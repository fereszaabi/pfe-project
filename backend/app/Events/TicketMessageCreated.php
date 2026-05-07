<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketMessageCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Message $message;
    public int $ticketId;
    public string $recipientType;
    public int $recipientId;
    public ?int $recipientUserId;

    public function __construct(Message $message, int $ticketId, string $recipientType, int $recipientId, ?int $recipientUserId = null)
    {
        $this->message = $message;
        $this->ticketId = $ticketId;
        $this->recipientType = $recipientType;
        $this->recipientId = $recipientId;
        $this->recipientUserId = $recipientUserId;
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('ticket.' . $this->ticketId),
            new PrivateChannel('user.' . $this->recipientType . '.' . $this->recipientId),
        ];

        if ($this->recipientUserId) {
            $channels[] = new PrivateChannel('user.user.' . $this->recipientUserId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'ticket.message.created';
    }

    public function broadcastWith(): array
    {
        return [
            'ticket_id' => $this->ticketId,
            'message' => $this->message->formatForResponse(),
            'recipient' => [
                'type' => $this->recipientType,
                'id' => $this->recipientId,
            ],
        ];
    }
}
