<?php

namespace App\Services;

use App\Models\Demande;
use App\Models\Message;
use App\Models\Client;
use App\Models\ChannelAddress;
use App\Models\Conversation;
use Illuminate\Support\Str;
use Carbon\Carbon;

class MultiChannelTicketService
{
    /**
     * Get or create a ticket from channel message
     */
    public static function handleIncomingMessage(
        string $channel,
        string $senderAddress,
        string $messageContent,
        array $metadata = [],
        string $externalMessageId = null,
        string $subject = null
    ): Message {
        // Find or create client address
        $channelAddress = ChannelAddress::findByChannelAndAddress($channel, $senderAddress);
        
        if (!$channelAddress) {
            // Auto-create client for new channel addresses
            $channelAddress = self::createClientAndAddress($channel, $senderAddress);
        }

        $clientId = $channelAddress->client_id;

        // Get or create ticket for this channel conversation
        $ticket = self::getOrCreateTicketForChannel($clientId, $channel, $metadata);

        // Get or create system employee/admin contact
        $employeeId = self::getSystemChannelContact($channel);

        // Create conversation between client and system
        $conversation = self::getOrCreateConversation($clientId, $employeeId, $channel);

        // Create the message
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $clientId,
            'sender_type' => 'client',
            'recipient_id' => $employeeId,
            'recipient_type' => 'employee',
            'ticket_id' => $ticket->id,
            'message' => $messageContent,
            'channel' => $channel,
            'external_message_id' => $externalMessageId,
            'external_user_id' => $senderAddress,
            'channel_metadata' => $metadata,
            'is_read' => false,
            'created_at' => Carbon::now(),
        ]);

        // Update conversation's active channels
        $activeChannels = $conversation->active_channels ?? [];
        if (!in_array($channel, $activeChannels)) {
            $activeChannels[] = $channel;
            $conversation->update(['active_channels' => $activeChannels]);
        }

        // Broadcast message created event
        \App\Events\TicketMessageCreated::dispatch(
            $message,
            $ticket->id,
            'employee',
            $employeeId,
            null
        );

        return $message;
    }

    /**
     * Create ticket from channel message
     */
    private static function getOrCreateTicketForChannel(
        int $clientId,
        string $channel,
        array $metadata = []
    ): Demande {
        // Check if there's an existing ticket for this client in this channel
        // that was created within the last 7 days and not yet resolved
        $existingTicket = Demande::where('id_client', $clientId)
            ->where('status', '!=', 'closed')
            ->whereNull('end_at')
            ->where('created_at', '>=', Carbon::now()->subDays(7))
            ->latest('created_at')
            ->first();

        if ($existingTicket) {
            return $existingTicket;
        }

        // Create new ticket from channel message
        $title = $metadata['subject'] ?? "Message from {$channel}";
        
        return Demande::create([
            'titre' => $title,
            'id_client' => $clientId,
            'description' => $metadata['description'] ?? 'Initiated from ' . ucfirst($channel) . ' channel',
            'status' => 'submitted',
            'priority' => 'medium',
            'created_at' => Carbon::now(),
        ]);
    }

    /**
     * Create client and channel address if they don't exist
     */
    private static function createClientAndAddress(
        string $channel,
        string $address
    ): ChannelAddress {
        // Try to find existing client by address
        $existingChannelAddress = ChannelAddress::where('channel', $channel)
            ->where('address', $address)
            ->first();

        if ($existingChannelAddress) {
            return $existingChannelAddress;
        }

        // For email channel, try to find existing client by email
        if ($channel === 'email') {
            $existingClient = Client::where('mail', $address)->first();
            if ($existingClient) {
                return ChannelAddress::findOrCreateForClient(
                    $existingClient->id,
                    $channel,
                    $address
                );
            }
        }

        // Create new client from channel address
        $name = self::extractNameFromAddress($channel, $address);
        
        $client = Client::create([
            'cin' => 'auto-' . Str::random(8),
            'prenom' => $name,
            'nom' => $channel,
            'mail' => $channel === 'email' ? $address : "auto-{$channel}@generated.local",
            'telephone' => $channel === 'sms' || $channel === 'whatsapp' ? $address : null,
            'money' => 0,
        ]);

        // Create channel address
        return ChannelAddress::findOrCreateForClient(
            $client->id,
            $channel,
            $address
        );
    }

    /**
     * Extract name from channel address
     */
    private static function extractNameFromAddress(string $channel, string $address): string
    {
        return match ($channel) {
            'email' => explode('@', $address)[0] ?? 'User',
            'whatsapp', 'sms' => 'Customer ' . substr($address, -4),
            'facebook' => $address,
            default => 'User',
        };
    }

    /**
     * Get or create a conversation in the specified channel
     */
    private static function getOrCreateConversation(
        int $clientId,
        int $employeeId,
        string $channel
    ): Conversation {
        // Try to find existing conversation
        $conversation = Conversation::where(function ($query) use ($clientId, $employeeId) {
            $query->where('sender_id', $clientId)
                ->where('recipient_id', $employeeId)
                ->where('sender_type', 'client')
                ->where('recipient_type', 'employee');
        })->orWhere(function ($query) use ($clientId, $employeeId) {
            $query->where('sender_id', $employeeId)
                ->where('recipient_id', $clientId)
                ->where('sender_type', 'employee')
                ->where('recipient_type', 'client');
        })->first();

        if ($conversation) {
            return $conversation;
        }

        // Create new conversation
        return Conversation::create([
            'sender_id' => $clientId,
            'sender_type' => 'client',
            'recipient_id' => $employeeId,
            'recipient_type' => 'employee',
            'primary_channel' => $channel,
            'active_channels' => [$channel],
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ]);
    }

    /**
     * Get or create system employee for channel contact
     */
    private static function getSystemChannelContact(string $channel): int
    {
        // TODO: Create or get a dedicated employee/bot account for each channel
        // For now, return the first available employee or admin
        $employee = \App\Models\Employee::where('status', 'active')
            ->first();

        if ($employee) {
            return $employee->id;
        }

        // Fallback to user ID if no employee found
        $user = \App\Models\User::where('role', 'admin')->first();
        return $user?->id ?? 1;
    }

    /**
     * Get channel icon/emoji for display
     */
    public static function getChannelIcon(string $channel): string
    {
        return match ($channel) {
            'email' => '📧',
            'whatsapp' => '💬',
            'sms' => '📱',
            'facebook' => 'f',
            'web' => '🌐',
            default => '💬',
        };
    }

    /**
     * Get channel display name
     */
    public static function getChannelDisplayName(string $channel): string
    {
        return match ($channel) {
            'email' => 'Email',
            'whatsapp' => 'WhatsApp',
            'sms' => 'SMS',
            'facebook' => 'Facebook',
            'web' => 'Web Chat',
            default => ucfirst($channel),
        };
    }
}
