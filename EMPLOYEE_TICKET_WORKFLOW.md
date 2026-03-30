# Employee Ticket Management & Client Rating System

## Overview
This document describes the complete workflow for employee ticket management, client notifications, employee-client communication, and client rating system.

---

## Feature 1: Employee Dashboard Enhancement

### What's New
- **View All Tickets**: Toggle between "All Tickets" and "My Tickets" to see client-submitted tickets across the system
- **Ticket Claiming**: Employees can now claim unassigned tickets to start working on them
- **Ticket Details**: Enhanced modal showing full ticket information including:
  - Client name and ticket ID
  - Ticket status, priority, and assignment
  - Full description and attached images
  - Employee notes (if any)
  - Client rating (if already rated)

### How It Works
**File**: `frontend/src/app/components/EmployeeDashboard.jsx`

1. **Viewing All Tickets vs My Tickets**
   - Click "All Tickets" tab to see all unassigned and submitted tickets from clients
   - Click "My Tickets" tab to see only tickets assigned to you
   - Filter by status (All, New, Active) to narrow down results

2. **Claiming a Ticket**
   - Click on any ticket row to open the ticket detail modal
   - If the ticket is unassigned (no employee assigned), a "Claim Ticket" button appears
   - Click "Claim Ticket" to:
     - Assign the ticket to yourself
     - Automatically set status to "in progress"
     - Notify the client that their ticket is being treated

3. **Processing Tickets**
   - Once claimed, your ticket appears in "My Tickets"
   - Use the "Resolve Ticket" button to mark it as complete
   - Use the "Escalate to IT" button if technical help is needed
   - Add resolution notes before submitting

### API Endpoints Used
- `GET /api/employee/tickets` - Fetch all tickets (assigned, unassigned, new)
- `POST /api/employee/tickets/{id}/claim` - Claim a ticket
- `POST /api/employee/tickets/{id}/unclaim` - Release a ticket back to unassigned
- `PATCH /api/employee/tickets/{id}` - Update ticket status and notes

---

## Feature 2: Employee-Client Communication

### What's New
- **Contact Client Button**: In the ticket detail modal, employees can now click "Contact Client" to open a messaging interface
- **Real-time Messaging**: Send and receive messages directly with clients about their tickets
- **Conversation History**: All messages are stored and can be reviewed

### How It Works
**Files**:
- `frontend/src/app/components/EmployeeDashboard.jsx` (messaging modal)
- `frontend/src/services/api.js` (messaging API calls)
- `backend/app/Http/Controllers/Api/MessagingController.php` (backend logic)

1. **Starting Communication**
   - Click the "Contact Client" button in ticket detail modal
   - A message composition window opens
   - Type your message to the client
   - Click "Send Message" to deliver it

2. **Communication Flow**
   - Employee initiates conversation with client
   - Messages are stored in `conversations` and `messages` tables
   - Both employee and client can view conversation history
   - Messages are marked as read automatically

3. **Client Perspective**
   - Client receives notification that employee wants to communicate
   - Client can view messages in their profile/messages section
   - Client can reply to employee messages

### API Endpoints Used
- `POST /api/messages/start/{userId}` - Start conversation with client
- `POST /api/messages/send` - Send message to client
- `GET /api/messages/conversations` - Get all conversations
- `GET /api/messages/conversations/{conversationId}` - Get specific conversation
- `GET /api/messages/unread` - Get unread message count

### Backend Changes
**File**: `backend/app/Http/Controllers/Api/MessagingController.php`

The messaging system now supports:
- Employee to Client communication
- Client to Employee communication
- Employee to Employee communication (existing)
- Admin to Any User communication (existing)

**Validation Logic**:
```
- Employee can message: Employee, Admin, Client
- Client can message: Employee, Admin
- Admin can message: Anyone
```

---

## Feature 3: Client Rating System

### What's New
- **Rating Interface**: After a ticket is resolved, clients can rate the employee's service (1-5 stars)
- **Star Rating**: Visual star rating widget in client dashboard
- **Optional Comments**: Space for clients to provide additional feedback
- **Rating Persistence**: Ratings are stored and displayed with the ticket

### How It Works
**Files**:
- `frontend/src/app/components/ClientDashboard.jsx` (rating modal)
- `backend/app/Http/Controllers/Api/ClientController.php` (rating endpoint)

