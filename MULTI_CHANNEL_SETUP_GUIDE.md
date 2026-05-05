# Multi-Channel Communication System - Setup Guide

## Quick Start

This guide walks you through setting up the multi-channel communication system to accept support requests via Email, WhatsApp, SMS, Facebook, and other channels.

---

## Prerequisites

- Laravel application running (see [backend README](backend/README.md))
- MySQL 8.4+ database
- Node.js 18+ for frontend
- (Optional) External service accounts:
  - Email: Mailgun or SendGrid account
  - WhatsApp: Twilio account
  - SMS: Twilio or AWS SNS account
  - Facebook: Facebook Developers account

---

## Step 1: Database Setup

### Apply Migrations

First, run the new database migrations:

```bash
cd backend
php artisan migrate
```

This creates:
- `communication_channels` table
- `channel_addresses` table
- `channel_webhooks` table
- Updates to `messages` and `conversations` tables

### Seed Initial Channels

```bash
php artisan db:seed --class=CommunicationChannelsSeeder
```

This creates channel records for:
- Web Chat (enabled by default)
- Email (disabled)
- WhatsApp (disabled)
- SMS (disabled)
- Facebook (disabled)
- Instagram (disabled)
- Telegram (disabled)

---

## Step 2: Backend Configuration

### Enable Channels

Update `.env` file to enable/disable channels:

```env
# Web Chat (always enabled)
CHANNEL_WEB_ENABLED=true

# Email Channel
CHANNEL_EMAIL_ENABLED=true
CHANNEL_EMAIL_SMTP_HOST=smtp.mailgun.org
CHANNEL_EMAIL_SMTP_PORT=587
CHANNEL_EMAIL_FROM=support@company.com
CHANNEL_EMAIL_USERNAME=postmaster@mail.company.com
CHANNEL_EMAIL_PASSWORD=your_smtp_password

# WhatsApp Channel (Twilio)
CHANNEL_WHATSAPP_ENABLED=false
CHANNEL_WHATSAPP_API_KEY=your_twilio_auth_token
CHANNEL_WHATSAPP_ACCOUNT_SID=your_account_sid
CHANNEL_WHATSAPP_PHONE_NUMBER=+1234567890

# SMS Channel (Twilio)
CHANNEL_SMS_ENABLED=false
CHANNEL_SMS_API_KEY=your_twilio_auth_token
CHANNEL_SMS_ACCOUNT_SID=your_account_sid
CHANNEL_SMS_FROM_NUMBER=+1234567890

# Facebook Messenger
CHANNEL_FACEBOOK_ENABLED=false
CHANNEL_FACEBOOK_APP_ID=your_app_id
CHANNEL_FACEBOOK_APP_SECRET=your_app_secret
CHANNEL_FACEBOOK_PAGE_ACCESS_TOKEN=your_token
CHANNEL_FACEBOOK_VERIFY_TOKEN=random_verification_token

# Webhook Base URL (for external services to call back)
WEBHOOK_BASE_URL=https://your-domain.com
```

### Verify Routes

Check that routes are properly registered:

```bash
php artisan route:list | grep webhook
php artisan route:list | grep channels
```

You should see:
- `POST /api/webhooks/email`
- `POST /api/webhooks/whatsapp`
- `POST /api/webhooks/sms`
- `POST /api/webhooks/facebook`
- `GET /api/channels`
- `POST /api/channels/add`
- etc.

---

## Step 3: Frontend Setup

### Add Channel Selector Component

Update your client dashboard to include the channel selector:

```jsx
// In frontend/src/app/components/ClientDashboard.jsx
import { ChannelSelector } from './ChannelSelector';

// Add to your component:
<div className="mt-8">
    <h2 className="text-2xl font-bold mb-4">Communication Channels</h2>
    <ChannelSelector 
        onChannelAdded={(channel) => {
            console.log(`Added: ${channel}`);
            // Refresh UI
        }}
        onChannelVerified={(addressId) => {
            console.log(`Verified address ${addressId}`);
        }}
        onChannelRemoved={(addressId) => {
            console.log(`Removed address ${addressId}`);
        }}
    />
</div>
```

### Update Ticket Detail View

Show which channel each message came from:

```jsx
// Show channel badge on messages
<div className="flex items-center gap-2">
    <span className="text-lg">
        {message.channel === 'email' ? '📧' :
         message.channel === 'whatsapp' ? '💬' :
         message.channel === 'sms' ? '📱' :
         message.channel === 'web' ? '🌐' : '💬'}
    </span>
    <span className="text-xs text-gray-500">via {message.channel}</span>
</div>
```

