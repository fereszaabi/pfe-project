<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class VerifyCaptcha
{
    /**
     * Verifies Cloudflare Turnstile token on login.
     */
    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethod('post')) {
            $token = $request->input('cf-turnstile-response');

            if (!$token) {
                return back()->withErrors([
                    'captcha' => 'Please complete the CAPTCHA verification.',
                ])->withInput();
            }

            $response = Http::asForm()->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                'secret'   => config('services.turnstile.secret'),
                'response' => $token,
                'remoteip' => $request->ip(),
            ]);

            $result = $response->json();

            if (!($result['success'] ?? false)) {
                return back()->withErrors([
                    'captcha' => 'CAPTCHA verification failed. Please try again.',
                ])->withInput();
            }
        }

        return $next($request);
    }
}