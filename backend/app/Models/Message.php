<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Message extends Model
{
    use HasFactory;

    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'sender_type',
        'recipient_id',
        'recipient_type',
        'message',
        'is_read',
        'read_at',
        'created_at',
        'ticket_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'read_at' => 'datetime',
        'is_read' => 'boolean',
    ];

    /**
     * Get the conversation this message belongs to
     */
    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the ticket this message relates to
     */
    public function demande()
    {
        return $this->belongsTo(Demande::class, 'ticket_id');
    }

    /**
     * Get the sender (can be from users, employees, or clients table)
     */
    public function sender()
    {
        // Use sender_type if available for more efficient lookup
        if ($this->sender_type) {
            return match ($this->sender_type) {
                'employee' => \App\Models\Employee::find($this->sender_id),
                'client' => \App\Models\Client::find($this->sender_id),
                'user' => User::find($this->sender_id),
                default => User::find($this->sender_id),
            };
        }

        // Fallback: Try to get from users table first
        $user = User::find($this->sender_id);
        if ($user) return $user;
        
        // Try employees table
        $employee = \App\Models\Employee::find($this->sender_id);
        if ($employee) return $employee;
        
        // Try clients table
        return \App\Models\Client::find($this->sender_id);
    }

    /**
     * Get the recipient (can be from users, employees, or clients table)
     */
    public function recipient()
    {
        // Use recipient_type if available for more efficient lookup
        if ($this->recipient_type) {
            return match ($this->recipient_type) {
                'employee' => \App\Models\Employee::find($this->recipient_id),
                'client' => \App\Models\Client::find($this->recipient_id),
                'user' => User::find($this->recipient_id),
                default => User::find($this->recipient_id),
            };
        }

        // Fallback: Try to get from users table first
        $user = User::find($this->recipient_id);
        if ($user) return $user;
        
        // Try employees table
        $employee = \App\Models\Employee::find($this->recipient_id);
        if ($employee) return $employee;
        
        // Try clients table
        return \App\Models\Client::find($this->recipient_id);
    }

    /**
     * Mark message as read
     */
    public function markAsRead()
    {
        if (!$this->is_read) {
            $this->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);
        }
        return $this;
    }

    /**
     * Get formatted response
     */
    public function formatForResponse()
    {
        $sender = $this->sender();
        $recipient = $this->recipient();
        
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'ticket_id' => $this->ticket_id,
            'sender_id' => $this->sender_id,
            'sender_type' => $this->sender_type,
            'recipient_id' => $this->recipient_id,
            'recipient_type' => $this->recipient_type,
            'sender' => $sender ? [
                'id' => $sender->id,
                'name' => $sender->name,
                'email' => $sender->email ?? $sender->mail ?? null,
            ] : null,
            'recipient' => $recipient ? [
                'id' => $recipient->id,
                'name' => $recipient->name,
                'email' => $recipient->email ?? $recipient->mail ?? null,
            ] : null,
            'message' => $this->message,
            'is_read' => $this->is_read,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }
}
