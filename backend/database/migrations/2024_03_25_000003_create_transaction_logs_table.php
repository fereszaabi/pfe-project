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
        Schema::create('transaction_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->unsignedBigInteger('demande_id')->nullable()->comment('Ticket ID if transaction is ticket-related');
            $table->enum('transaction_type', ['charge', 'refund', 'credit', 'deposit'])->comment('Type of transaction');
            $table->decimal('amount', 10, 3);
            $table->decimal('balance_before', 10, 3)->comment('Balance before transaction');
            $table->decimal('balance_after', 10, 3)->comment('Balance after transaction');
            $table->string('description');
            $table->string('reference_no')->unique()->nullable()->comment('Transaction reference number');
            $table->enum('status', ['pending', 'completed', 'failed', 'cancelled'])->default('completed');
            $table->timestamp('created_at')->nullable();

            // Foreign keys
            $table->foreign('client_id')->references('id')->on('clients')->onDelete('cascade');
            $table->foreign('demande_id')->references('id')->on('demandes')->onDelete('set null');

            // Indexes
            $table->index('client_id');
            $table->index('demande_id');
            $table->index('transaction_type');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaction_logs');
    }
};
