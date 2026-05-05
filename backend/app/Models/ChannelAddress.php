<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ChannelAddress extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'channel',
        'address',
        'verified',
        'verified_at',
    ];

    protected $casts = [
        'verified' => 'boolean',
        'verified_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the client this address belongs to
     */
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * Mark this address as verified
     */
    public function markAsVerified()
    {
        $this->update([
            'verified' => true,
            'verified_at' => Carbon::now(),
        ]);
        return $this;
    }

    /**
     * Generate a verification code
     */
    public static function generateVerificationCode(): string
    {
        return strtoupper(substr(str_shuffle('0123456789ABCDEF'), 0, 6));
    }

    /**
     * Find address by channel and external identifier
     */
    public static function findByChannelAndAddress(string $channel, string $address)
    {
        return self::where('channel', $channel)
            ->where('address', $address)
            ->first();
    }

    /**
     * Get or create address for a channel
     */
    public static function findOrCreateForClient(int $clientId, string $channel, string $address)
    {
        return self::firstOrCreate(
            [
                'client_id' => $clientId,
                'channel' => $channel,
                'address' => $address,
            ],
            [
                'verified' => false,
            ]
        );
    }
}
