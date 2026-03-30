<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Role
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        // Get the authenticated user
        $user = $request->user();

        // If no user is authenticated, deny access
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Allow access if user role matches any of the allowed roles
        // Admins have full access to all components
        if (in_array($user->role, $roles) || $user->role === 'admin') {
            return $next($request);
        }

        // If role doesn't match, return 403 Forbidden
        return response()->json(['message' => 'Unauthorized - insufficient permissions'], 403);
    }
}
