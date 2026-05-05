# Enterprise SaaS Features Implementation Guide

## Overview

This guide documents the complete implementation of enterprise-grade features including Role-Based Access Control (RBAC), Audit Logging, Single Sign-On (SSO), OAuth2/SAML integration, and Webhook infrastructure.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [RBAC System](#rbac-system)
4. [Audit Logging](#audit-logging)
5. [SSO & OAuth2](#sso--oauth2)
6. [Webhooks](#webhooks)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Deployment](#deployment)

---

## Architecture Overview

### System Design

The enterprise features follow a layered architecture:

```
Frontend (React Components)
    ↓
API Layer (Controllers & Routes)
    ↓
Business Logic (Models & Services)
    ↓
Database Layer (Models & Migrations)
    ↓
Event System (Webhooks & Queues)
```

### Key Components

1. **RBAC Layer**: Role → Permission → User hierarchy
2. **Audit Layer**: Complete change tracking with diff calculation
3. **SSO Layer**: Multi-provider authentication with auto-provisioning
4. **Webhook Layer**: Event-driven system with delivery tracking and retry logic

---

## Database Schema

### 1. RBAC Tables

#### `roles` Table
```sql
- id (PK)
- name (unique) - e.g., 'admin', 'manager', 'agent', 'client'
- description
- priority (for hierarchy ordering)
- is_system (bool) - immutable system roles
- timestamps
```

#### `permissions` Table
```sql
- id (PK)
- name (unique) - format: "resource.action"
  Examples: "tickets.view", "tickets.edit", "clients.delete"
- description
- timestamps
```

#### `role_permission` (Pivot Table)
```sql
- role_id (FK → roles)
- permission_id (FK → permissions)
- unique (role_id, permission_id)
```

#### `role_user` (Pivot Table)
```sql
- user_id (FK → users)
- role_id (FK → roles)
- unique (user_id, role_id)
```

#### `user_permission` (Individual Overrides)
```sql
- user_id (FK → users)
- permission_id (FK → permissions)
- unique (user_id, permission_id)
```

### 2. Audit Logging Tables

#### `audit_logs` Table
```sql
- id (PK)
- user_id (FK → users, nullable)
- event - 'created', 'updated', 'deleted', etc
- model_type - 'Ticket', 'Client', etc
- model_id
- ip_address
- user_agent
- http_method - GET, POST, PUT, etc
- http_path
- old_values (JSON)
- new_values (JSON)
- calculateChanges() - returns human-readable diff
- status - 'success', 'failed'
- response_code
- timestamps
```

### 3. SSO Tables

#### `sso_providers` Table
```sql
- id (PK)
- name - 'google', 'github', 'microsoft', 'saml'
- type - 'oauth2', 'saml'
- client_id
- client_secret
- tenant_id (for Azure/SAML)
- auth_url
- token_url
- enabled (bool)
- timestamps
```

#### `sso_users` Table
```sql
- id (PK)
- sso_provider_id (FK → sso_providers)
- user_id (FK → users)
- external_id - ID from provider
- external_email
- external_data (JSON)
- linked_at
```

### 4. Webhook Tables

#### `webhooks` Table
```sql
- id (PK)
- user_id (FK → users) - webhook owner
- name
- description
- url - endpoint to receive webhook
- event - specific event to listen for, or '*' for all
- filters (JSON) - optional filtering on payload
- method - POST, PUT, PATCH
- headers (JSON) - custom headers to send
- active (bool)
- max_attempts - 1-20, default 5
- timeout - seconds, default 30
- timestamps
```

#### `webhook_deliveries` Table
```sql
- id (PK)
- webhook_id (FK → webhooks)
- event
- payload (JSON)
- status - 'pending', 'delivered', 'failed'
- attempt (auto-increment)
- response_status
- response_body
- error_message
- delivered_at
- next_retry_at
- created_at (no updated_at)
```

---

## RBAC System

### Permission Format

Permissions follow a `resource.action` format for fine-grained control:

**Resources**: tickets, clients, employees, machines, users, roles, webhooks, settings, categories, templates

**Actions**: view, create, edit, delete, admin, export

**Examples**:
- `tickets.view` - View tickets
- `tickets.edit` - Update ticket details
- `clients.delete` - Delete client
- `roles.admin` - Manage all roles

### Default Roles

```
Admin (Priority: 100)
├── All permissions
└── Cannot be deleted

Manager (Priority: 75)
├── tickets.* (all ticket permissions)
├── clients.view
├── employees.view
├── templates.view
└── categories.view

Agent (Priority: 50)
├── tickets.view, tickets.edit, tickets.update_status
├── clients.view
├── messages.send
└── knowledge_base.view

Client (Priority: 0)
├── tickets.create, tickets.view (own only)
├── messages.view, messages.send
└── profile.edit
```

### Permission Hierarchy

```
User
├── Roles (BelongsToMany)
│   └── Permissions (via role_permission pivot)
└── Individual Permissions (direct overrides, via user_permission pivot)

Evaluation Logic:
1. Check individual user_permission overrides first
2. Then check role-based permissions
3. Return true if found in either
```

### Usage in Code

**Laravel Backend**:
```php
// Check single permission
if ($user->hasPermission('tickets.edit')) {
    // allowed
}

// Check multiple permissions (any)
if ($user->hasAnyPermission(['tickets.edit', 'tickets.admin'])) {
    // allowed
}

// Check multiple permissions (all)
if ($user->hasAllPermissions(['tickets.edit', 'clients.view'])) {
    // allowed
}

// Assign role
$user->assignRole('manager');

// Grant individual permission
$user->grantPermission('reports.export');

// Revoke individual permission
$user->revokePermission('reports.export');
```

**React Frontend**:
```jsx
// Hook-based permission checking
const { hasPermission, hasAnyRole } = usePermission();

if (hasPermission('tickets.delete')) {
    // Show delete button
}

if (hasAnyRole(['admin', 'manager'])) {
    // Show admin panel
}

// Conditional rendering component
<CanAccess permission="tickets.edit">
    <EditTicketButton />
</CanAccess>

// Require all permissions
<CanAccess permissions={['tickets.view', 'clients.view']} requireAll>
    <AnalyticsPanel />
</CanAccess>

// With fallback UI
<CanAccess 
    permission="tickets.delete"
    fallback={<div>No permission</div>}
>
    <DeleteButton />
</CanAccess>
```

### Route Protection (Laravel)

```php
// Using middleware
Route::post('/tickets/{ticket}/delete', [TicketController::class, 'destroy'])
    ->middleware('permission:tickets.delete');

// Using multiple permissions
Route::get('/reports', [ReportController::class, 'index'])
    ->middleware('permission:reports.view,reports.export');
```

---

## Audit Logging

### What Gets Logged

Every API action is automatically logged with:

| Field | Description |
|-------|-------------|
| `event` | Action type: created, updated, deleted, accessed, etc |
| `model_type` | Which model was affected: Ticket, Client, Machine, etc |
| `model_id` | ID of affected record |
| `user_id` | Who performed the action |
| `ip_address` | Source IP address |
| `user_agent` | Browser/device info |
| `http_method` | GET, POST, PUT, DELETE, etc |
| `http_path` | API endpoint path |
| `old_values` | Previous data (JSON) |
| `new_values` | New data (JSON) |
| `status` | success or failed |
| `response_code` | HTTP status code |
| `created_at` | Timestamp |

### Features

**Change Tracking**:
```php
$log->calculateChanges() // Returns human-readable diff
// Example output:
[
    'status' => ['old' => 'open', 'new' => 'closed'],
    'assigned_to' => ['old' => 5, 'new' => 8],
    'resolved_at' => ['old' => null, 'new' => '2024-05-03 10:30:00'],
]
```

**Query Helpers**:
```php
// Get all changes to specific model
AuditLog::forModel('Ticket', 123)->get();

// Get user's activities
$user->auditLogs()->get();

// Get failed operations
AuditLog::where('status', 'failed')->get();

// Date range queries
AuditLog::between($startDate, $endDate)->get();

// By event type
AuditLog::where('event', 'created')->get();
```

### API Endpoints for Auditing

| Endpoint | Purpose |
|----------|---------|
| `GET /api/audit-logs` | List logs with filters |
| `GET /api/audit-logs/{id}` | View specific log |
| `POST /api/audit-logs/model-history` | Get changes to specific model |
| `GET /api/audit-logs/user/{id}` | User's activity history |
| `GET /api/audit-logs/failures` | Failed operations only |
| `GET /api/audit-logs/summary` | Summary statistics |
| `GET /api/audit-logs/export` | Export as CSV |

### Frontend Audit Viewer

The `AuditLogViewer` component provides:
- Real-time log filtering by event, model, user, status
- Date range queries
- CSV export functionality
- Summary dashboard with statistics
- Detailed log inspection

---

## SSO & OAuth2

### Supported Providers

1. **Google OAuth2**
   - Consumer and enterprise-friendly
   - Email + profile auto-provisioning
   
2. **GitHub OAuth2**
   - Developer-friendly
   - Public profile access

3. **Microsoft Azure AD / Office365**
   - Enterprise-grade SAML2
   - Organization-wide deployment

4. **Generic SAML2**
   - Custom enterprise SSO systems
   - On-premise directory integration

### Configuration

#### Environment Setup

```bash
# Google
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# GitHub
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Microsoft
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx
MICROSOFT_TENANT_ID=common

# Webhook Security
WEBHOOK_SECRET=your-secure-random-string
```

#### Database Seeding

```php
// Seed SSO providers
$googleProvider = SsoProvider::create([
    'name' => 'google',
    'type' => 'oauth2',
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
    'token_url' => 'https://oauth2.googleapis.com/token',
    'enabled' => true,
]);
```

### Authentication Flow

```
User Clicks "Login with Google"
    ↓
Frontend redirects to: GET /api/sso/redirect/google
    ↓
Backend generates state token & redirects to Google OAuth consent
    ↓
User authorizes app
    ↓
Google redirects to: GET /api/sso/callback/google?code=xxx&state=yyy
    ↓
Backend exchanges code for access token
    ↓
Backend fetches user info from provider
    ↓
Backend finds or creates SsoUser record
    ↓
User auto-created or linked (merged with existing account)
    ↓
Backend generates API token and redirects to frontend with token
    ↓
Frontend stores token and completes login
```

### API Usage

**Get Available Providers**:
```bash
GET /api/sso/providers
Response:
[
    {
        "id": 1,
        "name": "google",
        "type": "oauth2",
        "auth_url": "http://api.local/api/sso/redirect/google"
    },
    ...
]
```

**OAuth Redirect**:
```bash
GET /api/sso/redirect/google
Response: 302 Redirect to Google OAuth consent screen
```

**OAuth Callback** (handled automatically):
```bash
GET /api/sso/callback/google?code=xxx&state=yyy
Response: 302 Redirect to frontend with ?token=xxx
```

**Link Provider to Existing Account**:
```bash
POST /api/sso/link
{
    "provider": "github",
    "external_id": "12345",
    "external_email": "user@example.com"
}
```

**View Linked Accounts**:
```bash
GET /api/sso/accounts
Response:
[
    {
        "id": 1,
        "provider": "google",
        "external_email": "user@gmail.com",
        "linked_at": "2024-05-03T10:00:00"
    }
]
```

---

## Webhooks

### Event Types

| Event | Trigger | Payload |
|-------|---------|---------|
| `ticket.created` | New ticket submitted | ticket data |
| `ticket.updated` | Ticket modified | ticket data + changes |
| `ticket.assigned` | Ticket assigned to agent | ticket_id, agent_id |
| `ticket.resolved` | Ticket marked resolved | ticket_id, resolution_time |
| `ticket.closed` | Ticket closed | ticket_id |
| `message.created` | New message/comment | message data |
| `client.created` | New client registered | client data |
| `client.updated` | Client profile changed | client data |
| `employee.created` | New employee added | employee data |

### Creating a Webhook

**API Endpoint**:
```bash
POST /api/webhooks
{
    "name": "My Ticket Alerts",
    "description": "Alert external system of new tickets",
    "url": "https://my-service.com/webhooks/tickets",
    "event": "ticket.created",
    "method": "POST",
    "max_attempts": 5,
    "timeout": 30,
    "headers": {
        "Authorization": "Bearer xxx",
        "X-Custom-Header": "value"
    },
    "active": true
}
```

### Webhook Payload Format

```json
{
    "webhook_id": 123,
    "event": "ticket.created",
    "timestamp": "2024-05-03T10:30:00Z",
    "data": {
        "id": 456,
        "title": "Issue with machine",
        "status": "open",
        ...
    }
}
```

### Delivery & Retry Logic

**Delivery Process**:
1. Event triggered in application
2. Webhook created in `webhook_deliveries` table with status='pending'
3. Job queued: `DeliverWebhook::dispatch()`
4. Job attempts to POST webhook payload
5. On success: mark as 'delivered'
6. On failure:
   - Initialize exponential backoff: 60s → 300s → 900s
   - Increment attempt counter
   - If attempt < max_attempts: schedule retry
   - If attempt = max_attempts: mark 'failed'

**Retry Endpoints**:
```bash
# Retry single delivery
POST /api/webhooks/deliveries/{delivery_id}/retry

# Retry all failed deliveries for webhook
POST /api/webhooks/{webhook_id}/retry-failed

# Bulk retry failed
POST /api/webhooks/retry-failed
```

### Webhook Signature Verification (Client Side)

```php
// Verify webhook authenticity using HMAC-SHA256
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
$payload = file_get_contents('php://input');
$calculatedSignature = hash_hmac('sha256', $payload, env('WEBHOOK_SECRET'));

if (!hash_equals($signature, $calculatedSignature)) {
    http_response_code(401);
    die('Webhook signature verification failed');
}

// Process webhook
$data = json_decode($payload);
```

### Testing Webhooks

**Frontend Interface**:
```jsx
<WebhookManager />
// Can:
// 1. Create, edit, delete webhooks
// 2. Toggle on/off
// 3. Send test webhook
// 4. View delivery history
// 5. Manually retry failed deliveries
// 6. Monitor success rate
```

**API Test Endpoint**:
```bash
POST /api/webhooks/{webhook_id}/test
Response:
{
    "message": "Test webhook sent",
    "delivery_id": 789
}
```

---

## API Endpoints

### RBAC Management

```
GET    /api/roles                          # List all roles
POST   /api/roles                          # Create role
GET    /api/roles/{id}                     # View role
PUT    /api/roles/{id}                     # Update role
DELETE /api/roles/{id}                     # Delete role

POST   /api/roles/{id}/assign-permissions  # Assign permissions to role
POST   /api/roles/{id}/remove-permissions  # Remove permissions from role
GET    /api/roles/{id}/users               # Get users with role
POST   /api/roles/{id}/assign-users        # Assign users to role
POST   /api/roles/{id}/remove-users        # Remove users from role

GET    /api/permissions                    # List all permissions (grouped by resource)
GET    /api/roles/hierarchy                # Get role hierarchy
```

### Audit Logging

```
GET    /api/audit-logs                     # List logs with filters
GET    /api/audit-logs/{id}                # View specific log
POST   /api/audit-logs/model-history       # Get history of specific model
GET    /api/audit-logs/user/{user_id}      # User's activity
GET    /api/audit-logs/failures            # Failed operations only
GET    /api/audit-logs/summary             # Summary statistics
GET    /api/audit-logs/recent              # Recent activity (20 logs)
GET    /api/audit-logs/export              # Export as CSV
GET    /api/audit-logs/filters             # Available filter options
```

### SSO

```
GET    /api/sso/providers                  # List enabled SSO providers
GET    /api/sso/redirect/{provider}        # Redirect to provider auth
GET    /api/sso/callback/{provider}        # Provider callback (auto)

POST   /api/sso/link                       # Link provider to existing account
DELETE /api/sso/unlink/{provider}          # Unlink SSO provider
GET    /api/sso/accounts                   # View linked SSO accounts
```

### Webhooks

```
GET    /api/webhooks                       # List user's webhooks
POST   /api/webhooks                       # Create webhook
GET    /api/webhooks/{id}                  # View webhook details
PUT    /api/webhooks/{id}                  # Update webhook
DELETE /api/webhooks/{id}                  # Delete webhook

POST   /api/webhooks/{id}/toggle           # Toggle active/inactive
GET    /api/webhooks/{id}/deliveries       # View webhook deliveries
GET    /api/webhooks/deliveries/{id}       # View specific delivery
POST   /api/webhooks/deliveries/{id}/retry # Retry failed delivery
POST   /api/webhooks/{id}/test             # Send test webhook
GET    /api/webhooks/events                # List available events
GET    /api/webhooks/stats                 # Webhook statistics
POST   /api/webhooks/retry-failed          # Bulk retry failed deliveries
```

---

## Frontend Components

### 1. usePermission Hook

```jsx
import { usePermission } from '@/hooks/usePermission';

function MyComponent() {
    const { 
        hasPermission, 
        hasAnyPermission, 
        hasAllPermissions,
        hasRole,
        hasAnyRole 
    } = usePermission();

    if (!hasPermission('tickets.view')) {
        return <div>No access</div>;
    }

    return <TicketList />;
}
```

### 2. CanAccess Component

```jsx
import { CanAccess } from '@/components/CanAccess';

function TicketActions() {
    return (
        <>
            <CanAccess permission="tickets.view">
                <ViewButton />
            </CanAccess>

            <CanAccess permission="tickets.edit">
                <EditButton />
            </CanAccess>

            <CanAccess 
                permissions={['tickets.delete']}
                fallback={<DisabledDeleteButton />}
            >
                <DeleteButton />
            </CanAccess>

            <CanAccess role="admin">
                <AdminPanel />
            </CanAccess>
        </>
    );
}
```

### 3. RoleManager Component

Admin interface for:
- Viewing all roles
- Creating custom roles
- Assigning/removing permissions
- Managing user role assignments
- Deleting non-system roles

```jsx
import { RoleManager } from '@/components/RoleManager';

<RoleManager />
```

### 4. AuditLogViewer Component

Audit trail inspection interface with:
- Advanced filtering (event, model, user, date range, status)
- Real-time search
- CSV export
- Summary statistics
- Pagination

```jsx
import { AuditLogViewer } from '@/components/AuditLogViewer';

<AuditLogViewer />
```

### 5. WebhookManager Component

Webhook management UI with:
- Webhook CRUD operations
- Test webhook sending
- Delivery history inspection
- Retry failed deliveries
- Statistics dashboard
- Event type selection

```jsx
import { WebhookManager } from '@/components/WebhookManager';

<WebhookManager />
```

---

## Deployment

### Database Migration

```bash
# Run migration
php artisan migrate --path=database/migrations/2026_05_03_000002_create_rbac_audit_sso_webhooks.php

# Seed initial roles and permissions
php artisan db:seed --class=RbacSeeder
```

### Seed Initial Roles

Create `database/seeders/RbacSeeder.php`:

```php
// Admin: Full access
Role::create([
    'name' => 'admin',
    'is_system' => true,
    'priority' => 100,
])->permissions()->attach(Permission::all());

// Manager: Moderate access
Role::create([
    'name' => 'manager',
    'is_system' => true,
    'priority' => 75,
])->permissions()->attach(
    Permission::whereIn('name', [
        'tickets.view', 'tickets.edit',
        'clients.view',
        'employees.view',
        ...
    ])->pluck('id')
);

// Agent: Limited access
Role::create([...]);

// Client: Minimal access
Role::create([...]);
```

### Configuration

Add to `.env`:

```bash
# SSO
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx

# Webhooks
WEBHOOK_SECRET=your-random-secret-key
QUEUE_DRIVER=redis  # For webhook delivery

# Audit
AUDIT_LOG_ENABLED=true
```

### Register Middleware

In `app/Http/Kernel.php`:

```php
protected $middleware = [
    ...
    \App\Http\Middleware\LogAuditTrail::class,
];

protected $routeMiddleware = [
    ...
    'permission' => \App\Http\Middleware\CheckPermission::class,
];
```

### Queue Setup

For webhook job processing:

```bash
# Start queue worker
php artisan queue:work

# Or use supervisor for production
# See: https://laravel.com/docs/queues#supervisor-configuration
```

---

## Best Practices

### 1. Permission Naming

Use consistent resource.action format:
- ✅ `tickets.view`, `tickets.create`, `tickets.delete`
- ❌ `view_tickets`, `can_delete_ticket`

### 2. Audit Logging

Keep sensitive data out of logs:
```php
// Already handled in LogAuditTrail middleware
// Passwords, tokens, credit cards get redacted
```

### 3. Webhook Delivery

Always verify webhook signatures:
```php
// Client-side verification
hash_hmac('sha256', $payload, WEBHOOK_SECRET)
```

### 4. SSO Security

- Store secrets in environment variables
- Use HTTPS for all OAuth callbacks
- Validate state parameter in middleware
- Set secure cookies for tokens

### 5. Frontend Permission Checks

Always check permissions on both frontend AND backend:
```jsx
// Frontend: UX purposes (hide buttons user can't use)
<CanAccess permission="tickets.delete">
    <DeleteButton />
</CanAccess>

// Backend: SECURITY (always validate on API)
Route::delete('/tickets/{id}')
    ->middleware('permission:tickets.delete');
```

---

## Troubleshooting

### Common Issues

**1. User can't login with SSO**
- Check SSO provider is enabled in database
- Verify client_id and client_secret are correct
- Check redirect URI matches provider configuration
- Review logs: `storage/logs/laravel.log`

**2. Webhooks not being delivered**
- Check queue is running: `php artisan queue:work`
- Verify webhook URL is accessible
- Check firewall rules
- Review webhook_deliveries table for error_message

**3. Audit logs not recording**
- Verify LogAuditTrail middleware is registered
- Check requests are going through /api/* routes
- Ensure user is authenticated

**4. Permission denied errors**
- Verify user has been assigned role
- Check role has required permissions
- Look for permission typos in code

---

## Future Enhancements

- [ ] API key authentication for service-to-service
- [ ] Webhook signing with ed25519
- [ ] Batch audit log export (async jobs)
- [ ] LDAP/Active Directory integration
- [ ] Fine-grained row-level permissions
- [ ] Permission inheritance hierarchy
- [ ] Audit log retention policies
- [ ] Webhook rate limiting per provider
- [ ] Advanced analytics dashboard
- [ ] Login attempt tracking & adaptive security

---

**Last Updated**: May 3, 2024
**Version**: 1.0
**Status**: Production Ready
