import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { getKpiMetrics, getTrendData, getAgentWorkload, getBacklogDetails, exportReport } from '../../services/api';

export function AnalyticsDashboard({ user, onLogout, onNavigate }) {
    const [activeTab, setActiveTab] = useState('kpis');
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });

    // KPI Data
    const [kpiData, setKpiData] = useState(null);
    const [kpiLoading, setKpiLoading] = useState(true);

    // Trend Data
    const [trendMetric, setTrendMetric] = useState('tickets');
    const [trendData, setTrendData] = useState([]);
    const [trendLoading, setTrendLoading] = useState(true);

    // Agent Workload
    const [agentData, setAgentData] = useState([]);
    const [agentLoading, setAgentLoading] = useState(true);

    // Backlog
    const [backlogData, setBacklogData] = useState(null);
    const [backlogLoading, setBacklogLoading] = useState(true);

    // Export
    const [exporting, setExporting] = useState(false);

    const fetchAllData = async () => {
        try {
            setKpiLoading(true);
            setTrendLoading(true);
            setAgentLoading(true);
            setBacklogLoading(true);

            const [kpis, trends, agents, backlog] = await Promise.all([
                getKpiMetrics(dateRange.start, dateRange.end),
                getTrendData(trendMetric, dateRange.start, dateRange.end),
                getAgentWorkload(dateRange.start, dateRange.end),
                getBacklogDetails(dateRange.start, dateRange.end),
            ]);

            setKpiData(kpis);
            setTrendData(trends?.data || []);
            setAgentData(agents?.agents || []);
            setBacklogData(backlog);
        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setKpiLoading(false);
            setTrendLoading(false);
            setAgentLoading(false);
            setBacklogLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [dateRange, trendMetric]);

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const response = await exportReport('kpis', format, dateRange.start, dateRange.end);
            
            if (format === 'json') {
                const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
            }
        } catch (err) {
            console.error('Export failed:', err);
        } finally {
            setExporting(false);
        }
    };

    const KpiCard = ({ label, value, unit, trend, icon, color = 'primary' }) => (
        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{label}</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                        {value} <span className="text-lg text-slate-500">{unit}</span>
                    </h3>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-${color}-500/10 flex items-center justify-center text-${color}-500`}>
                    <span className="material-symbols-outlined text-2xl">{icon}</span>
                </div>
            </div>
            {trend && (
                <div className="text-xs text-slate-500">
                    <span className={trend > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
                    </span>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Sidebar Navigation */}
            <aside className="w-64 bg-midnight text-slate-300 flex flex-col border-r border-border-dark">
                <div className="p-6 flex items-center gap-3">
                    <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined">analytics</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-none">IDSoft</h1>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">Analytics</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <button
                        onClick={() => setActiveTab('kpis')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeTab === 'kpis' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="text-sm font-medium">KPI Metrics</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('trends')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeTab === 'trends' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined">trending_up</span>
                        <span className="text-sm font-medium">Trends</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('agents')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeTab === 'agents' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined">people</span>
                        <span className="text-sm font-medium">Agent Workload</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('backlog')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeTab === 'backlog' ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-surface-dark/50 hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined">inbox</span>
                        <span className="text-sm font-medium">Backlog</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-rose-900/20 hover:text-rose-400 transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark overflow-y-auto">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-8 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md z-10">
                    <h2 className="text-lg font-semibold">Analytics & Reporting</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Start Date</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">End Date</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                            />
                        </div>
                        <button
                            onClick={() => handleExport('json')}
                            disabled={exporting}
                            className="px-4 py-2 rounded-lg bg-primary hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2 transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">download</span>
                            Export
                        </button>
                    </div>
                </header>

                <div className="p-8 space-y-8">
                    {/* KPI Metrics Tab */}
                    {activeTab === 'kpis' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {kpiLoading ? (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                    ))
                                ) : (
                                    <>
                                        <KpiCard
                                            label="Avg First Response"
                                            value={kpiData?.kpis?.first_response_time_hours ?? 0}
                                            unit="hours"
                                            icon="schedule"
                                            color="blue"
                                        />
                                        <KpiCard
                                            label="Avg Resolution Time"
                                            value={kpiData?.kpis?.resolution_time_hours ?? 0}
                                            unit="hours"
                                            icon="done_all"
                                            color="emerald"
                                        />
                                        <KpiCard
                                            label="Backlog Age"
                                            value={kpiData?.kpis?.backlog_age_days ?? 0}
                                            unit="days"
                                            icon="calendar_today"
                                            color="amber"
                                        />
                                        <KpiCard
                                            label="CSAT Score"
                                            value={kpiData?.kpis?.csat_score ?? 0}
                                            unit="/ 5.0"
                                            icon="star"
                                            color="yellow"
                                        />
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                    <h3 className="font-bold text-lg mb-4">Resolution Rate</h3>
                                    <div className="text-center">
                                        <h2 className="text-5xl font-black text-primary mb-2">
                                            {kpiData?.kpis?.resolution_rate_percent ?? 0}%
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            {kpiData?.kpis?.resolved_tickets ?? 0} of {kpiData?.kpis?.total_tickets ?? 0} tickets
                                        </p>
                                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-4 overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all"
                                                style={{ width: `${kpiData?.kpis?.resolution_rate_percent ?? 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                    <h3 className="font-bold text-lg mb-4">SLA Compliance</h3>
                                    <div className="text-center">
                                        <h2 className="text-5xl font-black text-emerald-500 mb-2">
                                            {kpiData?.kpis?.sla_compliance_percent ?? 0}%
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Tickets resolved within SLA
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                    <h3 className="font-bold text-lg mb-4">Current Backlog</h3>
                                    <div className="text-center">
                                        <h2 className="text-5xl font-black text-amber-500 mb-2">
                                            {kpiData?.kpis?.backlog_count ?? 0}
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Tickets in progress
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Status Distribution */}
                            <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                <h3 className="font-bold text-lg mb-6">Status Distribution</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {Object.entries(kpiData?.status_distribution || {}).map(([status, count]) => (
                                        <div key={status} className="text-center p-4 rounded-lg bg-slate-50 dark:bg-midnight">
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1 capitalize">
                                                {status}
                                            </p>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                                {count}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Trends Tab */}
                    {activeTab === 'trends' && (
                        <>
                            <div className="flex gap-4 mb-6">
                                {['tickets', 'resolution_time', 'first_response', 'csat', 'backlog'].map(metric => (
                                    <button
                                        key={metric}
                                        onClick={() => setTrendMetric(metric)}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                            trendMetric === metric
                                                ? 'bg-primary text-white'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {metric.replace('_', ' ').toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                {trendLoading ? (
                                    <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={400}>
                                        {trendMetric === 'tickets' && (
                                            <BarChart data={trendData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="created" fill="#FF6B35" name="Created" />
                                                <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
                                            </BarChart>
                                        )}
                                        {trendMetric === 'resolution_time' && (
                                            <LineChart data={trendData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="avg_resolution_hours" stroke="#FF6B35" strokeWidth={2} />
                                            </LineChart>
                                        )}
                                        {trendMetric === 'first_response' && (
                                            <LineChart data={trendData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="avg_first_response_hours" stroke="#3B82F6" strokeWidth={2} />
                                            </LineChart>
                                        )}
                                        {trendMetric === 'csat' && (
                                            <LineChart data={trendData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis domain={[0, 5]} />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="csat_score" stroke="#FBBF24" strokeWidth={2} />
                                            </LineChart>
                                        )}
                                        {trendMetric === 'backlog' && (
                                            <AreaChart data={trendData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis yAxisId="left" />
                                                <YAxis yAxisId="right" orientation="right" />
                                                <Tooltip />
                                                <Area yAxisId="left" type="monotone" dataKey="backlog_count" fill="#F59E0B" stroke="#F59E0B" />
                                            </AreaChart>
                                        )}
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </>
                    )}

                    {/* Agent Workload Tab */}
                    {activeTab === 'agents' && (
                        <div className="space-y-6">
                            {agentLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {agentData.map(agent => (
                                        <div key={agent.id} className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg">{agent.name}</h3>
                                                    <p className="text-sm text-slate-500">{agent.email}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-black text-primary">{agent.resolution_rate_percent}%</div>
                                                    <p className="text-xs text-slate-500">Resolution Rate</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3 mb-4">
                                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                                    <p className="text-xs text-slate-500 mb-1">Assigned</p>
                                                    <p className="text-xl font-bold text-blue-600">{agent.total_assigned}</p>
                                                </div>
                                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                                    <p className="text-xs text-slate-500 mb-1">Resolved</p>
                                                    <p className="text-xl font-bold text-emerald-600">{agent.resolved}</p>
                                                </div>
                                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                                                    <p className="text-xs text-slate-500 mb-1">Pending</p>
                                                    <p className="text-xl font-bold text-amber-600">{agent.pending}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600 dark:text-slate-400">Avg Resolution Time</span>
                                                    <span className="font-semibold">{agent.avg_resolution_hours}h</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600 dark:text-slate-400">Avg Rating</span>
                                                    <span className="font-semibold flex items-center gap-1">
                                                        ⭐ {agent.avg_rating.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-600 dark:text-slate-400">Current Workload</span>
                                                    <span className="font-semibold text-primary">{agent.current_workload} tickets</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Backlog Tab */}
                    {activeTab === 'backlog' && (
                        <div className="space-y-6">
                            {backlogLoading ? (
                                <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Total Backlog</p>
                                            <h2 className="text-4xl font-black text-primary">{backlogData?.total_backlog ?? 0}</h2>
                                        </div>
                                        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Under 24h</p>
                                            <h2 className="text-4xl font-black text-blue-500">{backlogData?.by_age?.under_24h ?? 0}</h2>
                                        </div>
                                        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">1-3 Days</p>
                                            <h2 className="text-4xl font-black text-amber-500">{backlogData?.by_age?.['1_3_days'] ?? 0}</h2>
                                        </div>
                                        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center">
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Over 7 Days</p>
                                            <h2 className="text-4xl font-black text-rose-500">{backlogData?.by_age?.over_7_days ?? 0}</h2>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                            <h3 className="font-bold text-lg mb-6">Backlog by Priority</h3>
                                            <div className="space-y-3">
                                                {Object.entries(backlogData?.by_priority || {}).map(([priority, count]) => (
                                                    <div key={priority} className="flex items-center justify-between">
                                                        <span className="capitalize font-medium">{priority}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${
                                                                        priority === 'urgent' ? 'bg-rose-500' : 
                                                                        priority === 'high' ? 'bg-amber-500' : 
                                                                        priority === 'medium' ? 'bg-blue-500' : 'bg-emerald-500'
                                                                    }`}
                                                                    style={{ width: `${(count / (backlogData?.total_backlog || 1)) * 100}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 w-8 text-right">{count}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-midnight-accent rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                                            <h3 className="font-bold text-lg mb-6">Critical Metrics</h3>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-midnight">
                                                    <span className="text-slate-600 dark:text-slate-400">Oldest Ticket Age</span>
                                                    <span className="text-2xl font-bold text-rose-500">
                                                        {backlogData?.oldest_ticket_age_days ?? 0} days
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-midnight">
                                                    <span className="text-slate-600 dark:text-slate-400">Critical Tickets</span>
                                                    <span className="text-2xl font-bold text-amber-500">
                                                        {(backlogData?.by_priority?.urgent ?? 0) + (backlogData?.by_priority?.high ?? 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
