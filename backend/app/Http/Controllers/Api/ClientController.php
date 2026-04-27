<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Demande;
use App\Models\Client;
use App\Models\Machine;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ClientController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $clientId = $client->id;

        $demandes = Demande::where('id_client', $clientId)
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'employee_note',
                'client_rating',
                'rating_comment',
                'created_at',
                'image',
            ])
            ->latest('created_at')
            ->paginate(10);

        $counts = [
            'total'       => Demande::where('id_client', $clientId)->count(),
            'open'        => Demande::where('id_client', $clientId)->where('status', 'submitted')->count(),
            'closed'      => Demande::where('id_client', $clientId)->where('status', 'resolved')->count(),
            'in_progress' => Demande::where('id_client', $clientId)->where('status', 'in progress')->count(),
            'tech'        => Demande::where('id_client', $clientId)->where('status', 'tech')->count(),
            'money'       => Client::where('id', $clientId)->value('money'),
        ];

        return response()->json([
            'demandes' => $demandes,
            'counts'   => $counts,
        ]);
    }

    /**
     * Get client's registered machines
     */
    public function getMachines(Request $request)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $machines = Machine::where('id_client', $client->id)
            ->select(['id', 'code_anydesk', 'nom_poste', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['machines' => $machines]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $clientId = $client->id;

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('demandes', 'public');
        }

        // Handle machine selection or creation
        $machineId = null;
        
        if ($request->machine_id) {
            // Use existing machine
            $machine = Machine::find($request->machine_id);
            if (!$machine || $machine->id_client !== $clientId) {
                return response()->json(['error' => 'Invalid machine'], 422);
            }
            $machineId = $machine->id;
        } elseif ($request->code_anydesk) {
            // Create new machine with anydesk code
            $machine = Machine::create([
                'id_client' => $clientId,
                'code_anydesk' => $request->code_anydesk,
                'nom_poste' => $request->code_anydesk, // Use code as name
            ]);
            $machineId = $machine->id;
        } else {
            return response()->json(['error' => 'Machine ID or AnyDesk code required'], 422);
        }

        // Check if client has insufficient funds
        $hasInsufficientFunds = $client->money < 0;

        $demande = Demande::create([
            'id_client'             => $clientId,
            'titre'                 => $request->titre,
            'id_employee'           => null,
            'priority'              => $request->priority,
            'id_machine'            => $machineId,
            'description'           => $request->description,
            'image'                 => $imagePath,
            'status'                => 'submitted',
            'ticket_cost'           => 0,
            'total_cost'            => 0,
            'payment_status'        => 'pending',
            'end_at'                => null,
            'employee_note'         => null,
            'insufficient_funds'    => $hasInsufficientFunds,
            'created_at'            => now(),
        ]);

        return response()->json([
            'demande' => $demande,
            'client_balance' => $client->money,
            'insufficient_funds' => $hasInsufficientFunds,
            'warning' => $hasInsufficientFunds 
                ? 'Warning: Client has insufficient funds. Admin approval required to proceed.' 
                : null,
        ], 201);
        // If the client is in debt, create a simple Log entry for admins
        if ($hasInsufficientFunds) {
            try {
                \App\Models\Log::create([
                    'demande_id' => $demande->id,
                    'client_id' => $clientId,
                    'description' => 'Client created a ticket with insufficient funds: balance ' . $client->money,
                    'status' => 'insufficient_funds',
                    'created_at_demande' => now(),
                ]);
            } catch (\Throwable $e) {
                // swallow: logging failure should not affect client flow
            }
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Demande $ticket)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json(
            $ticket->load('machine', 'employee', 'client')
        );
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Demande $demande)
    {
        //
    }

    /**
     * Rate a completed ticket (client rating for employee)
     */
    public function rate(Request $request, Demande $ticket)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Validate rating
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'rating_comment' => 'nullable|string|max:1000',
        ]);

        // Only allow rating completed tickets
        if (!in_array($ticket->status, ['resolved', 'closed'], true)) {
            return response()->json([
                'message' => 'Can only rate completed/resolved tickets'
            ], 422);
        }

        // Prevent multiple ratings for the same ticket.
        if (!is_null($ticket->client_rating)) {
            return response()->json([
                'message' => 'This ticket has already been rated'
            ], 422);
        }

        // Update the ticket with client rating
        $ticket->update([
            'client_rating' => $request->rating,
            'rating_comment' => $request->input('rating_comment'),
        ]);

        // Recalculate employee performance if ticket is assigned
        if ($ticket->id_employee) {
            $employee = User::find($ticket->id_employee);
            if ($employee && method_exists($employee, 'recalculatePerformance')) {
                $employee->recalculatePerformance();
            }
        }

        return response()->json([
            'message' => 'Rating submitted successfully',
            'ticket' => $ticket->fresh()->load(['client', 'employee', 'machine']),
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Demande $ticket)
    {
        $clientId = $request->user()->id;

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $clientId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $ticket->delete();

        return response()->json(['message' => 'Ticket deleted successfully']);
    }
}
    /**
     * Get recent logs for authenticated client (used to sync balance changes)
     */
    public function getLogs(Request $request)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $logs = \App\Models\Log::where('client_id', $client->id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json(['logs' => $logs]);
    }

    /**
     * Mark a client log as read (notification consumed)
     */
    public function markLogRead(Request $request, $logId)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $log = \App\Models\Log::where('id', $logId)->where('client_id', $client->id)->first();
        if (!$log) {
            return response()->json(['error' => 'Log not found'], 404);
        }

        $log->update(['is_read' => true]);
        return response()->json(['message' => 'Marked as read', 'log' => $log]);
    }

    /**
     * Delete the image attached to a ticket. Clients can delete their own attachments; employees can delete attachments on tickets they handle.
     */
    public function deleteTicketImage(Request $request, Demande $ticket)
    {
        $user = $request->user();

        // Authorization: clients must own the ticket; employees must be assigned or have employee role
        if ($user->role === 'client') {
            $client = Client::where('cin', $user->cin)->first();
            if (!$client || $ticket->id_client !== $client->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        } elseif ($user->role === 'employee') {
            // allow employees to delete attachments on tickets they are assigned to or generally
            // if strict: check assignment: if ($ticket->id_employee && $ticket->id_employee != $user->id) return 403;
        } else {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $original = $ticket->getOriginal('image');
        if (!$original) {
            return response()->json(['message' => 'No image to delete'], 200);
        }

        try {
            if (\Illuminate\Support\Facades\Storage::disk('public')->exists($original)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($original);
            }

            $ticket->update(['image' => null]);
            return response()->json(['message' => 'Image deleted', 'ticket' => $ticket->fresh()]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to delete image: ' . $e->getMessage()], 500);
        }
    }
