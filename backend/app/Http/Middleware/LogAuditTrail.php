<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;

class LogAuditTrail
{
    /**
     * Handle an incoming request
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Only log for API requests
        if (!$request->is('api/*')) {
            return $response;
        }

        // Don't log read-only requests or webhook callbacks
        if ($request->method === 'GET' || $request->is('api/webhooks/*')) {
            return $response;
        }

        // Extract model information from the request
        $user = $request->user();
        if (!$user) {
            return $response;
        }

        $this->logActivity($request, $response, $user);

        return $response;
    }

    /**
     * Log the API activity
     */
    private function logActivity($request, $response, $user): void
    {
        $event = $this->getEventType($request);
        $status = $response->status() >= 400 ? 'failed' : 'success';

        AuditLog::create([
            'user_id' => $user->id,
            'event' => $event,
            'model_type' => $this->getModelType($request),
            'model_id' => $this->getModelId($request),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'http_method' => $request->method(),
            'http_path' => $request->path(),
            'status' => $status,
            'response_code' => $response->status(),
            'old_values' => null,
            'new_values' => $this->sanitizePayload($request->all()),
        ]);
    }

    /**
     * Determine the event type based on HTTP method
     */
    private function getEventType(Request $request): string
    {
        return match ($request->method()) {
            'POST' => 'created',
            'PUT', 'PATCH' => 'updated',
            'DELETE' => 'deleted',
            default => 'accessed',
        };
    }

    /**
     * Extract model type from request path
     */
    private function getModelType(Request $request): ?string
    {
        $pathParts = explode('/', trim($request->path(), '/'));
        
        // Skip 'api' prefix
        if ($pathParts[0] === 'api') {
            $pathParts = array_slice($pathParts, 1);
        }

        // Get the first part as model type (singular form)
        $modelType = $pathParts[0] ?? null;
        
        if (!$modelType || $modelType === 'webhooks') {
            return null;
        }

        // Convert plural to singular for common cases
        return match ($modelType) {
            'clients' => 'Client',
            'employees' => 'Employee',
            'tickets', 'demandes' => 'Demande',
            'roles' => 'Role',
            'permissions' => 'Permission',
            'webhooks' => 'Webhook',
            'machines' => 'Machine',
            'users' => 'User',
            default => ucfirst(rtrim($modelType, 's')),
        };
    }

    /**
     * Extract model ID from request path
     */
    private function getModelId(Request $request): ?int
    {
        $pathParts = explode('/', trim($request->path(), '/'));
        
        // Skip 'api' prefix
        if ($pathParts[0] === 'api') {
            $pathParts = array_slice($pathParts, 1);
        }

        // Get the second part if it's a numeric ID
        $id = $pathParts[1] ?? null;
        
        return is_numeric($id) ? (int)$id : null;
    }

    /**
     * Sanitize request payload (remove sensitive data)
     */
    private function sanitizePayload(array $payload): array
    {
        $sensitive = ['password', 'token', 'secret', 'pin', 'credit_card'];
        
        foreach ($payload as $key => $value) {
            if (in_array(strtolower($key), $sensitive)) {
                $payload[$key] = '***REDACTED***';
            }
        }

        return $payload;
    }
}
