# Analytics & Reporting System Implementation

## Overview

A comprehensive KPI tracking and analytics system has been implemented to provide real-time operational insights for support team management. This system replaces generic metrics with actionable business intelligence that managers can use for decision-making.

## Features Implemented

### 1. **Key Performance Indicators (KPIs)**

#### Tracked Metrics:
- **First Response Time** (hours): Average time from ticket creation to first assignment
- **Resolution Time** (hours): Average time from assignment to ticket completion
- **Backlog Age** (days): Average age of unresolved tickets
- **CSAT Score** (out of 5): Customer Satisfaction based on ticket ratings
- **Resolution Rate** (%): Percentage of tickets resolved vs. total created
- **SLA Compliance** (%): Percentage of tickets resolved within SLA windows
- **Backlog Count**: Current number of tickets in progress
- **Status Distribution**: Breakdown of tickets by status

### 2. **Trend Analysis**

Real-time trend charts showing performance over selected date ranges with optional metrics:
- **Ticket Trends**: Created vs. Resolved tickets per day
- **Resolution Time Trends**: Average resolution time progression
- **First Response Trends**: Average first response time progression
- **CSAT Trends**: Customer satisfaction score over time
- **Backlog Trends**: Backlog volume and age progression

### 3. **Agent Workload Analytics**

Detailed agent-level metrics:
- Total assigned tickets (period)
- Resolved tickets count
- Pending tickets count
- Average resolution time per agent
- Average customer rating per agent
- Current workload (active tickets)
- Resolution rate percentage

**Dashboard Display**: Side-by-side agent performance cards with visual workload indicators

### 4. **Backlog Management**

Critical backlog insights:
- Total backlog count
- Breakdown by age ranges:
  - Under 24 hours
  - 1-3 days
  - 3-7 days
  - Over 7 days
- Breakdown by priority (urgent, high, medium, low)
- Oldest ticket age (critical alerts)
- Critical ticket count (urgent + high priority)

### 5. **Date Range Filtering**

- Calendar-based start/end date selection
- All metrics dynamically recalculate based on selected range
- Supports custom periods (last 7 days, 30 days, quarterly, annual, etc.)
- Preserved across all dashboard tabs

### 6. **Export Functionality**

**Export Formats**:
- JSON format: Raw structured data
- CSV format: Spreadsheet-compatible (coming soon)

**Exportable Reports**:
- KPI Metrics Report
- Detailed Tickets Report
- Agent Performance Report

**Files Generated**: `analytics_report_{date}.json` or `.csv`

## Backend Architecture

### New Controller: `AnalyticsController`

**Endpoints**:

#### `/api/analytics/kpis` (GET)
- **Parameters**: `start_date`, `end_date`
- **Returns**: All KPI metrics for the period
- **Cache**: N/A (calculated on-demand)

#### `/api/analytics/trends` (GET)
- **Parameters**: `start_date`, `end_date`, `metric`: (tickets|resolution_time|first_response|csat|backlog)
- **Returns**: Daily data points for trend visualization

#### `/api/analytics/agent-workload` (GET)
- **Parameters**: `start_date`, `end_date`
- **Returns**: Agent performance metrics including workload

#### `/api/analytics/backlog` (GET)
- **Parameters**: `start_date`, `end_date`, `priority` (optional)
- **Returns**: Backlog breakdown by age and priority

#### `/api/analytics/export` (POST)
- **Parameters**: `report_type`, `format`, `start_date`, `end_date`
- **Returns**: CSV/JSON file stream
- **Formats**: `csv`, `json`
- **Types**: `kpis`, `tickets`, `agents`

### Data Calculations

All metrics are calculated from the `Demande` (tickets) model using date ranges:

```php
// First Response Time = created_at to assigned_at
// Resolution Time = assigned_at to completed_at
// Backlog Age = average days for unresolved tickets
// CSAT = average of client_rating field
```

## Frontend Architecture

### New Component: `AnalyticsDashboard`

**Tabs**:
1. **KPI Metrics** - Overview of all key metrics with trend indicators
2. **Trends** - Interactive time-series charts with metric selector
3. **Agent Workload** - Team performance grid with individual analytics
4. **Backlog** - Critical backlog management view

**Features**:
- Real-time data fetching with loading states
- Responsive grid layout (desktop/tablet/mobile)
- Dark mode support
- Date range controls in header
- Export button with format selection

### API Integration (`frontend/src/services/api.js`)

New exported functions:
```javascript
getKpiMetrics(startDate, endDate)
getTrendData(metric, startDate, endDate)
getAgentWorkload(startDate, endDate)
getBacklogDetails(startDate, endDate, priority)
exportReport(reportType, format, startDate, endDate)
```

## Usage Guide

### Admin Access

1. Navigate to Admin Dashboard
2. Click **"Analytics & Reports"** button in sidebar
3. Select date range using calendar inputs
4. Choose metric/tab to view
5. Export data using Export button

