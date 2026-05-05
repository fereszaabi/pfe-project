<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('ticket.{ticketId}', function ($user, $ticketId) {
    $ticket = \App\Models\Demande::find($ticketId);
    if (!$ticket) {
        return false;
    }

    $role = $user->role ?? 'user';

    if ($role === 'admin') {
        return true;
    }

    if ($role === 'employee') {
        $employee = \App\Models\Employee::where('mail', $user->email)
            ->orWhere('cin', $user->cin)
            ->first();

        $employeeId = $employee?->id ?? $user->id;
        return (int) $ticket->id_employee === (int) $employeeId;
    }

    if ($role === 'client') {
        $client = \App\Models\Client::where('mail', $user->email)
            ->orWhere('cin', $user->cin)
            ->first();

        $clientId = $client?->id ?? $user->id;
        return (int) $ticket->id_client === (int) $clientId;
    }

    return false;
});

Broadcast::channel('user.{type}.{id}', function ($user, $type, $id) {
    $role = $user->role ?? 'user';

    if ($type === 'employee' && $role === 'employee') {
        $employee = \App\Models\Employee::where('mail', $user->email)
            ->orWhere('cin', $user->cin)
            ->first();

        $employeeId = $employee?->id ?? $user->id;
        return (int) $employeeId === (int) $id;
    }

    if ($type === 'client' && $role === 'client') {
        $client = \App\Models\Client::where('mail', $user->email)
            ->orWhere('cin', $user->cin)
            ->first();

        $clientId = $client?->id ?? $user->id;
        return (int) $clientId === (int) $id;
    }

    if ($type === 'user') {
        return (int) $user->id === (int) $id;
    }

    return false;
});

Broadcast::channel('user.user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
