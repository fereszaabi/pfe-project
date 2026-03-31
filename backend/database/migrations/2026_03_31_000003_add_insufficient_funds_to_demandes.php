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
            // Track if ticket was created with insufficient client funds
            $table->boolean('insufficient_funds')->default(false)->after('payment_notes');
            // Track if admin approved despite insufficient funds
            $table->boolean('admin_approved_override')->default(false)->after('insufficient_funds');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demandes', function (Blueprint $table) {
            $table->dropColumn('insufficient_funds');
            $table->dropColumn('admin_approved_override');
        });
    }
};
