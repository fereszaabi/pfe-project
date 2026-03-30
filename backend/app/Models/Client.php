<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Client extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'mail',
        'cin',
        'code_fiscal',
        'nom',
        'prenom',
        'numero',
        'password',
        'money',
        'client_state',
        'business_type',
        'description',
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
        'money' => 'float',
    ];

    public function machines()
    {
        return $this->hasMany(Machine::class, 'id_client');
    }

    public function demandes()
    {
        return $this->hasMany(Demande::class, 'id_client');
    }

    /**
     * Get all phone numbers for this client
     */
    public function phoneNumbers()
    {
        return $this->hasMany(ClientPhoneNumber::class, 'client_id');
    }

    /**
     * Get primary phone number
     */
    public function getPrimaryPhoneNumber()
    {
        return $this->phoneNumbers()
            ->where('is_primary', true)
            ->first() ?? $this->phoneNumbers()->first();
    }

    /**
     * Get all phone numbers as array
     */
    public function getAllPhoneNumbers()
    {
        return $this->phoneNumbers()
            ->orderBy('is_primary', 'desc')
            ->orderBy('created_at', 'asc')
            ->get();
    }

    /**
     * Add a new phone number
     */
    public function addPhoneNumber($phoneNumber, $type = 'main', $contactPerson = null, $isPrimary = false)
    {
        // If no primary yet, make this one primary
        if ($isPrimary || $this->phoneNumbers()->where('is_primary', true)->count() === 0) {
            $this->phoneNumbers()->update(['is_primary' => false]);
            $isPrimary = true;
        }

        return $this->phoneNumbers()->create([
            'phone_number' => $phoneNumber,
            'type' => $type,
            'contact_person' => $contactPerson,
            'is_primary' => $isPrimary,
        ]);
    }

    /**
     * Set primary phone number
     */
    public function setPrimaryPhoneNumber($phoneNumberId)
    {
        $this->phoneNumbers()->update(['is_primary' => false]);
        $this->phoneNumbers()->where('id', $phoneNumberId)->update(['is_primary' => true]);
        return $this;
    }

    /**
     * Get formatted profile data
     */
    public function getProfileData()
    {
        return [
            'id' => $this->id,
            'nom' => $this->nom,
            'prenom' => $this->prenom,
            'email' => $this->mail,
            'cin' => $this->cin,
            'code_fiscal' => $this->code_fiscal,
            'business_type' => $this->business_type,
            'description' => $this->description,
            'money' => (float) $this->money,
            'client_state' => $this->client_state,
            'phone_numbers' => $this->getAllPhoneNumbers()->map(function ($phone) {
                return $phone->formatForResponse();
            }),
            'machines_count' => $this->machines()->count(),
            'tickets_count' => $this->demandes()->count(),
        ];
    }
}
