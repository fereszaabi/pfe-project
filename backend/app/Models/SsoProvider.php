<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SsoProvider extends Model
{
    protected $fillable = [
        'name',
        'display_name',
        'enabled',
        'config',
        'client_id',
        'client_secret',
        'redirect_url',
        'authorize_url',
        'token_url',
        'user_info_url',
    ];

    protected $casts = [
        'config' => 'json',
        'enabled' => 'boolean',
    ];

    protected $hidden = ['client_secret'];

    /**
     * Get SSO users for this provider
     */
    public function ssoUsers()
    {
        return $this->hasMany(SsoUser::class);
    }

    /**
     * Check if provider is configured
     */
    public function isConfigured(): bool
    {
        return $this->enabled && 
               !empty($this->client_id) && 
               !empty($this->client_secret) &&
               !empty($this->authorize_url);
    }

    /**
     * Get provider by name
     */
    public static function findByName(string $name)
    {
        return self::where('name', $name)->first();
    }

    /**
     * Get enabled providers
     */
    public static function getEnabled()
    {
        return self::where('enabled', true)->get();
    }
}

class SsoUser extends Model
{
    protected $fillable = [
        'user_id',
        'sso_provider_id',
        'external_id',
        'email',
        'profile_data',
    ];

    protected $casts = [
        'profile_data' => 'json',
    ];

    /**
     * Get the user
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the SSO provider
     */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(SsoProvider::class, 'sso_provider_id');
    }

    /**
     * Find user by SSO credentials
     */
    public static function findByProvider(string $providerName, string $externalId)
    {
        return self::whereHas('provider', fn($q) => $q->where('name', $providerName))
            ->where('external_id', $externalId)
            ->first();
    }

    /**
     * Link or create user for SSO
     */
    public static function linkOrCreateUser(SsoProvider $provider, array $data)
    {
        // Check if SSO user exists
        $ssoUser = self::where('sso_provider_id', $provider->id)
            ->where('external_id', $data['id'])
            ->first();

        if ($ssoUser) {
            return $ssoUser->user;
        }

        // Check if user exists by email
        $user = User::where('email', $data['email'])->first();

        if (!$user) {
            // Create new user
            $user = User::create([
                'email' => $data['email'],
                'name' => $data['name'] ?? explode('@', $data['email'])[0],
                'password' => bcrypt(str()->random(32)),
                'role' => 'client',
            ]);
        }

        // Link SSO account
        self::create([
            'user_id' => $user->id,
            'sso_provider_id' => $provider->id,
            'external_id' => $data['id'],
            'email' => $data['email'],
            'profile_data' => $data,
        ]);

        return $user;
    }
}
