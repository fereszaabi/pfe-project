<?php

namespace App\Http\Controllers;

use App\Models\SsoProvider;
use App\Models\SsoUser;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;

class SsoController extends Controller
{
    /**
     * Get available SSO providers
     */
    public function getProviders()
    {
        $providers = SsoProvider::where('enabled', true)->get();

        return response()->json($providers->map(fn($p) => [
            'id' => $p->id,
            'name' => $p->name,
            'type' => $p->type,
            'auth_url' => route('sso.redirect', ['provider' => $p->name]),
        ]));
    }

    /**
     * Get SSO provider configuration
     */
    public function showProvider(SsoProvider $provider)
    {
        $provider->load('ssoUsers');
        return response()->json($provider);
    }

    /**
     * Redirect to SSO provider
     */
    public function redirect(Request $request, string $provider)
    {
        $ssoProvider = SsoProvider::where('name', $provider)->firstOrFail();

        if (!$ssoProvider->isConfigured()) {
            return response()->json(['error' => "SSO provider {$provider} not configured"], 400);
        }

        // Generate state for CSRF protection
        $state = bin2hex(random_bytes(32));
        session(['oauth_state' => $state, 'oauth_provider' => $provider]);

        $authUrl = match ($provider) {
            'google' => $this->getGoogleAuthUrl($ssoProvider, $state),
            'github' => $this->getGithubAuthUrl($ssoProvider, $state),
            'microsoft' => $this->getMicrosoftAuthUrl($ssoProvider, $state),
            default => null,
        };

        if (!$authUrl) {
            return response()->json(['error' => "Invalid provider: {$provider}"], 400);
        }

        return response()->json(['redirect_url' => $authUrl]);
    }

    /**
     * Handle OAuth2 callback
     */
    public function callback(Request $request, string $provider)
    {
        // Verify state for CSRF protection
        $state = session('oauth_state');
        if (!$state || $state !== $request->state) {
            return response()->json(['error' => 'Invalid state parameter'], 401);
        }

        $ssoProvider = SsoProvider::where('name', $provider)->firstOrFail();

        // Exchange code for token
        $tokenResponse = match ($provider) {
            'google' => $this->getGoogleToken($ssoProvider, $request->code),
            'github' => $this->getGithubToken($ssoProvider, $request->code),
            'microsoft' => $this->getMicrosoftToken($ssoProvider, $request->code),
            default => null,
        };

        if (!$tokenResponse) {
            return response()->json(['error' => 'Failed to exchange code for token'], 400);
        }

        // Get user info from provider
        $userInfo = match ($provider) {
            'google' => $this->getGoogleUserInfo($tokenResponse['access_token']),
            'github' => $this->getGithubUserInfo($tokenResponse['access_token']),
            'microsoft' => $this->getMicrosoftUserInfo($tokenResponse['access_token']),
            default => null,
        };

        if (!$userInfo) {
            return response()->json(['error' => 'Failed to retrieve user information'], 400);
        }

        // Get or create user
        $user = SsoUser::linkOrCreateUser($ssoProvider, $userInfo);

        if (!$user) {
            return response()->json(['error' => 'Failed to create or link user'], 500);
        }

        // Create API token
        $token = $user->createToken('sso-' . $provider)->plainTextToken;

        // Clear session
        session()->forget(['oauth_state', 'oauth_provider']);

        return redirect()->to(config('app.frontend_url') . '?token=' . urlencode($token));
    }

    /**
     * Link existing user to SSO provider
     */
    public function linkProvider(Request $request)
    {
        $request->validate([
            'provider' => 'required|exists:sso_providers,name',
            'external_id' => 'required|string',
            'external_email' => 'required|email',
        ]);

        $ssoProvider = SsoProvider::where('name', $request->provider)->firstOrFail();
        
        // Check if already linked
        if (SsoUser::where('sso_provider_id', $ssoProvider->id)
                   ->where('external_id', $request->external_id)
                   ->exists()) {
            return response()->json(['error' => 'Already linked to this account'], 400);
        }

        SsoUser::create([
            'sso_provider_id' => $ssoProvider->id,
            'user_id' => $request->user()->id,
            'external_id' => $request->external_id,
            'external_email' => $request->external_email,
            'external_data' => [],
        ]);

        return response()->json(['message' => 'Provider linked successfully']);
    }

