<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_id',
        'recipient_id',
        'last_message_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'last_message_at' => 'datetime',
    ];

    /**
     * Get the sender user
     */
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Get the recipient user
     */
    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    /**
     * Get all messages in this conversation
     */
    public function messages()
    {
        return $this->hasMany(Message::class)->orderBy('created_at', 'asc');
    }

    /**
     * Get the latest message
     */
    public function latestMessage()
    {
        return $this->hasOne(Message::class)->orderBy('created_at', 'desc');
    }

    /**
     * Get unread messages count
     */
    public function unreadCount($userId)
    {
        return $this->messages()
            ->where('recipient_id', $userId)
            ->where('is_read', false)
            ->count();
    }

    /**
     * Get other participant (not the current user)
     */
    public function getOtherParticipant($userId)
    {
        return $this->sender_id === $userId ? $this->recipient : $this->sender;
    }

    /**
     * Find or create conversation between two users
     */
    public static function findOrCreateBetween($userId1, $userId2)
    {
        // Ensure consistent ordering
        if ($userId1 > $userId2) {
            [$userId1, $userId2] = [$userId2, $userId1];
        }

        return self::firstOrCreate([
            'sender_id' => $userId1,
            'recipient_id' => $userId2,
        ]);
    }
}
