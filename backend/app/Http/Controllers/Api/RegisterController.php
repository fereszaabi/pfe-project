<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Client;

class RegisterController extends Controller
{
    public function register(Request $request)
    {
        $request->validate([
            'name'       => 'required|string|max:255',
            'email'      => 'required|string|email|max:255|unique:users',
            'cin'        => 'required|integer',
            'code_fiscal'=> 'required|string',
            'password'   => 'required|string|min:8|confirmed',
            'prenom'     => 'required|string|max:255',
            'numero'     => 'required|string|max:20',
        ]);

        $user = User::create([
            'name'       => $request->name,
            'email'      => $request->email,
            'password'   => Hash::make($request->password),
            'role'       => 'client',
            'cin'        => $request->cin,
            'code_fiscal'=> $request->code_fiscal,
        ]);

        $client = Client::create([
            'nom'          => $request->name,
            'mail'         => $request->email,
            'password'     => Hash::make($request->password),
            'cin'          => $request->cin,
            'code_fiscal'  => $request->code_fiscal,
            'prenom'       => $request->prenom,
            'numero'       => $request->numero,
            'money'        => 0,
            'client_state' => 'active',
        ]);

        $token = $user->createToken('register-token')->plainTextToken;

        return response()->json([
            'message' => 'Compte créé avec succès !',
            'user'    => $user,
            'token'   => $token,
        ], 201);
    }
}
