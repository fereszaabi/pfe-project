<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    protected $fillable = [
        'name',
        'display_name',
        'description',
        'resource',
        'action',
    ];

    /**
     * Get roles with this permission
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permission');
    }

    /**
     * Get users with this permission override
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_permission')
            ->withPivot('has_permission', 'reason');
    }

    /**
     * Parse permission name: "resource.action"
     */
    public static function parse(string $permission): array
    {
        [$resource, $action] = explode('.', $permission, 2);
        return compact('resource', 'action');
    }

    /**
     * Get all permissions for a resource
     */
    public static function forResource(string $resource)
    {
        return self::where('resource', $resource)->get();
    }

    /**
     * Get actions available
     */
    public static function getActions()
    {
        return ['view', 'create', 'edit', 'delete', 'admin', 'export'];
    }

    /**
     * Get resources
     */
    public static function getResources()
    {
        return ['tickets', 'clients', 'employees', 'users', 'settings', 'workflows', 'categories', 'templates'];
    }
}