---

## Step 4: Configure External Services

### Email Configuration (Mailgun Example)

1. **Sign up for Mailgun**: https://www.mailgun.com/

2. **Create receiving route**:
   - In Mailgun dashboard, go to "Receiving"
   - Add new route: `catch_all() store(notify "https://your-domain.com/api/webhooks/email")`

3. **Set up MX records** with your domain registrar to forward emails to Mailgun

4. **Update `.env`**:
```env
CHANNEL_EMAIL_ENABLED=true
CHANNEL_EMAIL_SMTP_HOST=smtp.mailgun.org
CHANNEL_EMAIL_SMTP_PORT=587
CHANNEL_EMAIL_FROM=support@company.com
CHANNEL_EMAIL_USERNAME=postmaster@mail.company.com
CHANNEL_EMAIL_PASSWORD=your_key-xxxx
```

5. **Test**:
```bash
# Send test email to support@company.com
# Should create ticket in system
```

### WhatsApp Configuration (Twilio Example)

1. **Sign up for Twilio**: https://www.twilio.com/

2. **Create WhatsApp Sender**:
   - In Twilio Console → Develop → SMS
   - Add WhatsApp Sender (sandbox or approved business account)

3. **Get credentials**:
   - Account SID: Find in Console
   - Auth Token: Find in Console
   - Phone Number: From WhatsApp setup
   - Recipient Simulator: +1 415-523-8886

4. **Enable webhook**:
   - In Twilio Console → Messaging → Whatsapp Senders
   - Set webhook URL: `https://your-domain.com/api/webhooks/whatsapp`

5. **Update `.env`**:
```env
CHANNEL_WHATSAPP_ENABLED=true
CHANNEL_WHATSAPP_API_KEY=your_auth_token
CHANNEL_WHATSAPP_ACCOUNT_SID=AC12345...
CHANNEL_WHATSAPP_PHONE_NUMBER=+1234567890
```

6. **Test**:
```bash
# Send WhatsApp message to your Twilio WhatsApp number
# Should create ticket in system
```

### SMS Configuration (Twilio Example)

1. **Similar to WhatsApp above**

2. **Get SMS phone number**:
   - In Twilio Console → Develop → SMS → Numbers
   - Purchase phone number (or use existing)

3. **Enable webhook**:
   - Set webhook URL: `https://your-domain.com/api/webhooks/sms`

4. **Update `.env`**:
```env
CHANNEL_SMS_ENABLED=true
CHANNEL_SMS_API_KEY=your_auth_token
CHANNEL_SMS_ACCOUNT_SID=AC12345...
CHANNEL_SMS_FROM_NUMBER=+1234567890
```

### Facebook Messenger Configuration

1. **Create Facebook App**:
   - Go to https://developers.facebook.com/
   - Create new app → "Customer communications"

2. **Set up Messenger**:
   - Add Messenger product
   - Connect Facebook Page

3. **Get tokens**:
   - App ID: Found in settings
   - App Secret: Found in settings
   - Page Access Token: Generate in Messenger settings
   - Verify Token: Generate random string

4. **Set webhook**:
   - In Messenger settings → Webhooks
   - Callback URL: `https://your-domain.com/api/webhooks/facebook`
   - Verify Token: Same as in `.env`

5. **Update `.env`**:
```env
CHANNEL_FACEBOOK_ENABLED=true
CHANNEL_FACEBOOK_APP_ID=123456789
CHANNEL_FACEBOOK_APP_SECRET=secret_xxxx
CHANNEL_FACEBOOK_PAGE_ACCESS_TOKEN=token_xxxx
CHANNEL_FACEBOOK_VERIFY_TOKEN=random_verify_token
```

---

## Step 5: Start the Application

### Backend

```bash
cd backend
php artisan serve
# Runs on http://127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://127.0.0.1:5173
```

---

## Step 6: Testing

### Test Web Chat (No External Setup Required)

1. Open frontend application
2. Client logs in
3. Open support chat
4. Send message
5. Employee receives notification

### Test Email Channel

1. Go to client dashboard → Communication Channels
2. Click "Add New Channel"
3. Select "Email"
4. Enter email address
5. Enter verification code (check email)
6. Email is linked
7. Send email to support@company.com
8. Should create ticket

### Test WhatsApp Channel

