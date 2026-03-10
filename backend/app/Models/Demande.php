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
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'end_at' => 'datetime',
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
}
