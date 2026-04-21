<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SampleDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Keep only a default admin account and do not inject sample clients,
        // employees, machines, or tickets.
        User::firstOrCreate(
            ['email' => 'admin@idsoft.com'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('Admin@1234'),
                'role' => 'admin',
                'cin' => '00000001',
                'code_fiscal' => '0001ADM0001',
                'client_state' => 'active',
            ]
        );
    }
}

