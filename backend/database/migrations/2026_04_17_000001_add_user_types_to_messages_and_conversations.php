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
            $table->string('sender_type')->default('user')->after('sender_id')->comment('Type of sender: user, employee, or client');
            $table->string('recipient_type')->default('user')->after('recipient_id')->comment('Type of recipient: user, employee, or client');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->string('sender_type')->default('user')->after('sender_id')->comment('Type of sender: user, employee, or client');
            $table->string('recipient_type')->default('user')->after('recipient_id')->comment('Type of recipient: user, employee, or client');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['sender_type', 'recipient_type']);
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['sender_type', 'recipient_type']);
        });
    }
};
