import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePermission } from '../hooks/usePermission';

/**
 * Admin panel for managing roles and permissions
 */
export function RoleManager() {
  const { hasPermission } = usePermission();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  useEffect(() => {
    if (!hasPermission('roles.view')) {
      return;
    }
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/api/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await axios.get('/api/permissions');
      setPermissions(response.data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      await axios.post('/api/roles', {
        name: newRoleName,
        description: newRoleDescription,
      });
      setNewRoleName('');
      setNewRoleDescription('');
      await fetchRoles();
    } catch (error) {
      alert('Failed to create role: ' + error.response?.data?.message);
    }
  };

  const deleteRole = async (roleId) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;

    try {
      await axios.delete(`/api/roles/${roleId}`);
      await fetchRoles();
      setSelectedRole(null);
    } catch (error) {
      alert('Failed to delete role: ' + error.response?.data?.error);
    }
  };

  const assignPermissions = async (roleId, selectedPermissions) => {
    try {
      await axios.post(`/api/roles/${roleId}/assign-permissions`, {
        permissions: selectedPermissions,
      });
      await fetchRoles();
    } catch (error) {
      alert('Failed to assign permissions: ' + error.response?.data?.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="role-manager">
      <div className="role-list-panel">
        <h2>Roles</h2>
        
        {/* Create New Role */}
        <div className="create-role">
          <input
            type="text"
            placeholder="Role name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            disabled={!hasPermission('roles.create')}
          />
          <textarea
            placeholder="Description"
            value={newRoleDescription}
            onChange={(e) => setNewRoleDescription(e.target.value)}
            disabled={!hasPermission('roles.create')}
          />
          <button 
            onClick={createRole}
            disabled={!hasPermission('roles.create') || !newRoleName}
          >
            Create Role
          </button>
        </div>

        {/* Role List */}
        <div className="roles">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`role-item ${selectedRole?.id === role.id ? 'active' : ''}`}
              onClick={() => setSelectedRole(role)}
            >
              <div className="role-name">{role.name}</div>
              <div className="role-count">
                {role.user_count} users • {role.permission_count} permissions
              </div>
              {role.is_system && <span className="badge">System</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Role Details Panel */}
      {selectedRole && (
        <div className="role-details-panel">
          <h2>{selectedRole.name}</h2>
          <p>{selectedRole.description}</p>

          {/* Permissions Assignment */}
          <div className="permissions-section">
            <h3>Permissions</h3>
            <div className="permissions-grid">
              {Object.entries(permissions).map(([resource, perms]) => (
                <div key={resource} className="permission-group">
                  <h4>{resource}</h4>
                  <div className="permission-list">
                    {perms.map((permission) => (
                      <label key={permission.id}>
                        <input
                          type="checkbox"
                          defaultChecked={selectedRole.permissions?.some(
                            (p) => p.id === permission.id
                          )}
                          onChange={(e) => {
                            const selectedPerms = e.target.checked
                              ? [...(selectedRole.permissions || []), permission.id]
                              : (selectedRole.permissions || []).filter(
                                  (p) => p.id !== permission.id
                                );
                            assignPermissions(selectedRole.id, selectedPerms);
                          }}
                          disabled={!hasPermission('roles.edit')}
                        />
                        <span>{permission.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delete Role */}
          {!selectedRole.is_system && (
            <button 
              onClick={() => deleteRole(selectedRole.id)}
              disabled={!hasPermission('roles.delete')}
              className="btn-danger"
            >
              Delete Role
            </button>
          )}
        </div>
      )}

      <style>{`
        .role-manager {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          padding: 20px;
        }

        .role-list-panel {
          border-right: 1px solid #eee;
          padding-right: 20px;
        }

        .create-role {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .role-item {
          padding: 12px;
          margin: 8px 0;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .role-item:hover {
          background: #f5f5f5;
        }

        .role-item.active {
          background: #e3f2fd;
          border-color: #2196f3;
        }

        .role-name {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .role-count {
          font-size: 12px;
          color: #666;
        }

        .badge {
          display: inline-block;
          background: #f0f0f0;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          margin-top: 4px;
        }

        .permissions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }

        .permission-group {
          border: 1px solid #ddd;
          padding: 12px;
          border-radius: 4px;
        }

        .permission-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }

        .permission-list label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .btn-danger {
          background: #f44336;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 20px;
        }

        .btn-danger:hover:not(:disabled) {
          background: #d32f2f;
        }

        button:disabled,
        input:disabled,
        textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
