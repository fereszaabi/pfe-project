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
            if (!Schema::hasColumn('employees', 'name')) {
                $table->string('name')->nullable()->after('id');
            }
            if (!Schema::hasColumn('employees', 'email')) {
                $table->string('email')->unique()->nullable()->after('mail');
            }
            if (!Schema::hasColumn('employees', 'code_fiscal')) {
                $table->string('code_fiscal')->unique()->nullable()->after('cin');
            }
            if (!Schema::hasColumn('employees', 'role')) {
                $table->string('role')->default('technician')->after('prenom');
            }
            if (!Schema::hasColumn('employees', 'phone')) {
                $table->string('phone')->nullable()->after('role');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['name', 'email', 'code_fiscal', 'role', 'phone']);
        });
    }
};
