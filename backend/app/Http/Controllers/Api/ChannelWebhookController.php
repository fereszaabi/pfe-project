<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChannelWebhook;
use App\Services\MultiChannelTicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ChannelWebhookController extends Controller
{
    /**
     * Handle incoming webhook from email service
     * Example: Mailgun, SendGrid webhook
     */
    public function handleEmailWebhook(Request $request)
    {
        return $this->processWebhook('email', $request);
    }

    /**
     * Handle incoming webhook from WhatsApp
     * Example: Twilio, WhatsApp Business API
     */
    public function handleWhatsAppWebhook(Request $request)
    {
        return $this->processWebhook('whatsapp', $request);
    }

    /**
     * Handle incoming webhook from SMS service
     * Example: Twilio, AWS SNS
     */
    public function handleSmsWebhook(Request $request)
    {
        return $this->processWebhook('sms', $request);
    }

    /**
     * Handle incoming webhook from Facebook
     * Example: Facebook Messenger Webhook
     */
    public function handleFacebookWebhook(Request $request)
    {
        return $this->processWebhook('facebook', $request);
    }

    /**
     * Generic webhook processor
     */
    private function processWebhook(string $channel, Request $request)
    {
        // Log the incoming webhook
        Log::info("Incoming {$channel} webhook", [
            'channel' => $channel,
            'headers' => $request->headers->all(),
            'payload' => $request->all(),
        ]);

        // Verify webhook authenticity (channel-specific)
        if (!$this->verifyWebhookSignature($channel, $request)) {
            Log::warning("Invalid webhook signature for {$channel}");
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        // Store webhook for processing
        $webhook = ChannelWebhook::create([
            'channel' => $channel,
            'event_type' => $request->input('event_type') ?? $request->input('type') ?? 'unknown',
            'payload' => $request->all(),
            'processed' => false,
            'processing_status' => 'pending',
            'created_at' => \Carbon\Carbon::now(),
        ]);

        // Process the webhook
        try {
            $this->handleIncomingMessage($channel, $request, $webhook);
            $webhook->markAsProcessed();
        } catch (\Exception $e) {
            Log::error("Error processing {$channel} webhook", [
                'error' => $e->getMessage(),
                'webhook_id' => $webhook->id,
            ]);
            $webhook->markAsFailed($e->getMessage());
        }

        return response()->json(['success' => true]);
    }

    /**
     * Verify webhook signature based on channel
     */
    private function verifyWebhookSignature(string $channel, Request $request): bool
    {
        return match ($channel) {
            'whatsapp' => $this->verifyWhatsAppSignature($request),
            'sms' => $this->verifySmsSignature($request),
            'facebook' => $this->verifyFacebookSignature($request),
            'email' => true, // Implement email service verification
            default => true,
        };
    }

    /**
     * Verify WhatsApp webhook signature (Twilio)
     */
    private function verifyWhatsAppSignature(Request $request): bool
    {
        // TODO: Implement Twilio signature verification
        return true;
    }

    /**
     * Verify SMS webhook signature (Twilio)
     */
    private function verifySmsSignature(Request $request): bool
    {
        // TODO: Implement SMS signature verification
        return true;
    }

    /**
     * Verify Facebook webhook signature
     */
    private function verifyFacebookSignature(Request $request): bool
    {
        // TODO: Implement Facebook signature verification
        return true;
    }

    /**
     * Extract and handle incoming message from webhook payload
     */
    private function handleIncomingMessage(string $channel, Request $request, ChannelWebhook $webhook): void
    {
        match ($channel) {
            'whatsapp' => $this->handleWhatsAppMessage($request, $webhook),
            'sms' => $this->handleSmsMessage($request, $webhook),
            'facebook' => $this->handleFacebookMessage($request, $webhook),
            'email' => $this->handleEmailMessage($request, $webhook),
            default => null,
        };
    }

    /**
     * Handle WhatsApp incoming message
     */
    private function handleWhatsAppMessage(Request $request, ChannelWebhook $webhook): void
    {
        // Extract message data from Twilio/WhatsApp Business API format
        $from = $request->input('From') ?? $request->input('messages.0.from');
        $body = $request->input('Body') ?? $request->input('messages.0.text.body');
        $messageId = $request->input('MessageSid') ?? $request->input('messages.0.id');

        if (!$from || !$body) {
            throw new \Exception('Missing required WhatsApp fields');
        }

        $metadata = [
            'whatsapp_id' => $from,
            'message_type' => $request->input('MessageType') ?? 'text',
            'media_url' => $request->input('MediaUrl'),
        ];

        $message = MultiChannelTicketService::handleIncomingMessage(
            'whatsapp',
            $from,
            $body,
            $metadata,
            $messageId
        );

        $webhook->message_id = $message->id;
    }

    /**
     * Handle SMS incoming message
     */
    private function handleSmsMessage(Request $request, ChannelWebhook $webhook): void
    {
        // Extract message data from Twilio SMS format
        $from = $request->input('From');
        $body = $request->input('Body');
        $messageId = $request->input('MessageSid');

        if (!$from || !$body) {
            throw new \Exception('Missing required SMS fields');
        }

        $metadata = [
            'phone_number' => $from,
            'sms_status' => $request->input('MessageStatus'),
        ];

        $message = MultiChannelTicketService::handleIncomingMessage(
            'sms',
            $from,
            $body,
            $metadata,
            $messageId
        );

        $webhook->message_id = $message->id;
    }

    /**
     * Handle Facebook Messenger incoming message
     */
    private function handleFacebookMessage(Request $request, ChannelWebhook $webhook): void
    {
        // Extract message data from Facebook Graph API format
        $messaging = $request->input('entry.0.messaging.0');
        
        if (!$messaging) {
            throw new \Exception('Invalid Facebook message format');
        }

        $sender = $messaging['sender']['id'] ?? null;
        $message = $messaging['message']['text'] ?? '';
        $messageId = $messaging['message']['mid'] ?? null;

        if (!$sender || !$message) {
            throw new \Exception('Missing required Facebook fields');
        }

        $metadata = [
            'facebook_id' => $sender,
            'attachment' => $messaging['message']['attachments'],
        ];

        $msg = MultiChannelTicketService::handleIncomingMessage(
            'facebook',
            $sender,
            $message,
            $metadata,
            $messageId
        );

        $webhook->message_id = $msg->id;
    }

    /**
     * Handle email incoming message
     * This is typically handled by Laravel mailables, but included for completeness
     */
    private function handleEmailMessage(Request $request, ChannelWebhook $webhook): void
    {
        // Extract message data from email service format
        $from = $request->input('from');
        $subject = $request->input('subject');
        $body = $request->input('text') ?? $request->input('html');
        $messageId = $request->input('message_id');

        if (!$from || !$body) {
            throw new \Exception('Missing required email fields');
        }

        $metadata = [
            'email_subject' => $subject,
            'email_html' => $request->input('html'),
            'attachments' => $request->input('attachment_count', 0),
        ];

        $message = MultiChannelTicketService::handleIncomingMessage(
            'email',
            $from,
            $body,
            $metadata,
            $messageId,
            $subject
        );

        $webhook->message_id = $message->id;
    }

    /**
     * Retry failed webhooks (admin only)
     */
    public function retryFailed(Request $request)
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $failed = ChannelWebhook::getFailed();
        $retryCount = 0;

        foreach ($failed as $webhook) {
            try {
                $this->handleIncomingMessage($webhook->channel, new Request($webhook->payload), $webhook);
                $webhook->markAsProcessed();
                $retryCount++;
            } catch (\Exception $e) {
                // Log but continue with other failed webhooks
            }
        }

        return response()->json([
            'message' => "Retried {$retryCount} failed webhooks",
            'retried' => $retryCount,
        ]);
    }

    /**
     * Get webhook processing status
     */
    public function getStatus(Request $request)
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $total = ChannelWebhook::count();
        $pending = ChannelWebhook::where('processed', false)->count();
        $failed = ChannelWebhook::where('processing_status', 'failed')->count();
        $success = ChannelWebhook::where('processing_status', 'success')->count();

        return response()->json([
            'status' => [
                'total' => $total,
                'pending' => $pending,
                'failed' => $failed,
                'success' => $success,
                'by_channel' => ChannelWebhook::selectRaw('channel, processing_status, COUNT(*) as count')
                    ->groupBy('channel', 'processing_status')
                    ->get(),
            ],
        ]);
    }
}
