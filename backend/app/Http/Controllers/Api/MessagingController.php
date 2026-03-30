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

        return response()->json([
            'conversations' => $conversations->map(function ($conv) use ($userId) {
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
            }),
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
            ->with('sender', 'recipient')
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        return response()->json([
            'conversation_id' => $conversationId,
            'other_participant' => [
                'id' => $conversation->getOtherParticipant($userId)->id,
                'name' => $conversation->getOtherParticipant($userId)->name,
                'email' => $conversation->getOtherParticipant($userId)->email,
            ],
            'messages' => $messages->map(function ($msg) {
                return $msg->formatForResponse();
            }),
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
        $request->validate([
            'recipient_id' => 'required|exists:users,id',
            'message' => 'required|string|min:1|max:5000',
        ]);

        $senderId = $request->user()->id;
        $recipientId = $request->recipient_id;

        // Prevent sending to self
        if ($senderId === $recipientId) {
            return response()->json(['message' => 'Cannot send messages to yourself'], 422);
        }

        $sender = User::find($senderId);
        $recipient = User::find($recipientId);

        // Allow messaging between:
        // - Employee to Employee/Admin
        // - Employee to Client
        // - Client to Employee/Admin
        $isValidMessageChain = 
            ($sender->role === 'employee' && in_array($recipient->role, ['employee', 'admin', 'client'])) ||
            ($sender->role === 'client' && in_array($recipient->role, ['employee', 'admin'])) ||
            ($sender->role === 'admin' && in_array($recipient->role, ['employee', 'client', 'admin']));

        if (!$isValidMessageChain) {
            return response()->json(['message' => 'You cannot message this user'], 422);
        }

        // Find or create conversation
        $conversation = Conversation::findOrCreateBetween($senderId, $recipientId);

        // Create message
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $senderId,
            'recipient_id' => $recipientId,
            'message' => $request->message,
            'created_at' => Carbon::now(),
        ]);

        // Update conversation last message time
        $conversation->update(['updated_at' => Carbon::now()]);

        return response()->json([
            'message' => 'Message sent successfully',
            'data' => $message->formatForResponse(),
        ], 201);
    }

    /**
     * Start or get conversation with a specific user (employee, admin, or client)
     */
    public function startConversation(Request $request, $userId)
    {
        $currentUserId = $request->user()->id;
        $currentUser = User::find($currentUserId);

        // Verify target user exists
        $targetUser = User::find($userId);
        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Allow conversation between:
        // - Employee to Employee/Admin
        // - Employee to Client
        // - Client to Employee/Admin
        $isValidConversation = 
            ($currentUser->role === 'employee' && in_array($targetUser->role, ['employee', 'admin', 'client'])) ||
            ($currentUser->role === 'client' && in_array($targetUser->role, ['employee', 'admin'])) ||
            ($currentUser->role === 'admin' && in_array($targetUser->role, ['employee', 'client', 'admin']));

        if (!$isValidConversation) {
            return response()->json(['message' => 'Cannot start conversation with this user'], 422);
        }

        // Prevent conversation with self
        if ($currentUserId === $userId) {
            return response()->json(['message' => 'Cannot message yourself'], 422);
        }

        // Find or create conversation
        $conversation = Conversation::findOrCreateBetween($currentUserId, $userId);

        // Mark messages as read
        Message::where('conversation_id', $conversation->id)
            ->where('recipient_id', $currentUserId)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => Carbon::now(),
            ]);

        $messages = Message::where('conversation_id', $conversation->id)
            ->with('sender', 'recipient')
            ->orderBy('created_at', 'asc')
            ->limit(50)
            ->get();

        return response()->json([
            'conversation_id' => $conversation->id,
            'other_participant' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
            ],
            'messages' => $messages->map(function ($msg) {
                return $msg->formatForResponse();
            }),
        ]);
    }

    /**
     * Get list of available employees to message
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
        $userId = $request->user()->id;

        $unreadCount = Message::where('recipient_id', $userId)
            ->where('is_read', false)
            ->count();

        $unreadByConversation = Message::where('recipient_id', $userId)
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

        $messages = $queryBuilder->with('sender', 'recipient')
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
