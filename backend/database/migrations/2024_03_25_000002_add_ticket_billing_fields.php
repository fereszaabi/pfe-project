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
            // Billing fields
            $table->decimal('ticket_cost', 8, 3)->default(0)->after('priority')->comment('Base ticket cost in TND');
            $table->decimal('total_cost', 8, 3)->nullable()->after('ticket_cost')->comment('Total charged amount (includes any adjustments)');
            $table->enum('payment_status', ['unpaid', 'pending', 'paid', 'refunded'])->default('unpaid')->after('total_cost')->comment('Payment status');
            $table->timestamp('paid_at')->nullable()->after('payment_status')->comment('When payment was processed');
            $table->string('payment_notes')->nullable()->after('paid_at')->comment('Payment reference or notes');
        });

        // transaction_logs table will be created separately if needed
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('demandes', function (Blueprint $table) {
            $table->dropColumn([
                'ticket_cost',
                'total_cost',
                'payment_status',
                'paid_at',
                'payment_notes',
            ]);
        });
    }
};
