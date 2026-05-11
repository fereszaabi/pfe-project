<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use App\Models\User;
use App\Mail\OtpMail;

class AuthController extends Controller
{
    public function captchaChallenge()
    {
        $code = Str::upper(Str::random(6));
        $token = Str::random(40);

        Cache::put('captcha:' . $token, $code, now()->addMinutes(10));

        $width = 180;
        $height = 50;
        $image = imagecreatetruecolor($width, $height);
        $background = imagecolorallocate($image, 245, 247, 250);
        $textColor = imagecolorallocate($image, 44, 62, 80);
        $noiseColor = imagecolorallocate($image, 180, 190, 200);

        imagefilledrectangle($image, 0, 0, $width, $height, $background);

        for ($i = 0; $i < 6; $i++) {
            imageline(
                $image,
                random_int(0, $width),
                random_int(0, $height),
                random_int(0, $width),
                random_int(0, $height),
                $noiseColor
            );
        }

        for ($i = 0; $i < 120; $i++) {
            imagesetpixel(
                $image,
                random_int(0, $width - 1),
                random_int(0, $height - 1),
                $noiseColor
            );
        }

        $font = 5;
        $charWidth = imagefontwidth($font);
        $charHeight = imagefontheight($font);
        $startX = 14;
        $gap = 22;
        for ($i = 0; $i < strlen($code); $i++) {
            $x = $startX + ($i * $gap) + random_int(-2, 2);
            $y = ($height - $charHeight) / 2 + random_int(-6, 6);
            imagestring($image, $font, $x, (int) $y, $code[$i], $textColor);
        }

        ob_start();
        imagepng($image);
        $pngData = ob_get_clean();
        imagedestroy($image);

        $dataUrl = 'data:image/png;base64,' . base64_encode($pngData);

        return response()->json([
            'token' => $token,
            'image' => $dataUrl,
        ]);
    }

    public function verifyCaptcha(Request $request)
    {
        $request->validate([
            'captcha_token' => 'required|string',
            'captcha_answer' => 'required|string',
        ]);

        $normalized = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $request->captcha_answer));
        if (strlen($normalized) !== 6) {
            return response()->json([
                'ok' => false,
                'message' => 'Invalid format.',
            ], 422);
        }

        $expected = Cache::get('captcha:' . $request->captcha_token);
        if (!$expected) {
            return response()->json([
                'ok' => false,
                'message' => 'Verification expired. Please refresh and try again.',
            ], 410);
        }

        $valid = $normalized === (string) $expected;

        return response()->json([
            'ok' => $valid,
        ], $valid ? 200 : 422);
    }

    public function login(Request $request)
    {
        $normalizedCaptcha = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $request->captcha_answer));
        $request->merge(['captcha_answer' => $normalizedCaptcha]);

        // Validate input format
        $request->validate([
            'identifier' => 'required|string',
            'password' => 'required|string',
            'captcha_token' => 'required|string',
            'captcha_answer' => 'required|string|size:6|regex:/^[A-Za-z0-9]+$/',
        ]);

        $captchaKey = 'captcha:' . $request->captcha_token;
        $expected = Cache::get($captchaKey);
        $provided = strtoupper((string) $request->captcha_answer);

        if (!$expected) {
            throw ValidationException::withMessages([
                'captcha' => ['Verification expired. Please refresh and try again.'],
            ]);
        }

        if ($provided !== (string) $expected) {
            throw ValidationException::withMessages([
                'captcha' => ['Incorrect verification answer.'],
            ]);
        }

        Cache::forget($captchaKey);

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

        $otp = (string) random_int(100000, 999999);
        Cache::put('login_otp:' . $user->id, $otp, now()->addMinutes(10));
        $loginToken = Str::random(40);
        Cache::put('login_token:' . $loginToken, $user->id, now()->addMinutes(10));

        Mail::to($user->email)->send(new OtpMail($otp, $user->name));

        return response()->json([
            'message' => 'Verification required',
            'two_factor_required' => true,
            'login_token' => $loginToken,
        ], 202);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'login_token' => 'required|string',
            'otp' => 'required|digits:6',
        ]);

        $userId = Cache::get('login_token:' . $request->login_token);
        if (!$userId) {
            throw ValidationException::withMessages([
                'otp' => ['Verification session expired. Please log in again.'],
            ]);
        }

        $expected = Cache::get('login_otp:' . $userId);
        if (!$expected || (string) $expected !== (string) $request->otp) {
            throw ValidationException::withMessages([
                'otp' => ['Invalid verification code.'],
            ]);
        }

        Cache::forget('login_otp:' . $userId);
        Cache::forget('login_token:' . $request->login_token);

        $user = User::find($userId);
        if (!$user) {
            throw ValidationException::withMessages([
                'otp' => ['User not found.'],
            ]);
        }

        $role = $user->role;
        $token = $user->createToken($role . '-token')->plainTextToken;

        return response()->json([
            'message' => 'Connexion réussie',
            'role' => $role,
            'user' => $user,
            'token' => $token,
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