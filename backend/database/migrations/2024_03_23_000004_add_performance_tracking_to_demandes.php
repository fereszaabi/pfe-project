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
        Schema::table('demandes', function (Blueprint $table) {
            // Track when employee claimed the ticket
            $table->timestamp('assigned_at')->nullable()->after('id_employee');
            // Track when ticket was completed
            $table->timestamp('completed_at')->nullable()->after('end_at');
            // Resolution time in hours (calculated field for performance tracking)
            $table->decimal('resolution_hours', 8, 2)->nullable()->after('completed_at');
            // Client satisfaction rating (1-5)
            $table->integer('client_rating')->nullable()->after('resolution_hours')->comment('1-5 star rating from client');
            // Track if ticket was re-opened
            $table->integer('reopen_count')->default(0)->after('client_rating');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demandes', function (Blueprint $table) {
            $table->dropColumn(['assigned_at', 'completed_at', 'resolution_hours', 'client_rating', 'reopen_count']);
        });
    }
};
