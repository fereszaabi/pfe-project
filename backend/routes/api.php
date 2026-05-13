<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\MachineController;
use App\Http\Controllers\Api\MessagingController;
use App\Http\Controllers\Api\ClientProfileController;
use App\Http\Controllers\Api\HelpCenterController;
use App\Http\Controllers\Api\SupportBotController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\ChannelWebhookController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\WebhookController;
use App\Http\Controllers\SsoController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Test route
Route::get('/test', function () {
    return response()->json(['status' => 'ok', 'timestamp' => now()]);
});

// Public routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/login/verify-otp', [AuthController::class, 'verifyOtp']);
Route::get('/captcha/challenge', [AuthController::class, 'captchaChallenge']);
Route::post('/captcha/verify', [AuthController::class, 'verifyCaptcha']);
Route::post('/register/send-code', [RegisterController::class, 'sendVerificationCode']);
Route::post('/register', [RegisterController::class, 'register']);

// Authenticated routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);

    // Client
    Route::post('client/tickets/send-otp', [ClientController::class, 'sendTicketOtp']);
    Route::apiResource('client/tickets', ClientController::class)
         ->only(['index', 'store', 'show', 'destroy']);
    Route::get('client/logs', [ClientController::class, 'getLogs']);
    Route::get('client/logs/stream', [ClientController::class, 'streamLogs']);
        Route::patch('client/logs/{logId}/read', [ClientController::class, 'markLogRead']);
        Route::delete('client/tickets/{ticket}/image', [ClientController::class, 'deleteTicketImage']);
    Route::post('client/tickets/{ticket}/rate', [ClientController::class, 'rate']);
    Route::get('client/machines', [ClientController::class, 'getMachines']);
    Route::get('client/profile', [ClientProfileController::class, 'getProfile']);
    Route::apiResource('client/machines', MachineController::class)
         ->only(['index', 'store', 'update', 'destroy']);
    Route::middleware('role:client')->group(function () {
        Route::post('client/support-bot', [SupportBotController::class, 'ask']);
        Route::get('client/support-bot/history', [SupportBotController::class, 'history']);
        Route::get('client/support-bot/history/{session}', [SupportBotController::class, 'showHistory']);
        Route::post('client/support-bot/history', [SupportBotController::class, 'storeHistory']);
        Route::get('client/help/articles', [HelpCenterController::class, 'index']);
        Route::get('client/help/articles/{article}', [HelpCenterController::class, 'show']);
    });

    // Employee
    Route::middleware('role:employee')->group(function () {
        Route::get('employee/tickets', [EmployeeController::class, 'index']);
        Route::get('employee/tickets/{demande}', [EmployeeController::class, 'show']);
        Route::post('employee/tickets/{demande}/claim', [EmployeeController::class, 'claim']);
        Route::post('employee/tickets/{demande}/unclaim', [EmployeeController::class, 'unclaim']);
        Route::patch('employee/tickets/{demande}', [EmployeeController::class, 'update']);
        Route::post('employee/tickets/{demande}/rate', [EmployeeController::class, 'rate']);
        Route::get('employee/stats', [EmployeeController::class, 'stats']);
        Route::get('employee/leaderboard', [EmployeeController::class, 'leaderboard']);
    });

    // IT queue (shared by employee/admin views)
    Route::get('it/tickets', [EmployeeController::class, 'itTickets']);

    // Admin
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/demandes', [AdminUserController::class, 'index']);
        Route::get('/admin/demandes/{demande}', [AdminUserController::class, 'show']);
        Route::get('/admin/stats', [AdminUserController::class, 'stats']);
        Route::get('/admin/otp-codes', [AdminUserController::class, 'getLocalOtpCodes']);
        Route::get('/admin/clients', [AdminUserController::class, 'getClients']);
        Route::post('/admin/users', [AdminUserController::class, 'store']);
        Route::patch('/admin/clients/{client}', [AdminUserController::class, 'update']);
        Route::patch('/admin/demandes/{demande}/status', [AdminUserController::class, 'update_statu']);
        Route::patch('/admin/demandes/{demande}/assign', [AdminUserController::class, 'assignTicket']);
        Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
        Route::patch('/admin/clients/{client}/take-money', [AdminUserController::class, 'takeMoney']);
        Route::patch('/admin/clients/{client}/balance', [AdminUserController::class, 'updateBalance']);
        
        // Employee Management
        Route::get('/admin/employees', [AdminUserController::class, 'getEmployees']);
        Route::get('/admin/employees/{employeeId}/stats', [AdminUserController::class, 'getEmployeeStats']);
        Route::post('/admin/employees', [AdminUserController::class, 'storeEmployee']);
        Route::patch('/admin/employees/{employeeId}', [AdminUserController::class, 'updateEmployee']);
        Route::delete('/admin/employees/{employeeId}', [AdminUserController::class, 'destroyEmployee']);
        
        // Ticket Finance Management
        Route::get('/admin/tickets/insufficient-funds', [AdminUserController::class, 'getInsufficientFundsTickets']);
        Route::post('/admin/tickets/{ticketId}/set-cost', [AdminUserController::class, 'setTicketCost']);
        Route::post('/admin/tickets/{ticketId}/approve-override', [AdminUserController::class, 'approveInsufficientFundsTicket']);
        Route::post('/admin/tickets/{ticketId}/process-payment', [AdminUserController::class, 'processTicketPayment']);
        // Ticket blocking management
        Route::post('/admin/tickets/{ticketId}/block', [AdminUserController::class, 'blockTicket']);
        Route::post('/admin/tickets/{ticketId}/unblock', [AdminUserController::class, 'unblockTicket']);
            Route::delete('/admin/tickets/{ticketId}', [AdminUserController::class, 'deleteTicket']);
        
        // Employee notifications
        Route::post('/employee/notify/assignment', [AdminUserController::class, 'notifyEmployeeAssignment']);
        Route::post('/employee/notify/reassignment', [AdminUserController::class, 'notifyEmployeeReassignment']);
        
        // Analytics & Reporting
        Route::get('/analytics/kpis', [AnalyticsController::class, 'kpiMetrics']);
        Route::get('/analytics/trends', [AnalyticsController::class, 'trendData']);
        Route::get('/analytics/agent-workload', [AnalyticsController::class, 'agentWorkload']);
        Route::get('/analytics/backlog', [AnalyticsController::class, 'backlogDetails']);
        Route::post('/analytics/export', [AnalyticsController::class, 'exportReport']);

        // RBAC Management
        Route::apiResource('roles', RoleController::class);
        Route::post('roles/{role}/assign-permissions', [RoleController::class, 'assignPermissions']);
        Route::post('roles/{role}/remove-permissions', [RoleController::class, 'removePermissions']);
        Route::get('roles/{role}/users', [RoleController::class, 'getUsers']);
        Route::post('roles/{role}/assign-users', [RoleController::class, 'assignUsers']);
        Route::post('roles/{role}/remove-users', [RoleController::class, 'removeUsers']);
        Route::get('permissions', [RoleController::class, 'getPermissions']);
        Route::get('roles/hierarchy', [RoleController::class, 'getHierarchy']);

        // Audit Logging
        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/{auditLog}', [AuditLogController::class, 'show']);
        Route::post('audit-logs/model-history', [AuditLogController::class, 'modelHistory']);
        Route::get('audit-logs/user/{user}', [AuditLogController::class, 'userActivity']);
        Route::get('audit-logs/failures', [AuditLogController::class, 'failures']);
        Route::get('audit-logs/summary', [AuditLogController::class, 'summary']);
        Route::get('audit-logs/recent', [AuditLogController::class, 'recent']);
        Route::get('audit-logs/export', [AuditLogController::class, 'export']);
        Route::get('audit-logs/filters', [AuditLogController::class, 'getFilters']);
    });

    // SSO (Public endpoints for OAuth callback, Authenticated for management)
    Route::get('sso/providers', [SsoController::class, 'getProviders']);
    Route::get('sso/redirect/{provider}', [SsoController::class, 'redirect'])->name('sso.redirect');
    Route::get('sso/callback/{provider}', [SsoController::class, 'callback'])->name('sso.callback');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('sso/link', [SsoController::class, 'linkProvider']);
        Route::delete('sso/unlink/{provider}', [SsoController::class, 'unlinkProvider']);
        Route::get('sso/accounts', [SsoController::class, 'getLinkedAccounts']);
    });

    // Webhooks
    Route::middleware('auth:sanctum')->group(function () {
        Route::apiResource('webhooks', WebhookController::class);
        Route::post('webhooks/{webhook}/toggle', [WebhookController::class, 'toggle']);
        Route::get('webhooks/{webhook}/deliveries', [WebhookController::class, 'deliveries']);
        Route::get('webhooks/deliveries/{delivery}', [WebhookController::class, 'showDelivery']);
        Route::post('webhooks/deliveries/{delivery}/retry', [WebhookController::class, 'retryDelivery']);
        Route::post('webhooks/{webhook}/test', [WebhookController::class, 'test']);
        Route::get('webhooks/events', [WebhookController::class, 'getEvents']);
        Route::get('webhooks/stats', [WebhookController::class, 'getStats']);
        Route::post('webhooks/retry-failed', [WebhookController::class, 'retryFailed']);
    });


    // Messaging (available to employees, admins, and clients)
    Route::get('messages/conversations', [MessagingController::class, 'conversations']);
    Route::get('messages/conversations/{conversationId}', [MessagingController::class, 'getMessages']);
    Route::get('messages/tickets/{ticketId}', [MessagingController::class, 'getTicketMessages']);
    Route::post('messages/send', [MessagingController::class, 'sendMessage']);
    Route::post('messages/start-support', [MessagingController::class, 'startSupportConversation']);
    Route::post('messages/start/{userId}', [MessagingController::class, 'startConversation']);
    Route::get('messages/available-employees', [MessagingController::class, 'getAvailableEmployees']);
    Route::get('messages/unread', [MessagingController::class, 'unreadSummary']);
    Route::get('messages/search', [MessagingController::class, 'searchMessages']);
    Route::delete('messages/{messageId}', [MessagingController::class, 'deleteMessage']);

    // Communication Channels
    Route::get('channels', [ChannelController::class, 'availableForClient']);
    Route::get('channels/my', [ChannelController::class, 'getClientChannels'])->middleware('role:client');
    Route::post('channels/add', [ChannelController::class, 'addChannelAddress'])->middleware('role:client');
    Route::post('channels/{addressId}/verify', [ChannelController::class, 'verifyChannelAddress'])->middleware('role:client');
    Route::delete('channels/{addressId}', [ChannelController::class, 'removeChannelAddress'])->middleware('role:client');
    Route::get('channels/admin/list', [ChannelController::class, 'index'])->middleware('role:admin');
    Route::get('channels/admin/webhooks', [ChannelController::class, 'getWebhookSummary'])->middleware('role:admin');
});

// Public webhook routes (no authentication required)
// These endpoints handle incoming messages from external services
Route::post('/webhooks/email', [ChannelWebhookController::class, 'handleEmailWebhook']);
Route::post('/webhooks/whatsapp', [ChannelWebhookController::class, 'handleWhatsAppWebhook']);
Route::post('/webhooks/sms', [ChannelWebhookController::class, 'handleSmsWebhook']);
Route::post('/webhooks/facebook', [ChannelWebhookController::class, 'handleFacebookWebhook']);

// Admin webhook management (requires authentication)
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/webhooks/status', [ChannelWebhookController::class, 'getStatus']);
    Route::post('/webhooks/retry', [ChannelWebhookController::class, 'retryFailed']);
});