import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePermission } from '../hooks/usePermission';

/**
 * Audit log viewer with filters and export functionality
 */
export function AuditLogViewer() {
  const { hasPermission } = usePermission();
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    event: '',
    model: '',
    user_id: '',
    status: '',
    start_date: '',
    end_date: '',
    search: '',
  });
  const [availableFilters, setAvailableFilters] = useState({
    events: [],
    models: [],
    users: [],
  });
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!hasPermission('audit-logs.view')) {
      return;
    }
    fetchFilters();
    fetchLogs();
    fetchSummary();
  }, []);

  const fetchFilters = async () => {
    try {
      const response = await axios.get('/api/audit-logs/filters');
      setAvailableFilters(response.data);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/audit-logs', {
        params: { ...filters, page },
      });
      setLogs(response.data.data);
      setPagination({
        page,
        total: response.data.total,
      });
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const response = await axios.get('/api/audit-logs/summary', { params });
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    fetchLogs(1);
    fetchSummary();
  };

  const handleExport = async () => {
    try {
      const response = await axios.get('/api/audit-logs/export', {
        params: filters,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      alert('Failed to export logs');
    }
  };

  if (!hasPermission('audit-logs.view')) {
    return <div>You don't have permission to view audit logs</div>;
  }

  return (
    <div className="audit-log-viewer">
      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards">
          <div className="card">
            <div className="label">Total Events</div>
            <div className="value">{summary.total_events}</div>
          </div>
          <div className="card">
            <div className="label">Failed</div>
            <div className="value error">{summary.failed_count}</div>
          </div>
          <div className="card">
            <div className="label">Date Range</div>
            <div className="value">
              {new Date(summary.date_range.start).toLocaleDateString()} -
              {new Date(summary.date_range.end).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <h2>Filters</h2>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Event Type</label>
            <select
              value={filters.event}
              onChange={(e) => handleFilterChange('event', e.target.value)}
            >
              <option value="">All Events</option>
              {availableFilters.events?.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Model Type</label>
            <select
              value={filters.model}
              onChange={(e) => handleFilterChange('model', e.target.value)}
            >
              <option value="">All Models</option>
              {availableFilters.models?.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>User</label>
            <select
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
            >
              <option value="">All Users</option>
              {Object.entries(availableFilters.users || {}).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by user, method, etc..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button onClick={handleSearch} className="btn-primary">
            Search
          </button>
          <button onClick={handleExport} className="btn-secondary">
            Export CSV
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="logs-section">
        <h2>Audit Logs</h2>
        {loading ? (
          <div>Loading...</div>
        ) : logs.length === 0 ? (
          <div>No logs found</div>
        ) : (
          <div className="logs-table">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
                  <th>Model</th>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={log.status === 'failed' ? 'error-row' : ''}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.event}</td>
                    <td>{log.model_type}</td>
                    <td>{log.user?.name || 'System'}</td>
                    <td>{log.ip_address}</td>
                    <td>
                      <span className={`method method-${log.http_method.toLowerCase()}`}>
                        {log.http_method}
                      </span>
                    </td>
                    <td>
                      <span className={`status status-${log.status}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.response_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="pagination">
              <button
                disabled={pagination.page === 1}
                onClick={() => fetchLogs(pagination.page - 1)}
              >
                Previous
              </button>
              <span>Page {pagination.page}</span>
              <button onClick={() => fetchLogs(pagination.page + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .audit-log-viewer {
          padding: 20px;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 15px;
          text-align: center;
        }

        .card .label {
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .card .value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }

        .card .value.error {
          color: #f44336;
        }

        .filters-section {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
          margin-bottom: 30px;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
        }

        .filter-group label {
          font-weight: 600;
          margin-bottom: 5px;
          font-size: 12px;
        }

        .filter-group select,
        .filter-group input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .filter-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-primary {
          background: #2196f3;
          color: white;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }

        .logs-section {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
        }

        .logs-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th {
          background: #f5f5f5;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #ddd;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid #eee;
        }

        tr:hover {
          background: #f9f9f9;
        }

        tr.error-row {
          background: #ffebee;
        }

        .method {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
        }

        .method-get {
          background: #e3f2fd;
          color: #1976d2;
        }

        .method-post {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .method-patch {
          background: #fff3e0;
          color: #e65100;
        }

        .method-delete {
          background: #ffebee;
          color: #c62828;
        }

        .status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: 600;
        }

        .status-success {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .status-failed {
          background: #ffebee;
          color: #c62828;
        }

        .pagination {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
        }

        .pagination button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
