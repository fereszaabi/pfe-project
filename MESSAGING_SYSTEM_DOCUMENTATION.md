================================================================================
                   SUPPORT AGENT MESSAGING SYSTEM
================================================================================

OVERVIEW:
Support agents (employees and admins) can now communicate with each other in
real-time through the messaging system. Each conversation is tracked and 
messages are marked as read/unread for easy tracking.

================================================================================
DATABASE SCHEMA
================================================================================

TABLE: conversations
- id (Primary Key)
- sender_id (Foreign Key → users.id)
- recipient_id (Foreign Key → users.id)
- created_at (Timestamp)
- updated_at (Timestamp)
- last_message_at (Timestamp) - stores when the latest message was sent

TABLE: messages
- id (Primary Key)
- conversation_id (Foreign Key → conversations.id)
- sender_id (Foreign Key → users.id)
- recipient_id (Foreign Key → users.id)
- message (Long Text)
- is_read (Boolean, default: false)
- read_at (Timestamp, nullable)
- created_at (Timestamp)

KEY FEATURES:
✓ Bidirectional conversations (order-independent)
✓ Message read/unread tracking with timestamps
✓ Indexed for fast queries
✓ Supports pagination for large conversations
✓ Auto-creates conversations on first message

================================================================================
API ENDPOINTS
================================================================================

BASE URL: http://localhost:8000/api

AUTHENTICATION:
All endpoints require Bearer token (employee or admin role)
Header: Authorization: Bearer {token}

================================================================================
1. GET /messages/conversations
================================================================================
Get all conversations for the current user

RESPONSE:
{
  "conversations": [
    {
      "id": 1,
      "other_participant": {
        "id": 2,
        "name": "Marco Rivera",
        "email": "marco.rivera@idsoft.tn",
        "role": "employee"
      },
      "last_message": {
        "message": "How's the ticket going?",
        "sender_id": 2,
        "is_read": true,
        "created_at": "2026-03-25T10:30:00"
      },
      "unread_count": 0,
      "updated_at": "2026-03-25T10:30:00"
    }
  ]
}

PAGINATION: Default 20 per page

================================================================================
2. GET /messages/conversations/{conversationId}
================================================================================
Get all messages in a specific conversation

PARAMETERS:
- conversationId: Conversation ID (integer)

