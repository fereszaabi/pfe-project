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
        // This migration is skipped - id_admin can remain with its original constraint
        // Employees will be created without id_admin set during seeding
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
