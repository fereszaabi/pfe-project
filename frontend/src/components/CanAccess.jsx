import { usePermission } from '../hooks/usePermission';

/**
 * Component to conditionally render based on permissions/roles
 * 
 * Usage:
 * <CanAccess permission="tickets.delete">
 *   <DeleteButton />
 * </CanAccess>
 */
export function CanAccess({ 
  children, 
  permission = null, 
  permissions = null,
  requireAll = false,
  role = null,
  roles = null,
  requireAllRoles = false,
  fallback = null 
}) {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    hasRole, 
    hasAnyRole 
  } = usePermission();

  let allowed = true;

  if (permission) {
    allowed = hasPermission(permission);
  } else if (permissions) {
    allowed = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  }

  if (role) {
    allowed = allowed && hasRole(role);
  } else if (roles) {
    allowed = allowed && (requireAllRoles ? !hasAnyRole(roles) : hasAnyRole(roles));
  }

  if (!allowed) {
    return fallback || null;
  }

  return children;
}

/**
 * Hook-based permission checker (for use in component logic)
 */
export function withPermission(Component, permission) {
  return function ProtectedComponent(props) {
    const { hasPermission } = usePermission();

    if (!hasPermission(permission)) {
      return null;
    }

    return <Component {...props} />;
  };
}
