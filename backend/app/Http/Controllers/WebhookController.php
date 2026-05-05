<?php

namespace App\Http\Controllers;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class WebhookController extends Controller
{
    /**
     * List user's webhooks
     */
    public function index(Request $request)
    {
        $webhooks = $request->user()->webhooks()
            ->with(['deliveries' => function ($q) {
                $q->latest()->limit(5);
            }])
            ->paginate(15);

        return response()->json($webhooks);
    }

    /**
     * Get a specific webhook
     */
    public function show(Webhook $webhook)
    {
        $this->authorize('view', $webhook);

        $webhook->load('deliveries');
        
        return response()->json(array_merge(
            $webhook->toArray(),
            ['stats' => $webhook->getStats()]
        ));
    }

    /**
     * Create a new webhook
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'url' => 'required|url',
            'event' => 'required|string|in:' . implode(',', array_keys(Webhook::getAvailableEvents())),
            'filters' => 'nullable|json',
            'method' => 'required|in:POST,PUT,PATCH',
            'headers' => 'nullable|json',
            'active' => 'boolean',
            'max_attempts' => 'integer|min:1|max:20',
            'timeout' => 'integer|min:1|max:300',
        ]);

        $webhook = $request->user()->webhooks()->create($request->only([
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
        ]));

        return response()->json($webhook, Response::HTTP_CREATED);
    }

    /**
     * Update a webhook
     */
    public function update(Request $request, Webhook $webhook)
    {
        $this->authorize('update', $webhook);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'url' => 'sometimes|url',
            'event' => 'sometimes|string|in:' . implode(',', array_keys(Webhook::getAvailableEvents())),
            'filters' => 'nullable|json',
            'method' => 'sometimes|in:POST,PUT,PATCH',
            'headers' => 'nullable|json',
            'active' => 'boolean',
            'max_attempts' => 'integer|min:1|max:20',
            'timeout' => 'integer|min:1|max:300',
        ]);

        $webhook->update($request->only([
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
        ]));

        return response()->json($webhook);
    }

    /**
     * Delete a webhook
     */
    public function destroy(Webhook $webhook)
    {
        $this->authorize('delete', $webhook);

        $webhook->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Toggle webhook active status
     */
    public function toggle(Webhook $webhook)
    {
        $this->authorize('update', $webhook);

        $webhook->update(['active' => !$webhook->active]);

        return response()->json([
            'message' => 'Webhook status updated',
            'active' => $webhook->active,
        ]);
    }

    /**
     * Get webhook deliveries
     */
    public function deliveries(Webhook $webhook, Request $request)
    {
        $this->authorize('view', $webhook);

        $query = $webhook->deliveries();

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->event) {
            $query->where('event', $request->event);
        }

        $deliveries = $query->orderBy('created_at', 'desc')
            ->paginate(50);

        return response()->json($deliveries);
    }

    /**
     * Get a specific delivery
     */
    public function showDelivery(WebhookDelivery $delivery)
    {
        $this->authorize('view', $delivery->webhook);

        return response()->json($delivery);
    }

    /**
     * Retry a failed delivery
     */
    public function retryDelivery(WebhookDelivery $delivery)
    {
        $this->authorize('update', $delivery->webhook);

        if ($delivery->status !== 'failed') {
            return response()->json(['error' => 'Only failed deliveries can be retried'], Response::HTTP_CONFLICT);
        }

        $delivery->retry();

        return response()->json(['message' => 'Delivery retry queued']);
    }

    /**
     * Test webhook
     */
    public function test(Webhook $webhook)
    {
        $this->authorize('update', $webhook);

        $testPayload = [
            'event' => 'webhook.test',
            'timestamp' => now()->toIso8601String(),
            'test' => true,
        ];

        // Create test delivery
        $delivery = WebhookDelivery::create([
            'webhook_id' => $webhook->id,
            'event' => 'webhook.test',
            'payload' => $testPayload,
            'status' => 'pending',
        ]);

        // Queue delivery
        \App\Jobs\DeliverWebhook::dispatch($webhook, $testPayload, 'webhook.test', $delivery->id);

        return response()->json([
            'message' => 'Test webhook sent',
            'delivery_id' => $delivery->id,
        ]);
    }

    /**
     * Get webhook events
     */
    public function getEvents()
    {
        return response()->json(Webhook::getAvailableEvents());
    }

    /**
     * Get webhook statistics
     */
    public function getStats(Request $request)
    {
        $webhooks = $request->user()->webhooks;
        
        $totalDeliveries = 0;
        $successfulDeliveries = 0;
        $failedDeliveries = 0;

        foreach ($webhooks as $webhook) {
            $stats = $webhook->getStats();
            $totalDeliveries += $stats['total_deliveries'];
            $successfulDeliveries += $stats['delivered'];
            $failedDeliveries += $stats['failed'];
        }

        return response()->json([
            'total_webhooks' => $webhooks->count(),
            'active_webhooks' => $webhooks->where('active', true)->count(),
            'total_deliveries' => $totalDeliveries,
            'successful_deliveries' => $successfulDeliveries,
            'failed_deliveries' => $failedDeliveries,
            'success_rate' => $totalDeliveries > 0 ? ($successfulDeliveries / $totalDeliveries) * 100 : 0,
        ]);
    }

    /**
     * Bulk retry failed deliveries
     */
    public function retryFailed(Request $request)
    {
        $request->validate([
            'webhook_id' => 'nullable|exists:webhooks,id',
        ]);

        $query = WebhookDelivery::where('status', 'failed');

        if ($request->webhook_id) {
            $webhook = Webhook::findOrFail($request->webhook_id);
            $this->authorize('update', $webhook);
            $query->where('webhook_id', $request->webhook_id);
        } else {
            $query->whereHas('webhook', function ($q) use ($request) {
                $q->where('user_id', $request->user()->id);
            });
        }

        $failedDeliveries = $query->where('attempt', '<', 3)->get();
        $count = $failedDeliveries->count();

        foreach ($failedDeliveries as $delivery) {
            $delivery->retry();
        }

        return response()->json([
            'message' => "Queued $count failed deliveries for retry",
            'count' => $count,
        ]);
    }
}
