<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Add performance tracking fields to users table as well
            // for employees authenticated via User model
            $table->integer('tickets_completed')->default(0)->after('client_state')->nullable();
            $table->decimal('avg_rating', 3, 2)->default(0)->after('tickets_completed')->nullable()->comment('Average client rating 0-5');
            $table->decimal('avg_resolution_hours', 8, 2)->default(0)->after('avg_rating')->nullable();
            $table->integer('current_workload')->default(0)->after('avg_resolution_hours')->nullable();
            $table->decimal('total_earnings', 10, 3)->default(0)->after('current_workload')->nullable();
            $table->string('performance_status')->default('active')->after('total_earnings')->nullable();
            $table->timestamp('last_ticket_completed')->nullable()->after('performance_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'tickets_completed',
                'avg_rating',
                'avg_resolution_hours',
                'current_workload',
                'total_earnings',
                'performance_status',
                'last_ticket_completed',
            ]);
        });
    }
};
