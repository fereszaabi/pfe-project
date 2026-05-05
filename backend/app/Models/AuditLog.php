<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class AuditLog extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'event',
        'model_type',
        'model_id',
        'user_id',
        'user_type',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
        'method',
        'url',
        'status_code',
        'changes',
        'created_at',
    ];

    protected $casts = [
        'old_values' => 'json',
        'new_values' => 'json',
        'created_at' => 'datetime',
    ];

    /**
     * Get the user who performed the action
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the model that was audited
     */
    public function auditable()
    {
        if (!$this->model_type) {
            return null;
        }

        return $this->model_type::find($this->model_id);
    }

    /**
     * Create audit log entry
     */
    public static function log(
        string $event,
        $model,
        array $oldValues = [],
        array $newValues = [],
        $user = null,
        ?string $userType = null
    ): self {
        $changes = self::calculateChanges($oldValues, $newValues);

        return self::create([
            'event' => $event,
            'model_type' => $model::class ?? null,
            'model_id' => $model->id ?? null,
            'user_id' => $user?->id,
            'user_type' => $userType ?? 'user',
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'method' => request()->method(),
            'url' => request()->path(),
            'changes' => $changes,
            'created_at' => Carbon::now(),
        ]);
    }

    /**
     * Calculate human-readable changes
     */
    private static function calculateChanges(array $old, array $new): string
    {
        $changes = [];
        
        foreach ($new as $key => $value) {
            $oldValue = $old[$key] ?? null;
            
            if ($oldValue !== $value) {
                $changes[] = "{$key}: '{$oldValue}' → '{$value}'";
            }
        }

        return implode(', ', $changes);
    }

    /**
     * Get audit logs for a user
     */
    public static function forUser($user)
    {
        return self::where('user_id', $user->id)
            ->orderBy('created_at', 'desc');
    }

    /**
     * Get audit logs for a model
     */
    public static function forModel($model)
    {
        return self::where('model_type', $model::class)
            ->where('model_id', $model->id)
            ->orderBy('created_at', 'desc');
    }

    /**
     * Get recent activity
     */
    public static function getRecent($limit = 50)
    {
        return self::orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get activity between dates
     */
    public static function between(Carbon $start, Carbon $end)
    {
        return self::whereBetween('created_at', [$start, $end])
            ->orderBy('created_at', 'desc');
    }

    /**
     * Get failed operations
     */
    public static function getFailed()
    {
        return self::where('event', 'failed')
            ->orWhereNotNull('error_message')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Get activity by event type
     */
    public static function byEvent(string $event)
    {
        return self::where('event', $event)
            ->orderBy('created_at', 'desc');
    }
}
