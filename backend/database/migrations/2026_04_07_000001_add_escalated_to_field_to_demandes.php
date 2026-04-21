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
            // Track which support team/department the ticket was escalated to
            $table->string('escalated_to')->nullable()->after('status')->comment('Support team escalated to: Ensight Tech Support, IT Department, etc.');
            // Track when the ticket was escalated
            $table->timestamp('escalated_at')->nullable()->after('escalated_to')->comment('Timestamp when ticket was escalated');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demandes', function (Blueprint $table) {
            $table->dropColumn(['escalated_to', 'escalated_at']);
        });
    }
};