RESPONSE:
{
  "conversation_id": 1,
  "other_participant": {
    "id": 2,
    "name": "Marco Rivera",
    "email": "marco.rivera@idsoft.tn"
  },
  "messages": [
    {
      "id": 5,
      "conversation_id": 1,
      "sender": {
        "id": 2,
        "name": "Marco Rivera",
        "email": "marco.rivera@idsoft.tn"
      },
      "recipient": {
        "id": 1,
        "name": "Sarah Johnson",
        "email": "sarah.johnson@idsoft.tn"
      },
      "message": "Can you assist with ticket #123?",
      "is_read": true,
      "read_at": "2026-03-25T10:32:00",
      "created_at": "2026-03-25T10:30:00"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_messages": 150
  }
}

SIDE EFFECTS:
- Automatically marks all unread messages as read
- Updates read_at timestamp

================================================================================
3. POST /messages/send
================================================================================
Send a message to another employee

REQUEST BODY:
{
  "recipient_id": 2,
  "message": "I need help with a complex ticket"
}

VALIDATION:
- recipient_id: Required, must exist in users table
- message: Required, min 1 char, max 5000 chars
- Cannot send to yourself
- Recipient must be employee or admin

RESPONSE:
{
  "message": "Message sent successfully",
  "data": {
    "id": 10,
    "conversation_id": 1,
    "sender": {...},
    "recipient": {...},
    "message": "I need help with a complex ticket",
    "is_read": false,
    "read_at": null,
    "created_at": "2026-03-25T10:35:00"
  }
}

STATUS CODES:
- 201: Message sent successfully
- 422: Validation error or unallowed recipient
- 403: Unauthorized

================================================================================
4. POST /messages/start/{userId}
================================================================================
Start a new conversation or load existing one with a specific employee

PARAMETERS:
- userId: Employee ID to message (integer)

RESPONSE:
Same as GET /messages/conversations/{conversationId}

FEATURES:
- Finds existing conversation or creates new one
- Auto-loads last 50 messages
- Marks all messages as read

================================================================================
5. GET /messages/available-employees
================================================================================
Get list of employees available to message

RESPONSE:
{
  "available_employees": [
    {
      "id": 2,
      "name": "Marco Rivera",
      "email": "marco.rivera@idsoft.tn",
      "role": "employee",
      "current_workload": 3,
      "avg_rating": 4.5
    },
    {
      "id": 3,
      "name": "Sarah Johnson",
      "email": "sarah.johnson@idsoft.tn",
      "role": "employee",
      "current_workload": 1,
      "avg_rating": 4.8
    },
    {
      "id": 100,
      "name": "Admin User",
      "email": "admin@idsoft.com",
      "role": "admin"
    }
  ]
}

FILTERS:
- Only active employees (performance_status = 'active')
- Alphabetically sorted by name
- Includes admin user

================================================================================
6. GET /messages/unread
================================================================================
Get summary of unread messages

RESPONSE:
{
  "total_unread": 5,
  "unread_by_conversation": [
    {
      "conversation_id": 1,
      "unread_count": 3
    },
    {
      "conversation_id": 2,
      "unread_count": 2
    }
  ]
}

USE CASE:
- Show notification badge on UI
- Alert user to messages needing attention

================================================================================
7. GET /messages/search
================================================================================
Search messages by content

QUERY PARAMETERS:
- query: Search string (required, min 1 char)
- conversation_id: Filter by conversation (optional)

EXAMPLE: GET /messages/search?query=ticket&conversation_id=1

RESPONSE:
{
  "query": "ticket",
  "results": [
    {
      "id": 5,
      "conversation_id": 1,
      "sender": {...},
      "recipient": {...},
      "message": "Can you check ticket #456?",
      "is_read": true,
      "read_at": "2026-03-25T10:32:00",
      "created_at": "2026-03-25T10:30:00"
    }
  ]
}

LIMIT: Returns max 50 results, ordered by newest first

================================================================================
8. DELETE /messages/{messageId}
================================================================================
Delete a message (only sender can delete)

PARAMETERS:
- messageId: Message ID (integer)

RESPONSE:
{
  "message": "Message deleted successfully"
}

RESTRICTIONS:
- Only sender can delete their own messages
- No real deletion tracking (permanent)

STATUS CODES:
- 200: Deleted successfully
- 404: Message not found
- 403: Not authorized (didn't send message)

================================================================================
USAGE EXAMPLES
================================================================================

EXAMPLE 1: Employee Marco sends message to Sarah
----------------------------------------------

Step 1: Get available employees
GET /messages/available-employees

Step 2: Send message
POST /messages/send
{
  "recipient_id": 3,
  "message": "Hi Sarah, I need help with ticket #789 - customer is reporting timeout issues"
}

Response: Message created with ID 15

Step 3: Sarah receives notification (polling)
GET /messages/unread
Response: total_unread: 1

Step 4: Sarah loads conversation
GET /messages/start/2
Response: Conversation loads, message marked as read

Step 5: Sarah replies
POST /messages/send
{
  "recipient_id": 2,
  "message": "Sure Marco! I'll check the logs now and get back to you"
}

Step 6: Marco gets conversation
GET /messages/conversations/1
Response: Shows all messages with Sarah's reply


EXAMPLE 2: Real-time sync (Pull-based polling)
-----------------------------------------------

Frontend polls every 3-5 seconds:
1. GET /messages/unread → Check if new messages
2. If unread > 0, GET /messages/conversations → Refresh list
3. When user opens conversation, GET /messages/conversations/{id} → Load new messages

Real-time WebSocket implementation can be added later.


EXAMPLE 3: Search for specific ticket discussion
-------------------------------------------------

User wants to find message about "ticket #456"

GET /messages/search?query=ticket%20%23456

Response: Shows all messages mentioning that ticket across all conversations

================================================================================
DATA MODEL RELATIONSHIPS
================================================================================

User
├── sentMessages (1 → Many)
├── receivedMessages (1 → Many)
├── conversations (1 → Many, bidirectional)
│   ├── sender (BelongsTo User)
│   ├── recipient (BelongsTo User)
│   └── messages (1 → Many)
│       ├── sender (BelongsTo User)
│       └── recipient (BelongsTo User)

Conversation
├── sender (BelongsTo User)
├── recipient (BelongsTo User)
├── messages (1 → Many)
└── latestMessage (1 → 1, most recent message)

Message
├── conversation (BelongsTo Conversation)
├── sender (BelongsTo User)
└── recipient (BelongsTo User)

================================================================================
PERFORMANCE CONSIDERATIONS
================================================================================

DATABASE INDEXES:
✓ messages.conversation_id → Fast conversation lookups
✓ messages.sender_id → Fast "sent by" queries
✓ messages.recipient_id → Fast "received by" queries
✓ (recipient_id, is_read) → Fast unread message queries

PAGINATION:
✓ Conversations: 20 per page (configurable)
✓ Messages: 50 per page (prevents large payload)
✓ Search results: 50 results max

QUERY OPTIMIZATION:
✓ Eager loading with ->with('sender', 'recipient')
✓ Selective columns in queries
✓ Indexed lookups for conversation finding

================================================================================
SECURITY NOTES
================================================================================

✓ Role-based access: Only employees/admins can message
✓ Authorization checks: Users can only see their own conversations
✓ Message ownership: Only sender can delete their messages
✓ SQL injection protection: Using parameterized queries (Eloquent)
✓ Message truncation: Max 5000 characters
✓ Input validation: All user inputs validated

POTENTIAL ENHANCEMENTS:
- Rate limiting on message sends
- Message encryption at rest
- Audit logging for deleted messages
- Block/mute functionality
- Group conversations

================================================================================
TESTING THE SYSTEM
================================================================================

Using Authentication:
1. Login as Marco (CIN: 01234567, Password: Tech@2024)
2. Get token from /login endpoint
3. Use token in Bearer header for all requests

Quick Test Sequence:
1. GET /messages/available-employees
2. POST /messages/send (to Sarah: user_id 3)
3. GET /messages/conversations
4. GET /messages/conversations/1 (with real conversation ID)
5. GET /messages/unread
6. GET /messages/search?query=test

Mobile/Frontend Integration:
- Call GET /messages/conversations periodically (3-5 sec)
- Show unread badge using GET /messages/unread
- Auto-refresh on focus
- Real-time would require WebSocket upgrade

================================================================================
FUTURE ENHANCEMENTS
================================================================================

✓ Real-time WebSocket support (Socket.io/Pusher)
✓ Group conversations (multiple participants)
✓ Message reactions (emoji reactions)
✓ File/image attachments
✓ Typing indicators
✓ Message threading/replies
✓ Conversation archiving
✓ Draft messages
✓ Message pinning
✓ Block/mute users
✓ AI-powered auto-responses
✓ Chatbot integration
✓ Read receipts tracking
✓ Delivery notifications

================================================================================
Last Updated: March 25, 2026
================================================================================
