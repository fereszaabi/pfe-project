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
            // Drop the existing foreign keys that point to users table
            try {
                $table->dropForeign(['sender_id']);
            } catch (\Exception $e) {
                // Foreign key might not exist
            }
            
            try {
                $table->dropForeign(['recipient_id']);
            } catch (\Exception $e) {
                // Foreign key might not exist
            }
        });

        Schema::table('conversations', function (Blueprint $table) {
            // Drop the existing foreign keys that point to users table
            try {
                $table->dropForeign(['sender_id']);
            } catch (\Exception $e) {
                // Foreign key might not exist
            }
            
            try {
                $table->dropForeign(['recipient_id']);
            } catch (\Exception $e) {
                // Foreign key might not exist
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert is complex - keeping original foreign keys would require additional logic
        // This is a data model change that's hard to fully revert without losing information
    }
};