1. **Client View**
   - In the tickets table, resolved tickets show a star icon button
   - Click the star to open the rating modal
   - Select 1-5 stars to rate the employee
   - Optionally add a comment about the service
   - Click "Submit Rating"

2. **Rating Modal**
   - Displays ticket information
   - Shows 5 interactive stars
   - Text shows current rating (e.g., "3 out of 5 stars")
   - Optional comment field for detailed feedback

3. **After Rating**
   - Stars change to gold/filled to show the selected rating
   - Rating is submitted to backend
   - Employee performance metrics are updated
   - Star icon button hides and stars are displayed instead

### Employee Performance Impact
When a client submits a rating:
- Employee's `avg_rating` is recalculated
- `tickets_completed` count is incremented
- Employee leaderboard standings may change

### API Endpoints Used
- `POST /api/client/tickets/{ticket}/rate` - Submit client rating for a ticket

### Backend Implementation
**File**: `backend/app/Http/Controllers/Api/ClientController.php`

New `rate()` method:
```php
public function rate(Request $request, Demande $ticket)
```

Features:
- Validates rating (1-5)
- Ensures only resolved tickets can be rated
- Ensures ticket belongs to authenticated client
- Updates employee performance metrics
- Returns updated ticket data

---

## Feature 4: Client Notifications

### Implementation
When an employee claims a ticket:
1. Ticket status changes from "submitted" to "in progress"
2. `assigned_at` timestamp is set to the current time
3. Employee ID is stored in the ticket
4. Client sees the status change when they refresh their dashboard

### How Clients See Notifications
**File**: `frontend/src/app/components/ClientDashboard.jsx`

1. **Status Change Visualization**
   - Resolved tickets show a green status badge
   - In-progress tickets show a blue status badge
   - New/submitted tickets show an orange status badge

2. **Tickets Table**
   - Shows real-time ticket status
   - Color-coded by status
   - Last update date displayed
   - Shows rating stars for resolved tickets

### Future Enhancement Possibilities
- Push notifications (browser/mobile)
- Email notifications
- In-app notification bell with unread count
- Real-time WebSocket updates (no page refresh needed)

---

## Database Tables Involved

### Demande (Tickets)
- `id` - Ticket ID
- `id_client` - Client who created ticket
- `id_employee` - Employee assigned to ticket
- `status` - Current status (submitted, in progress, resolved, escalated)
- `priority` - Ticket priority
- `titre` - Ticket title
- `description` - Detailed description
- `image` - Attached image path
- `assigned_at` - When employee claimed the ticket
- `completed_at` - When ticket was resolved
- `employee_note` - Notes from employee
- `client_rating` - Client's rating (1-5)
- `resolution_hours` - Time taken to resolve

### Conversation
- `id` - Conversation ID
- `sender_id` - User who initiated conversation
- `recipient_id` - User who received conversation
- `updated_at` - Last activity time

### Message
- `id` - Message ID
- `conversation_id` - Which conversation this belongs to
- `sender_id` - User who sent message
- `recipient_id` - User who received message
- `message` - Message content
- `is_read` - Whether message has been read
- `read_at` - When message was read
- `created_at` - When message was sent

---

## API Summary

### New Endpoints Added

#### Client Rating
```
POST /api/client/tickets/{ticket}/rate
Body: { "rating": 5 }
Response: { "message": "Rating submitted successfully", "ticket": {...} }
```

#### Employee Ticket Claiming
```
POST /api/employee/tickets/{id}/claim
Response: { updated ticket data }

POST /api/employee/tickets/{id}/unclaim
Response: { updated ticket data }
```

#### Messaging (Extended for Clients)
```
POST /api/messages/send
Body: { "recipient_id": 5, "message": "Hello client" }

POST /api/messages/start/{userId}
GET /api/messages/conversations
GET /api/messages/conversations/{conversationId}
```

---

## Frontend Component Files Modified

1. **EmployeeDashboard.jsx**
   - Added state for message modal and rating
   - Added methods: `handleClaimTicket()`, `handleContactClient()`, `handleSendMessage()`
   - Enhanced ticket detail modal with claim button and contact button
   - Added messaging modal component
   - Added toggle for "All Tickets" vs "My Tickets"

2. **ClientDashboard.jsx**
   - Added state for rating modal
   - Added method: `handleSubmitRating()`
   - Enhanced ticket table with rating button for resolved tickets
   - Added rating modal component with star selector
   - Changed action column logic to show "Rate" for resolved tickets

