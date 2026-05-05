<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Roles table
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('admin, manager, agent, client');
            $table->string('display_name')->comment('Administrator, Manager, Support Agent');
            $table->text('description')->nullable();
            $table->boolean('is_system')->default(true)->comment('Cannot be deleted if true');
            $table->integer('priority')->default(0)->comment('Higher = more permissive');
            $table->timestamps();
        });

        // Permissions table
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('tickets.view, tickets.create, etc');
            $table->string('display_name')->comment('Display name for UI');
            $table->text('description')->nullable();
            $table->string('resource')->comment('tickets, clients, employees, etc');
            $table->string('action')->comment('view, create, edit, delete, admin');
            $table->timestamps();
        });

        // Role-Permission relationship
        Schema::create('role_permission', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->foreignId('permission_id')->constrained('permissions')->onDelete('cascade');
            $table->primary(['role_id', 'permission_id']);
        });

        // User-Role relationship
        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->primary(['role_id', 'user_id']);
            $table->timestamp('assigned_at')->nullable();
        });

        // Custom user permissions (override role permissions)
        Schema::create('user_permission', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('permission_id')->constrained('permissions')->onDelete('cascade');
            $table->boolean('has_permission')->default(true);
            $table->text('reason')->nullable();
            $table->timestamps();
            $table->primary(['user_id', 'permission_id']);
        });

        // Audit log table
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('event')->comment('created, updated, deleted, etc');
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_type')->nullable()->comment('user, employee, client, system');
            $table->text('old_values')->nullable()->comment('JSON');
            $table->text('new_values')->nullable()->comment('JSON');
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->string('method')->nullable()->comment('GET, POST, PATCH, DELETE');
            $table->string('url')->nullable();
            $table->integer('status_code')->nullable();
            $table->text('changes')->nullable()->comment('Human-readable changes');
            $table->timestamp('created_at')->nullable();
            $table->index(['model_type', 'model_id']);
            $table->index(['user_id', 'created_at']);
            $table->index('event');
        });

        // SSO Providers table
        Schema::create('sso_providers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique()->comment('google, github, oauth, saml, etc');
            $table->string('display_name')->comment('Google, GitHub, etc');
            $table->boolean('enabled')->default(false);
            $table->json('config')->comment('provider-specific config');
            $table->string('client_id')->nullable();
            $table->string('client_secret')->nullable();
            $table->string('redirect_url')->nullable();
            $table->string('authorize_url')->nullable();
            $table->string('token_url')->nullable();
            $table->string('user_info_url')->nullable();
            $table->timestamps();
        });

        // SSO User mapping
        Schema::create('sso_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->foreignId('sso_provider_id')->constrained('sso_providers')->onDelete('cascade');
            $table->string('external_id')->unique();
            $table->string('email');
            $table->json('profile_data')->nullable();
            $table->timestamps();
            $table->unique(['sso_provider_id', 'external_id']);
        });

        // Webhooks table
        Schema::create('webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('url');
            $table->string('event')->comment('ticket.created, ticket.updated, etc');
            $table->json('filters')->nullable()->comment('Event filters');
            $table->string('method')->default('POST')->comment('POST, PUT, PATCH');
            $table->json('headers')->nullable()->comment('Custom headers');
            $table->boolean('active')->default(true);
            $table->integer('max_attempts')->default(5);
            $table->integer('timeout')->default(30);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('event');
            $table->index('active');
        });

        // Webhook delivery log
        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('webhook_id')->constrained('webhooks')->onDelete('cascade');
            $table->string('event');
            $table->json('payload');
            $table->string('status')->default('pending')->comment('pending, delivered, failed');
            $table->integer('attempt')->default(1);
            $table->integer('response_status')->nullable();
            $table->text('response_body')->nullable();
            $table->string('error_message')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->index(['webhook_id', 'status']);
            $table->index('delivered_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_deliveries');
        Schema::dropIfExists('webhooks');
        Schema::dropIfExists('sso_users');
        Schema::dropIfExists('sso_providers');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('user_permission');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('role_permission');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
