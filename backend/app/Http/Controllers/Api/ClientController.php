<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Demande;
use App\Models\Client;
use App\Models\Machine;
use App\Models\Log;
use App\Models\User;
use App\Models\Employee;
use App\Events\TicketUpdated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class ClientController extends Controller
{
    private function resolveClient($user)
    {
        if (!$user) {
            return null;
        }

        $client = null;

        $email = $user->email ?? null;
        if (!empty($email)) {
            $client = Client::where('mail', $email)->first();
            if ($client) {
                return $client;
            }
        }

        if (!empty($user->cin)) {
            $client = Client::where('cin', $user->cin)->first();
            if ($client) {
                return $client;
            }
        }

        if (!empty($user->code_fiscal)) {
            $client = Client::where('code_fiscal', $user->code_fiscal)->first();
            if ($client) {
                return $client;
            }
        }

        // Debug: Log what we're looking for
        \Log::debug('Client not resolved', [
            'user_id' => $user->id,
            'user_cin' => $user->cin ?? 'null',
            'user_code_fiscal' => $user->code_fiscal ?? 'null',
            'user_email' => $user->email ?? 'null',
        ]);

        return null;
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        \Log::debug('index: User from token', [
            'user_id' => $user?->id,
            'user_role' => $user?->role,
            'user_cin' => $user?->cin,
            'user_code_fiscal' => $user?->code_fiscal,
            'user_email' => $user?->email,
        ]);

        $client = $this->resolveClient($user);

        if (!$client) {
            \Log::debug('index: Client not found after resolution');
            return response()->json(['error' => 'Client not found'], 404);
        }

        \Log::debug('index: Client resolved', [
            'client_id' => $client->id,
            'client_cin' => $client->cin,
            'client_mail' => $client->mail,
        ]);

        $clientId = $client->id;

        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:120',
            'status' => 'nullable|string|max:50',
            'all' => 'nullable|boolean',
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $status = $validated['status'] ?? null;
        $fetchAll = $request->boolean('all');

        $demandesQuery = Demande::where('id_client', $clientId)
            ->select([
                'id',
                'titre',
                'status',
                'description',
                'priority',
                'employee_note',
                'client_rating',
                'rating_comment',
                'created_at',
                'image',
            ]);

        if ($status) {
            $demandesQuery->where('status', $status);
        }

        if ($search !== '') {
            $demandesQuery->where(function ($query) use ($search) {
                $query->where('titre', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%");
            });
        }

        $demandesQuery->latest('created_at');

        if ($fetchAll) {
            $demandes = $demandesQuery->get();
            \Log::debug('index: Demandes fetched (all)', [
                'count' => $demandes->count(),
            ]);

            return response()->json([
                'ok' => true,
                'demandes' => $demandes,
                'counts' => [
                    'total' => $demandes->count(),
                    'open' => $demandes->where('status', 'submitted')->count(),
                    'closed' => $demandes->where('status', 'resolved')->count(),
                    'in_progress' => $demandes->where('status', 'in progress')->count(),
                    'tech' => $demandes->where('status', 'tech')->count(),
                    'money' => Client::where('id', $clientId)->value('money'),
                ],
            ]);
        }

        $demandes = $demandesQuery
            ->paginate($perPage);

        \Log::debug('index: Demandes fetched', [
            'count' => count($demandes->items()),
            'total' => $demandes->total(),
            'per_page' => $perPage,
        ]);

        $counts = [
            'total'       => Demande::where('id_client', $clientId)->count(),
            'open'        => Demande::where('id_client', $clientId)->where('status', 'submitted')->count(),
            'closed'      => Demande::where('id_client', $clientId)->where('status', 'resolved')->count(),
            'in_progress' => Demande::where('id_client', $clientId)->where('status', 'in progress')->count(),
            'tech'        => Demande::where('id_client', $clientId)->where('status', 'tech')->count(),
            'money'       => Client::where('id', $clientId)->value('money'),
        ];

        return response()->json([
            'ok' => true,
            'demandes' => $demandes,
            'counts'   => $counts,
        ]);
    }

    /**
     * Get client's registered machines
     */
    public function getMachines(Request $request)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $machines = Machine::where('id_client', $client->id)
            ->select(['id', 'code_anydesk', 'nom_poste', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['machines' => $machines]);
    }

    /**
     * Stream client logs via Server-Sent Events (SSE) for real-time notifications.
     */
    public function streamLogs(Request $request)
    {
        $token = $request->query('token');
        if (!$token) {
            return response()->json(['error' => 'Missing token'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($token);
        if (!$accessToken) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        $user = $accessToken->tokenable;
        if (!$user || $user->role !== 'client') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $client = $this->resolveClient($user);
        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $startFromId = (int) $request->query('last_id', 0);

        return response()->stream(function () use ($client, $startFromId) {
            @ini_set('zlib.output_compression', 0);
            @ini_set('output_buffering', 'off');

            $lastSentId = $startFromId;

            while (true) {
                if (connection_aborted()) {
                    break;
                }

                $logsQuery = Log::where('client_id', $client->id)
                    ->orderBy('id', 'asc')
                    ->limit(50);

                if ($lastSentId > 0) {
                    $logsQuery->where('id', '>', $lastSentId);
                }

                $logs = $logsQuery->get();

                if ($logs->isNotEmpty()) {
                    $lastSentId = $logs->last()->id;
                    echo "event: logs\n";
                    echo 'data: ' . json_encode($logs) . "\n\n";
                } else {
                    echo "event: ping\n";
                    echo 'data: ' . json_encode(['type' => 'ping', 'time' => now()->toISOString()]) . "\n\n";
                }

                @ob_flush();
                @flush();
                sleep(3);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        \Log::debug('store: User from token', [
            'user_id' => $user?->id,
            'user_role' => $user?->role,
            'user_cin' => $user?->cin,
            'user_code_fiscal' => $user?->code_fiscal,
            'user_email' => $user?->email,
        ]);

        $client = $this->resolveClient($user);

        if (!$client) {
            \Log::debug('store: Client not found after resolution');
            return response()->json(['error' => 'Client not found'], 404);
        }

        \Log::debug('store: Client resolved', [
            'client_id' => $client->id,
            'client_cin' => $client->cin,
            'client_mail' => $client->mail,
        ]);

        $clientId = $client->id;

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('demandes', 'public');
        }

        // Handle machine selection or creation
        $machineId = null;
        
        if ($request->machine_id) {
            // Use existing machine
            $machine = Machine::find($request->machine_id);
            if (!$machine || $machine->id_client !== $clientId) {
                return response()->json(['error' => 'Invalid machine'], 422);
            }
            $machineId = $machine->id;
        } elseif ($request->code_anydesk) {
            // Create new machine with anydesk code
            $machine = Machine::create([
                'id_client' => $clientId,
                'code_anydesk' => $request->code_anydesk,
                'nom_poste' => $request->code_anydesk, // Use code as name
            ]);
            $machineId = $machine->id;
        } else {
            return response()->json(['error' => 'Machine ID or AnyDesk code required'], 422);
        }

        // Check if client has insufficient funds for the chosen priority
        $priorityFees = [
            'low' => 10,
            'medium' => 20,
            'high' => 25,
            'urgent' => 30,
        ];
        $priorityKey = strtolower((string) $request->priority);
        $requiredFee = $priorityFees[$priorityKey] ?? 10;
        
        $hasInsufficientFunds = $client->money < $requiredFee;
        $paymentDeadline = now()->addWeek();
        $originalBalance = $client->money;

        try {
            $result = \DB::transaction(function () use ($client, $clientId, $request, $machineId, $imagePath, $requiredFee, $hasInsufficientFunds, $paymentDeadline, $originalBalance) {
                $newBalance = $client->money - $requiredFee;
                $client->update(['money' => $newBalance]);

                $demande = Demande::create([
                    'id_client'             => $clientId,
                    'titre'                 => $request->titre,
                    'id_employee'           => null,
                    'priority'              => $request->priority,
                    'id_machine'            => $machineId,
                    'description'           => $request->description,
                    'image'                 => $imagePath,
                    'status'                => 'submitted',
                    'ticket_cost'           => $requiredFee,
                    'total_cost'            => $requiredFee,
                    'payment_status'        => $hasInsufficientFunds ? 'pending' : 'paid',
                    'paid_at'               => $hasInsufficientFunds ? null : now(),
                    'payment_notes'         => $hasInsufficientFunds
                        ? 'Payment due within 7 days. Admin notified.'
                        : 'Ticket fee charged on submission.',
                    'end_at'                => null,
                    'employee_note'         => null,
                    'insufficient_funds'    => $hasInsufficientFunds,
                    'admin_approved_override' => false,
                    'created_at'            => now(),
                ]);

                try {
                    \App\Models\Log::create([
                        'demande_id' => $demande->id,
                        'client_id' => $clientId,
                        'description' => $hasInsufficientFunds
                            ? 'Client submitted a ticket with insufficient funds. Required ' . $requiredFee . ' TND, balance changed from ' . $originalBalance . ' to ' . $newBalance . '. Payment due within 7 days. Admin notified.'
                            : 'Client submitted a ticket and was charged ' . $requiredFee . ' TND. New balance: ' . $newBalance,
                        'status' => $hasInsufficientFunds ? 'insufficient_funds' : 'balance_change',
                        'created_at_demande' => now(),
                    ]);
                } catch (\Throwable $e) {
                    // swallow: logging failure should not affect client flow
                }

                return [
                    'demande' => $demande,
                    'client_balance' => $newBalance,
                    'insufficient_funds' => $hasInsufficientFunds,
                    'warning' => $hasInsufficientFunds
                        ? 'Insufficient funds. Your ticket was submitted. Please pay within 7 days. An admin has been notified.'
                        : null,
                    'payment_deadline' => $hasInsufficientFunds ? $paymentDeadline->toDateString() : null,
                ];
            });

            return response()->json($result, 201);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to submit ticket: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Demande $ticket)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json([
            'ok' => true,
            'ticket' => $ticket->load('machine', 'employee', 'client'),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Demande $demande)
    {
        //
    }

    /**
     * Rate a completed ticket (client rating for employee)
     */
    public function rate(Request $request, Demande $ticket)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Validate rating
        $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'rating_comment' => 'nullable|string|max:1000',
        ]);

        // Only allow rating completed tickets
        if (!in_array($ticket->status, ['resolved', 'closed'], true)) {
            return response()->json([
                'message' => 'Can only rate completed/resolved tickets'
            ], 422);
        }

        // Prevent multiple ratings for the same ticket.
        if (!is_null($ticket->client_rating)) {
            return response()->json([
                'message' => 'This ticket has already been rated'
            ], 422);
        }

        // Update the ticket with client rating
        $ticket->update([
            'client_rating' => $request->rating,
            'rating_comment' => $request->input('rating_comment'),
        ]);

        // Recalculate employee performance if ticket is assigned
        if ($ticket->id_employee) {
            $employee = Employee::find($ticket->id_employee);
            if ($employee) {
                $employee->recalculatePerformance();
            }
        }

        $updatedTicket = $ticket->fresh()->load(['client', 'employee', 'machine']);
        broadcast(new TicketUpdated($updatedTicket))->toOthers();

        return response()->json([
            'ok' => true,
            'message' => 'Rating submitted successfully',
            'ticket' => $updatedTicket,
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Demande $ticket)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        // Ensure the ticket belongs to the authenticated client
        if ($ticket->id_client !== $client->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $ticket->delete();

        return response()->json(['message' => 'Ticket deleted successfully']);
    }
    /**
     * Get recent logs for authenticated client (used to sync balance changes)
     */
    public function getLogs(Request $request)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:200',
            'search' => 'nullable|string|max:120',
            'status' => 'nullable|string|max:50',
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);
        $search = trim((string) ($validated['search'] ?? ''));
        $status = $validated['status'] ?? null;

        $logsQuery = \App\Models\Log::where('client_id', $client->id)
            ->orderBy('created_at', 'desc');

        if ($status) {
            $logsQuery->where('status', $status);
        }

        if ($search !== '') {
            $logsQuery->where(function ($query) use ($search) {
                $query->where('description', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('software_name', 'like', "%{$search}%");
            });
        }

        $logs = $logsQuery->paginate($perPage);

        return response()->json([
            'ok' => true,
            'logs' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'total_pages' => $logs->lastPage(),
                'total_logs' => $logs->total(),
            ],
        ]);
    }

    /**
     * Mark a client log as read (notification consumed)
     */
    public function markLogRead(Request $request, $logId)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        if (!$client) {
            return response()->json(['error' => 'Client not found'], 404);
        }

        $log = \App\Models\Log::where('id', $logId)->where('client_id', $client->id)->first();
        if (!$log) {
            return response()->json(['error' => 'Log not found'], 404);
        }

        $log->update(['is_read' => true]);
        return response()->json([
            'ok' => true,
            'message' => 'Marked as read',
            'log' => $log,
        ]);
    }

    /**
     * Delete the image attached to a ticket. Clients can delete their own attachments; employees can delete attachments on tickets they handle.
     */
    public function deleteTicketImage(Request $request, Demande $ticket)
    {
        $user = $request->user();
        $client = $this->resolveClient($user);

        // Authorization: clients must own the ticket; employees must be assigned or have employee role
        if ($user->role === 'client') {
            if (!$client || $ticket->id_client !== $client->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        } elseif ($user->role === 'employee') {
            // allow employees to delete attachments on tickets they are assigned to or generally
            // if strict: check assignment: if ($ticket->id_employee && $ticket->id_employee != $user->id) return 403;
        } else {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $original = $ticket->getOriginal('image');
        if (!$original) {
            return response()->json(['message' => 'No image to delete'], 200);
        }

        try {
            if (\Illuminate\Support\Facades\Storage::disk('public')->exists($original)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($original);
            }
            $ticket->update(['image' => null]);
            return response()->json(['message' => 'Image deleted', 'ticket' => $ticket->fresh()]);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to delete image: ' . $e->getMessage()], 500);
        }
    }
}
