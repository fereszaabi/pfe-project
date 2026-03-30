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
        Schema::create('client_phone_numbers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->string('phone_number');
            $table->string('contact_person')->nullable()->comment('Name of person at this number');
            $table->enum('type', ['main', 'secondary', 'emergency', 'support'])->default('main');
            $table->boolean('is_primary')->default(false);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            // Foreign key
            $table->foreign('client_id')->references('id')->on('clients')->onDelete('cascade');

            // Indexes
            $table->index('client_id');
            $table->unique(['client_id', 'phone_number']);
        });

        // Migrate existing phone number from clients table
        Schema::table('client_phone_numbers', function (Blueprint $table) {
            // Data migration will be done via seeder/post-migration script
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('client_phone_numbers');
    }
};
