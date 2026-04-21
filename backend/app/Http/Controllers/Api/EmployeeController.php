<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Demande;
use App\Models\User;
use Carbon\Carbon;

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
        $allDemandes = Demande::with(['client', 'employee', 'machine'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        // Get employee's assigned tickets - use the correct employee ID
        $myDemandes = $employeeId 
            ? Demande::where('id_employee', $employeeId)
                ->whereNotNull('assigned_at')
                ->with(['client', 'employee', 'machine'])
                ->orderBy('assigned_at', 'desc')
                ->paginate(10)
            : [];

        // Get unassigned tickets for quick claiming
        $unassignedDemandes = Demande::whereNull('id_employee')
            ->with(['client', 'machine'])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        // Get all claimed tickets (assigned to any employee)
        $claimedDemandes = Demande::whereNotNull('id_employee')
            ->with(['client', 'employee', 'machine'])
            ->orderBy('assigned_at', 'desc')
            ->paginate(15);

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
     * Claim/Assign a ticket to self
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
        if ($user instanceof \App\Models\Employee) {
            $employeeId = $user->id;
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

        $demande->update([
            'id_employee' => $employeeId,
            'assigned_at' => Carbon::now(),
            'status' => 'in progress', // automatically set to in progress when claimed
        ]);

        // Update employee workload
        $employee = \App\Models\Employee::find($employeeId);
        if ($employee) {
            $employee->increment('current_workload');
        }

        return response()->json([
            'message' => 'Ticket claimed successfully',
            'data' => $demande->fresh()->load(['client', 'employee', 'machine']),
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

        return response()->json($demande->fresh()->load(['client', 'machine']));
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

        $currentUserId = $request->user()->id;

        // If ticket is currently unassigned and employee wants to update status,
        // automatically assign it to them
        if ($demande->id_employee === null && in_array($normalizedStatus, ['in progress', 'resolved', 'closed'])) {
            $demande->update([
                'id_employee' => $currentUserId,
                'assigned_at' => Carbon::now(),
            ]);
            
            // Update employee workload
            $employee = User::find($currentUserId);
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
                $employee = User::find($demande->id_employee);
                if ($employee) {
                    $employee->decrement('current_workload');
                    $employee->update(['last_ticket_completed' => Carbon::now()]);
                    $employee->recalculatePerformance();
                }
            }
        }

        return response()->json($demande->fresh()->load(['client', 'employee', 'machine']));
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
        return response()->json($demande->load(['client', 'employee', 'machine']));
    }

    /**
     * Get employee performance stats
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        $employeeActorId = $this->resolveEmployeeActorId($user);

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

        return response()->json([
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
        ]);
    }

    /**
     * Get leaderboard of top performers
     */
    public function leaderboard(Request $request)
    {
        $limit = max(1, (int) $request->get('limit', 10));

        $employees = \App\Models\Employee::all();

        $leaderboard = $employees->map(function ($employee) {
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

        return response()->json(['leaderboard' => $leaderboard]);
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
