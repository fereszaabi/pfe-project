<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Admin;
use App\Models\Employee;
use App\Models\Demande;
use App\Models\Client;
use App\Models\Conversation;
use App\Models\Message;
use App\Events\TicketUpdated;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use App\Services\LocalOtpCodeStore;

class AdminUserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $validated = request()->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:120',
            'status' => 'nullable|string|max:50',
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $status = $validated['status'] ?? null;

        $query = Demande::with(['client', 'employee', 'machine'])
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        if ($search !== '') {
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
        }

        $demandes = $query->paginate($perPage);

        return response()->json([
            'ok' => true,
            'data' => $demandes->items(),
            'pagination' => [
                'current_page' => $demandes->currentPage(),
                'total_pages' => $demandes->lastPage(),
                'total_tickets' => $demandes->total(),
            ],
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $role = $request->role;

        $user = User::create([
            'name'       => $request->name,
            'email'      => $request->email,
            'cin'        => $request->cin,
            'code_fiscal'=> $request->code_fiscal,
            'role'       => $role,
            'password'   => Hash::make($request->password),
        ]);

        if ($role == 'admin') {
            Admin::create([
                'nom'      => $request->name,
                'mail'     => $request->email,
                'cin'      => $request->cin,
                'password' => Hash::make($request->password),
            ]);
        } elseif ($role == 'employee') {
            Employee::create([
                'nom'      => $request->name,
                'mail'     => $request->email,
                'cin'      => $request->cin,
                'password' => Hash::make($request->password),
            ]);
        } elseif ($role == 'client') {
            $nameParts = preg_split('/\s+/', trim((string) $request->name), 2);
            $nom = $nameParts[0] ?? $request->name;
            $prenom = $nameParts[1] ?? $nom;

            $client = Client::create([
                'nom' => $nom,
                'prenom' => $request->prenom ?? $prenom,
                'mail' => $request->email,
                'cin' => $request->cin,
                'code_fiscal' => $request->code_fiscal,
                'numero' => $request->numero ?? '00000000',
                'password' => Hash::make($request->password),
                'money' => 0,
                'client_state' => 'active',
            ]);

            try {
                $otpCode = random_int(100000, 999999);
                app(LocalOtpCodeStore::class)->record('client', $request->email, $otpCode, [
                    'client_id' => $client->id,
                    'client_name' => trim($client->nom . ' ' . $client->prenom),
                    'cache_key' => 'client_creation:' . $client->id,
                ]);
            } catch (\Throwable $e) {
                // Keep client creation successful even if OTP logging fails.
            }
        }

        return response()->json($user, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Demande $demande)
    {
        return response()->json([
            'ok' => true,
            'demande' => $demande->load(['employee', 'client', 'machine']),
        ]);
    }

    public function stats()
    {
        $payload = Cache::remember('admin:stats', now()->addSeconds(45), function () {
            return [
                'total'     => Demande::count(),
                'by_status' => Demande::groupBy('status')
                    ->selectRaw('status, count(*) as count')
                    ->pluck('count', 'status'),
            ];
        });

        return response()->json(['ok' => true] + $payload);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Client $client)
    {
        $client->update(['client_state' => $request->client_state]);
        return response()->json($client);
    }

    public function update_statu(Request $request, Demande $demande)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:submitted,in progress,resolved,closed,escalated,tech',
        ]);

        $normalizedStatus = $validated['status'] === 'tech' ? 'escalated' : $validated['status'];

        $demande->update([
            'status' => $normalizedStatus,
        ]);

        if (in_array($normalizedStatus, ['resolved', 'closed'], true) && !$demande->completed_at) {
            $demande->update([
                'completed_at' => Carbon::now(),
            ]);

            if ($demande->assigned_at) {
                $hours = $demande->completed_at->diffInMinutes($demande->assigned_at) / 60;
                $demande->update(['resolution_hours' => round($hours, 2)]);
            }

            if ($demande->id_employee) {
                $employee = Employee::find($demande->id_employee);
                if ($employee) {
                    $employee->decrement('current_workload');
                    $employee->update(['last_ticket_completed' => Carbon::now()]);
                    $employee->recalculatePerformance();
                }
            }
        }

        $updatedTicket = $demande->fresh()->load(['client', 'employee', 'machine']);
        broadcast(new TicketUpdated($updatedTicket))->toOthers();

        return response()->json([
            'ok' => true,
            'demande' => $updatedTicket,
        ]);
    }

    public function assignTicket(Request $request, Demande $demande)
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
        ]);

        $employee = Employee::findOrFail($validated['employee_id']);
        $previousEmployeeId = $demande->id_employee;

        DB::transaction(function () use ($demande, $employee, $previousEmployeeId) {
            if ($previousEmployeeId && (int) $previousEmployeeId !== (int) $employee->id) {
                $previousEmployee = Employee::find($previousEmployeeId);
                if ($previousEmployee && $previousEmployee->current_workload > 0) {
                    $previousEmployee->decrement('current_workload');
                }
            }

            if ((int) $previousEmployeeId !== (int) $employee->id) {
                $employee->increment('current_workload');
            }

            $demande->update([
                'id_employee' => $employee->id,
                'assigned_at' => Carbon::now(),
                'status' => 'assigned',
            ]);
        });

        $updatedTicket = $demande->fresh()->load(['client', 'employee', 'machine']);
        broadcast(new TicketUpdated($updatedTicket))->toOthers();

        return response()->json([
            'ok' => true,
            'demande' => $updatedTicket,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user)
    {

        if ($user->role === 'employee') {
            Employee::where('cin', $user->cin)->delete();
        } elseif ($user->role === 'client') {
            Client::where('cin', $user->cin)
                ->orWhere('code_fiscal', $user->code_fiscal)
                ->delete();
        }
        $user->delete();
        return response()->json(['message' => 'Utilisateur supprimé avec succès']);
    }

    /**
     * Update client balance (add or subtract)
     * When setting to positive, automatically deduct any outstanding debt
     */
    public function updateBalance(Request $request, Client $client)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric',
            'operation' => 'required|in:add,subtract,set',
        ]);

        $operation = $validated['operation'];
        $amount = abs($validated['amount']);
        $previousBalance = (float) $client->money;

        if ($operation === 'add') {
            $client->increment('money', $amount);
        } elseif ($operation === 'subtract') {
            $client->decrement('money', $amount);
        } elseif ($operation === 'set') {
            // If setting to a positive amount, deduct any outstanding debt first
            if ($amount > 0 && $previousBalance < 0) {
                $debt = abs($previousBalance); // Get the absolute debt amount
                $balanceAfterDebt = $amount - $debt;
                $client->update(['money' => $balanceAfterDebt]);
            } else {
                $client->update(['money' => $amount]);
            }
        }

        $newBalance = (float) $client->fresh()->money;

        try {
            \App\Models\Log::create([
                'client_id' => $client->id,
                'description' => sprintf(
                    'Admin updated your balance via %s by %.2f TND. New balance: %.2f TND',
                    $operation,
                    $amount,
                    $newBalance
                ),
                'status' => 'balance_change',
                'created_at_demande' => now(),
            ]);
        } catch (\Throwable $e) {
            // Keep the balance update even if notification logging fails.
        }

        return response()->json([
            'message' => 'Balance updated successfully',
            'client' => $client->fresh(),
        ]);
    }

    public function takeMoney(Request $request, Client $client)
    {
        $client->decrement('money', $request->amount);

        try {
            \App\Models\Log::create([
                'client_id' => $client->id,
                'description' => 'Admin removed ' . abs((float) $request->amount) . ' TND from your balance. New balance: ' . (float) $client->fresh()->money,
                'status' => 'balance_change',
                'created_at_demande' => now(),
            ]);
        } catch (\Throwable $e) {
            // Ignore notification logging failures.
        }

        return response()->json($client->fresh());
    }

    // ─────────────────────────────────────────────────────────────────
    // Employee Management
    // ─────────────────────────────────────────────────────────────────

    /**
     * Get all employees
     */
    public function getEmployees()
    {
        $employees = Employee::orderBy('created_at', 'desc')->get();
        
        return response()->json(['employees' => $employees]);
    }

    public function getLocalOtpCodes(Request $request)
    {
        $limit = (int) $request->integer('limit', 20);

        // Get local OTP codes
        $localOtpCodes = app(LocalOtpCodeStore::class)->latest($limit);

        // Get ticket acceptance OTPs from database
        $ticketOtps = \App\Models\TicketAcceptanceOtp::with(['employee', 'demande'])
            ->where('expires_at', '>', now())
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($otp) {
                return [
                    'code' => $otp->code,
                    'recipient' => $otp->recipient,
                    'type' => 'emp', // Employee ticket acceptance
                    'created_at' => $otp->created_at,
                    'expires_at' => $otp->expires_at,
                    'cache_key' => "ticket_acceptance_otp_{$otp->id}",
                    'employee_name' => $otp->employee?->name ?? $otp->employee?->nom ?? 'Unknown',
                    'ticket_id' => $otp->demande_id,
                    'verified' => $otp->verified,
                ];
            })
            ->toArray();

        // Merge both arrays and sort by created_at descending
        $allCodes = array_merge($localOtpCodes, $ticketOtps);
        usort($allCodes, function ($a, $b) {
            $dateA = strtotime($a['created_at'] ?? 0);
            $dateB = strtotime($b['created_at'] ?? 0);
            return $dateB - $dateA;
        });

        // Limit to requested amount
        $allCodes = array_slice($allCodes, 0, $limit);

        return response()->json([
            'ok' => true,
            'codes' => $allCodes,
        ]);
    }

    /**
     * Get all clients
     */
    public function getClients()
    {
        $validated = request()->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:120',
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);
        $search = trim((string) ($validated['search'] ?? ''));

        $query = Client::orderBy('created_at', 'desc');

        if ($search !== '') {
            $query->where(function ($nested) use ($search) {
                $nested->where('nom', 'like', "%{$search}%")
                    ->orWhere('prenom', 'like', "%{$search}%")
                    ->orWhere('mail', 'like', "%{$search}%")
                    ->orWhere('cin', 'like', "%{$search}%")
                    ->orWhere('code_fiscal', 'like', "%{$search}%");
            });
        }

        $clients = $query->paginate($perPage);

        return response()->json([
            'ok' => true,
            'clients' => $clients->items(),
            'pagination' => [
                'current_page' => $clients->currentPage(),
                'total_pages' => $clients->lastPage(),
                'total_clients' => $clients->total(),
            ],
        ]);
    }

    /**
     * Create a new employee
     */
    public function storeEmployee(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'cin' => 'required|string|unique:users,cin',
            'password' => 'required|string|min:6',
        ]);

        // Split name into first and last name
        $nameParts = explode(' ', $validated['name'], 2);
        $nom = $nameParts[0];
        $prenom = $nameParts[1] ?? $nameParts[0];

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'cin' => $validated['cin'],
            'role' => 'employee',
            'password' => Hash::make($validated['password']),
        ]);

        Employee::create([
            'nom' => $nom,
            'prenom' => $prenom,
            'mail' => $validated['email'],
            'cin' => $validated['cin'],
            'password' => Hash::make($validated['password']),
        ]);

        return response()->json([
            'message' => 'Employé créé avec succès',
            'employee' => $user
        ], 201);
    }

    /**
     * Update employee credentials
     */
    public function updateEmployee(Request $request, $employeeId)
    {
        $employee = Employee::find($employeeId);
        
        if (!$employee) {
            return response()->json(['message' => 'Employé non trouvé'], 404);
        }

        // Find the user by CIN
        $user = User::where('cin', $employee->cin)->first();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . ($user?->id ?? null),
            'cin' => 'sometimes|string|unique:users,cin,' . ($user?->id ?? null),
            'password' => 'sometimes|string|min:6',
        ]);

        // Update User
        if ($user) {
            $updateData = [];
            if (isset($validated['name'])) $updateData['name'] = $validated['name'];
            if (isset($validated['email'])) $updateData['email'] = $validated['email'];
            if (isset($validated['cin'])) $updateData['cin'] = $validated['cin'];
            if (isset($validated['password'])) $updateData['password'] = Hash::make($validated['password']);
            
            $user->update($updateData);
        }

        // Update Employee
        $employeeUpdateData = [];
        if (isset($validated['name'])) {
            $nameParts = explode(' ', $validated['name'], 2);
            $employeeUpdateData['nom'] = $nameParts[0];
            $employeeUpdateData['prenom'] = $nameParts[1] ?? $nameParts[0];
        }
        if (isset($validated['email'])) $employeeUpdateData['mail'] = $validated['email'];
        if (isset($validated['cin'])) $employeeUpdateData['cin'] = $validated['cin'];
        if (isset($validated['password'])) $employeeUpdateData['password'] = Hash::make($validated['password']);
        
        $employee->update($employeeUpdateData);

        return response()->json([
            'message' => 'Employé mis à jour avec succès',
            'employee' => $employee->fresh()
        ]);
    }

    /**
     * Delete an employee
     */
    public function destroyEmployee($employeeId)
    {
        $employee = Employee::find($employeeId);
        
        if (!$employee) {
            return response()->json(['message' => 'Employé non trouvé'], 404);
        }

        // Delete from User table
        User::where('cin', $employee->cin)->delete();
        
        // Delete from Employee table
        $employee->delete();

        return response()->json(['message' => 'Employé supprimé avec succès']);
    }

    /**
     * Get detailed performance stats for a specific employee
     */
    public function getEmployeeStats($employeeId)
    {
        $employee = Employee::find($employeeId);

        if (!$employee) {
            return response()->json(['message' => 'Employee not found'], 404);
        }

        // Find matching User record for display name
        $userRecord = \App\Models\User::where('cin', $employee->cin)
            ->orWhere('email', $employee->mail)
            ->first();

        $fallbackName = trim(($employee->nom ?? '') . ' ' . ($employee->prenom ?? ''));

        // All tickets assigned to this employee
        $allTickets = Demande::where('id_employee', $employee->id)
            ->with(['client', 'machine'])
            ->orderBy('created_at', 'desc')
            ->get();

        $completedTickets = $allTickets->whereIn('status', ['resolved', 'closed']);
        $activeTickets = $allTickets->whereNotIn('status', ['resolved', 'closed']);

        $ticketsCompleted = $completedTickets->count();
        $ticketsActive = $activeTickets->count();
        $ticketsTotal = $allTickets->count();

        // Average rating
        $ratedTickets = $completedTickets->whereNotNull('client_rating');
        $avgRating = $ratedTickets->count() > 0
            ? round($ratedTickets->avg('client_rating'), 2)
            : 0;

        // Average resolution time
        $resolvedWithTime = $completedTickets->whereNotNull('resolution_hours');
        $avgResolutionHours = $resolvedWithTime->count() > 0
            ? round($resolvedWithTime->avg('resolution_hours'), 2)
            : 0;

        // Rating distribution (1-5 stars)
        $ratingDistribution = [];
        for ($i = 1; $i <= 5; $i++) {
            $ratingDistribution[$i] = $ratedTickets->where('client_rating', $i)->count();
        }

        // Status breakdown
        $statusBreakdown = $allTickets->groupBy('status')->map->count();

        // Priority breakdown
        $priorityBreakdown = $allTickets->groupBy('priority')->map->count();

        // Monthly trend (last 6 months)
        $monthlyTrend = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $monthKey = $month->format('Y-m');
            $monthLabel = $month->format('M Y');

            $monthTickets = $allTickets->filter(function ($t) use ($monthKey) {
                return $t->created_at && $t->created_at->format('Y-m') === $monthKey;
            });

            $monthCompleted = $monthTickets->whereIn('status', ['resolved', 'closed']);

            $monthlyTrend[] = [
                'month' => $monthLabel,
                'assigned' => $monthTickets->count(),
                'completed' => $monthCompleted->count(),
            ];
        }

        // Recent tickets (last 10)
        $recentTickets = $allTickets->take(10)->map(function ($t) {
            return [
                'id' => $t->id,
                'titre' => $t->titre,
                'description' => $t->description ? substr($t->description, 0, 80) : null,
                'status' => $t->status,
                'priority' => $t->priority,
                'client_name' => $t->client->nom ?? 'Unknown',
                'client_rating' => $t->client_rating,
                'resolution_hours' => $t->resolution_hours,
                'created_at' => $t->created_at,
                'completed_at' => $t->completed_at,
            ];
        })->values();

        // Satisfaction rate (tickets rated >= 4)
        $satisfactionRate = $ratedTickets->count() > 0
            ? round($ratedTickets->where('client_rating', '>=', 4)->count() / $ratedTickets->count() * 100, 1)
            : 0;

        return response()->json([
            'ok' => true,
            'employee' => [
                'id' => $employee->id,
                'name' => $userRecord?->name ?? ($fallbackName !== '' ? $fallbackName : 'Employee #' . $employee->id),
                'email' => $userRecord?->email ?? $employee->mail,
                'cin' => $employee->cin,
                'joined_at' => $employee->created_at,
            ],
            'stats' => [
                'tickets_total' => $ticketsTotal,
                'tickets_completed' => $ticketsCompleted,
                'tickets_active' => $ticketsActive,
                'avg_rating' => $avgRating,
                'avg_resolution_hours' => $avgResolutionHours,
                'satisfaction_rate' => $satisfactionRate,
                'total_ratings' => $ratedTickets->count(),
            ],
            'rating_distribution' => $ratingDistribution,
            'status_breakdown' => $statusBreakdown,
            'priority_breakdown' => $priorityBreakdown,
            'monthly_trend' => $monthlyTrend,
            'recent_tickets' => $recentTickets,
        ]);
    }

    /**
     * Get all tickets with insufficient funds that need admin approval
     */
    public function getInsufficientFundsTickets()
    {
        $tickets = Demande::where('insufficient_funds', true)
            ->where('admin_approved_override', false)
            ->with(['client', 'employee', 'machine'])
            ->orderBy('created_at', 'desc')
            ->get();

        $summary = [
            'pending_count' => $tickets->count(),
            'total_amount_needed' => $tickets->sum(function ($ticket) {
                $cost = abs($ticket->client->money); // Amount needed to bring balance to 0
                return max(0, $cost);
            }),
        ];

        return response()->json([
            'ok' => true,
            'tickets' => $tickets,
            'summary' => $summary,
        ]);
    }

    /**
     * Set ticket cost and update client balance
     */
    public function setTicketCost(Request $request, $ticketId)
    {
        $validated = $request->validate([
            'ticket_cost' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $ticket = Demande::find($ticketId);
        
        if (!$ticket) {
            return response()->json(['error' => 'Ticket not found'], 404);
        }

        $client = Client::find($ticket->id_client);

        // Apply cost and update client balance atomically
        \DB::beginTransaction();
        try {
            // Deduct the cost from client (charge immediately)
            $newBalance = $client->money - $validated['ticket_cost'];
            $client->update(['money' => $newBalance]);

            // Set the cost on the ticket and mark payment pending
            $ticket->update([
                'ticket_cost' => $validated['ticket_cost'],
                'total_cost' => $validated['ticket_cost'],
                'payment_notes' => $validated['notes'] ?? $ticket->payment_notes,
                'payment_status' => 'pending',
            ]);

            \DB::commit();

            // Create an audit Log for the client so their UI can sync
            try {
                \App\Models\Log::create([
                    'demande_id' => $ticket->id,
                    'client_id' => $client->id,
                    'description' => 'Client charged ' . $validated['ticket_cost'] . ' TND. New balance: ' . $newBalance,
                    'status' => 'balance_change',
                    'created_at_demande' => now(),
                ]);
            } catch (\Throwable $e) {
                // don't fail the main operation if log creation fails
            }

            return response()->json([
                'message' => 'Ticket cost set and client charged successfully',
                'ticket' => $ticket->fresh()->load(['client', 'employee', 'machine']),
                'client_balance' => $newBalance,
            ]);
        } catch (\Throwable $e) {
            \DB::rollBack();
            return response()->json(['error' => 'Failed to set cost and charge client: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Approve a ticket with insufficient funds and allow negative balance
     */
    public function approveInsufficientFundsTicket(Request $request, $ticketId)
    {
        $validated = $request->validate([
            'ticket_cost' => 'required|numeric|min:0',
            'admin_notes' => 'nullable|string',
        ]);

        $ticket = Demande::find($ticketId);
        
        if (!$ticket) {
            return response()->json(['error' => 'Ticket not found'], 404);
        }

        $client = Client::find($ticket->id_client);

        // Deduct the cost from client balance (will go negative if needed)
        $newBalance = $client->money - $validated['ticket_cost'];
        $client->update(['money' => $newBalance]);

        // Mark ticket as approved despite insufficient funds
        $ticket->update([
            'ticket_cost' => $validated['ticket_cost'],
            'total_cost' => $validated['ticket_cost'],
            'payment_status' => 'pending',
            'payment_notes' => $validated['admin_notes'] ?? 'Admin approved despite insufficient funds',
            'admin_approved_override' => true,
        ]);

        // Create an audit Log entry so client is notified of balance change
        try {
            \App\Models\Log::create([
                'demande_id' => $ticket->id,
                'client_id' => $client->id,
                'description' => 'Admin approved ticket and charged ' . $validated['ticket_cost'] . ' TND. New balance: ' . $newBalance,
                'status' => 'balance_change',
                'created_at_demande' => now(),
            ]);
        } catch (\Throwable $e) {
            // ignore logging failures
        }

        return response()->json([
            'message' => 'Ticket approved. Balance may now be negative.',
            'ticket' => $ticket->fresh()->load(['client', 'employee', 'machine']),
            'client_balance' => $newBalance,
            'balance_warning' => $newBalance < 0 ? 'Client balance is now negative: ' . $newBalance . ' TND' : null,
        ]);
    }

    /**
     * Process payment for a ticket
     */
    public function processTicketPayment(Request $request, $ticketId)
    {
        $ticket = Demande::find($ticketId);
        
        if (!$ticket) {
            return response()->json(['error' => 'Ticket not found'], 404);
        }

        $client = Client::find($ticket->id_client);

        // Mark as paid
        $ticket->update([
            'payment_status' => 'paid',
            'paid_at' => now(),
        ]);

        return response()->json([
            'message' => 'Payment processed successfully',
            'ticket' => $ticket->fresh(),
            'client_balance' => $client->money,
        ]);
    }
    
    /**
     * Block a ticket and mark all client's tickets as blocked. Also mark client state as blocked.
     */
    public function blockTicket(Request $request, $ticketId)
    {
        $ticket = Demande::find($ticketId);
        if (!$ticket) {
            return response()->json(['error' => 'Ticket not found'], 404);
        }

        DB::transaction(function () use ($ticket) {
            $clientId = $ticket->id_client;
            Demande::where('id_client', $clientId)->update(['blocked' => true]);
            Client::where('id', $clientId)->update(['client_state' => 'blocked']);

            // Broadcast updates for all affected tickets so frontends refresh
            $affected = Demande::where('id_client', $clientId)->get();
            foreach ($affected as $t) {
                broadcast(new TicketUpdated($t->fresh()->load(['client', 'employee', 'machine'])))->toOthers();
            }
        });

        return response()->json(['ok' => true, 'message' => 'Client tickets blocked']);
    }

    /**
     * Unblock a ticket. If no other blocked tickets remain for client, restore client_state to active.
     */
    public function unblockTicket(Request $request, $ticketId)
    {
        $ticket = Demande::find($ticketId);
        if (!$ticket) {
            return response()->json(['error' => 'Ticket not found'], 404);
        }

        DB::transaction(function () use ($ticket) {
            $clientId = $ticket->id_client;
            Demande::where('id', $ticket->id)->update(['blocked' => false]);

            // If no other blocked tickets remain for the client, set client_state back to active
            $remaining = Demande::where('id_client', $clientId)->where('blocked', true)->count();
            if ($remaining === 0) {
                Client::where('id', $clientId)->update(['client_state' => 'active']);
            }

            // Broadcast update for the unblocked ticket
            $updated = Demande::find($ticket->id);
            broadcast(new TicketUpdated($updated->fresh()->load(['client', 'employee', 'machine'])))->toOthers();
        });

        return response()->json(['ok' => true, 'message' => 'Ticket unblocked']);
    }

    /**
     * Notify an employee that a ticket has been assigned to them
     */
    public function notifyEmployeeAssignment(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'ticket_id' => 'required|integer|exists:demandes,id',
            'ticket_title' => 'required|string|max:255',
        ]);

        $employee = Employee::find($validated['employee_id']);
        $ticket = Demande::with(['client'])->find($validated['ticket_id']);

        if (!$employee || !$ticket) {
            return response()->json(['error' => 'Employee or ticket not found'], 404);
        }

        $clientName = $ticket->client?->nom ?? 'Unknown Client';
        $message = "New ticket assigned: {$validated['ticket_title']} from {$clientName}";

        // Create a notification/message for the employee
        try {
            // Send a system message to the employee
            \App\Models\Message::create([
                'id_sender' => null, // System message
                'sender_type' => 'system',
                'id_receiver' => $employee->id,
                'receiver_type' => 'employee',
                'ticket_id' => $ticket->id,
                'message' => $message,
                'message_type' => 'notification',
            ]);

            return response()->json([
                'ok' => true,
                'message' => 'Employee notified of ticket assignment',
            ]);
        } catch (\Exception $e) {
            // Log the error but don't fail the assignment
            \Log::warning('Failed to notify employee of assignment: ' . $e->getMessage());
            return response()->json([
                'ok' => true,
                'message' => 'Assignment completed (notification failed)',
            ]);
        }
    }

    /**
     * Notify an employee that a ticket has been reassigned to them
     */
    public function notifyEmployeeReassignment(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'ticket_id' => 'required|integer|exists:demandes,id',
            'ticket_title' => 'required|string|max:255',
            'previous_employee_id' => 'nullable|integer|exists:employees,id',
        ]);

        $employee = Employee::find($validated['employee_id']);
        $ticket = Demande::with(['client'])->find($validated['ticket_id']);
        $previousEmployee = $validated['previous_employee_id'] 
            ? Employee::find($validated['previous_employee_id']) 
            : null;

        if (!$employee || !$ticket) {
            return response()->json(['error' => 'Employee or ticket not found'], 404);
        }

        $clientName = $ticket->client?->nom ?? 'Unknown Client';
        $previousName = $previousEmployee ? "from {$previousEmployee->nom}" : '';
        $message = "Ticket reassigned to you: {$validated['ticket_title']} from {$clientName} {$previousName}";

        try {
            // Send a system message to the new employee
            \App\Models\Message::create([
                'id_sender' => null, // System message
                'sender_type' => 'system',
                'id_receiver' => $employee->id,
                'receiver_type' => 'employee',
                'ticket_id' => $ticket->id,
                'message' => $message,
                'message_type' => 'notification',
            ]);

            // Optionally notify the previous employee that they've been removed
            if ($previousEmployee) {
                \App\Models\Message::create([
                    'id_sender' => null, // System message
                    'sender_type' => 'system',
                    'id_receiver' => $previousEmployee->id,
                    'receiver_type' => 'employee',
                    'ticket_id' => $ticket->id,
                    'message' => "Ticket reassigned: {$validated['ticket_title']} has been reassigned from you to {$employee->nom}",
                    'message_type' => 'notification',
                ]);
            }

            return response()->json([
                'ok' => true,
                'message' => 'Employee notified of ticket reassignment',
            ]);
        } catch (\Exception $e) {
            // Log the error but don't fail the assignment
            \Log::warning('Failed to notify employee of reassignment: ' . $e->getMessage());
            return response()->json([
                'ok' => true,
                'message' => 'Reassignment completed (notification failed)',
            ]);
        }
    }
    
        /**
         * Delete a ticket
         */
        public function deleteTicket(Request $request, $ticketId)
        {
            $ticket = Demande::find($ticketId);

            if (!$ticket) {
                return response()->json(['error' => 'Ticket not found'], 404);
            }

            try {
                DB::transaction(function () use ($ticket) {
                    // Delete related messages
                    \App\Models\Message::where('ticket_id', $ticket->id)->delete();

                    // Delete related logs
                    \App\Models\Log::where('demande_id', $ticket->id)->delete();

                    // Delete the ticket
                    $ticket->delete();

                    // Broadcast the deletion event using the ticket snapshot before removal
                    broadcast(new TicketUpdated($ticket))->toOthers();
                });

                return response()->json([
                    'ok' => true,
                    'message' => 'Ticket deleted successfully',
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'error' => 'Failed to delete ticket: ' . $e->getMessage(),
                ], 500);
            }
        }
}
