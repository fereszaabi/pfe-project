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
        Schema::table('employees', function (Blueprint $table) {
            // Total tickets completed
            $table->integer('tickets_completed')->default(0)->after('phone');
            // Average client rating (1-5)
            $table->decimal('avg_rating', 3, 2)->default(0)->after('tickets_completed')->comment('Average client rating 0-5');
            // Average resolution time in hours
            $table->decimal('avg_resolution_hours', 8, 2)->default(0)->after('avg_rating');
            // Current workload (tickets in progress)
            $table->integer('current_workload')->default(0)->after('avg_resolution_hours');
            // Total earnings/bonus from completed tickets
            $table->decimal('total_earnings', 10, 3)->default(0)->after('current_workload');
            // Performance status (active, inactive, on-leave)
            $table->string('performance_status')->default('active')->after('total_earnings');
            // Last ticket completion date
            $table->timestamp('last_ticket_completed')->nullable()->after('performance_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
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
