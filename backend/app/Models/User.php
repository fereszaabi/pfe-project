<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'cin',
        'code_fiscal',
        'role',
        'client_state',
        'tickets_completed',
        'avg_rating',
        'avg_resolution_hours',
        'current_workload',
        'total_earnings',
        'performance_status',
        'last_ticket_completed',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'tickets_completed' => 'integer',
        'avg_rating' => 'decimal:2',
        'avg_resolution_hours' => 'decimal:2',
        'current_workload' => 'integer',
        'total_earnings' => 'decimal:3',
        'last_ticket_completed' => 'datetime',
    ];

    /**
     * Get tickets assigned to this employee
     */
    public function assignedDemandes()
    {
        if ($this->role !== 'employee') {
            return collect();
        }
        return Demande::where('id_employee', $this->id)->get();
    }

    /**
     * Get open/in-progress tickets
     */
    public function pendingDemandes()
    {
        if ($this->role !== 'employee') {
            return collect();
        }
        return Demande::where('id_employee', $this->id)
            ->whereNotIn('status', ['resolved', 'closed'])
            ->get();
    }

    /**
     * Recalculate performance metrics for employees
     */
    public function recalculatePerformance()
    {
        if ($this->role !== 'employee') {
            return $this;
        }

        $completedTickets = Demande::where('id_employee', $this->id)
            ->whereIn('status', ['resolved', 'closed'])
            ->where('completed_at', '!=', null)
            ->get();

        $ticketsCount = $completedTickets->count();
        $totalRating = $completedTickets->sum('client_rating') ?? 0;
        $totalHours = $completedTickets->sum('resolution_hours') ?? 0;

        $avgRating = $ticketsCount > 0 ? round($totalRating / $ticketsCount, 2) : 0;
        $avgHours = $ticketsCount > 0 ? round($totalHours / $ticketsCount, 2) : 0;
        $currentWorkload = Demande::where('id_employee', $this->id)
            ->whereNotIn('status', ['resolved', 'closed'])
            ->count();

        $this->update([
            'tickets_completed' => $ticketsCount,
            'avg_rating' => $avgRating,
            'avg_resolution_hours' => $avgHours,
            'current_workload' => $currentWorkload,
            'last_ticket_completed' => $completedTickets->max('completed_at'),
        ]);

        return $this;
    }

    /**
     * Get performance summary
     */
    public function getPerformanceSummary()
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'tickets_completed' => (int) $this->tickets_completed,
            'avg_rating' => (float) $this->avg_rating,
            'avg_resolution_hours' => (float) $this->avg_resolution_hours,
            'current_workload' => (int) $this->current_workload,
            'total_earnings' => (float) $this->total_earnings,
            'performance_status' => $this->performance_status ?? 'active',
            'last_ticket_completed' => $this->last_ticket_completed,
        ];
    }

    /**
     * Get all conversations for this user
     */
    public function conversations()
    {
        return Conversation::where(function ($query) {
            $query->where('sender_id', $this->id)
                  ->orWhere('recipient_id', $this->id);
        })->orderBy('updated_at', 'desc');
    }

    /**
     * Get all messages sent by this user
     */
    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    /**
     * Get all messages received by this user
     */
    public function receivedMessages()
    {
        return $this->hasMany(Message::class, 'recipient_id');
    }

    /**
     * Get unread message count
     */
    public function unreadMessageCount()
    {
        return Message::where('recipient_id', $this->id)
            ->where('is_read', false)
            ->count();
    }

    /**
     * Get all unread messages
     */
    public function unreadMessages()
    {
        return $this->receivedMessages()
            ->where('is_read', false)
            ->get();
    }

    /**
     * Get conversation with specific user
     */
    public function getConversationWith($otherUserId)
    {
        return Conversation::where(function ($query) use ($otherUserId) {
            $query->where(function ($q) {
                $q->where('sender_id', $this->id)
                  ->where('recipient_id', $otherUserId);
            })->orWhere(function ($q) {
                $q->where('sender_id', $otherUserId)
                  ->where('recipient_id', $this->id);
            });
        })->first();
    }
}
