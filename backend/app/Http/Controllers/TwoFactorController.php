<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class TwoFactorController extends Controller
{
    /**
     * Show the 2FA OTP challenge form.
     */
    public function showChallenge()
    {
        if (!auth()->check()) {
            return redirect()->route('login');
        }

        return view('2fa.challenge');
    }

    /**
     * Verify the submitted OTP code.
     */
    public function verifyChallenge(Request $request)
    {
        $request->validate([
            'otp' => 'required|digits:6',
        ]);

        $user     = auth()->user();
        $cacheKey = '2fa_otp_' . $user->id;
        $stored   = Cache::get($cacheKey);

        if (!$stored || (string) $stored !== (string) $request->otp) {
            return back()->withErrors([
                'otp' => 'Invalid or expired code. Please request a new one.',
            ]);
        }

        // Clear OTP from cache
        Cache::forget($cacheKey);

        // Mark this action as 2FA-verified
        $sessionKey = session('2fa_session_key');
        if ($sessionKey) {
            session([$sessionKey => true]);
        }

        // Replay the original request
        $intendedUrl    = session('2fa_intended_url', route('dashboard'));
        $intendedMethod = strtolower(session('2fa_intended_method', 'get'));
        $formData       = session('2fa_form_data', []);

        // Clear session data
        session()->forget([
            '2fa_intended_url',
            '2fa_intended_method',
            '2fa_form_data',
            '2fa_session_key',
        ]);

        if ($intendedMethod === 'get') {
            return redirect($intendedUrl);
        }

        // For POST/PUT requests, redirect back to the page with data
        // The user will resubmit — the middleware will now pass through
        return redirect($intendedUrl)
            ->with('2fa_passed', true)
            ->with('2fa_form_data', $formData);
    }

    /**
     * Resend OTP to the authenticated user.
     */
    public function resendOtp()
    {
        $user = auth()->user();

        if (!$user) {
            return redirect()->route('login');
        }

        $otp      = rand(100000, 999999);
        $cacheKey = '2fa_otp_' . $user->id;
        Cache::put($cacheKey, $otp, now()->addMinutes(10));

        \Mail::to($user->email)->send(new \App\Mail\OtpMail($otp, $user->name));

        return back()->with('info', 'A new code has been sent to ' . $user->email);
    }
}