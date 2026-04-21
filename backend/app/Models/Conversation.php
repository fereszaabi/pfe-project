<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_id',
        'sender_type',
        'recipient_id',
        'recipient_type',
        'last_message_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'last_message_at' => 'datetime',
    ];

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
        if ($this->sender_id === $userId) {
            // Return recipient using type info if available
            if ($this->recipient_type) {
                return match ($this->recipient_type) {
                    'employee' => \App\Models\Employee::find($this->recipient_id),
                    'client' => \App\Models\Client::find($this->recipient_id),
                    'user' => User::find($this->recipient_id),
                    default => User::find($this->recipient_id),
                };
            }
            
            // Fallback: Try all tables
            $user = User::find($this->recipient_id);
            if ($user) return $user;
            
            $employee = \App\Models\Employee::find($this->recipient_id);
            if ($employee) return $employee;
            
            return \App\Models\Client::find($this->recipient_id);
        } else {
            // Return sender using type info if available
            if ($this->sender_type) {
                return match ($this->sender_type) {
                    'employee' => \App\Models\Employee::find($this->sender_id),
                    'client' => \App\Models\Client::find($this->sender_id),
                    'user' => User::find($this->sender_id),
                    default => User::find($this->sender_id),
                };
            }
            
            // Fallback: Try all tables
            $user = User::find($this->sender_id);
            if ($user) return $user;
            
            $employee = \App\Models\Employee::find($this->sender_id);
            if ($employee) return $employee;
            
            return \App\Models\Client::find($this->sender_id);
        }
    }

    /**
     * Find or create conversation between two users with specified types
     */
    public static function findOrCreateBetweenWithTypes($userId1, $userType1, $userId2, $userType2)
    {
        // Ensure consistent ordering
        $ids = [$userId1, $userId2];
        $types = [$userType1, $userType2];
        
        if ($userId1 > $userId2) {
            $ids = [$userId2, $userId1];
            $types = [$userType2, $userType1];
        }

        return self::firstOrCreate([
            'sender_id' => $ids[0],
            'recipient_id' => $ids[1],
        ], [
            'sender_type' => $types[0],
            'recipient_type' => $types[1],
        ]);
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
