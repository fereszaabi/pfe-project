<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupportBotSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'title',
        'messages',
    ];

    protected $casts = [
        'messages' => 'array',
    ];

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }
}
