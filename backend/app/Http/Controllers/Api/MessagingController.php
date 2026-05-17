<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\User;
use Carbon\Carbon;
use App\Events\TicketMessageCreated;

class MessagingController extends Controller
{
    private function resolveActorFromUser($user): array
    {
        $role = $user->role ?? 'user';

        if ($role === 'employee') {
            $employee = \App\Models\Employee::where('mail', $user->email)
                ->orWhere('cin', $user->cin)
                ->first();

            if (!$employee) {
                return [
                    'role' => $role,
                    'type' => 'user',
                    'id' => $user->id,
                ];
            }

            return [
                'role' => 'employee',
                'type' => 'employee',
                'id' => $employee?->id ?? $user->id,
            ];
        }

        if ($role === 'client') {
            $client = \App\Models\Client::where('mail', $user->email)
                ->orWhere('cin', $user->cin)
                ->first();

            if (!$client) {
                return [
                    'role' => $role,
                    'type' => 'user',
                    'id' => $user->id,
                ];
            }

            return [
                'role' => 'client',
                'type' => 'client',
                'id' => $client?->id ?? $user->id,
            ];
        }

        return [
            'role' => $role,
            'type' => 'user',
            'id' => $user->id,
        ];
    }

    private function resolveParticipant(string $type, int $id)
    {
        return match ($type) {
            'employee' => \App\Models\Employee::find($id),
            'client' => \App\Models\Client::find($id),
            'user' => User::find($id),
            default => User::find($id),
        };
    }

    private function formatParticipant($participant, string $type): ?array
    {
        if (!$participant) {
            return null;
        }

        $name = $participant->name
            ?? trim(($participant->prenom ?? '') . ' ' . ($participant->nom ?? ''))
            ?? $participant->nom
            ?? $participant->prenom
            ?? 'Unknown';

        $email = $participant->email ?? $participant->mail ?? null;
        $role = $participant->role ?? $type;

        return [
            'id' => $participant->id,
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'type' => $type,
        ];
    }

    /**
     * Get all conversations for the authenticated user
     */
    public function conversations(Request $request)
    {
        $actor = $this->resolveActorFromUser($request->user());
        $actorId = $actor['id'];
        $actorType = $actor['type'];

        $conversations = Conversation::where(function ($query) use ($actorId, $actorType) {
            $query->where(function ($nested) use ($actorId, $actorType) {
                $nested->where('sender_id', $actorId)
                    ->where('sender_type', $actorType);
            })->orWhere(function ($nested) use ($actorId, $actorType) {
                $nested->where('recipient_id', $actorId)
                    ->where('recipient_type', $actorType);
            });
        })
        ->with(['sender', 'recipient', 'latestMessage'])
        ->orderBy('updated_at', 'desc')
        ->paginate(20);

        $conversationItems = collect($conversations->items())->map(function ($conv) use ($actorId, $actorType) {
            $isSender = $conv->sender_id === $actorId && $conv->sender_type === $actorType;
            $otherId = $isSender ? $conv->recipient_id : $conv->sender_id;
            $otherType = $isSender ? $conv->recipient_type : $conv->sender_type;
            $otherParticipant = $this->resolveParticipant($otherType, $otherId);
            $unreadCount = Message::where('conversation_id', $conv->id)
                ->where('recipient_id', $actorId)
                ->where('recipient_type', $actorType)
                ->where('is_read', false)
                ->count();

            return [
                'id' => $conv->id,
                'other_participant' => $this->formatParticipant($otherParticipant, $otherType),
                'last_message' => $conv->latestMessage ? [
                    'message' => $conv->latestMessage->message,
                    'sender_id' => $conv->latestMessage->sender_id,
                    'is_read' => $conv->latestMessage->is_read,
                    'created_at' => $conv->latestMessage->created_at,
                ] : null,
                'unread_count' => $unreadCount,
                'updated_at' => $conv->updated_at,
            ];
        });

        return response()->json([
            'conversations' => $conversationItems,
        ]);
    }

