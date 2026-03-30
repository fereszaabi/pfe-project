<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Machine extends Model
{
    use HasFactory;

    protected $fillable = [
        'nom_poste',
        'numero_machine',
        'code_anydesk',
        'id_client',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class, 'id_client');
    }

    public function demandes()
    {
        return $this->hasMany(Demande::class, 'id_machine');
    }
}
