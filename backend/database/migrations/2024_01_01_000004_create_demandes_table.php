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
        Schema::create('demandes', function (Blueprint $table) {
            $table->id();
            $table->string('titre');
            $table->foreignId('id_client')->constrained('clients')->onDelete('cascade');
            $table->foreignId('id_employee')->nullable()->constrained('employees')->onDelete('set null');
            $table->foreignId('id_machine')->nullable()->constrained('machines')->onDelete('set null');
            $table->text('description')->nullable();
            $table->string('image')->nullable();
            $table->string('status');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('end_at')->nullable();
            $table->string('employee_note')->nullable();
            $table->string('priority');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('demandes');
    }
};
