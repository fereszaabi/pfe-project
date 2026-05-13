<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Services\LocalOtpCodeStore;
use App\Models\User;
use App\Models\Client;
use App\Models\Machine;

class RegisterController extends Controller
{
    public function sendVerificationCode(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email|max:255',
        ]);

        $email = strtolower($request->email);
        $code = rand(100000, 999999);
        $cacheKey = 'register_email_code:' . $email;

        try {
            app(LocalOtpCodeStore::class)->record('register', $request->email, $code, [
                'cache_key' => $cacheKey,
            ]);

            Mail::to($request->email)->send(new \App\Mail\OtpMail($code, $request->email));

            if (count(Mail::failures()) > 0) {
                throw new \Exception('Mail transport reported failed recipients: ' . implode(', ', Mail::failures()));
            }

            Cache::put($cacheKey, $code, now()->addMinutes(10));

            return response()->json([
                'message' => 'A verification code has been sent to your email address.',
            ]);
        } catch (\Throwable $e) {
            Log::error('Register verification code send failed', [
                'email' => $request->email,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Unable to send verification code. Please check your email configuration and try again.',
            ], 500);
        }
    }

    public function register(Request $request)
    {
        $request->validate([
            'name'       => 'required|string|max:255',
            'email'      => 'required|string|email|max:255|unique:users',
            'cin'        => 'required|integer',
            'code_fiscal'=> 'required|string',
            'code_anydesk' => 'required|string|max:255',
            'password'   => 'required|string|min:8|confirmed',
            'prenom'     => 'required|string|max:255',
            'numero'     => 'required|string|max:20',
            'email_code' => 'required|digits:6',
        ]);

        $cacheKey = 'register_email_code:' . strtolower($request->email);
        $cachedCode = Cache::get($cacheKey);

        if (!$cachedCode || (string) $cachedCode !== (string) $request->email_code) {
            return response()->json([
                'message' => 'Invalid or expired email verification code.',
            ], 422);
        }

        Cache::forget($cacheKey);

        $result = DB::transaction(function () use ($request) {
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

            Machine::create([
                'id_client' => $client->id,
                'nom_poste' => $request->name . ' - Main AnyDesk',
                'code_anydesk' => $request->code_anydesk,
            ]);

            return [$user, $client];
        });

        [$user, $client] = $result;

        $token = $user->createToken('register-token')->plainTextToken;

        return response()->json([
            'message' => 'Compte créé avec succès !',
            'user'    => $user,
            'token'   => $token,
            'profile' => $client,
        ], 201);
    }
}
