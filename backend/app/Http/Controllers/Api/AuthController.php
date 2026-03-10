<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        // Determine login field based on input length
        if (strlen($request->identifier) == 8) {
            // Login by CIN (8 digits)
            $user = User::where('cin', $request->identifier)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                throw ValidationException::withMessages([
                    'cin' => ['Les identifiants sont incorrects.'],
                ]);
            }
        } else {
            // Login by code_fiscal
            $user = User::where('code_fiscal', $request->identifier)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                throw ValidationException::withMessages([
                    'code_fiscal' => ['Les identifiants sont incorrects.'],
                ]);
            }
        }

        $role = $user->role;
        if ($role == 'client' && $user->client_state == 'inactive') {
            throw ValidationException::withMessages([
                'client_state' => ['Votre compte est inactif.'],
            ]);
        }
        $token = $user->createToken($role . '-token')->plainTextToken;

        return response()->json([
            'message' => 'Connexion réussie',
            'role'    => $role,
            'user'    => $user,
            'token'   => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Déconnexion réussie',
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}