    /**
     * Get messages in a conversation with pagination
     */
    public function getMessages(Request $request, $conversationId)
    {
        $actor = $this->resolveActorFromUser($request->user());
        $actorId = $actor['id'];
        $actorType = $actor['type'];
        $conversation = Conversation::find($conversationId);

        if (!$conversation) {
            return response()->json(['message' => 'Conversation not found'], 404);
        }

        // Verify user is part of this conversation
        $isParticipant =
            ($conversation->sender_id === $actorId && $conversation->sender_type === $actorType) ||
            ($conversation->recipient_id === $actorId && $conversation->recipient_type === $actorType);
        if (!$isParticipant) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Mark all messages as read
        Message::where('conversation_id', $conversationId)
            ->where('recipient_id', $actorId)
            ->where('recipient_type', $actorType)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        $messages = Message::where('conversation_id', $conversationId)
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        $messageItems = collect($messages->items())->map(function ($msg) {
            return $msg->formatForResponse();
        });

        $isSender = $conversation->sender_id === $actorId && $conversation->sender_type === $actorType;
        $otherId = $isSender ? $conversation->recipient_id : $conversation->sender_id;
        $otherType = $isSender ? $conversation->recipient_type : $conversation->sender_type;
        $otherParticipant = $this->resolveParticipant($otherType, $otherId);

        return response()->json([
            'conversation_id' => $conversationId,
            'other_participant' => $this->formatParticipant($otherParticipant, $otherType),
            'messages' => $messageItems,
            'pagination' => [
                'current_page' => $messages->currentPage(),
                'total_pages' => $messages->lastPage(),
                'total_messages' => $messages->total(),
            ],
        ]);
    }

    /**
     * Send a message to another user (employee, admin, or client)
     */
    public function sendMessage(Request $request)
    {
        try {
            $request->validate([
                'recipient_id' => 'required',
                'recipient_type' => 'nullable|in:user,employee,client',
                'message' => 'required|string|min:1|max:5000',
                'ticket_id' => 'nullable|exists:demandes,id',
            ]);

            \Log::info('SendMessage called', [
                'user' => $request->user(),
                'user_id' => $request->user()?->id,
                'user_class' => get_class($request->user()),
                'payload' => $request->all(),
            ]);

            $sender = $request->user();
            if (!$sender) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $senderActor = $this->resolveActorFromUser($sender);
            $senderId = $senderActor['id'];
            $senderRole = $senderActor['role'];
            $senderType = $senderActor['type'];
            $recipientId = $request->recipient_id;
            $recipientType = $request->recipient_type;
            $ticketId = $request->ticket_id;

            // Prevent sending to self
            if ($senderId == $recipientId && ($recipientType === null || $recipientType === $senderType)) {
                return response()->json(['message' => 'Cannot send messages to yourself'], 422);
            }
            
            \Log::info('Sender role determined', [
                'sender_id' => $senderId,
                'sender_role' => $senderRole,
                'sender_type' => $senderType,
            ]);
            
            // Resolve recipient, prioritizing explicit type to avoid cross-table ID collisions
            $recipient = null;
            if ($recipientType === 'employee') {
                $recipient = \App\Models\Employee::find($recipientId);
            } elseif ($recipientType === 'client') {
                $recipient = \App\Models\Client::find($recipientId);
            } elseif ($recipientType === 'user') {
                $recipient = User::find($recipientId);
            } else {
                $recipient = User::find($recipientId);
                $recipientType = 'user';

                if (!$recipient) {
                    $recipient = \App\Models\Employee::find($recipientId);
                    $recipientType = 'employee';
                }

                if (!$recipient) {
                    $recipient = \App\Models\Client::find($recipientId);
                    $recipientType = 'client';
                }
            }

            if (!$recipient) {
                \Log::warning('Recipient not found', ['recipient_id' => $recipientId]);
                return response()->json(['message' => 'User not found'], 404);
            }

            // Get recipient role (normalize typed recipients)
            $recipientRole = in_array($recipientType, ['employee', 'client'], true)
                ? $recipientType
                : ($recipient->role ?? $recipientType);

            $recipientUserId = null;
            if ($recipientType === 'employee') {
                $recipientUser = User::where('email', $recipient->mail ?? $recipient->email)
                    ->orWhere('cin', $recipient->cin)
                    ->first();
                $recipientUserId = $recipientUser?->id;
            } elseif ($recipientType === 'client') {
                $recipientUser = User::where('email', $recipient->mail ?? $recipient->email)
                    ->orWhere('cin', $recipient->cin)
                    ->orWhere('code_fiscal', $recipient->code_fiscal)
                    ->first();
                $recipientUserId = $recipientUser?->id;
                \Log::info('Client recipient user lookup', [
                    'client_email' => $recipient->mail ?? $recipient->email,
                    'client_cin' => $recipient->cin,
                    'client_code_fiscal' => $recipient->code_fiscal,
                    'found_user_id' => $recipientUserId,
                ]);
            } elseif ($recipientType === 'user') {
                $recipientUserId = $recipient->id;
            }

            \Log::info('Recipient found', [
                'recipient_id' => $recipientId,
                'recipient_role' => $recipientRole,
                'recipient_class' => get_class($recipient),
            ]);

            // Allow messaging between:
            // - Employee to Employee/Admin/Client
            // - Client to Employee/Admin
            // - Admin to Employee/Client/Admin
            $isValidMessageChain = 
                ($senderRole === 'employee' && in_array($recipientRole, ['employee', 'admin', 'client'])) ||
                ($senderRole === 'client' && in_array($recipientRole, ['employee', 'admin'])) ||
                ($senderRole === 'admin' && in_array($recipientRole, ['employee', 'client', 'admin']));

            if (!$isValidMessageChain) {
                \Log::warning('Invalid message chain', [
                    'sender_role' => $senderRole,
                    'recipient_role' => $recipientRole,
                ]);
                return response()->json(['message' => 'You cannot message this user'], 422);
            }

            // If ticket_id is provided, verify authorization
            if ($ticketId) {
                $ticket = \App\Models\Demande::find($ticketId);
                if (!$ticket) {
                    return response()->json(['message' => 'Ticket not found'], 404);
                }

                // Verify user is associated with the ticket
                $canAccessTicket = ($senderRole === 'employee' && ($ticket->id_employee == $senderId || $ticket->id_employee == $sender->id)) ||
                                  ($senderRole === 'client' && $ticket->id_client == $senderId) ||
                                  ($senderRole === 'admin');

                if (!$canAccessTicket) {
                    \Log::warning('User not authorized for ticket', [
                        'user_id' => $senderId,
                        'ticket_id' => $ticketId,
                        'sender_role' => $senderRole,
                        'ticket_employee_id' => $ticket->id_employee,
                        'ticket_client_id' => $ticket->id_client,
                    ]);
                    return response()->json(['message' => 'Unauthorized to message about this ticket'], 403);
                }
            }

            // Find or create conversation with types
            $conversation = Conversation::findOrCreateBetweenWithTypes(
                $senderId, 
                $senderType, 
                $recipientId, 
                $recipientType
            );

            // Create message with types
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $senderId,
                'sender_type' => $senderType,
                'recipient_id' => $recipientId,
                'recipient_type' => $recipientType,
                'message' => $request->message,
                'ticket_id' => $ticketId,
                'created_at' => Carbon::now(),
            ]);

