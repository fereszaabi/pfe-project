<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Demande;
use App\Models\User;
use Carbon\Carbon;
use App\Events\TicketUpdated;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class EmployeeController extends Controller
{
    /**
     * Resolve the employee actor id used in demandes.id_employee.
     */
    private function resolveEmployeeActorId($user)
    {
        if ($user instanceof \App\Models\Employee) {
            return $user->id;
        }

        $employee = \App\Models\Employee::where('cin', $user->cin ?? null)
            ->orWhere('mail', $user->email ?? null)
            ->first();

        if ($employee) {
            return $employee->id;
        }

        return $user->id;
    }

    /**
     * Display all tickets (assigned + unassigned) with ticket details
     * All employees and admin can see all tickets
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:120',
            'status' => 'nullable|string|max:50',
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $status = $validated['status'] ?? null;
        
        // Get the employee ID from the current user
        $employeeId = null;
        if ($user instanceof \App\Models\Employee) {
            $employeeId = $user->id;
        } else {
            // If user is authenticated via users table, find the corresponding Employee record
            $employee = \App\Models\Employee::where('email', $user->email)
                ->orWhere('cin', $user->cin ?? null)
                ->first();
            if ($employee) {
                $employeeId = $employee->id;
            }
        }

        // Get all tickets with employee and client info
        $allDemandesQuery = Demande::with(['client', 'employee', 'machine'])
            ->orderBy('created_at', 'desc');

        if ($status) {
            $allDemandesQuery->where('status', $status);
        }

        if ($search !== '') {
            $allDemandesQuery->where(function ($query) use ($search) {
                $query->where('titre', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhereHas('client', function ($clientQuery) use ($search) {
                        $clientQuery->where('nom', 'like', "%{$search}%")
                            ->orWhere('prenom', 'like', "%{$search}%")
                            ->orWhere('mail', 'like', "%{$search}%");
                    });
            });
        }

        $allDemandes = $allDemandesQuery->paginate($perPage);

        // Get employee's assigned tickets - use the correct employee ID
        $myDemandes = $employeeId
            ? Demande::where('id_employee', $employeeId)
                ->whereNotNull('assigned_at')
                ->with(['client', 'employee', 'machine'])
                ->when($status, fn ($query) => $query->where('status', $status))
                ->when($search !== '', function ($query) use ($search) {
                    $query->where(function ($nested) use ($search) {
                        $nested->where('titre', 'like', "%{$search}%")
                            ->orWhere('description', 'like', "%{$search}%")
                            ->orWhere('status', 'like', "%{$search}%")
                            ->orWhereHas('client', function ($clientQuery) use ($search) {
                                $clientQuery->where('nom', 'like', "%{$search}%")
                                    ->orWhere('prenom', 'like', "%{$search}%")
                                    ->orWhere('mail', 'like', "%{$search}%");
                            });
                    });
                })
                ->orderBy('assigned_at', 'desc')
                ->paginate($perPage)
            : [];

        // Get unassigned tickets for quick claiming
        $unassignedDemandes = Demande::whereNull('id_employee')
            ->with(['client', 'machine'])
            ->when($status, fn ($query) => $query->where('status', $status))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $nested->where('titre', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('client', function ($clientQuery) use ($search) {
                            $clientQuery->where('nom', 'like', "%{$search}%")
                                ->orWhere('prenom', 'like', "%{$search}%")
                                ->orWhere('mail', 'like', "%{$search}%");
                        });
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        // Get all claimed tickets (assigned to any employee)
        $claimedDemandes = Demande::whereNotNull('id_employee')
            ->with(['client', 'employee', 'machine'])
            ->when($status, fn ($query) => $query->where('status', $status))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $nested->where('titre', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('client', function ($clientQuery) use ($search) {
                            $clientQuery->where('nom', 'like', "%{$search}%")
                                ->orWhere('prenom', 'like', "%{$search}%")
                                ->orWhere('mail', 'like', "%{$search}%");
                        });
                });
            })
            ->orderBy('assigned_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'all_tickets' => $allDemandes,
            'my_tickets' => $myDemandes,
            'claimed_tickets' => $claimedDemandes,
            'unassigned_tickets' => $unassignedDemandes,
        ]);
    }

    /**
     * Dedicated IT endpoint: escalated queue + onsite queue for employee/admin views.
     */
    public function itTickets(Request $request)
    {
        $role = $request->user()->role;

        if (!in_array($role, ['employee', 'admin'], true)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $allTickets = Demande::with(['client', 'employee', 'machine'])
            ->orderBy('created_at', 'desc')
            ->get();

        $escalatedTickets = $allTickets
            ->filter(fn ($ticket) => in_array($ticket->status, ['escalated', 'tech'], true))
            ->values();

        $onsiteTickets = $allTickets
            ->filter(fn ($ticket) => !in_array($ticket->status, ['resolved', 'escalated', 'tech'], true))
            ->values();

        return response()->json([
            'all_tickets' => $allTickets,
            'escalated_tickets' => $escalatedTickets,
            'onsite_tickets' => $onsiteTickets,
            'counts' => [
                'all' => $allTickets->count(),
                'escalated' => $escalatedTickets->count(),
                'onsite' => $onsiteTickets->count(),
            ],
        ]);
    }

    /**
     * Request to claim/assign a ticket to self - generates OTP for verification
     */
    public function claim(Request $request, Demande $demande)
    {
        // Can only claim unassigned tickets
        if ($demande->id_employee !== null) {
            return response()->json([
                'message' => 'This ticket is already assigned to ' . $demande->employee->name,
            ], 422);
        }

        // Get the current employee - they might be authenticated as User or Employee
        $user = $request->user();
        
        // If user is not directly an Employee, find the Employee record
        $employeeId = null;
        $employee = null;
        
        if ($user instanceof \App\Models\Employee) {
            $employeeId = $user->id;
            $employee = $user;
        } else {
            // Search for employee by email, cin, or name
            $employee = \App\Models\Employee::where('email', $user->email)
                ->orWhere('cin', $user->cin)
                ->first();
            
            if (!$employee) {
                return response()->json([
                    'message' => 'Employee record not found for current user',
                ], 404);
            }
            $employeeId = $employee->id;
        }

        // Generate OTP for ticket acceptance
        $otp = \App\Models\TicketAcceptanceOtp::create([
            'demande_id' => $demande->id,
            'employee_id' => $employeeId,
            'code' => \App\Models\TicketAcceptanceOtp::generateCode(),
            'recipient' => $employee->email ?? $user->email,
            'type' => 'emp',
            'expires_at' => Carbon::now()->addMinutes(10),
        ]);

        // Store OTP in cache for admin viewing
        \Cache::put("ticket_acceptance_otp_{$otp->id}", [
            'code' => $otp->code,
            'employee' => $employee->name ?? $employee->nom ?? 'Employee',
            'ticket_id' => $demande->id,
            'recipient' => $otp->recipient,
            'type' => 'emp',
            'expires_at' => $otp->expires_at,
            'created_at' => $otp->created_at,
            'cache_key' => "ticket_acceptance_otp_{$otp->id}",
        ], 10 * 60);

        return response()->json([
            'message' => 'OTP sent to admin. Please enter OTP to confirm ticket acceptance.',
            'otp_id' => $otp->id,
            'requires_otp' => true,
            'otp_expires_in' => 600, // 10 minutes in seconds
        ], 200);
    }

    /**
     * Verify OTP and complete ticket claim
     */
    public function verifyClaimOtp(Request $request, Demande $demande)
    {
        $validated = $request->validate([
            'otp_id' => 'required|integer|exists:ticket_acceptance_otps,id',
            'code' => 'required|string|size:6',
        ]);

        // Can only claim unassigned tickets
        if ($demande->id_employee !== null) {
            return response()->json([
                'message' => 'This ticket is already assigned to ' . $demande->employee->name,
            ], 422);
        }

        $otp = \App\Models\TicketAcceptanceOtp::find($validated['otp_id']);

        // Verify OTP belongs to this ticket
        if ($otp->demande_id !== $demande->id) {
            return response()->json([
                'message' => 'OTP does not match this ticket',
            ], 422);
        }

        // Get the current employee
        $user = $request->user();
        $employeeId = null;
        $employee = null;
        
        if ($user instanceof \App\Models\Employee) {
            $employeeId = $user->id;
            $employee = $user;
        } else {
            $employee = \App\Models\Employee::where('email', $user->email)
                ->orWhere('cin', $user->cin)
                ->first();
            if (!$employee) {
                return response()->json(['message' => 'Employee record not found'], 404);
            }
            $employeeId = $employee->id;
        }

        // Verify employee matches
        if ($otp->employee_id !== $employeeId) {
            return response()->json([
                'message' => 'This OTP was not generated for your claim request',
            ], 403);
        }

        // Check if OTP is locked
        if ($otp->isLocked()) {
            return response()->json([
                'message' => 'Too many incorrect attempts. Please try again later.',
            ], 429);
        }

        // Check if OTP is expired
        if ($otp->isExpired()) {
            return response()->json([
                'message' => 'OTP has expired. Please request a new one.',
            ], 422);
        }

        // Check if already verified
        if ($otp->verified) {
            return response()->json([
                'message' => 'This OTP has already been used.',
            ], 422);
        }

        // Verify OTP code
        if ($otp->code !== trim($validated['code'])) {
            $otp->incrementAttempts();
            return response()->json([
                'message' => 'Incorrect OTP code. Please try again.',
                'attempts_remaining' => max(0, 5 - $otp->attempts),
            ], 422);
        }

        // OTP verified successfully - complete the ticket claim
        $otp->update([
            'verified' => true,
            'verified_at' => Carbon::now(),
        ]);

        // Assign ticket to employee
        $demande->update([
            'id_employee' => $employeeId,
            'assigned_at' => Carbon::now(),
            'status' => 'in progress',
        ]);

        // Update employee workload
        $employee->increment('current_workload');

        // Load relationships and broadcast update
        $updatedTicket = $demande->fresh()->load(['client', 'employee', 'machine']);
        $this->safeBroadcast(new TicketUpdated($updatedTicket));

        return response()->json([
            'message' => 'Ticket claimed successfully',
            'data' => $updatedTicket,
        ], 200);
    }

    /**
     * Unclaim a ticket (release it back to unassigned)
     */
    public function unclaim(Request $request, Demande $demande)
    {
        // Get the current employee
        $user = $request->user();
        $employeeId = null;
        
        if ($user instanceof \App\Models\Employee) {
            $employeeId = $user->id;
        } else {
            $employee = \App\Models\Employee::where('email', $user->email)
                ->orWhere('cin', $user->cin)
                ->first();
            
            if (!$employee) {
                return response()->json([
                    'message' => 'Employee record not found',
                ], 404);
            }
            $employeeId = $employee->id;
        }

        // Only the assigned employee can unclaim
        if ($demande->id_employee !== $employeeId) {
            return response()->json([
                'message' => 'You can only unclaim your own tickets',
            ], 403);
        }

        $demande->update([
            'id_employee' => null,
            'assigned_at' => null,
            'status' => 'submitted', // return to submitted status
        ]);

        // Update employee workload
        $employee = \App\Models\Employee::find($employeeId);
        if ($employee) {
            $employee->decrement('current_workload');
        }

        // Load relationships and broadcast update
        $updatedTicket = $demande->fresh()->load(['client', 'employee', 'machine']);
        $this->safeBroadcast(new TicketUpdated($updatedTicket));

        return response()->json($updatedTicket);
    }

    /**
     * Update ticket status - any employee can update any ticket
     */
    public function update(Request $request, Demande $demande)
    {
        $request->validate([
            'status' => 'required|string|in:submitted,in progress,resolved,closed,escalated,tech',
            'employee_note' => 'nullable|string',
        ]);

        $normalizedStatus = $request->status === 'tech' ? 'escalated' : $request->status;

        $employee = $request->user() instanceof \App\Models\Employee
            ? $request->user()
            : \App\Models\Employee::where('cin', $request->user()->cin ?? null)
                ->orWhere('mail', $request->user()->email ?? null)
                ->first();

        if (!$employee) {
            return response()->json([
                'message' => 'Employee record not found for current user',
            ], 404);
        }

        // If ticket is currently unassigned and employee wants to update status,
        // automatically assign it to them
        if ($demande->id_employee === null && in_array($normalizedStatus, ['in progress', 'resolved', 'closed'])) {
            $demande->update([
                'id_employee' => $employee->id,
                'assigned_at' => Carbon::now(),
            ]);
            
            // Update employee workload
            $employee->increment('current_workload');
        }

        $demande->update([
            'status' => $normalizedStatus,
            'employee_note' => $request->employee_note ?? $demande->employee_note,
        ]);

        // Handle completion
        if (in_array($normalizedStatus, ['resolved', 'closed']) && !$demande->completed_at) {
            $demande->update([
                'completed_at' => Carbon::now(),
            ]);

            // Calculate resolution time
            if ($demande->assigned_at) {
                $hours = $demande->completed_at->diffInMinutes($demande->assigned_at) / 60;
                $demande->update(['resolution_hours' => round($hours, 2)]);
            }

            // Update the assigned employee's performance
            if ($demande->id_employee) {
                $assignedEmployee = \App\Models\Employee::find($demande->id_employee);
                if ($assignedEmployee) {
                    $assignedEmployee->decrement('current_workload');
                    $assignedEmployee->update(['last_ticket_completed' => Carbon::now()]);
                    $assignedEmployee->recalculatePerformance();
                }
            }
        }

        $updatedTicket = $demande->fresh()->load(['client', 'employee', 'machine']);
        $this->safeBroadcast(new TicketUpdated($updatedTicket));

        return response()->json($updatedTicket);
    }

    /**
     * Safely broadcast an event without letting broadcast failures break the request.
     */
    private function safeBroadcast($event)
    {
        try {
            broadcast($event)->toOthers();
        } catch (\Exception $e) {
            Log::warning('Broadcast failed: ' . $e->getMessage(), ['exception' => $e]);
        }
    }

    /**
     * Add client rating for a completed ticket
     */
    public function rate(Request $request, Demande $demande)
    {
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'rating_comment' => 'nullable|string|max:1000',
        ]);

        if (!in_array($demande->status, ['resolved', 'closed'])) {
            return response()->json([
                'message' => 'Can only rate completed tickets',
            ], 422);
        }

        if (!is_null($demande->client_rating)) {
            return response()->json([
                'message' => 'This ticket has already been rated',
            ], 422);
        }

        $demande->update([
            'client_rating' => $request->rating,
            'rating_comment' => $request->input('rating_comment'),
        ]);

        // Recalculate employee performance
        if ($demande->id_employee) {
            User::find($demande->id_employee)->recalculatePerformance();
        }

        return response()->json($demande->fresh()->load(['client', 'employee', 'machine']));
    }

    /**
     * Show detailed view of a single ticket
     */
    public function show(Request $request, Demande $demande)
    {
        return response()->json([
            'ok' => true,
            'demande' => $demande->load(['client', 'employee', 'machine']),
        ]);
    }

    /**
     * Get employee performance stats
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        $employeeActorId = $this->resolveEmployeeActorId($user);
        $cacheKey = 'employee:stats:' . $employeeActorId;

        $payload = Cache::remember($cacheKey, now()->addSeconds(45), function () use ($employeeActorId, $user) {
            $completedQuery = Demande::where('id_employee', $employeeActorId)
                ->whereIn('status', ['resolved', 'closed']);

            $ticketsCompleted = (clone $completedQuery)->count();
            $avgRating = (float) ((clone $completedQuery)
                ->whereNotNull('client_rating')
                ->avg('client_rating') ?? 0);
            $avgResolutionHours = (float) ((clone $completedQuery)
                ->whereNotNull('resolution_hours')
                ->avg('resolution_hours') ?? 0);

            $currentWorkload = Demande::where('id_employee', $employeeActorId)
                ->whereNotIn('status', ['resolved', 'closed'])
                ->count();

            $lastTicketCompleted = (clone $completedQuery)->max('completed_at');

            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'tickets_completed' => (int) $ticketsCompleted,
                'avg_rating' => round($avgRating, 2),
                'avg_resolution_hours' => round($avgResolutionHours, 2),
                'current_workload' => (int) $currentWorkload,
                'total_earnings' => 0,
                'performance_status' => 'active',
                'last_ticket_completed' => $lastTicketCompleted,
            ];
        });

        return response()->json(['ok' => true] + $payload);
    }

    /**
     * Get leaderboard of top performers
     */
    public function leaderboard(Request $request)
    {
        $validated = $request->validate([
            'limit' => 'nullable|integer|min:1|max:50',
        ]);

        $limit = (int) ($validated['limit'] ?? 10);
        $cacheKey = 'employee:leaderboard:' . $limit;

        $leaderboard = Cache::remember($cacheKey, now()->addSeconds(45), function () use ($limit) {
            $employees = \App\Models\Employee::all();

            return $employees->map(function ($employee) {
                $completedQuery = Demande::where('id_employee', $employee->id)
                    ->whereIn('status', ['resolved', 'closed']);

                $ticketsCompleted = (clone $completedQuery)->count();
                $avgRating = (float) ((clone $completedQuery)
                    ->whereNotNull('client_rating')
                    ->avg('client_rating') ?? 0);
                $avgResolutionHours = (float) ((clone $completedQuery)
                    ->whereNotNull('resolution_hours')
                    ->avg('resolution_hours') ?? 0);
                $currentWorkload = Demande::where('id_employee', $employee->id)
                    ->whereNotIn('status', ['resolved', 'closed'])
                    ->count();

                $userRecord = User::where('cin', $employee->cin)
                    ->orWhere('email', $employee->mail)
                    ->first();

                $fallbackName = trim(($employee->nom ?? '') . ' ' . ($employee->prenom ?? ''));

                return [
                    'id' => $userRecord?->id ?? $employee->id,
                    'name' => $userRecord?->name ?? ($fallbackName !== '' ? $fallbackName : 'Employee #' . $employee->id),
                    'email' => $userRecord?->email ?? $employee->mail,
                    'tickets_completed' => (int) $ticketsCompleted,
                    'avg_rating' => round($avgRating, 2),
                    'avg_resolution_hours' => round($avgResolutionHours, 2),
                    'current_workload' => (int) $currentWorkload,
                    'total_earnings' => (float) ($userRecord?->total_earnings ?? 0),
                ];
            })
                ->sort(function ($a, $b) {
                    if ($a['avg_rating'] === $b['avg_rating']) {
                        return $b['tickets_completed'] <=> $a['tickets_completed'];
                    }

                    return $b['avg_rating'] <=> $a['avg_rating'];
                })
                ->take($limit)
                ->values();
        });

        return response()->json([
            'ok' => true,
            'leaderboard' => $leaderboard,
        ]);
    }

    /**
     * Store is not used
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Destroy is not used
     */
    public function destroy(string $id)
    {
        //
    }
}
