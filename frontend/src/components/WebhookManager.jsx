import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePermission } from '../hooks/usePermission';

/**
 * Webhook management interface
 */
export function WebhookManager() {
  const { hasPermission } = usePermission();
  const [webhooks, setWebhooks] = useState([]);
  const [events, setEvents] = useState({});
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    event: '*',
    method: 'POST',
    headers: '{}',
    active: true,
    max_attempts: 5,
    timeout: 30,
  });

  useEffect(() => {
    if (!hasPermission('webhooks.view')) {
      return;
    }
    fetchWebhooks();
    fetchEvents();
    fetchStats();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await axios.get('/api/webhooks');
      setWebhooks(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/webhooks/events');
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/webhooks/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchDeliveries = async (webhookId) => {
    try {
      const response = await axios.get(`/api/webhooks/${webhookId}/deliveries`);
      setDeliveries(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    }
  };

  const createWebhook = async () => {
    try {
      const payload = {
        ...formData,
        headers: formData.headers ? JSON.parse(formData.headers) : {},
      };
      await axios.post('/api/webhooks', payload);
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        url: '',
        event: '*',
        method: 'POST',
        headers: '{}',
        active: true,
        max_attempts: 5,
        timeout: 30,
      });
      await fetchWebhooks();
    } catch (error) {
      alert('Failed to create webhook: ' + error.response?.data?.message);
    }
  };

  const updateWebhook = async (webhookId, data) => {
    try {
      await axios.put(`/api/webhooks/${webhookId}`, data);
      await fetchWebhooks();
    } catch (error) {
      alert('Failed to update webhook: ' + error.response?.data?.message);
    }
  };

  const deleteWebhook = async (webhookId) => {
    if (!window.confirm('Are you sure?')) return;

    try {
      await axios.delete(`/api/webhooks/${webhookId}`);
      await fetchWebhooks();
      setSelectedWebhook(null);
    } catch (error) {
      alert('Failed to delete webhook');
    }
  };

  const toggleWebhook = async (webhookId, currentActive) => {
    try {
      await axios.post(`/api/webhooks/${webhookId}/toggle`);
      await fetchWebhooks();
    } catch (error) {
      alert('Failed to toggle webhook');
    }
  };

  const testWebhook = async (webhookId) => {
    try {
      await axios.post(`/api/webhooks/${webhookId}/test`);
      alert('Test webhook sent. Check deliveries tab for results.');
    } catch (error) {
      alert('Failed to send test webhook');
    }
  };

  const retryFailedDeliveries = async (webhookId) => {
    try {
      await axios.post('/api/webhooks/retry-failed', {
        webhook_id: webhookId,
      });
      alert('Failed deliveries queued for retry');
      if (selectedWebhook) {
        fetchDeliveries(selectedWebhook.id);
      }
    } catch (error) {
      alert('Failed to retry deliveries');
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!hasPermission('webhooks.view')) {
    return <div>You don't have permission to manage webhooks</div>;
  }

  return (
    <div className="webhook-manager">
      {/* Stats */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Active Webhooks</div>
            <div className="stat-value">{stats.active_webhooks}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Deliveries</div>
            <div className="stat-value">{stats.total_deliveries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Success Rate</div>
            <div className="stat-value">{stats.success_rate.toFixed(1)}%</div>
          </div>
          <div className="stat-card error">
            <div className="stat-label">Failed</div>
            <div className="stat-value">{stats.failed_deliveries}</div>
          </div>
        </div>
      )}

      <div className="webhook-layout">
        {/* Webhooks List */}
        <div className="webhooks-panel">
          <div className="panel-header">
            <h2>Webhooks</h2>
            {hasPermission('webhooks.create') && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="btn-primary"
              >
                {showCreateForm ? 'Cancel' : 'Create'}
              </button>
            )}
          </div>

          {/* Create Form */}
          {showCreateForm && hasPermission('webhooks.create') && (
            <div className="create-form">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>URL *</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://example.com/webhook"
                />
              </div>

              <div className="form-group">
                <label>Event *</label>
                <select
                  value={formData.event}
                  onChange={(e) =>
                    setFormData({ ...formData, event: e.target.value })
                  }
                >
                  {Object.entries(events).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) =>
                      setFormData({ ...formData, method: e.target.value })
                    }
                  >
                    <option>POST</option>
                    <option>PUT</option>
                    <option>PATCH</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Max Attempts</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.max_attempts}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_attempts: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-actions">
                <button onClick={createWebhook} className="btn-submit">
                  Create Webhook
                </button>
              </div>
            </div>
          )}

          {/* Webhooks List */}
          <div className="webhooks-list">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className={`webhook-item ${
                  selectedWebhook?.id === webhook.id ? 'active' : ''
                }`}
                onClick={() => {
                  setSelectedWebhook(webhook);
                  fetchDeliveries(webhook.id);
                }}
              >
                <div className="webhook-header">
                  <div className="webhook-name">{webhook.name}</div>
                  <div
                    className={`status ${webhook.active ? 'active' : 'inactive'}`}
                  >
                    {webhook.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <div className="webhook-event">{webhook.event}</div>
                <div className="webhook-url">{webhook.url}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Details */}
        {selectedWebhook && (
          <div className="details-panel">
            <h2>{selectedWebhook.name}</h2>

            <div className="details-section">
              <div className="detail-row">
                <span className="label">URL</span>
                <span className="value">{selectedWebhook.url}</span>
              </div>
              <div className="detail-row">
                <span className="label">Event</span>
                <span className="value">{selectedWebhook.event}</span>
              </div>
              <div className="detail-row">
                <span className="label">Method</span>
                <span className="value">{selectedWebhook.method}</span>
              </div>
              <div className="detail-row">
                <span className="label">Status</span>
                <span className={`value ${selectedWebhook.active ? 'success' : ''}`}>
                  {selectedWebhook.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Actions */}
            {hasPermission('webhooks.update') && (
              <div className="actions">
                <button
                  onClick={() =>
                    toggleWebhook(selectedWebhook.id, selectedWebhook.active)
                  }
                >
                  {selectedWebhook.active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => testWebhook(selectedWebhook.id)}>
                  Send Test
                </button>
                <button onClick={() => retryFailedDeliveries(selectedWebhook.id)}>
                  Retry Failed
                </button>
              </div>
            )}

            {hasPermission('webhooks.delete') && (
              <div className="danger-actions">
                <button
                  onClick={() => deleteWebhook(selectedWebhook.id)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            )}

            {/* Deliveries */}
            <div className="deliveries-section">
              <h3>Recent Deliveries</h3>
              <div className="deliveries-list">
                {deliveries.length === 0 ? (
                  <div>No deliveries yet</div>
                ) : (
                  deliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className={`delivery-item ${delivery.status}`}
                    >
                      <div className="delivery-event">
                        {delivery.event} -{' '}
                        <span className={`badge ${delivery.status}`}>
                          {delivery.status}
                        </span>
                      </div>
                      <div className="delivery-time">
                        {new Date(delivery.created_at).toLocaleString()}
                      </div>
                      {delivery.response_status && (
                        <div className="delivery-response">
                          HTTP {delivery.response_status}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .webhook-manager {
          padding: 20px;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
          text-align: center;
        }

        .stat-card.error {
          background: #ffebee;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #333;
        }

        .webhook-layout {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 20px;
        }

        .webhooks-panel {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .create-form {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 5px;
          font-size: 12px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .form-actions {
          display: flex;
          gap: 10px;
        }

        .btn-submit {
          flex: 1;
          padding: 10px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .webhook-item {
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .webhook-item:hover {
          background: #f0f0f0;
        }

        .webhook-item.active {
          background: #e3f2fd;
          border-color: #2196f3;
        }

        .webhook-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .webhook-name {
          font-weight: 600;
        }

        .status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 3px;
          background: #f0f0f0;
        }

        .status.active {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .status.inactive {
          background: #ffebee;
          color: #c62828;
        }

        .webhook-event {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .webhook-url {
          font-size: 11px;
          color: #999;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .details-panel {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
        }

        .details-section {
          margin: 20px 0;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 4px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          font-weight: 600;
          color: #666;
        }

        .detail-row .value {
          color: #333;
          word-break: break-all;
        }

        .actions {
          display: flex;
          gap: 10px;
          margin: 20px 0;
        }

        .actions button {
          flex: 1;
          padding: 10px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .actions button:hover {
          background: #f0f0f0;
        }

        .danger-actions {
          border-top: 1px solid #ddd;
          padding-top: 20px;
        }

        .btn-danger {
          width: 100%;
          padding: 10px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .btn-danger:hover {
          background: #d32f2f;
        }

        .deliveries-section {
          border-top: 1px solid #ddd;
          padding-top: 20px;
          margin-top: 20px;
        }

        .deliveries-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .delivery-item {
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 8px;
          background: white;
        }

        .delivery-item.delivered {
          border-left: 4px solid #4caf50;
        }

        .delivery-item.failed {
          border-left: 4px solid #f44336;
          background: #ffebee;
        }

        .delivery-item.pending {
          border-left: 4px solid #ff9800;
        }

        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
        }

        .badge.delivered {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .badge.failed {
          background: #ffebee;
          color: #c62828;
        }

        .badge.pending {
          background: #fff3e0;
          color: #e65100;
        }

        .delivery-time {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
        }

        .btn-primary {
          padding: 8px 16px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
