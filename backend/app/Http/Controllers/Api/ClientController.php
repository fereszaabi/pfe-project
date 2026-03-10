<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Demande;
use App\Models\Client;
use App\Models\Machine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

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

        $machine = Machine::where('id_client', $clientId)
            ->where('nom_poste', $request->nom_poste)
            ->first();

        if (!$machine) {
            throw ValidationException::withMessages([
                'nom_poste' => ['Machine introuvable pour ce client.'],
            ]);
        }

        $demande = Demande::create([
            'id_client'     => $clientId,
            'titre'         => $request->titre,
            'id_employee'   => null,
            'priority'      => $request->priority,
            'id_machine'    => $machine->id,
            'description'   => $request->description,
            'image'         => $imagePath,
            'status'        => 'open',
            'end_at'        => null,
            'employee_note' => null,
            'created_at'    => now(),
        ]);

        return response()->json($demande, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Demande $demande)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Demande $demande)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Demande $demande)
    {
        //
    }
}
