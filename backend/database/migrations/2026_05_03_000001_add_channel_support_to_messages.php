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
        // Add channel tracking to messages table
        Schema::table('messages', function (Blueprint $table) {
            $table->string('channel')->default('web')->after('ticket_id')->comment('Channel source: web, email, whatsapp, sms, facebook, etc');
            $table->string('external_message_id')->nullable()->after('channel')->comment('ID from external service (email-id, whatsapp-id, etc)');
            $table->string('external_user_id')->nullable()->after('external_message_id')->comment('User ID from external service');
            $table->json('channel_metadata')->nullable()->after('external_user_id')->comment('Additional channel-specific data');
            
            // Indexes for channel queries
            $table->index('channel');
            $table->index('external_message_id');
        });

        // Add channel tracking to conversations table
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('primary_channel')->default('web')->after('recipient_type')->comment('Primary channel for this conversation');
            $table->json('active_channels')->nullable()->after('primary_channel')->comment('Array of channels this conversation uses');
        });

        // Create communication_channels table
        Schema::create('communication_channels', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('email, whatsapp, sms, facebook, etc');
            $table->string('display_name')->comment('Email, WhatsApp, SMS, Facebook Messenger');
            $table->boolean('enabled')->default(false);
            $table->json('config')->nullable()->comment('Channel-specific configuration (API keys, etc)');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // Create channel_addresses table to link clients to external channels
        Schema::create('channel_addresses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('client_id');
            $table->string('channel')->comment('email, whatsapp, sms, facebook, etc');
            $table->string('address')->comment('Email, phone number, WhatsApp ID, etc');
            $table->boolean('verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            
            // Foreign key
            $table->foreign('client_id')->references('id')->on('clients')->onDelete('cascade');
            
            // Unique combination ensures one address per channel per client
            $table->unique(['client_id', 'channel', 'address']);
            
            // Indexes for lookups
            $table->index('channel');
            $table->index('address');
        });

        // Create channel_webhooks table for tracking incoming webhooks
        Schema::create('channel_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('channel');
            $table->string('event_type')->comment('inbound.message, outbound.message, delivery, read, etc');
            $table->unsignedBigInteger('message_id')->nullable();
            $table->json('payload')->comment('Complete webhook payload');
            $table->boolean('processed')->default(false);
            $table->string('processing_status')->default('pending')->comment('pending, success, failed');
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('created_at')->nullable();
            
            // Foreign key
            $table->foreign('message_id')->references('id')->on('messages')->onDelete('set null');
            
            // Indexes for queries
            $table->index('channel');
            $table->index('processed');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['channel']);
            $table->dropIndex(['external_message_id']);
            $table->dropColumn([
                'channel',
                'external_message_id',
                'external_user_id',
                'channel_metadata'
            ]);
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn(['primary_channel', 'active_channels']);
        });

        Schema::dropIfExists('channel_webhooks');
        Schema::dropIfExists('channel_addresses');
        Schema::dropIfExists('communication_channels');
    }
};
