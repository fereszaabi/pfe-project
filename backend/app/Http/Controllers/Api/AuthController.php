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
        // Validate input format
        $request->validate([
            'identifier' => 'required|string',
            'password' => 'required|string',
        ]);

        $identifier = trim($request->identifier);
        
        // Determine if it's CIN (8 digits, starting with 0 or 1) or code_fiscal (4 digits + 3 letters + 4 digits)
        $isCIN = preg_match('/^[01]\d{7}$/', $identifier);
        $isCodeFiscal = preg_match('/^\d{4}[A-Z]{3}\d{4}$/', $identifier);

        if (!$isCIN && !$isCodeFiscal) {
            throw ValidationException::withMessages([
                'identifier' => ['Format invalide. CIN: 8 chiffres (0-1...). Code Fiscal: 4 chiffres, 3 lettres, 4 chiffres.'],
            ]);
        }

        // Determine login field based on format
        if ($isCIN) {
            // Login by CIN (8 digits)
            $user = User::where('cin', $identifier)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                throw ValidationException::withMessages([
                    'cin' => ['Les identifiants sont incorrects.'],
                ]);
            }
        } else {
            // Login by code_fiscal
            $user = User::where('code_fiscal', $identifier)->first();

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