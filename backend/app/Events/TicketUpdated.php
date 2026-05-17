<?php

namespace App\Events;

use App\Models\Demande;
use App\Models\Client;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Demande $ticket;

    public function __construct(Demande $ticket)
    {
        $this->ticket = $ticket;
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('ticket.' . $this->ticket->id),
        ];

        if ($this->ticket->id_client) {
            $channels[] = new PrivateChannel('user.client.' . $this->ticket->id_client);
        }

        $clientUserId = $this->resolveUserIdForClient($this->ticket->id_client);
        if ($clientUserId) {
            $channels[] = new PrivateChannel('user.user.' . $clientUserId);
        }

        if ($this->ticket->id_employee) {
            $channels[] = new PrivateChannel('user.employee.' . $this->ticket->id_employee);
        }

        $employeeUserId = $this->resolveUserIdForEmployee($this->ticket->id_employee);
        if ($employeeUserId) {
            $channels[] = new PrivateChannel('user.user.' . $employeeUserId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'ticket.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'ticket' => $this->ticket->load(['client', 'employee', 'machine']),
        ];
    }

    private function resolveUserIdForClient(?int $clientId): ?int
    {
        if (!$clientId) {
            return null;
        }

        $client = Client::find($clientId);
        if (!$client) {
            return null;
        }

        $user = User::where('cin', $client->cin)
            ->orWhere('email', $client->mail)
            ->first();

        return $user?->id;
    }

    private function resolveUserIdForEmployee(?int $employeeId): ?int
    {
        if (!$employeeId) {
            return null;
        }

        $employee = Employee::find($employeeId);
        if (!$employee) {
            return null;
        }

        $user = User::where('cin', $employee->cin)
            ->orWhere('email', $employee->mail)
            ->first();

        return $user?->id;
    }
}
