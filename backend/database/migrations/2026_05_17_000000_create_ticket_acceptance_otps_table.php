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
        Schema::create('ticket_acceptance_otps', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('demande_id')->nullable();
            $table->unsignedBigInteger('employee_id')->nullable();
            $table->string('code', 6)->unique();
            $table->string('recipient')->comment('Email or identifier of recipient');
            $table->string('type')->default('emp')->comment('Type: emp for employee ticket acceptance');
            $table->boolean('verified')->default(false);
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->integer('attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            $table->timestamps();
            
            $table->foreign('demande_id')->references('id')->on('demandes')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->index('code');
            $table->index('employee_id');
            $table->index('demande_id');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ticket_acceptance_otps');
    }
};
