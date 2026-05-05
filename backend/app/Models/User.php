<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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

    /**
     * RBAC: Get roles assigned to this user
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user');
    }

    /**
     * RBAC: Get individual permission overrides
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'user_permission');
    }

    /**
     * RBAC: Check if user has permission
     */
    public function hasPermission(string $permission): bool
    {
        // Check individual overrides first
        if ($this->permissions()->where('name', $permission)->exists()) {
            return true;
        }

        // Check role-based permissions
        return $this->roles()
            ->whereHas('permissions', function ($query) use ($permission) {
                $query->where('name', $permission);
            })
            ->exists();
    }

    /**
     * RBAC: Check if user has any of the given permissions
     */
    public function hasAnyPermission(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * RBAC: Check if user has all given permissions
     */
    public function hasAllPermissions(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (!$this->hasPermission($permission)) {
                return false;
            }
        }
        return true;
    }

    /**
     * RBAC: Check if user has role
     */
    public function hasRole(string $role): bool
    {
        return $this->roles()->where('name', $role)->exists();
    }

    /**
     * RBAC: Check if user has any of the given roles
     */
    public function hasAnyRole(array $roles): bool
    {
        return $this->roles()->whereIn('name', $roles)->exists();
    }

    /**
     * RBAC: Assign role to user
     */
    public function assignRole(string $roleName): void
    {
        $role = Role::where('name', $roleName)->firstOrFail();
        $this->roles()->syncWithoutDetaching($role->id);
    }

    /**
     * RBAC: Remove role from user
     */
    public function removeRole(string $roleName): void
    {
        $role = Role::where('name', $roleName)->first();
        if ($role) {
            $this->roles()->detach($role->id);
        }
    }

    /**
     * RBAC: Grant individual permission override
     */
    public function grantPermission(string $permissionName): void
    {
        $permission = Permission::where('name', $permissionName)->firstOrFail();
        $this->permissions()->syncWithoutDetaching($permission->id);
    }

    /**
     * RBAC: Revoke individual permission override
     */
    public function revokePermission(string $permissionName): void
    {
        $permission = Permission::where('name', $permissionName)->first();
        if ($permission) {
            $this->permissions()->detach($permission->id);
        }
    }

    /**
     * Get audit logs for this user
     */
    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'user_id')->orderBy('created_at', 'desc');
    }

    /**
     * Get SSO accounts linked to this user
     */
    public function ssoAccounts()
    {
        return $this->hasMany(SsoUser::class);
    }

    /**
     * Get webhooks created by this user
     */
    public function webhooks()
    {
        return $this->hasMany(Webhook::class);
    }
}
