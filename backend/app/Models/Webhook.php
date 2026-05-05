<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Carbon\Carbon;

class Webhook extends Model
{
    protected $fillable = [
        'name',
        'description',
        'url',
        'event',
        'filters',
        'method',
        'headers',
        'active',
        'max_attempts',
        'timeout',
        'user_id',
    ];

    protected $casts = [
        'filters' => 'json',
        'headers' => 'json',
        'active' => 'boolean',
    ];

    /**
     * Get the user who created this webhook
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get deliveries for this webhook
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }

    /**
     * Trigger webhook event
     */
    public function trigger(string $event, array $payload): void
    {
        if (!$this->active) {
            return;
        }

        // Check if event matches
        if ($this->event !== '*' && $this->event !== $event) {
            return;
        }

        // Check filters
        if ($this->filters && !$this->matchesFilters($event, $payload)) {
            return;
        }

        // Create delivery record
        WebhookDelivery::create([
            'webhook_id' => $this->id,
            'event' => $event,
            'payload' => $payload,
            'status' => 'pending',
        ]);

        // Queue delivery job
        \App\Jobs\DeliverWebhook::dispatch($this, $payload, $event);
    }

    /**
     * Check if payload matches filter criteria
     */
    private function matchesFilters(string $event, array $payload): bool
    {
        foreach ($this->filters as $key => $values) {
            if (!isset($payload[$key]) || !in_array($payload[$key], (array)$values)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get recent deliveries
     */
    public function getRecentDeliveries($limit = 50)
    {
        return $this->deliveries()
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get failed deliveries
     */
    public function getFailedDeliveries()
    {
        return $this->deliveries()
            ->where('status', 'failed')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get webhook statistics
     */
    public function getStats()
    {
        return [
            'total_deliveries' => $this->deliveries()->count(),
            'delivered' => $this->deliveries()->where('status', 'delivered')->count(),
            'failed' => $this->deliveries()->where('status', 'failed')->count(),
            'pending' => $this->deliveries()->where('status', 'pending')->count(),
            'success_rate' => $this->deliveries()->where('status', 'delivered')->count() / 
                             max($this->deliveries()->count(), 1) * 100,
        ];
    }

    /**
     * Get event list for UI
     */
    public static function getAvailableEvents()
    {
        return [
            'ticket.created' => 'Ticket Created',
            'ticket.updated' => 'Ticket Updated',
            'ticket.assigned' => 'Ticket Assigned',
            'ticket.resolved' => 'Ticket Resolved',
            'ticket.closed' => 'Ticket Closed',
            'message.created' => 'Message Created',
            'client.created' => 'Client Created',
            'client.updated' => 'Client Updated',
            'employee.created' => 'Employee Created',
            '*' => 'All Events',
        ];
    }
}

class WebhookDelivery extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'webhook_id',
        'event',
        'payload',
        'status',
        'attempt',
        'response_status',
        'response_body',
        'error_message',
        'delivered_at',
        'next_retry_at',
        'created_at',
    ];

    protected $casts = [
        'payload' => 'json',
        'delivered_at' => 'datetime',
        'next_retry_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /**
     * Get the webhook
     */
    public function webhook(): BelongsTo
    {
        return $this->belongsTo(Webhook::class);
    }

    /**
     * Mark as delivered
     */
    public function markDelivered(int $statusCode, $responseBody = null): void
    {
        $this->update([
            'status' => 'delivered',
            'response_status' => $statusCode,
            'response_body' => $responseBody,
            'delivered_at' => Carbon::now(),
        ]);
    }

    /**
     * Mark as failed
     */
    public function markFailed(string $error, ?Carbon $nextRetry = null): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $error,
            'next_retry_at' => $nextRetry,
        ]);
    }

    /**
     * Attempt retry
     */
    public function retry(): void
    {
        $webhook = $this->webhook;
        
        if ($this->attempt >= $webhook->max_attempts) {
            $this->markFailed('Max attempts reached');
            return;
        }

        $this->increment('attempt');
        $this->update(['status' => 'pending']);

        \App\Jobs\DeliverWebhook::dispatch($webhook, $this->payload, $this->event, $this->id);
    }

    /**
     * Get pending deliveries for retry
     */
    public static function getPendingRetries()
    {
        return self::where('status', 'pending')
            ->whereNotNull('next_retry_at')
            ->where('next_retry_at', '<=', Carbon::now())
            ->get();
    }
}