            // Update conversation last message time
            $conversation->update(['updated_at' => Carbon::now()]);

            if ($ticketId) {
                broadcast(new TicketMessageCreated(
                    $message,
                    (int) $ticketId,
                    $recipientType,
                    (int) $recipientId,
                    $recipientUserId
                ))->toOthers();
            }

            \Log::info('Message created successfully', [
                'message_id' => $message->id,
                'sender_id' => $senderId,
                'recipient_id' => $recipientId,
            ]);

            return response()->json([
                'message' => 'Message sent successfully',
                'data' => $message->formatForResponse(),
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error in sendMessage', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'message' => 'Failed to send message: ' . $e->getMessage(),
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start or get conversation with a specific user (employee, admin, or client)
     */
    public function startSupportConversation(Request $request)
    {
        $request->validate([
            'subject' => 'nullable|string|max:255',
        ]);

        $currentUser = $request->user();
        $currentActor = $this->resolveActorFromUser($currentUser);
        $currentUserRole = $currentUser->role ?? $currentActor['role'];

        if ($currentUserRole !== 'client') {
            return response()->json(['message' => 'Only clients can start support conversations from this endpoint'], 403);
        }

        $supportTarget = User::where('role', 'admin')->orderBy('id')->first();

        if (!$supportTarget) {
            return response()->json(['message' => 'No support admin available'], 404);
        }

        $conversation = Conversation::findOrCreateBetweenWithTypes(
            $currentActor['id'],
            $currentActor['type'],
            $supportTarget->id,
            'user'
        );

        Message::where('conversation_id', $conversation->id)
            ->where('recipient_id', $currentActor['id'])
            ->where('recipient_type', $currentActor['type'])
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        $messages = Message::where('conversation_id', $conversation->id)
            ->orderBy('created_at', 'asc')
            ->limit(50)
            ->get();

        return response()->json([
            'conversation_id' => $conversation->id,
            'other_participant' => $this->formatParticipant($supportTarget, 'user'),
            'messages' => $messages->map(function ($msg) {
                return $msg->formatForResponse();
            }),
            'subject' => $request->input('subject'),
        ]);
    }

    /**
     * Start or get conversation with a specific user (employee, admin, or client)
     */
    public function startConversation(Request $request, $userId)
    {
        $currentUser = $request->user();
        $currentActor = $this->resolveActorFromUser($currentUser);
        $currentUserId = $currentActor['id'];
        $currentUserType = $currentActor['type'];

        // Try to find target user in all tables
        $requestedType = $request->query('type') ?? $request->input('type');
        $targetUser = null;
        $targetUserType = null;

        if ($requestedType) {
            $targetUserType = $requestedType;
            $targetUser = $this->resolveParticipant($requestedType, (int) $userId);
        } else {
            $targetUser = \App\Models\Employee::find($userId);
            $targetUserType = $targetUser ? 'employee' : null;

            if (!$targetUser) {
                $targetUser = \App\Models\Client::find($userId);
                $targetUserType = $targetUser ? 'client' : null;
            }

            if (!$targetUser) {
                $targetUser = User::find($userId);
                $targetUserType = $targetUser ? 'user' : null;
            }
        }

        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Determine target user role
        $targetUserRole = $targetUser->role ?? $targetUserType;

        // Allow conversation between:
        // - Employee to Employee/Admin/Client
        // - Client to Employee/Admin
        // - Admin to Employee/Client/Admin
        $currentUserRole = $currentUser->role ?? $currentUserType;
        $isValidConversation = 
            ($currentUserRole === 'employee' && in_array($targetUserRole, ['employee', 'admin', 'client'])) ||
            ($currentUserRole === 'client' && in_array($targetUserRole, ['employee', 'admin'])) ||
            ($currentUserRole === 'admin' && in_array($targetUserRole, ['employee', 'client', 'admin']));

        if (!$isValidConversation) {
            return response()->json(['message' => 'Cannot start conversation with this user'], 422);
        }

        // Prevent conversation with self
        if ($currentUserId === (int) $userId && $currentUserType === $targetUserType) {
            return response()->json(['message' => 'Cannot message yourself'], 422);
        }

        // Find or create conversation with types
        $conversation = Conversation::findOrCreateBetweenWithTypes(
            $currentUserId, 
            $currentUserType, 
            (int) $userId, 
            $targetUserType
        );

        // Mark messages as read
        Message::where('conversation_id', $conversation->id)
            ->where('recipient_id', $currentUserId)
            ->where('recipient_type', $currentUserType)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        $messages = Message::where('conversation_id', $conversation->id)
            ->orderBy('created_at', 'asc')
            ->limit(50)
            ->get();

        return response()->json([
            'conversation_id' => $conversation->id,
            'other_participant' => $this->formatParticipant($targetUser, $targetUserType),
            'messages' => $messages->map(function ($msg) {
                return $msg->formatForResponse();
            }),
        ]);
    }

    /**
     * Get messages for a specific ticket between employee and client
     */
    public function getTicketMessages(Request $request, $ticketId)
    {
        $user = $request->user();
        $actor = $this->resolveActorFromUser($user);
        $userId = $actor['id'];
        $userRole = $actor['role'];
        $userType = $actor['type'];
        $ticket = \App\Models\Demande::find($ticketId);

        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        // Verify user is associated with the ticket
        $canAccessTicket = ($userRole === 'employee' && $ticket->id_employee == $userId) ||
                          ($userRole === 'client' && $ticket->id_client == $userId) ||
                          ($userRole === 'admin');

        if (!$canAccessTicket) {
            \Log::warning('User cannot access ticket', [
                'user_id' => $userId,
                'user_role' => $userRole,
                'ticket_id' => $ticketId,
                'ticket_employee' => $ticket->id_employee,
                'ticket_client' => $ticket->id_client,
            ]);
            return response()->json(['message' => 'Unauthorized to view this ticket'], 403);
        }

        // Get all messages related to this ticket
        $messages = Message::where('ticket_id', $ticketId)
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        $messageItems = collect($messages->items())->map(function ($msg) {
            return $msg->formatForResponse();
        });

        // Mark unread messages as read
        Message::where('ticket_id', $ticketId)
            ->where('recipient_id', $userId)
            ->where('recipient_type', $userType)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        // Get the other party (client or employee) - include email field
        $otherParty = $userRole === 'employee'
            ? $ticket->client
            : ($userRole === 'client'
                ? \App\Models\Employee::find($ticket->id_employee)
                : ($ticket->employee ?? $ticket->client));

        $otherPartyType = $userRole === 'employee'
            ? 'client'
            : ($userRole === 'client' ? 'employee' : ($ticket->employee ? 'employee' : 'client'));

        $otherPartyData = $this->formatParticipant($otherParty, $otherPartyType);

        return response()->json([
            'ticket_id' => $ticketId,
            'ticket_title' => $ticket->titre,
            'other_participant' => $otherPartyData,
            'messages' => $messageItems,
            'pagination' => [
                'current_page' => $messages->currentPage(),
                'total_pages' => $messages->lastPage(),
                'total_messages' => $messages->total(),
            ],
        ]);
    }

    /**
     * Get available employees
     */
    public function getAvailableEmployees(Request $request)
    {
        $currentActor = $this->resolveActorFromUser($request->user());
        $currentActorId = $currentActor['id'];

        $employees = \App\Models\Employee::orderBy('nom')
            ->get()
            ->filter(function ($emp) use ($currentActorId, $currentActor) {
                if ($currentActor['type'] !== 'employee') {
                    return true;
                }

                return $emp->id !== $currentActorId;
            })
            ->values();

        $admin = User::where('role', 'admin')
            ->select('id', 'name', 'email', 'role')
            ->first();

        $available = $employees->map(function ($emp) {
            $name = trim(($emp->prenom ?? '') . ' ' . ($emp->nom ?? '')) ?: ($emp->nom ?? 'Employee');
            return [
                'id' => $emp->id,
                'name' => $name,
                'email' => $emp->mail ?? null,
                'role' => 'employee',
                'type' => 'employee',
            ];
        });

        if ($admin) {
            $available->push([
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => $admin->role,
                'type' => 'user',
            ]);
        }

        return response()->json([
            'available_employees' => $available,
        ]);
    }

    /**
     * Get unread message summary
     */
    public function unreadSummary(Request $request)
    {
        $actor = $this->resolveActorFromUser($request->user());
        $userId = $actor['id'];
        $userType = $actor['type'];

        $unreadCount = Message::where('recipient_id', $userId)
            ->where('recipient_type', $userType)
            ->where('is_read', false)
            ->count();

        $unreadByConversation = Message::where('recipient_id', $userId)
            ->where('recipient_type', $userType)
            ->where('is_read', false)
            ->groupBy('conversation_id')
            ->selectRaw('conversation_id, COUNT(*) as count')
            ->with('conversation')
            ->get();

        return response()->json([
            'total_unread' => $unreadCount,
            'unread_by_conversation' => $unreadByConversation->map(function ($item) {
                return [
                    'conversation_id' => $item->conversation_id,
                    'unread_count' => $item->count,
                ];
            }),
        ]);
    }

    /**
     * Search messages
     */
    public function searchMessages(Request $request)
    {
        $request->validate([
            'query' => 'required|string|min:1',
            'conversation_id' => 'nullable|exists:conversations,id',
        ]);

        $actor = $this->resolveActorFromUser($request->user());
        $userId = $actor['id'];
        $userType = $actor['type'];
        $query = $request->query;
        $conversationId = $request->conversation_id;

        $queryBuilder = Message::where(function ($builder) use ($userId, $userType) {
            $builder->where(function ($nested) use ($userId, $userType) {
                $nested->where('sender_id', $userId)
                    ->where('sender_type', $userType);
            })->orWhere(function ($nested) use ($userId, $userType) {
                $nested->where('recipient_id', $userId)
                    ->where('recipient_type', $userType);
            });
        })->where('message', 'like', '%' . $query . '%');

        if ($conversationId) {
            $queryBuilder->where('conversation_id', $conversationId);
        }

        $messages = $queryBuilder
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json([
            'query' => $query,
            'results' => $messages->map(function ($msg) {
                return $msg->formatForResponse();
            }),
        ]);
    }

    /**
     * Delete a message (only if sent by current user)
     */
    public function deleteMessage(Request $request, $messageId)
    {
        $message = Message::find($messageId);

        if (!$message) {
            return response()->json(['message' => 'Message not found'], 404);
        }

        // Only sender can delete
        $actor = $this->resolveActorFromUser($request->user());
        if ($message->sender_id !== $actor['id'] || $message->sender_type !== $actor['type']) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $message->delete();

        return response()->json(['message' => 'Message deleted successfully']);
    }
}
