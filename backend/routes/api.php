<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\Api\AdminUserController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
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
         ->only(['index', 'store']);

    // Employee
    Route::middleware('role:employee')->group(function () {
        Route::apiResource('employee/tickets', EmployeeController::class)
             ->only(['index', 'show', 'update']);
        Route::post('employee/tickets/{demande}/assign', [EmployeeController::class, 'assign']);
        Route::post('employee/tickets/{ticket}/reply', [EmployeeController::class, 'reply']);
        Route::get('employee/stats', [EmployeeController::class, 'stats']);
    });

    // Admin
    Route::middleware('role:admin')->group(function () {
        Route::get('/admin/demandes', [AdminUserController::class, 'index']);
        Route::get('/admin/demandes/{demande}', [AdminUserController::class, 'show']);
        Route::get('/admin/stats', [AdminUserController::class, 'stats']);
        Route::post('/admin/users', [AdminUserController::class, 'store']);
        Route::patch('/admin/clients/{client}', [AdminUserController::class, 'update']);
        Route::patch('/admin/demandes/{demande}/status', [AdminUserController::class, 'update_statu']);
        Route::delete('/admin/users/{user}', [AdminUserController::class, 'destroy']);
        Route::patch('/admin/clients/{client}/take-money', [AdminUserController::class, 'takeMoney']);
    });
});