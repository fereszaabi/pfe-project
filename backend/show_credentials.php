<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$response = $kernel->handle($request = \Illuminate\Http\Request::capture());

// Get all users
$users = \App\Models\User::all();

echo "=== SEEDED LOGIN CREDENTIALS ===\n\n";
echo "PASSWORD: Same for all = LastSeeded@2024\n\n";

foreach ($users as $user) {
    echo "Name: {$user->name}\n";
    echo "  Role: {$user->role}\n";
    echo "  Email: {$user->email}\n";
    echo "  CIN: {$user->cin}\n";
    echo "  Code Fiscale: {$user->code_fiscal}\n";
    echo "  Password: LastSeeded@2024\n";
    echo "\n";
}
