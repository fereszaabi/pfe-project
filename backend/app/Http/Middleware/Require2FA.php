<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use App\Mail\OtpMail;

class Require2FA
{
    /**
     * Handle an incoming request.
     * Triggers OTP email before sensitive ticket actions.
     */
    public function handle(Request $request, Closure $next)
    {
        $user = auth()->user();

        if (!$user) {
            return redirect()->route('login');
        }

        // Check if 2FA already verified for this session action
        $sessionKey = '2fa_verified_' . md5($request->url());

        if (!session($sessionKey)) {
            // Generate and cache OTP (10 minute expiry)
            $otp = rand(100000, 999999);
            $cacheKey = '2fa_otp_' . $user->id;
            Cache::put($cacheKey, $otp, now()->addMinutes(10));

            // Store the intended URL and method
            session([
                '2fa_intended_url'    => $request->fullUrl(),
                '2fa_intended_method' => $request->method(),
                '2fa_form_data'       => $request->except(['_token', '_method']),
                '2fa_session_key'     => $sessionKey,
            ]);

            // Send OTP email
            Mail::to($user->email)->send(new OtpMail($otp, $user->name));

            return redirect()->route('2fa.challenge')
                ->with('info', 'A verification code has been sent to ' . $user->email);
        }

        // Clear the session key after successful pass-through
        session()->forget($sessionKey);

        return $next($request);
    }
}