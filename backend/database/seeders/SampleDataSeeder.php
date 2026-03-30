<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Client;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SampleDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ───────────────────────────────────────────────────────
        // ADMIN USER
        // ───────────────────────────────────────────────────────
        User::create([
            'name' => 'Admin User',
            'email' => 'admin@idsoft.com',
            'password' => Hash::make('Admin@1234'),
            'role' => 'admin',
            'cin' => '00000001',
            'code_fiscal' => '0001ADM0001',
            'client_state' => 'active',
        ]);

        // ───────────────────────────────────────────────────────
        // EMPLOYEES/WORKERS
        // ───────────────────────────────────────────────────────
        
        // Employee 1
        User::create([
            'name' => 'Marco Rivera',
            'email' => 'marco.rivera@idsoft.tn',
            'password' => Hash::make('Tech@2024'),
            'role' => 'employee',
            'cin' => '01234567',
            'code_fiscal' => '1234RIV5678',
            'client_state' => 'active',
        ]);

        // Employee 2
        User::create([
            'name' => 'Sarah Johnson',
            'email' => 'sarah.johnson@idsoft.tn',
            'password' => Hash::make('Tech@2024'),
            'role' => 'employee',
            'cin' => '10876543',
            'code_fiscal' => '5432JOH8765',
            'client_state' => 'active',
        ]);

        // Employee 3
        User::create([
            'name' => 'Ahmed Ben Ali',
            'email' => 'ahmed.benali@idsoft.tn',
            'password' => Hash::make('Tech@2024'),
            'role' => 'employee',
            'cin' => '01555555',
            'code_fiscal' => '1555ALI5555',
            'client_state' => 'active',
        ]);

        // ───────────────────────────────────────────────────────
        // SAMPLE CLIENTS
        // ───────────────────────────────────────────────────────

        // Client 1
        Client::create([
            'nom' => 'Gourmet Haven Ltd',
            'prenom' => 'Manager',
            'mail' => 'contact@gourmethaven.com',
            'numero' => '+216 71 123 456',
            'cin' => '01111111',
            'code_fiscal' => '1111GOU1111',
            'password' => Hash::make('Client@1234'),
            'money' => 2450.000,
            'client_state' => 'active',
        ]);

        User::create([
            'name' => 'Gourmet Haven Ltd',
            'email' => 'contact@gourmethaven.com',
            'password' => Hash::make('Client@1234'),
            'role' => 'client',
            'cin' => '01111111',
            'code_fiscal' => '1111GOU1111',
            'client_state' => 'active',
        ]);

        // Client 2
        Client::create([
            'nom' => 'TechPro Solutions',
            'prenom' => 'Support',
            'mail' => 'support@techpro.tn',
            'numero' => '+216 71 234 567',
            'cin' => '02222222',
            'code_fiscal' => '2222TEC2222',
            'password' => Hash::make('Client@1234'),
            'money' => 1850.500,
            'client_state' => 'active',
        ]);

        User::create([
            'name' => 'TechPro Solutions',
            'email' => 'support@techpro.tn',
            'password' => Hash::make('Client@1234'),
            'role' => 'client',
            'cin' => '02222222',
            'code_fiscal' => '2222TEC2222',
            'client_state' => 'active',
        ]);

        // Client 3
        Client::create([
            'nom' => 'Finance Plus Group',
            'prenom' => 'Director',
            'mail' => 'director@financeplus.tn',
            'numero' => '+216 71 345 678',
            'cin' => '03333333',
            'code_fiscal' => '3333FIN3333',
            'password' => Hash::make('Client@1234'),
            'money' => 5200.750,
            'client_state' => 'active',
        ]);

        User::create([
            'name' => 'Finance Plus Group',
            'email' => 'director@financeplus.tn',
            'password' => Hash::make('Client@1234'),
            'role' => 'client',
            'cin' => '03333333',
            'code_fiscal' => '3333FIN3333',
            'client_state' => 'active',
        ]);

        // Client 4 (Inactive)
        Client::create([
            'nom' => 'Inactive Business Inc',
            'prenom' => 'Owner',
            'mail' => 'owner@inactivebiz.tn',
            'numero' => '+216 71 456 789',
            'cin' => '04444444',
            'code_fiscal' => '4444INA4444',
            'password' => Hash::make('Client@1234'),
            'money' => 0,
            'client_state' => 'inactive',
        ]);

        User::create([
            'name' => 'Inactive Business Inc',
            'email' => 'owner@inactivebiz.tn',
            'password' => Hash::make('Client@1234'),
            'role' => 'client',
            'cin' => '04444444',
            'code_fiscal' => '4444INA4444',
            'client_state' => 'inactive',
        ]);

        // Client 5
        Client::create([
            'nom' => 'Retail Express Store',
            'prenom' => 'Manager',
            'mail' => 'manager@retailexpress.tn',
            'numero' => '+216 71 567 890',
            'cin' => '05555555',
            'code_fiscal' => '5555RET5555',
            'password' => Hash::make('Client@1234'),
            'money' => 3100.000,
            'client_state' => 'active',
        ]);

        User::create([
            'name' => 'Retail Express Store',
            'email' => 'manager@retailexpress.tn',
            'password' => Hash::make('Client@1234'),
            'role' => 'client',
            'cin' => '05555555',
            'code_fiscal' => '5555RET5555',
            'client_state' => 'active',
        ]);
    }
}
