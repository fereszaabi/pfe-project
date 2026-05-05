import { useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook to check user permissions and roles
 */
export function usePermission() {
  const { user } = useAuth();

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    return user.permissions?.includes(permission) || false;
  }, [user]);

  const hasAnyPermission = useCallback((permissions) => {
    if (!user) return false;
    return permissions.some(p => user.permissions?.includes(p));
  }, [user]);

  const hasAllPermissions = useCallback((permissions) => {
    if (!user) return false;
    return permissions.every(p => user.permissions?.includes(p));
  }, [user]);

  const hasRole = useCallback((role) => {
    if (!user) return false;
    return user.roles?.includes(role) || false;
  }, [user]);

  const hasAnyRole = useCallback((roles) => {
    if (!user) return false;
    return roles.some(r => user.roles?.includes(r));
  }, [user]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
  };
}
