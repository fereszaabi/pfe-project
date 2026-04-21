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
        Schema::table('messages', function (Blueprint $table) {
            // Add ticket_id to link messages to specific tickets
            $table->unsignedBigInteger('ticket_id')->nullable()->after('conversation_id');
            
            // Foreign key to demandes table
            $table->foreign('ticket_id')->references('id')->on('demandes')->onDelete('cascade');
            
            // Index for fast queries on ticket messages
            $table->index('ticket_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropForeign(['ticket_id']);
            $table->dropIndex(['ticket_id']);
            $table->dropColumn('ticket_id');
        });
    }
};
