<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HelpArticle extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'category',
        'summary',
        'content',
        'keywords',
        'is_published',
        'sort_order',
    ];

    protected $casts = [
        'keywords' => 'array',
        'is_published' => 'boolean',
    ];
}