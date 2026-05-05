# Multi-Channel Communication System

## Overview

The multi-channel communication system allows clients to communicate with support through multiple channels (Email, WhatsApp, SMS, Live Chat, Facebook, etc.) while maintaining a **unified ticket record** regardless of the channel used. All messages are tracked and linked to the original support ticket.

### Key Features

- **Unified Ticket Records**: One ticket per client issue, regardless of communication channel
- **Channel Tracking**: Know which channel each message came from
- **Channel Switching**: Continue conversation on different channel if needed
- **External Channel Integration**: WhatsApp, SMS, Facebook, Email webhooks
- **Automatic Ticket Creation**: New messages automatically create tickets if needed
- **Channel Verification**: Verify client ownership of channel addresses
- **Webhook Management**: Process and retry external webhooks

---

## Architecture

### Database Schema

#### `communication_channels` Table
Defines available communication channels:
```sql
CREATE TABLE communication_channels (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) UNIQUE,           -- 'email', 'whatsapp', 'sms', 'facebook'
    display_name VARCHAR(255),          -- 'Email', 'WhatsApp', 'SMS'
    enabled BOOLEAN DEFAULT FALSE,
    config JSON,                        -- Channel-specific config (API keys, etc)
    description TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### `channel_addresses` Table
Links clients to their external channel addresses:
```sql
CREATE TABLE channel_addresses (
    id BIGINT PRIMARY KEY,
    client_id BIGINT,                   -- Links to clients table
    channel VARCHAR(255),               -- 'email', 'whatsapp', 'sms'
    address VARCHAR(255),               -- Email, phone number, WhatsApp ID
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
UNIQUE(client_id, channel, address);
```

#### `channel_webhooks` Table
Tracks incoming webhook events:
```sql
CREATE TABLE channel_webhooks (
    id BIGINT PRIMARY KEY,
    channel VARCHAR(255),               -- Which channel sent the webhook
    event_type VARCHAR(255),            -- 'inbound.message', 'delivery', etc
    message_id BIGINT,                  -- Links to messages table
    payload JSON,                       -- Complete webhook payload
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(255),     -- 'pending', 'success', 'failed'
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP
);
```

#### Enhanced `messages` Table
Added channel tracking fields:
```sql
ALTER TABLE messages ADD COLUMN (
    channel VARCHAR(255) DEFAULT 'web',             -- message source
    external_message_id VARCHAR(255),               -- ID from external service
    external_user_id VARCHAR(255),                  -- User ID from external service
    channel_metadata JSON                           -- Channel-specific data
);
```

#### Enhanced `conversations` Table
Added multi-channel support:
```sql
ALTER TABLE conversations ADD COLUMN (
    primary_channel VARCHAR(255) DEFAULT 'web',    -- Primary channel
    active_channels JSON                            -- Array of channels in use
);
```

---

## API Endpoints

### Channel Management (Client)

#### Get Available Channels
```
GET /api/channels
Authentication: Required (client)
Response: {
  "channels": [
    {
      "name": "email",
      "display_name": "Email",
      "description": "Communicate via email"
    },
    {
      "name": "whatsapp",
      "display_name": "WhatsApp",
      "description": "Communicate via WhatsApp"
    }
  ]
}
```

#### Get Client's Linked Channels
```
GET /api/channels/my
Authentication: Required (client)
Response: {
  "channels": [
    {
      "id": 1,
      "channel": "email",
      "address": "j***n@example.com",    -- Masked for privacy
      "verified": true,
      "verified_at": "2026-05-03T10:30:00Z"
    }
  ]
}
```

#### Add Channel Address
```
POST /api/channels/add
Authentication: Required (client)
Body: {
  "channel": "email",
  "address": "john@example.com"
}
Response: {
  "message": "Channel address added. A verification code has been sent.",
  "address": {
    "id": 1,
    "channel": "email",
    "address": "j***n@example.com",
    "verified": false
  }
}
```

#### Verify Channel Address
```
POST /api/channels/{addressId}/verify
Authentication: Required (client)
Body: {
  "code": "A1B2C3"  -- 6-character verification code
}
Response: {
  "message": "Channel address verified successfully!",
  "address": {
    "id": 1,
    "channel": "email",
    "verified": true
  }
}
```

#### Remove Channel Address
```
DELETE /api/channels/{addressId}
Authentication: Required (client)
Response: {
  "message": "Channel address removed successfully"
}
```

### Webhook Endpoints (External)

These endpoints receive incoming messages from external services. They are **public** (no authentication) but verify sender signatures.

#### Email Webhook
```
POST /api/webhooks/email
Headers: X-Signature: <email-service-signature>
Body: {
  "event_type": "inbound.message",
  "from": "client@example.com",
  "subject": "Problem with machine",
  "text": "Machine stopped working",
  "message_id": "msg_12345",
  "html": "<p>Machine stopped working</p>"
}
Response: {"success": true}
```

#### WhatsApp Webhook
```
POST /api/webhooks/whatsapp
Headers: X-Twilio-Signature: <signature>
Body: {
  "From": "+1234567890",
  "Body": "Hello, I need help",
  "MessageSid": "SM_12345",
  "MessageType": "text"
}
Response: {"success": true}
```

#### SMS Webhook
```
POST /api/webhooks/sms
Headers: X-Twilio-Signature: <signature>
Body: {
  "From": "+1234567890",
  "Body": "Help needed",
  "MessageSid": "SM_12345"
}
Response: {"success": true}
```

#### Facebook Messenger Webhook
```
POST /api/webhooks/facebook
Headers: X-Hub-Signature: sha1=<signature>
Body: {
  "entry": [{
    "messaging": [{
      "sender": {"id": "user_123"},
      "message": {
        "text": "Help needed",
        "mid": "msg_123"
      }
    }]
  }]
}
Response: {"success": true}
```

---

## Message Flow

### Incoming Email Message

```
1. Email arrives at dedicated address (support@company.com)
2. Email service (Mailgun, SendGrid) sends webhook to /api/webhooks/email
3. ChannelWebhookController receives and validates signature
4. MultiChannelTicketService processes message:
   a. Finds or creates ChannelAddress for sender email
   b. Creates or finds existing Client record
   c. Gets or creates Ticket for this client/thread
   d. Creates Message record linked to ticket
   e. Dispatches TicketMessageCreated event
5. Message appears in employee dashboard
6. Employee can reply, which sends email back
```

### Incoming WhatsApp Message

```
1. Client sends WhatsApp message
2. WhatsApp Business API/Twilio sends webhook to /api/webhooks/whatsapp
3. ChannelWebhookController validates Twilio signature
4. MultiChannelTicketService processes message:
   a. Finds or creates ChannelAddress for phone number
   b. Creates or finds existing Client record
   c. Gets or creates Ticket for this client
   d. Creates Message record with channel='whatsapp'
   e. Broadcasts WebSocket event
5. Employee notified of new WhatsApp message
6. Employee responds in dashboard
7. Message sent back via WhatsApp API
```

### Incoming Web Chat Message (Existing)

```
1. Client sends message via web chat
2. React frontend calls POST /api/messages/send
3. MessagingController creates Message with channel='web'
4. Employee receives notification
5. Unified interface shows all channels
```

---

## Implementation Guide

### Step 1: Run Migrations

```bash
php artisan migrate
```

This creates all necessary tables with channel support.

### Step 2: Seed Communication Channels

```bash
php artisan db:seed --class=CommunicationChannelsSeeder
```

This creates initial channel records:
- Email (disabled, needs SMTP config)
- WhatsApp (disabled, needs API key)
- SMS (disabled, needs API key)
- Facebook (disabled, needs app ID)
- Web Chat (enabled by default)

### Step 3: Configure External Channels

#### Email Setup

1. Update `.env`:
```env
CHANNEL_EMAIL_ENABLED=true
CHANNEL_EMAIL_SMTP_HOST=smtp.mailgun.org
CHANNEL_EMAIL_SMTP_PORT=587
CHANNEL_EMAIL_SMTP_FROM=support@company.com
```

2. Set up email routing in Mailgun/SendGrid to forward to:
   ```
   https://your-domain.com/api/webhooks/email
   ```

#### WhatsApp Setup

1. Update `.env`:
```env
CHANNEL_WHATSAPP_ENABLED=true
CHANNEL_WHATSAPP_API_KEY=your_twilio_auth_token
CHANNEL_WHATSAPP_ACCOUNT_SID=your_account_sid
CHANNEL_WHATSAPP_PHONE_NUMBER=+1234567890
```

2. Configure Twilio webhook URL in Twilio Console:
   ```
   https://your-domain.com/api/webhooks/whatsapp
   ```

#### SMS Setup

1. Update `.env`:
```env
CHANNEL_SMS_ENABLED=true
CHANNEL_SMS_API_KEY=your_api_key
CHANNEL_SMS_API_URL=https://api.provider.com/sms
CHANNEL_SMS_FROM_NUMBER=+1234567890
```

2. Configure provider webhook to point to:
   ```
   https://your-domain.com/api/webhooks/sms
   ```

#### Facebook Setup

1. Update `.env`:
```env
CHANNEL_FACEBOOK_ENABLED=true
CHANNEL_FACEBOOK_APP_ID=your_app_id
CHANNEL_FACEBOOK_APP_SECRET=your_app_secret
CHANNEL_FACEBOOK_PAGE_ACCESS_TOKEN=your_token
```

2. Set webhook URL in Facebook App Settings:
   ```
   https://your-domain.com/api/webhooks/facebook
   ```

### Step 4: Add Channel UI to Frontend

See [Frontend Components](#frontend-components) section below.

---

## Frontend Components

### Channel Selector Component

Location: `frontend/src/app/components/ChannelSelector.jsx`

Displays available channels for client to add/verify:

```jsx
<ChannelSelector 
  onChannelAdded={handleChannelAdded}
  onChannelVerified={handleChannelVerified}
/>
```

Features:
- List of available channels
- Add new channel address form
- Verification code input
- List of verified channels with options to remove

### Multi-Channel Chat Component

Location: `frontend/src/app/components/MultiChannelChat.jsx`

Enhanced chat component showing:
- Channel badge on each message (📧 Email, 💬 WhatsApp, 🌐 Web, etc)
- Ability to switch channels mid-conversation
- Channel verification status
- Message source indicators

---

## Service: MultiChannelTicketService

Central service handling all multi-channel logic.

### Key Methods

#### `handleIncomingMessage()`
```php
$message = MultiChannelTicketService::handleIncomingMessage(
    'email',                          // channel
    'client@example.com',             // senderAddress
    'Hello, I need help',             // messageContent
    ['subject' => 'Problem'],          // metadata
    'msg_12345'                        // externalMessageId
);
```

Creates or links message to existing ticket, auto-creates client if needed.

#### `getChannelIcon()`
```php
$icon = MultiChannelTicketService::getChannelIcon('whatsapp');  // Returns: '💬'
```

#### `getChannelDisplayName()`
```php
$name = MultiChannelTicketService::getChannelDisplayName('email');  // Returns: 'Email'
```

---

## Admin Management

### View Channel Status

```
GET /api/channels/admin/list
Authentication: Required (admin)
```

Returns all configured channels with:
- Enabled status
- Configuration status
- Last webhook received

### View Webhook Processing

```
GET /api/channels/admin/webhooks
Authentication: Required (admin)
```

Returns webhook summary:
- Pending webhooks count
- Failed webhooks count  
- By-channel breakdown

### Retry Failed Webhooks

```
POST /api/webhooks/retry
Authentication: Required (admin)
```

Processes all failed webhooks again.

---

## Ticketing Examples

### Example 1: Email to Ticket

```
1. Client sends email to: support@company.com
2. Email: "Hi, my machine stopped working after update"
3. System creates:
   - New Client record (auto-created from email)
   - New Ticket record with status='submitted'
   - Message record with channel='email'
4. Employee receives notification
5. Employee responds with solution
6. Response sent back as email reply
7. If client replies to email, linked to same ticket
```

### Example 2: WhatsApp to Ticket

```
1. Client sends WhatsApp: "+1 (555) 123-4567"
2. Message: "How do I reset my device?"
3. System creates:
   - New Client record (phone-based)
   - New Ticket record
   - Message with external_user_id=+1 (555) 123-4567
4. Employee sees WhatsApp message in dashboard
5. Employee replies
6. Client receives WhatsApp response
7. Conversation continues on WhatsApp or switches to email
8. All messages stay in same ticket
```

### Example 3: Web Chat to Email to WhatsApp

```
1. Client starts web chat and describes problem (Message 1)
2. Employee responds suggesting email for attachments
3. Client switches to email, sends technical details (Message 2)
4. Employee suggests moving to WhatsApp for faster response
5. Client accepts, sends WA message (Message 3)
6. All 3 messages linked to ONE ticket
7. Unified conversation history visible to employees
```

---

## Database Queries

### Find All Messages for a Ticket by Channel

```php
$emailMessages = Message::where('ticket_id', $ticketId)
    ->where('channel', 'email')
    ->get();
```

### Find Conversations Using Multiple Channels

```php
$multiChannelConversations = Conversation::whereJsonContains('active_channels', 'whatsapp')
    ->whereJsonContains('active_channels', 'email')
    ->get();
```

### Find Messages from External Channels

```php
$externalMessages = Message::whereIn('channel', ['email', 'whatsapp', 'sms', 'facebook'])
    ->where('ticket_id', $ticketId)
    ->get();
```

### Get Webhook Processing Status

```php
$pending = ChannelWebhook::where('processed', false)->count();
$failed = ChannelWebhook::where('processing_status', 'failed')->count();
$successRate = ChannelWebhook::where('processing_status', 'success')->count() / ChannelWebhook::count();
```

---

## Configuration

### .env Variables

```env
# Enable/disable channels
CHANNEL_EMAIL_ENABLED=true
CHANNEL_WHATSAPP_ENABLED=false
CHANNEL_SMS_ENABLED=false
CHANNEL_FACEBOOK_ENABLED=false

# Channel-specific configs
CHANNEL_EMAIL_SMTP_HOST=smtp.mailgun.org
CHANNEL_EMAIL_SMTP_PORT=587
CHANNEL_EMAIL_FROM=support@company.com

CHANNEL_WHATSAPP_API_KEY=
CHANNEL_WHATSAPP_ACCOUNT_SID=
CHANNEL_WHATSAPP_PHONE_NUMBER=

CHANNEL_SMS_API_KEY=
CHANNEL_SMS_PROVIDER=twilio

CHANNEL_FACEBOOK_PAGE_ACCESS_TOKEN=
```

---

## Security Considerations

### Webhook Signature Verification

Each webhook handler must verify the sender:

```php
// Verify Twilio signature
$token = config('services.twilio.auth_token');
$url = $request->url();
$post = $request->post();

$expectedSignature = hash_hmac(
    'sha1',
    $url . http_build_query($post),
    $token,
    true
);

if (!hash_equals($expectedSignature, $request->header('X-Twilio-Signature'))) {
    return response()->json(['error' => 'Invalid signature'], 401);
}
```

### Rate Limiting

Apply rate limiting to webhook endpoints:

```php
Route::post('/webhooks/whatsapp', [ChannelWebhookController::class, 'handleWhatsAppWebhook'])
    ->middleware('throttle:1000,1');
```

### Data Privacy

- Mask sensitive information in API responses
- Store encrypted API keys in config
- Don't log full message contents
- Implement GDPR compliance for data retention

---

## Future Enhancements

- [ ] GraphQL API for channels
- [ ] Webhook retry queue job
- [ ] Channel switching suggestions
- [ ] Sentiment analysis on messages
- [ ] Automatic channel recommendation
- [ ] Bulk messaging to multiple channels
- [ ] Channel performance metrics
- [ ] A/B testing channel engagement
- [ ] Fallback routing if channel fails
- [ ] Message templating system

---

## Testing

### Unit Tests

```php
// Test message creation from email
public function test_email_webhook_creates_message()
{
    $response = $this->post('/api/webhooks/email', [
        'from' => 'test@example.com',
        'subject' => 'Help needed',
        'text' => 'My device is broken'
    ]);
    
    $this->assertDatabaseHas('messages', [
        'channel' => 'email',
        'external_message_id' => $response['message_id']
    ]);
}
```

### Integration Tests

```php
// Test end-to-end email to ticket flow
public function test_email_creates_ticket_and_notification()
{
    // Send webhook
    $response = $this->post('/api/webhooks/email', $payload);
    
    // Verify ticket created
    $ticket = Demande::latest()->first();
    $this->assertEquals('submitted', $ticket->status);
    
    // Verify message linked
    $message = Message::where('ticket_id', $ticket->id)->first();
    $this->assertEquals('email', $message->channel);
    
    // Verify employee notified
    $this->assertNotificationSent();
}
```

---

## Troubleshooting

### Webhook Not Received

1. Check endpoint is accessible from internet
2. Verify webhook URL configured in external service
3. Check firewall/cors settings
4. Review server logs: `tail -f storage/logs/laravel.log`

### Messages Not Appearing

1. Check webhook was received: `SELECT * FROM channel_webhooks`
2. Verify processing_status: `SELECT processing_status FROM channel_webhooks WHERE id = ?`
3. Check error_message for details
4. Verify communication_channels table has enabled=true

### Client Address Not Verified

1. Check verification code matches: `SELECT * FROM cache WHERE key LIKE 'channel_verify_%'`
2. Verify address was seen in POST request
3. Check client record exists

### Signature Verification Failed

1. Verify API key/token is correct
2. Check timestamp isn't too old
3. Ensure request body isn't modified
4. Review provider documentation for exact verification method

---

## Support

For issues or questions about the multi-channel system, contact: admin@company.com

Version: 1.0.0
Last Updated: May 3, 2026
