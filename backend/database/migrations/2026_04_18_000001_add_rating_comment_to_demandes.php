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
            if (!Schema::hasColumn('demandes', 'rating_comment')) {
                $table->text('rating_comment')->nullable()->after('client_rating');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demandes', function (Blueprint $table) {
            if (Schema::hasColumn('demandes', 'rating_comment')) {
                $table->dropColumn('rating_comment');
            }
        });
    }
};
