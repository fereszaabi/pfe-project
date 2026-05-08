<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TwoFactorController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

/*
|--------------------------------------------------------------------------
| 2FA Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth'])->group(function () {
    Route::get('/2fa/challenge',  [TwoFactorController::class, 'showChallenge'])->name('2fa.challenge');
    Route::post('/2fa/verify',    [TwoFactorController::class, 'verifyChallenge'])->name('2fa.verify');
    Route::post('/2fa/resend',    [TwoFactorController::class, 'resendOtp'])->name('2fa.resend');
});

/*
|--------------------------------------------------------------------------
| Protected Ticket Routes (require 2FA)
|--------------------------------------------------------------------------
| Add 'require.2fa' middleware to any route that should trigger OTP.
| - Clients creating a ticket: POST /tickets
| - Employees claiming a ticket: POST /tickets/{id}/claim
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'require.2fa'])->group(function () {
    Route::post('/tickets',              [\App\Http\Controllers\TicketController::class, 'store'])->name('tickets.store');
    Route::post('/tickets/{id}/claim',   [\App\Http\Controllers\TicketController::class, 'claim'])->name('tickets.claim');
    Route::post('/tickets/{id}/close',   [\App\Http\Controllers\TicketController::class, 'close'])->name('tickets.close');
});

/*
|--------------------------------------------------------------------------
| Login Route with Cloudflare Turnstile CAPTCHA
|--------------------------------------------------------------------------
*/
Route::middleware(['guest'])->group(function () {
    Route::get('/login',  [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'create'])->name('login');
    // 'verify.captcha' middleware runs before the login POST handler
    Route::post('/login', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'store'])
         ->middleware('verify.captcha')
         ->name('login.post');
});