### Date Range Selection
```
Start Date: YYYY-MM-DD
End Date: YYYY-MM-DD
```

### Interpreting KPI Metrics

| Metric | Target | Interpretation |
|--------|--------|-----------------|
| First Response Time | < 2 hours | How quickly team acknowledges tickets |
| Resolution Time | < 4 hours | Average time to resolve |
| CSAT Score | > 4.0 | Customer satisfaction (1-5 scale) |
| Resolution Rate | > 90% | Efficiency of ticket closure |
| SLA Compliance | > 95% | Contract fulfillment |
| Backlog Age | < 3 days | Ticket staleness indicator |

### Agent Performance Analysis

**Key Metrics per Agent**:
- **Resolution Rate**: Percentage of assigned tickets resolved
- **Avg Resolution Time**: Hours spent per ticket
- **Avg Rating**: Customer satisfaction feedback
- **Workload**: Current active tickets (should be balanced)

## Database Considerations

### Required Fields in `demande` table:
- `created_at` - ticket creation timestamp
- `assigned_at` - assignment to employee timestamp (nullable)
- `completed_at` - resolution timestamp (nullable)
- `client_rating` - 1-5 rating for CSAT (nullable)
- `status` - ticket status
- `priority` - ticket priority level
- `resolution_hours` - calculated field (set at completion)

### Migration Note
If fields are missing, add via migration:
```php
Schema::table('demandes', function (Blueprint $table) {
    $table->timestamp('assigned_at')->nullable()->after('created_at');
    $table->timestamp('completed_at')->nullable()->after('assigned_at');
    $table->float('resolution_hours')->nullable()->after('completed_at');
});
```

## Performance Optimization

### Caching Strategy
- KPI calculations are computed on-demand (no cache to ensure freshness)
- Results are computed from database queries during request
- For large datasets, consider implementing query optimization:

```php
// Query optimization for KPI calculations
Demande::whereBetween('created_at', [$startDate, $endDate])
    ->select('id', 'created_at', 'assigned_at', 'completed_at', 'status', 'client_rating')
    ->with('employee:id,nom')
    ->get();
```

### Scalability
- For > 100k tickets/month, consider time-bucketing aggregations
- Implement indexed columns: `created_at`, `status`, `priority`
- Consider materialized views for historical trend data

## Future Enhancements

1. **Predictive Analytics**: ML-based forecasting
2. **Real-time Dashboards**: WebSocket updates
3. **Custom Report Builder**: User-defined metric combinations
4. **Scheduled Reports**: Automated email delivery
5. **Benchmark Comparison**: vs. industry standards
6. **CSAT Correlation**: Link ratings to resolution time
7. **SLA Management**: Define custom SLA rules per ticket type
8. **Heat Maps**: Time-based demand visualization
9. **ROI Calculations**: Cost vs. resolution time analysis

## Troubleshooting

### No Data Showing
- Check date range includes tickets
- Verify `assigned_at` and `completed_at` are being set
- Check user permissions (admin role required)

### Export Not Working
- Ensure full app path is correct in API calls
- Check PHP output buffering settings
- Verify disk space for CSV generation

### Page Loads Slowly
- Reduce date range (limit to 90 days for best performance)
- Check database indexes on timestamps
- Verify server resources during peak hours

## API Response Examples

### KPI Metrics Response
```json
{
  "ok": true,
  "period": {
    "start_date": "2026-04-03",
    "end_date": "2026-05-03"
  },
  "kpis": {
    "first_response_time_hours": 1.5,
    "resolution_time_hours": 4.2,
    "backlog_age_days": 2.8,
    "csat_score": 4.3,
    "resolution_rate_percent": 92.5,
    "sla_compliance_percent": 96.8,
    "backlog_count": 15,
    "total_tickets": 200,
    "resolved_tickets": 185
  },
  "status_distribution": {
    "resolved": 185,
    "in-progress": 12,
    "submitted": 3
  }
}
```

### Agent Workload Response
```json
{
  "ok": true,
  "agents": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "total_assigned": 45,
      "resolved": 42,
      "pending": 3,
      "avg_resolution_hours": 3.8,
      "avg_rating": 4.6,
      "current_workload": 2,
      "resolution_rate_percent": 93.3
    }
  ]
}
```

## Configuration

To enable custom date ranges for different report types, update controller parameters or create configuration file:

```php
// config/analytics.php
return [
    'default_period_days' => 30,
    'trend_granularity' => 'daily', // or 'hourly', 'weekly'
    'export_max_records' => 50000,
];
```

## Testing

### Sample Test Cases
1. Date range calculation accuracy
2. Null value handling for unassigned tickets
3. CSAT calculation with missing ratings
4. Workload balancing across agents
5. Export file generation and format validation

---

**Last Updated**: May 3, 2026
**Version**: 1.0
**Status**: Production Ready
