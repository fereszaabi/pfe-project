<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ChannelWebhook extends Model
{
    use HasFactory;

    const UPDATED_AT = null;

    protected $fillable = [
        'channel',
        'event_type',
        'message_id',
        'payload',
        'processed',
        'processing_status',
        'error_message',
        'processed_at',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'json',
        'processed' => 'boolean',
        'created_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    /**
     * Get the message this webhook relates to
     */
    public function message()
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * Mark webhook as successfully processed
     */
    public function markAsProcessed(int $messageId = null)
    {
        $this->update([
            'message_id' => $messageId,
            'processed' => true,
            'processing_status' => 'success',
            'processed_at' => Carbon::now(),
            'error_message' => null,
        ]);
        return $this;
    }

    /**
     * Mark webhook as failed
     */
    public function markAsFailed(string $errorMessage)
    {
        $this->update([
            'processed' => true,
            'processing_status' => 'failed',
            'error_message' => $errorMessage,
            'processed_at' => Carbon::now(),
        ]);
        return $this;
    }

    /**
     * Get pending webhooks
     */
    public static function getPending()
    {
        return self::where('processed', false)
            ->where('processing_status', 'pending')
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Get failed webhooks
     */
    public static function getFailed()
    {
        return self::where('processing_status', 'failed')
            ->orderBy('processed_at', 'desc')
            ->get();
    }
}
