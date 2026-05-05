<?php

namespace App\Jobs;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class DeliverWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $webhook;
    protected $payload;
    protected $event;
    protected $deliveryId;
    protected $attempt = 0;

    /**
     * Create a new job instance.
     */
    public function __construct(Webhook $webhook, array $payload, string $event, ?int $deliveryId = null)
    {
        $this->webhook = $webhook;
        $this->payload = array_merge($payload, [
            'webhook_id' => $webhook->id,
            'timestamp' => now()->toIso8601String(),
        ]);
        $this->event = $event;
        $this->deliveryId = $deliveryId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $delivery = $this->deliveryId 
            ? WebhookDelivery::findOrFail($this->deliveryId)
            : WebhookDelivery::where('webhook_id', $this->webhook->id)
                ->where('event', $this->event)
                ->where('status', 'pending')
                ->first();

        if (!$delivery) {
            return;
        }

        try {
            $this->attempt = $delivery->attempt ?? 0;

            // Prepare request
            $headers = $this->webhook->headers ?? [];
            $headers['Content-Type'] = 'application/json';
            $headers['X-Webhook-Signature'] = $this->generateSignature($this->webhook->id, json_encode($this->payload));
            $headers['X-Webhook-Event'] = $this->event;
            $headers['X-Webhook-Delivery'] = (string)$delivery->id;

            // Send webhook
            $response = Http::withHeaders($headers)
                ->timeout($this->webhook->timeout ?? 30)
                ->retry(1, 100) // Don't retry here, we handle retries separately
                ->{strtolower($this->webhook->method ?? 'POST')}($this->webhook->url, $this->payload);

            if ($response->successful()) {
                $delivery->markDelivered($response->status(), $response->body());
                
                \Log::info("Webhook {$this->webhook->id} delivered successfully", [
                    'delivery_id' => $delivery->id,
                    'status' => $response->status(),
                ]);
            } else {
                throw new \Exception("HTTP {$response->status()}: {$response->body()}");
            }
        } catch (\Exception $e) {
            $this->handleFailure($delivery, $e);
        }
    }

    /**
     * Handle failed delivery
     */
    private function handleFailure(WebhookDelivery $delivery, \Exception $e): void
    {
        $delivery->increment('attempt');
        $nextAttempt = $delivery->attempt;

        // Calculate backoff time (exponential backoff: 60s, 300s, 900s, etc)
        $backoffSeconds = match (true) {
            $nextAttempt >= $this->webhook->max_attempts => null,
            $nextAttempt === 1 => 60,
            $nextAttempt === 2 => 300,
            default => 900,
        };

        if ($nextAttempt >= $this->webhook->max_attempts) {
            $delivery->markFailed("Max attempts ({$this->webhook->max_attempts}) reached: {$e->getMessage()}");
            
            \Log::error("Webhook {$this->webhook->id} failed permanently", [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage(),
                'attempts' => $nextAttempt,
            ]);
        } else {
            $nextRetry = Carbon::now()->addSeconds($backoffSeconds);
            $delivery->markFailed($e->getMessage(), $nextRetry);

            // Retry the job
            $this->release($backoffSeconds);
            
            \Log::warning("Webhook {$this->webhook->id} failed, will retry", [
                'delivery_id' => $delivery->id,
                'error' => $e->getMessage(),
                'attempt' => $nextAttempt,
                'next_retry' => $nextRetry,
            ]);
        }
    }

    /**
     * Generate HMAC signature for webhook verification
     */
    private function generateSignature(int $webhookId, string $payload): string
    {
        $secret = config('app.webhook_secret') ?? $this->webhook->user->id;
        return hash_hmac('sha256', "{$webhookId}.{$payload}", $secret);
    }

    /**
     * Handle job failure
     */
    public function failed(\Exception $exception): void
    {
        $delivery = $this->deliveryId 
            ? WebhookDelivery::findOrFail($this->deliveryId)
            : null;

        if ($delivery) {
            $delivery->markFailed("Job failed: {$exception->getMessage()}");
        }

        \Log::error("Webhook delivery job failed", [
            'webhook_id' => $this->webhook->id,
            'delivery_id' => $this->deliveryId,
            'error' => $exception->getMessage(),
        ]);
    }
}
