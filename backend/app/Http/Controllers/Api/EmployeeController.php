<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Demande;

class EmployeeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $demandes = Demande::where('id_employee', $request->user()->id)
            ->with('client')
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'employee_note',
                'created_at',
                'image',
                'id_client',
            ])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        $newDemandes = Demande::whereNull('id_employee')
            ->with('client')
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'employee_note',
                'created_at',
                'image',
                'id_client',
            ])
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json([
            'demandes'     => $demandes,
            'new_demandes' => $newDemandes,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function assign(Request $request, Demande $demande)
    {
        $demande->update([
            'id_employee' => $request->user()->id,
        ]);
        return response()->json($demande->fresh()->load('client'));
    }

    public function update(Request $request, Demande $demande)
    {
        $demande->update([
            'status' => $request->status,
        ]);

        return response()->json($demande->fresh()->load('client'));
    }

    public function stats(Request $request)
    {
        return response()->json([
            'total_open'       => Demande::where('status', 'open')->where('id_employee', $request->user()->id)->count(),
            'total_processing' => Demande::where('status', 'processing')->where('id_employee', $request->user()->id)->count(),
            'total_closed'     => Demande::where('status', 'closed')->where('id_employee', $request->user()->id)->count(),
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
