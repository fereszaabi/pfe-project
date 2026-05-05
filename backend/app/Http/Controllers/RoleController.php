<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class RoleController extends Controller
{
    /**
     * List all roles
     */
    public function index()
    {
        $roles = Role::with('permissions')->get();
        return response()->json($roles);
    }

    /**
     * Get a specific role with its permissions
     */
    public function show(Role $role)
    {
        $role->load('permissions', 'users');
        return response()->json($role);
    }

    /**
     * Create a new role
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|unique:roles,name',
            'description' => 'nullable|string',
            'priority' => 'nullable|integer|min:0',
        ]);

        $role = Role::create($request->only(['name', 'description', 'priority']));

        return response()->json($role, Response::HTTP_CREATED);
    }

    /**
     * Update a role
     */
    public function update(Request $request, Role $role)
    {
        // Prevent system roles from being modified
        if ($role->is_system) {
            return response()->json(['error' => 'Cannot modify system roles'], Response::HTTP_FORBIDDEN);
        }

        $request->validate([
            'name' => 'sometimes|required|string|unique:roles,name,' . $role->id,
            'description' => 'nullable|string',
            'priority' => 'nullable|integer|min:0',
        ]);

        $role->update($request->only(['name', 'description', 'priority']));

        return response()->json($role);
    }

    /**
     * Delete a role
     */
    public function destroy(Role $role)
    {
        // Prevent system roles from being deleted
        if ($role->is_system) {
            return response()->json(['error' => 'Cannot delete system roles'], Response::HTTP_FORBIDDEN);
        }

        // Check if role is assigned to any users
        if ($role->users()->exists()) {
            return response()->json([
                'error' => 'Cannot delete role with assigned users. Remove users first.',
            ], Response::HTTP_CONFLICT);
        }

        $role->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Assign permissions to a role
     */
    public function assignPermissions(Request $request, Role $role)
    {
        $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $permissions = Permission::whereIn('name', $request->permissions)
            ->pluck('id');

        $role->permissions()->sync($permissions);

        return response()->json([
            'message' => 'Permissions assigned successfully',
            'role' => $role->load('permissions'),
        ]);
    }

    /**
     * Remove permissions from a role
     */
    public function removePermissions(Request $request, Role $role)
    {
        $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $permissions = Permission::whereIn('name', $request->permissions)
            ->pluck('id');

        $role->permissions()->detach($permissions);

        return response()->json([
            'message' => 'Permissions removed successfully',
            'role' => $role->load('permissions'),
        ]);
    }

    /**
     * Get all permissions
     */
    public function getPermissions()
    {
        $permissions = Permission::all();
        
        // Group by resource
        $grouped = [];
        foreach ($permissions as $permission) {
            [$resource, $action] = Permission::parse($permission->name);
            if (!isset($grouped[$resource])) {
                $grouped[$resource] = [];
            }
            $grouped[$resource][] = $permission;
        }

        return response()->json($grouped);
    }

    /**
     * Get users with a specific role
     */
    public function getUsers(Role $role)
    {
        $users = $role->users()->paginate(15);
        return response()->json($users);
    }

    /**
     * Assign role to users
     */
    public function assignUsers(Request $request, Role $role)
    {
        $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        foreach ($request->user_ids as $userId) {
            $user = User::findOrFail($userId);
            $user->assignRole($role->name);
        }

        return response()->json([
            'message' => 'Users assigned to role successfully',
        ]);
    }

    /**
     * Remove users from role
     */
    public function removeUsers(Request $request, Role $role)
    {
        $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        $role->users()->detach($request->user_ids);

        return response()->json([
            'message' => 'Users removed from role successfully',
        ]);
    }

    /**
     * Get role hierarchy (for display)
     */
    public function getHierarchy()
    {
        $roles = Role::orderBy('priority', 'desc')->get();
        
        return response()->json($roles->map(function ($role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'priority' => $role->priority,
                'is_system' => $role->is_system,
                'user_count' => $role->users()->count(),
                'permission_count' => $role->permissions()->count(),
            ];
        }));
    }
}
