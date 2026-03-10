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

    public function takeMoney(Request $request, Client $client)
    {
        $client->decrement('money', $request->amount);

        return response()->json($client->fresh());
    }
    
}
