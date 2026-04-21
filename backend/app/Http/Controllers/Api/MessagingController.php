<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\User;
use Carbon\Carbon;

class MessagingController extends Controller
{
    private function resolveActorFromUser($user): array
    {
        $role = $user->role ?? 'user';

        if ($role === 'employee') {
            $employee = \App\Models\Employee::where('mail', $user->email)
                ->orWhere('cin', $user->cin)
                ->first();

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

    /**
     * Get all conversations for the authenticated user
     */
    public function conversations(Request $request)
    {
        $userId = $request->user()->id;

        $conversations = Conversation::where(function ($query) use ($userId) {
            $query->where('sender_id', $userId)
                  ->orWhere('recipient_id', $userId);
        })
        ->with(['sender', 'recipient', 'latestMessage'])
        ->orderBy('updated_at', 'desc')
        ->paginate(20);

        $conversationItems = collect($conversations->items())->map(function ($conv) use ($userId) {
            $otherParticipant = $conv->getOtherParticipant($userId);
            $unreadCount = $conv->unreadCount($userId);

            return [
                'id' => $conv->id,
                'other_participant' => [
                    'id' => $otherParticipant->id,
                    'name' => $otherParticipant->name,
                    'email' => $otherParticipant->email,
                    'role' => $otherParticipant->role,
                ],
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
        $userId = $request->user()->id;
        $conversation = Conversation::find($conversationId);

        if (!$conversation) {
            return response()->json(['message' => 'Conversation not found'], 404);
        }

        // Verify user is part of this conversation
        if ($conversation->sender_id !== $userId && $conversation->recipient_id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Mark all messages as read
        Message::where('conversation_id', $conversationId)
            ->where('recipient_id', $userId)
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

        return response()->json([
            'conversation_id' => $conversationId,
            'other_participant' => [
                'id' => $conversation->getOtherParticipant($userId)->id,
                'name' => $conversation->getOtherParticipant($userId)->name,
                'email' => $conversation->getOtherParticipant($userId)->email,
            ],
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
    public function startConversation(Request $request, $userId)
    {
        $currentUser = $request->user();
        $currentUserId = $currentUser->id;

        // Determine current user type
        $currentUserClass = get_class($currentUser);
        if (strpos($currentUserClass, 'Employee') !== false) {
            $currentUserType = 'employee';
        } elseif (strpos($currentUserClass, 'Client') !== false) {
            $currentUserType = 'client';
        } else {
            $currentUserType = 'user';
        }

        // Try to find target user in all tables
        $targetUser = User::find($userId);
        $targetUserType = 'user';
        
        if (!$targetUser) {
            $targetUser = \App\Models\Employee::find($userId);
            $targetUserType = 'employee';
        }
        
        if (!$targetUser) {
            $targetUser = \App\Models\Client::find($userId);
            $targetUserType = 'client';
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
        if ($currentUserId === $userId) {
            return response()->json(['message' => 'Cannot message yourself'], 422);
        }

        // Find or create conversation with types
        $conversation = Conversation::findOrCreateBetweenWithTypes(
            $currentUserId, 
            $currentUserType, 
            $userId, 
            $targetUserType
        );

        // Mark messages as read
        Message::where('conversation_id', $conversation->id)
            ->where('recipient_id', $currentUserId)
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
            'other_participant' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email ?? $targetUser->mail ?? null,
                'role' => $targetUser->role,
            ],
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
            : \App\Models\Employee::find($ticket->id_employee);

        $otherPartyData = null;
        if ($otherParty) {
            $otherPartyData = [
                'id' => $otherParty->id,
                'name' => $otherParty->name,
                'email' => $otherParty->email ?? $otherParty->mail ?? null,
            ];
        }

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
        $currentUserId = $request->user()->id;

        $employees = User::where('role', 'employee')
            ->where('id', '!=', $currentUserId)
            ->where('performance_status', 'active')
            ->select('id', 'name', 'email', 'role', 'current_workload', 'avg_rating')
            ->orderBy('name')
            ->get();

        // Also include admin
        $admin = User::where('role', 'admin')
            ->where('id', '!=', $currentUserId)
            ->select('id', 'name', 'email', 'role')
            ->first();

        $result = $employees;
        if ($admin) {
            $result->push($admin);
        }

        return response()->json([
            'available_employees' => $result->map(function ($emp) {
                return [
                    'id' => $emp->id,
                    'name' => $emp->name,
                    'email' => $emp->email,
                    'role' => $emp->role,
                    'current_workload' => $emp->current_workload ?? 0,
                    'avg_rating' => (float) ($emp->avg_rating ?? 0),
                ];
            }),
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

        $userId = $request->user()->id;
        $query = $request->query;
        $conversationId = $request->conversation_id;

        $queryBuilder = Message::whereRaw(
            '(sender_id = ? OR recipient_id = ?)',
            [$userId, $userId]
        )->where('message', 'like', '%' . $query . '%');

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
        if ($message->sender_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $message->delete();

        return response()->json(['message' => 'Message deleted successfully']);
    }
}
