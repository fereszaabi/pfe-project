<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Employee extends Authenticatable
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
        'mail',
        'cin',
        'code_fiscal',
        'nom',
        'prenom',
        'password',
        'role',
        'phone',
        'id_admin',
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
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'password' => 'hashed',
        'tickets_completed' => 'integer',
        'avg_rating' => 'decimal:2',
        'avg_resolution_hours' => 'decimal:2',
        'current_workload' => 'integer',
        'total_earnings' => 'decimal:3',
        'last_ticket_completed' => 'datetime',
    ];

    public function admin()
    {
        return $this->belongsTo(Admin::class, 'id_admin');
    }

    public function demandes()
    {
        return $this->hasMany(Demande::class, 'id_employee');
    }

    /**
     * Get all assigned tickets (including completed)
     */
    public function assignedDemandes()
    {
        return $this->hasMany(Demande::class, 'id_employee');
    }

    /**
     * Get open/in-progress tickets
     */
    public function pendingDemandes()
    {
        return $this->demandes()
            ->whereNotIn('status', ['resolved', 'closed'])
            ->get();
    }

    /**
     * Recalculate performance metrics
     */
    public function recalculatePerformance()
    {
        $completedTickets = $this->demandes()
            ->whereIn('status', ['resolved', 'closed'])
            ->where('completed_at', '!=', null)
            ->get();

        $ticketsCount = $completedTickets->count();
        $totalRating = $completedTickets->sum('client_rating') ?? 0;
        $totalHours = $completedTickets->sum('resolution_hours') ?? 0;

        $avgRating = $ticketsCount > 0 ? round($totalRating / $ticketsCount, 2) : 0;
        $avgHours = $ticketsCount > 0 ? round($totalHours / $ticketsCount, 2) : 0;
        $currentWorkload = $this->demandes()
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
            'tickets_completed' => $this->tickets_completed,
            'avg_rating' => (float) $this->avg_rating,
            'avg_resolution_hours' => (float) $this->avg_resolution_hours,
            'current_workload' => $this->current_workload,
            'total_earnings' => (float) $this->total_earnings,
            'performance_status' => $this->performance_status,
            'last_ticket_completed' => $this->last_ticket_completed,
        ];
    }
}
