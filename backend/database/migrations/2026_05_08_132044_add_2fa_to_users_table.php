<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('two_factor_enabled')->default(true)->after('remember_token');
            $table->timestamp('two_factor_verified_at')->nullable()->after('two_factor_enabled');
            $table->integer('otp_attempts')->default(0)->after('two_factor_verified_at');
            $table->timestamp('otp_locked_until')->nullable()->after('otp_attempts');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_enabled',
                'two_factor_verified_at',
                'otp_attempts',
                'otp_locked_until',
            ]);
        });
    }
};
