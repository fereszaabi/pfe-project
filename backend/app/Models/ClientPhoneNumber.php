<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientPhoneNumber extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'phone_number',
        'contact_person',
        'type',
        'is_primary',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the client that owns this phone number
     */
    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * Get all phone numbers formatted for API response
     */
    public function formatForResponse()
    {
        return [
            'id' => $this->id,
            'phone_number' => $this->phone_number,
            'contact_person' => $this->contact_person,
            'type' => $this->type,
            'is_primary' => $this->is_primary,
            'created_at' => $this->created_at,
        ];
    }
}