    /**
     * Unlink SSO provider
     */
    public function unlinkProvider(Request $request, string $provider)
    {
        $ssoProvider = SsoProvider::where('name', $provider)->firstOrFail();

        $request->user()->ssoAccounts()
            ->where('sso_provider_id', $ssoProvider->id)
            ->delete();

        return response()->json(['message' => 'Provider unlinked successfully']);
    }

    /**
     * Get user's SSO accounts
     */
    public function getLinkedAccounts()
    {
        $accounts = auth()->user()->ssoAccounts()
            ->with('provider')
            ->get();

        return response()->json($accounts->map(fn($account) => [
            'id' => $account->id,
            'provider' => $account->provider->name,
            'external_email' => $account->external_email,
            'linked_at' => $account->created_at,
        ]));
    }

    // OAuth2 Helper Methods

    private function getGoogleAuthUrl(SsoProvider $provider, string $state): string
    {
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $provider->client_id,
            'redirect_uri' => route('sso.callback', ['provider' => 'google']),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
        ]);
    }

    private function getGoogleToken(SsoProvider $provider, string $code): ?array
    {
        $response = \Illuminate\Support\Facades\Http::post('https://oauth2.googleapis.com/token', [
            'client_id' => $provider->client_id,
            'client_secret' => $provider->client_secret,
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => route('sso.callback', ['provider' => 'google']),
        ]);

        return $response->successful() ? $response->json() : null;
    }

    private function getGoogleUserInfo(string $accessToken): ?array
    {
        $response = \Illuminate\Support\Facades\Http::bearerToken($accessToken)
            ->get('https://www.googleapis.com/oauth2/v1/userinfo');

        return $response->successful() ? $response->json() : null;
    }

    private function getGithubAuthUrl(SsoProvider $provider, string $state): string
    {
        return 'https://github.com/login/oauth/authorize?' . http_build_query([
            'client_id' => $provider->client_id,
            'redirect_uri' => route('sso.callback', ['provider' => 'github']),
            'scope' => 'user:email',
            'state' => $state,
        ]);
    }

    private function getGithubToken(SsoProvider $provider, string $code): ?array
    {
        $response = \Illuminate\Support\Facades\Http::post('https://github.com/login/oauth/access_token', [
            'client_id' => $provider->client_id,
            'client_secret' => $provider->client_secret,
            'code' => $code,
        ])->withHeaders([
            'Accept' => 'application/json',
        ]);

        return $response->successful() ? $response->json() : null;
    }

    private function getGithubUserInfo(string $accessToken): ?array
    {
        $response = \Illuminate\Support\Facades\Http::bearerToken($accessToken)
            ->get('https://api.github.com/user');

        return $response->successful() ? $response->json() : null;
    }

    private function getMicrosoftAuthUrl(SsoProvider $provider, string $state): string
    {
        return 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' . http_build_query([
            'client_id' => $provider->client_id,
            'redirect_uri' => route('sso.callback', ['provider' => 'microsoft']),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
        ]);
    }

    private function getMicrosoftToken(SsoProvider $provider, string $code): ?array
    {
        $response = \Illuminate\Support\Facades\Http::post('https://login.microsoftonline.com/common/oauth2/v2.0/token', [
            'client_id' => $provider->client_id,
            'client_secret' => $provider->client_secret,
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => route('sso.callback', ['provider' => 'microsoft']),
        ]);

        return $response->successful() ? $response->json() : null;
    }

    private function getMicrosoftUserInfo(string $accessToken): ?array
    {
        $response = \Illuminate\Support\Facades\Http::bearerToken($accessToken)
            ->get('https://graph.microsoft.com/v1.0/me');

        return $response->successful() ? $response->json() : null;
    }
}
