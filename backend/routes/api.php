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
use App\Http\Controllers\Api\SupportBotController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [RegisterController::class, 'register']);

// Authenticated routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);

    // Client
    Route::apiResource('client/tickets', ClientController::class)
         ->only(['index', 'store', 'show', 'destroy']);
    Route::get('client/logs', [ClientController::class, 'getLogs']);
        Route::patch('client/logs/{logId}/read', [ClientController::class, 'markLogRead']);
        Route::delete('client/tickets/{ticket}/image', [ClientController::class, 'deleteTicketImage']);
    Route::post('client/tickets/{ticket}/rate', [ClientController::class, 'rate']);
    Route::get('client/machines', [ClientController::class, 'getMachines']);
    Route::get('client/profile', [ClientProfileController::class, 'getProfile']);
    Route::apiResource('client/machines', MachineController::class)
         ->only(['index', 'store', 'update', 'destroy']);
    Route::middleware('role:client')->post('client/support-bot', [SupportBotController::class, 'ask']);

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
        Route::get('/admin/clients', [AdminUserController::class, 'getClients']);
        Route::post('/admin/users', [AdminUserController::class, 'store']);
        Route::patch('/admin/clients/{client}', [AdminUserController::class, 'update']);
        Route::patch('/admin/demandes/{demande}/status', [AdminUserController::class, 'update_statu']);
        Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
        Route::patch('/admin/clients/{client}/take-money', [AdminUserController::class, 'takeMoney']);
        Route::patch('/admin/clients/{client}/balance', [AdminUserController::class, 'updateBalance']);
        
        // Employee Management
        Route::get('/admin/employees', [AdminUserController::class, 'getEmployees']);
        Route::post('/admin/employees', [AdminUserController::class, 'storeEmployee']);
        Route::patch('/admin/employees/{employeeId}', [AdminUserController::class, 'updateEmployee']);
        Route::delete('/admin/employees/{employeeId}', [AdminUserController::class, 'destroyEmployee']);
        
        // Ticket Finance Management
        Route::get('/admin/tickets/insufficient-funds', [AdminUserController::class, 'getInsufficientFundsTickets']);
        Route::post('/admin/tickets/{ticketId}/set-cost', [AdminUserController::class, 'setTicketCost']);
        Route::post('/admin/tickets/{ticketId}/approve-override', [AdminUserController::class, 'approveInsufficientFundsTicket']);
        Route::post('/admin/tickets/{ticketId}/process-payment', [AdminUserController::class, 'processTicketPayment']);
    });

    // Messaging (available to employees, admins, and clients)
    Route::get('messages/conversations', [MessagingController::class, 'conversations']);
    Route::get('messages/conversations/{conversationId}', [MessagingController::class, 'getMessages']);
    Route::get('messages/tickets/{ticketId}', [MessagingController::class, 'getTicketMessages']);
    Route::post('messages/send', [MessagingController::class, 'sendMessage']);
    Route::post('messages/start/{userId}', [MessagingController::class, 'startConversation']);
    Route::get('messages/available-employees', [MessagingController::class, 'getAvailableEmployees']);
    Route::get('messages/unread', [MessagingController::class, 'unreadSummary']);
    Route::get('messages/search', [MessagingController::class, 'searchMessages']);
    Route::delete('messages/{messageId}', [MessagingController::class, 'deleteMessage']);
});