<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class TicketAcceptanceOtp extends Model
{
    protected $table = 'ticket_acceptance_otps';

    protected $fillable = [
        'demande_id',
        'employee_id',
        'code',
        'recipient',
        'type',
        'verified',
        'expires_at',
        'verified_at',
        'attempts',
        'locked_until',
    ];

    protected $casts = [
        'verified' => 'boolean',
        'expires_at' => 'datetime',
        'verified_at' => 'datetime',
        'locked_until' => 'datetime',
    ];

    public function demande()
    {
        return $this->belongsTo(Demande::class, 'demande_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    /**
     * Generate a random 6-digit OTP code
     */
    public static function generateCode()
    {
        do {
            $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (self::where('code', $code)->where('verified', false)->where('expires_at', '>', now())->exists());

        return $code;
    }

    /**
     * Check if OTP is expired
     */
    public function isExpired()
    {
        return $this->expires_at && $this->expires_at < now();
    }

    /**
     * Check if OTP is locked due to too many attempts
     */
    public function isLocked()
    {
        return $this->locked_until && $this->locked_until > now();
    }

    /**
     * Increment attempts and lock if necessary
     */
    public function incrementAttempts()
    {
        $this->increment('attempts');
        if ($this->attempts >= 5) {
            $this->update(['locked_until' => now()->addMinutes(15)]);
        }
    }
}
