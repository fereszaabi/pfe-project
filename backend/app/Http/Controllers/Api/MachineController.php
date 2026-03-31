<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Machine;
use App\Models\Client;
use Illuminate\Http\Request;

class MachineController extends Controller
{
    /**
     * Get all machines for the authenticated client
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $machines = Machine::where('id_client', $client->id)
            ->select(['id', 'nom_poste', 'code_anydesk', 'created_at', 'updated_at'])
            ->get();

        return response()->json($machines);
    }

    /**
     * Store a newly created machine
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nom_poste' => 'required|string|max:255',
            'code_anydesk' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $machine = Machine::create([
            'id_client' => $client->id,
            'nom_poste' => $validated['nom_poste'],
            'code_anydesk' => $validated['code_anydesk'],
        ]);

        return response()->json($machine, 201);
    }

    /**
     * Update the specified machine
     */
    public function update(Request $request, Machine $machine)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the machine belongs to the authenticated client
        if ($machine->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'nom_poste' => 'sometimes|string|max:255',
            'code_anydesk' => 'nullable|string|max:255',
        ]);

        $machine->update($validated);

        return response()->json($machine);
    }

    /**
     * Delete the specified machine
     */
    public function destroy(Request $request, Machine $machine)
    {
        $user = $request->user();
        $client = Client::where('cin', $user->cin)->first();

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the machine belongs to the authenticated client
        if ($machine->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $machine->delete();

        return response()->json(['message' => 'Machine deleted successfully']);
    }
}
