<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Demande extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'titre',
        'id_client',
        'id_employee',
        'id_machine',
        'description',
        'image',
        'status',
        'created_at',
        'end_at',
        'employee_note',
        'priority',
        'assigned_at',
        'completed_at',
        'resolution_hours',
        'client_rating',
        'rating_comment',
        'reopen_count',
        'ticket_cost',
        'total_cost',
        'payment_status',
        'paid_at',
        'payment_notes',
        'insufficient_funds',
        'admin_approved_override',
        'escalated_to',
        'escalated_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'end_at' => 'datetime',
        'assigned_at' => 'datetime',
        'completed_at' => 'datetime',
        'escalated_at' => 'datetime',
        'paid_at' => 'datetime',
        'resolution_hours' => 'decimal:2',
        'ticket_cost' => 'decimal:3',
        'total_cost' => 'decimal:3',
        'client_rating' => 'integer',
        'reopen_count' => 'integer',
        'insufficient_funds' => 'boolean',
        'admin_approved_override' => 'boolean',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class, 'id_client');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'id_employee');
    }

    public function machine()
    {
        return $this->belongsTo(Machine::class, 'id_machine');
    }

    /**
     * Calculate resolution time in hours when marking as complete
     */
    public function calculateResolutionTime()
    {
        if ($this->assigned_at && $this->completed_at) {
            $hours = $this->completed_at->diffInMinutes($this->assigned_at) / 60;
            return round($hours, 2);
        }
        return null;
    }

    /**
     * Get employee performance data
     */
    public function getEmployeePerformance()
    {
        if (!$this->id_employee) return null;

        return [
            'complexity' => $this->priority,
            'rating' => $this->client_rating,
            'resolution_hours' => $this->resolution_hours,
            'reopened' => $this->reopen_count > 0,
        ];
    }
}