3. **api.js (Services)**
   - Added: `claimTicket()`, `unclaimTicket()`, `rateEmployee()`
   - Added: `sendMessage()`, `startConversation()`, `getConversationMessages()`
   - Updated: `assignTicket()` to use correct `/claim` endpoint

---

## Backend Files Modified

1. **EmployeeController.php**
   - `claim()` method - Assigns ticket to self, sets status to "in progress"
   - `unclaim()` method - Returns ticket to unassigned
   - Existing `update()` method - Update status and notes

2. **ClientController.php**
   - Added: `rate()` method - Submit client rating for ticket
   - Validates rating and ticket status
   - Updates employee performance metrics

3. **MessagingController.php**
   - Modified `sendMessage()` - Now allows client-employee messaging
   - Modified `startConversation()` - Now allows client-employee conversations
   - Updated validation logic to support multi-user role messaging

4. **Routes/api.php**
   - Added: `POST /api/client/tickets/{ticket}/rate`
   - Added: `POST /api/employee/tickets/{id}/claim`
   - Modified messaging middleware to include `client` role

---

## Workflow Diagram

```
CLIENT PERSPECTIVE:
1. Client Creates Ticket
   ↓
2. Ticket shows as "submitted" (orange)
   ↓
3. Employee claims ticket
   ↓
4. Ticket status changes to "in progress" (blue)
   ↓
5. Employee may contact client via messaging
   ↓
6. Employee resolves ticket
   ↓
7. Ticket status changes to "resolved" (green)
   ↓
8. Client sees "Rate" button
   ↓
9. Client rates employee (1-5 stars)
   ↓
10. Client permanently sees their rating in the table


EMPLOYEE PERSPECTIVE:
1. Employee views "All Tickets"
   ↓
2. Employee selects unassigned ticket
   ↓
3. Employee clicks "Claim Ticket"
   ↓
4. Employee starts work (status: in progress)
   ↓
5. Employee contacts client if needed via "Contact Client" button
   ↓
6. Employee sends messages to client
   ↓
7. Employee resolves ticket
   ↓
8. Ticket appears in "My Tickets" - Resolved
   ↓
9. Employee can see client's rating
```

---

## Testing Checklist

- [ ] Employee can view all tickets in dashboard
- [ ] Employee can claim an unassigned ticket
- [ ] Ticket status changes to "in progress" when claimed
- [ ] Employee can unclaim a ticket
- [ ] Employee can update ticket status to "resolved"
- [ ] Employee can escalate ticket to IT
- [ ] Employee can open messaging modal for a ticket
- [ ] Employee can send message to client
- [ ] Message appears in conversation history
- [ ] Client can see ticket status change to "in progress"
- [ ] Client can see resolved tickets in dashboard
- [ ] Client can open rating modal for resolved ticket
- [ ] Client can select 1-5 stars
- [ ] Client can add optional comment
- [ ] Client can submit rating
- [ ] Stars persist after rating submission
- [ ] Employee sees client rating in ticket details
- [ ] Client cannot rate unresolved tickets
- [ ] Client cannot rate same ticket twice
- [ ] Both client and employee can view message history

---

## Known Limitations & Future Enhancements

### Current Limitations
1. Notifications are passive (client must refresh to see updates)
2. No real-time WebSocket communication
3. Comments on ratings not stored (only star rating)
4. No email notifications sent

### Future Enhancements
1. Add real-time notifications using WebSockets or polling
2. Send email notifications when status changes
3. Add comment storage for ratings
4. Create notification bell with unread count
5. Add typing indicators in messaging
6. Add file uploads in messaging
7. Add reaction emojis to messages
8. Create automated status update notifications
9. Add SLA tracking (time to response, time to resolution)
10. Add escalation alerts for high-priority tickets

---

## Deployment Notes

1. Run database migrations (if any new tables were added)
2. Clear Laravel cache: `php artisan cache:clear`
3. Install any new dependencies: `composer install` / `npm install`
4. Update frontend environment variables if needed
5. Restart all background jobs and queue workers

---

## Support & Questions

For issues or questions about this implementation, refer to:
- Backend API: [backend/routes/api.php](backend/routes/api.php)
- Frontend Components: [frontend/src/app/components/](frontend/src/app/components/)
- Database Models: [backend/app/Models/](backend/app/Models/)
