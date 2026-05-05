<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CommunicationChannel extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'enabled',
        'config',
        'description',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'config' => 'json',
    ];

    /**
     * Get all addresses for this channel
     */
    public function addresses()
    {
        return $this->hasMany(ChannelAddress::class, 'channel', 'name');
    }

    /**
     * Get webhooks for this channel
     */
    public function webhooks()
    {
        return $this->hasMany(ChannelWebhook::class, 'channel', 'name');
    }

    /**
     * Get configuration for this channel
     */
    public function getConfig($key = null)
    {
        if (!$this->config) {
            return $key ? null : [];
        }

        if ($key) {
            return $this->config[$key] ?? null;
        }

        return $this->config;
    }

    /**
     * Check if channel is properly configured
     */
    public function isConfigured(): bool
    {
        if (!$this->enabled) {
            return false;
        }

        $requiredFields = match ($this->name) {
            'email' => ['smtp_host', 'smtp_port', 'smtp_from'],
            'whatsapp' => ['api_key', 'phone_number_id'],
            'sms' => ['api_key', 'api_url'],
            default => [],
        };

        foreach ($requiredFields as $field) {
            if (!$this->getConfig($field)) {
                return false;
            }
        }

        return true;
    }
}