1. Go to client dashboard → Communication Channels
2. Click "Add New Channel"
3. Select "WhatsApp"
4. Enter phone number
5. Receive WhatsApp verification code
6. Send WhatsApp message
7. Should create ticket

---

## Step 7: Monitor Webhooks

### Check webhook processing via admin dashboard

```bash
# Get webhook status
curl -X GET http://127.0.0.1:8000/api/webhooks/status \
  -H "Authorization: Bearer admin_token"

# Response:
{
  "status": {
    "pending": 0,
    "failed": 0,
    "success": 150,
    "by_channel": [
      {"channel": "email", "processing_status": "success", "count": 50}
    ]
  }
}
```

### Retry failed webhooks

```bash
curl -X POST http://127.0.0.1:8000/api/webhooks/retry \
  -H "Authorization: Bearer admin_token"
```

---

## Troubleshooting

### Webhook not received

1. **Check endpoint accessibility**:
```bash
curl -X POST https://your-domain.com/api/webhooks/email \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

2. **Check firewall rules**: Ensure incoming requests from external services are allowed

3. **Check Laravel logs**:
```bash
tail -f storage/logs/laravel.log
```

4. **Check database**:
```bash
# Should see webhook record
SELECT * FROM channel_webhooks LIMIT 1;
```

### Messages not appearing

1. **Check processing status**:
```bash
SELECT id, channel, processing_status, error_message FROM channel_webhooks WHERE processed = 1 LIMIT 5;
```

2. **Check message record**:
```bash
SELECT * FROM messages WHERE channel = 'email' LIMIT 1;
```

3. **Check ticket linked**:
```bash
SELECT * FROM demandes WHERE created_at > NOW() - INTERVAL 1 HOUR ORDER BY created_at DESC;
```

### External service not sending webhooks

1. **Verify webhook URL is accessible from internet**
   - Use ngrok for local testing: `ngrok http 8000`
   - Update webhook URL in external service

2. **Verify signature verification code**
   - Temporarily disable signature verification for debugging
   - Check ChannelWebhookController.php

3. **Check service console logs**
   - Mailgun: Logs tab
   - Twilio: Message logs
   - Facebook: Logs

---

## API Endpoints Reference

### Client Endpoints

```
GET    /api/channels                  # Get available channels
GET    /api/channels/my               # Get client's linked channels
POST   /api/channels/add              # Add channel address
POST   /api/channels/{id}/verify      # Verify with code
DELETE /api/channels/{id}             # Remove channel
```

### Webhook Endpoints (Public)

```
POST /api/webhooks/email              # Receive email
POST /api/webhooks/whatsapp           # Receive WhatsApp
POST /api/webhooks/sms                # Receive SMS
POST /api/webhooks/facebook           # Receive Facebook
```

### Admin Endpoints

```
GET    /api/channels/admin/list       # List all channels
GET    /api/channels/admin/webhooks   # Get webhook summary
GET    /api/webhooks/status           # Get webhook status
POST   /api/webhooks/retry            # Retry failed webhooks
```

---

## FAQ

**Q: Can I use multiple email addresses?**
A: Yes! Each client can link multiple email addresses, phone numbers, etc. All messages go to the same ticket.

**Q: What if someone sends an email to support@company.com but they're not a registered client?**
A: The system automatically creates a new client record based on their email/phone and creates a ticket.

**Q: How are messages linked to existing tickets?**
A: The system looks for unresolved tickets from the same client within the last 7 days. If found, messages are linked there. Otherwise, a new ticket is created.

**Q: Can employees reply via email/WhatsApp?**
A: Yes! (Currently requires additional configuration)  
Responses can be sent back through the same channel using outgoing integrations.

**Q: What happens if a webhook fails?**
A: Failed webhooks are stored in `channel_webhooks` table with error messages. Admins can retry them later.

**Q: How do I test without external service accounts?**
A: Use the included web chat channel for testing entire flow without external services.

---

## Next Steps

1. ✅ Set up database
2. ✅ Configure backend
3. ✅ Set up frontend
4. ✅ Configure external services
5. ⏭ Deploy to production
6. ⏭ Configure HTTPS (required for webhooks)
7. ⏭ Set up email autoresponder
8. ⏭ Configure support team permissions

---

## Support

For help or questions:
- Check logs: `storage/logs/laravel.log`
- Review documentation: [MULTI_CHANNEL_COMMUNICATION.md](MULTI_CHANNEL_COMMUNICATION.md)
- Check endpoint status: `/api/webhooks/status`

Version: 1.0.0  
Last Updated: May 3, 2026
