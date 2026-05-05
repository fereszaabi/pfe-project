<?php

namespace Database\Seeders;

use App\Models\Admin;
use App\Models\Client;
use App\Models\Demande;
use App\Models\Employee;
use App\Models\Machine;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SampleDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $adminUser = User::firstOrCreate(
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

        $admin = Admin::firstOrCreate(
            ['mail' => $adminUser->email],
            [
                'nom' => 'Admin',
                'prenom' => 'User',
                'cin' => $adminUser->cin,
                'password' => $adminUser->password,
            ]
        );

        $employees = [
            [
                'name' => 'emp1',
                'email' => 'emp1@idsoft.com',
                'cin' => '01234567',
                'code_fiscal' => '1234EMP0001',
            ],
            [
                'name' => 'emp2',
                'email' => 'emp2@idsoft.com',
                'cin' => '01234568',
                'code_fiscal' => '1234EMP0002',
            ],
        ];

        foreach ($employees as $employeeData) {
            $user = User::firstOrCreate(
                ['email' => $employeeData['email']],
                [
                    'name' => $employeeData['name'],
                    'password' => Hash::make('emp@123'),
                    'role' => 'employee',
                    'cin' => $employeeData['cin'],
                    'code_fiscal' => $employeeData['code_fiscal'],
                    'client_state' => 'active',
                ]
            );

            Employee::firstOrCreate(
                ['mail' => $user->email],
                [
                    'nom' => $employeeData['name'],
                    'prenom' => strtoupper($employeeData['name']),
                    'cin' => $employeeData['cin'],
                    'password' => $user->password,
                    'id_admin' => $admin->id,
                ]
            );
        }

        $clients = [
            [
                'name' => 'client 1',
                'email' => 'client1@idsoft.com',
                'cin' => '01111111',
                'code_fiscal' => '1111CLI0001',
                'numero' => '20000001',
            ],
            [
                'name' => 'client 2',
                'email' => 'client2@idsoft.com',
                'cin' => '02222222',
                'code_fiscal' => '2222CLI0002',
                'numero' => '20000002',
            ],
            [
                'name' => 'client 3',
                'email' => 'client3@idsoft.com',
                'cin' => '03333333',
                'code_fiscal' => '3333CLI0003',
                'numero' => '20000003',
            ],
            [
                'name' => 'client 4',
                'email' => 'client4@idsoft.com',
                'cin' => '04444444',
                'code_fiscal' => '4444CLI0004',
                'numero' => '20000004',
            ],
        ];

        foreach ($clients as $clientData) {
            $user = User::firstOrCreate(
                ['email' => $clientData['email']],
                [
                    'name' => $clientData['name'],
                    'password' => Hash::make('client@123'),
                    'role' => 'client',
                    'cin' => $clientData['cin'],
                    'code_fiscal' => $clientData['code_fiscal'],
                    'client_state' => 'active',
                ]
            );

            $nameParts = preg_split('/\s+/', $clientData['name'], 2);
            $nom = $nameParts[0] ?? $clientData['name'];
            $prenom = $nameParts[1] ?? $nom;

            Client::firstOrCreate(
                ['mail' => $user->email],
                [
                    'nom' => $nom,
                    'prenom' => $prenom,
                    'cin' => $clientData['cin'],
                    'code_fiscal' => $clientData['code_fiscal'],
                    'numero' => $clientData['numero'],
                    'password' => $user->password,
                    'money' => 0,
                    'client_state' => 'active',
                ]
            );
        }

        $clientRecords = Client::whereIn('mail', collect($clients)->pluck('email'))->get()->keyBy('mail');
        $employeeRecords = Employee::whereIn('mail', collect($employees)->pluck('email'))->get()->keyBy('mail');

        $machines = [
            [
                'nom_poste' => 'Client 1 - POS Terminal',
                'code_anydesk' => '111-222-333',
                'client_mail' => 'client1@idsoft.com',
            ],
            [
                'nom_poste' => 'Client 2 - Accounting PC',
                'code_anydesk' => '222-333-444',
                'client_mail' => 'client2@idsoft.com',
            ],
            [
                'nom_poste' => 'Client 3 - Reception Laptop',
                'code_anydesk' => '333-444-555',
                'client_mail' => 'client3@idsoft.com',
            ],
            [
                'nom_poste' => 'Client 4 - Office Desktop',
                'code_anydesk' => '444-555-666',
                'client_mail' => 'client4@idsoft.com',
            ],
        ];

        $machineRecords = collect();
        foreach ($machines as $machineData) {
            $client = $clientRecords->get($machineData['client_mail']);
            if (!$client) {
                continue;
            }

            $machine = Machine::firstOrCreate(
                [
                    'nom_poste' => $machineData['nom_poste'],
                    'id_client' => $client->id,
                ],
                [
                    'code_anydesk' => $machineData['code_anydesk'],
                ]
            );
            $machineRecords->push($machine);
        }

        $tickets = [
            [
                'titre' => 'Printer not responding',
                'description' => 'Unable to print invoices from the POS terminal.',
                'priority' => 'high',
                'status' => 'assigned',
                'client_mail' => 'client1@idsoft.com',
                'employee_mail' => 'emp1@idsoft.com',
            ],
            [
                'titre' => 'Software update request',
                'description' => 'Need to update the accounting module to the latest version.',
                'priority' => 'medium',
                'status' => 'submitted',
                'client_mail' => 'client2@idsoft.com',
                'employee_mail' => null,
            ],
            [
                'titre' => 'Slow system performance',
                'description' => 'The reception laptop is very slow after login.',
                'priority' => 'urgent',
                'status' => 'in progress',
                'client_mail' => 'client3@idsoft.com',
                'employee_mail' => 'emp2@idsoft.com',
            ],
            [
                'titre' => 'Access issue',
                'description' => 'User cannot access the admin panel after password reset.',
                'priority' => 'low',
                'status' => 'resolved',
                'client_mail' => 'client4@idsoft.com',
                'employee_mail' => 'emp1@idsoft.com',
            ],
        ];

        foreach ($tickets as $ticketData) {
            $client = $clientRecords->get($ticketData['client_mail']);
            if (!$client) {
                continue;
            }

            $employee = $ticketData['employee_mail'] ? $employeeRecords->get($ticketData['employee_mail']) : null;
            $machine = $machineRecords->firstWhere('id_client', $client->id);

            $createdAt = Carbon::now()->subDays(rand(1, 5));
            $endAt = $ticketData['status'] === 'resolved' ? $createdAt->copy()->addHours(rand(2, 6)) : null;

            Demande::firstOrCreate(
                [
                    'titre' => $ticketData['titre'],
                    'id_client' => $client->id,
                ],
                [
                    'description' => $ticketData['description'],
                    'priority' => $ticketData['priority'],
                    'status' => $ticketData['status'],
                    'id_employee' => $employee?->id,
                    'id_machine' => $machine?->id,
                    'created_at' => $createdAt,
                    'end_at' => $endAt,
                    'employee_note' => $employee ? 'Assigned to ' . $employee->nom : null,
                ]
            );
        }
    }
}

