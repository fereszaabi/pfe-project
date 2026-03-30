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
        $clientId = $request->user()->id;

        $demandes = Demande::where('id_client', $clientId)
            ->select([
                'id',
                'status',
                'description',
                'priority',
                'employee_note',
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
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $clientId = $request->user()->id;

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('demandes', 'public');
        }

        // Try to find existing machine, or create it if it doesn't exist
        $machine = Machine::firstOrCreate(
            [
                'id_client' => $clientId,
                'nom_poste' => $request->nom_poste,
            ],
            [
                'code_anydesk' => null, // Will be added later by admin/client
            ]
        );

        $demande = Demande::create([
            'id_client'     => $clientId,
            'titre'         => $request->titre,
            'id_employee'   => null,
            'priority'      => $request->priority,
            'id_machine'    => $machine->id,
            'description'   => $request->description,
            'image'         => $imagePath,
            'status'        => 'submitted',
            'end_at'        => null,
            'employee_note' => null,
            'created_at'    => now(),
        ]);

        return response()->json($demande, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Demande $ticket)
    {
        $clientId = $request->user()->id;

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $clientId) {
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
        $clientId = $request->user()->id;

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $clientId) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Validate rating
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
        ]);

        // Only allow rating resolved tickets
        if ($ticket->status !== 'resolved') {
            return response()->json([
                'message' => 'Can only rate completed/resolved tickets'
            ], 422);
        }

        // Update the ticket with client rating
        $ticket->update([
            'client_rating' => $request->rating,
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
