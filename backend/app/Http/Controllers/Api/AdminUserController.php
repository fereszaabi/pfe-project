<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Admin;
use App\Models\Employee;
use App\Models\Demande;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminUserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $demandes = Demande::with(['client', 'employee'])->orderBy('created_at', 'desc')->get();
        return response()->json($demandes);
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
        }

        return response()->json($user, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Demande $demande)
    {
        return $demande->load(['employee', 'client']);
    }

    public function stats()
    {
        return [
            'total'     => Demande::count(),
            'by_status' => Demande::groupBy('status')
                ->selectRaw('status, count(*) as count')
                ->pluck('count', 'status'),
        ];
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
        $demande->update([
            'status' => $request->status,
        ]);

        return response()->json($demande->fresh()->load('client'));
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
     */
    public function updateBalance(Request $request, Client $client)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric',
            'operation' => 'required|in:add,subtract,set',
        ]);

        $operation = $validated['operation'];
        $amount = abs($validated['amount']);

        if ($operation === 'add') {
            $client->increment('money', $amount);
        } elseif ($operation === 'subtract') {
            $client->decrement('money', $amount);
        } elseif ($operation === 'set') {
            $client->update(['money' => $amount]);
        }

        return response()->json([
            'message' => 'Balance updated successfully',
            'client' => $client->fresh()
        ]);
    }

    public function takeMoney(Request $request, Client $client)
    {
        $client->decrement('money', $request->amount);

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

    /**
     * Get all clients
     */
    public function getClients()
    {
        $clients = Client::orderBy('created_at', 'desc')->get();
        
        return response()->json(['clients' => $clients]);
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
    
}
