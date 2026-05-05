import { useState, useEffect } from 'react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getEmployeePerformance } from '../../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AdminEmployeeSettings({ user, onLogout }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedEmployeeStats, setSelectedEmployeeStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        cin: '',
        password: ''
    });

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const data = await getEmployees();
            setEmployees(data.employees || []);
        } catch (err) {
            setError('Erreur lors du chargement des employés');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            cin: '',
            password: ''
        });
        setEditingId(null);
        setShowAddForm(false);
        setError('');
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name || !formData.email || !formData.cin || !formData.password) {
            setError('Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            await createEmployee(formData);
            setSuccess('Employé créé avec succès');
            await fetchEmployees();
            resetForm();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Erreur lors de la création de l\'employé');
        }
    };

    const handleEditEmployee = (employee) => {
        setFormData({
            name: employee.nom || '',
            email: employee.mail || '',
            cin: employee.cin || '',
            password: ''
        });
        setEditingId(employee.id);
        setShowAddForm(true);
    };

    const handleUpdateEmployee = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name || !formData.email || !formData.cin) {
            setError('Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            const updateData = {
                name: formData.name,
                email: formData.email,
                cin: formData.cin,
            };
            if (formData.password) {
                updateData.password = formData.password;
            }
            
            await updateEmployee(editingId, updateData);
            setSuccess('Employé mis à jour avec succès');
            await fetchEmployees();
            resetForm();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Erreur lors de la mise à jour de l\'employé');
        }
    };

    const handleDeleteEmployee = async (employeeId) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé?')) return;

        try {
            await deleteEmployee(employeeId);
            setSuccess('Employé supprimé avec succès');
            await fetchEmployees();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.message || 'Erreur lors de la suppression de l\'employé');
        }
    };

    const handleViewStats = async (employeeId) => {
        setStatsLoading(true);
        try {
            const data = await getEmployeePerformance(employeeId);
            setSelectedEmployeeStats(data);
        } catch (err) {
            setError('Failed to load employee stats');
            setTimeout(() => setError(''), 3000);
        } finally {
            setStatsLoading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen flex w-full">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-midnight flex flex-col fixed h-full z-20">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-2xl">shield_with_heart</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-tight">IDSoft</h1>
                        <p className="text-slate-400 text-xs leading-none mt-0.5">Admin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-6">
                    <button className="w-full flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-lg">
                        <span className="material-symbols-outlined">people</span>
                        <span className="text-sm font-medium">Employee Management</span>
                    </button>
                </nav>

                <div className="p-4 mt-auto">
                    <div className="bg-surface-dark/30 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="size-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center text-primary font-bold text-xs ring-2 ring-white/10">
                                {user.name?.charAt(0) || 'A'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs font-bold truncate text-white">{user.name || 'Admin'}</p>
                                <p className="text-[10px] text-slate-500">Administrator</p>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="w-full text-xs font-semibold text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">logout</span> Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 flex flex-col min-h-screen">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Employee Management
                    </h2>
                    <button
                        onClick={() => {
                            setShowAddForm(!showAddForm);
                            if (editingId) resetForm();
                        }}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Add Employee
                    </button>
                </header>

                <div className="p-8 max-w-7xl mx-auto w-full">
                    {/* Alerts */}
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-lg shrink-0">error</span>
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-lg shrink-0">check_circle</span>
                                <p className="text-sm font-medium">{success}</p>
                            </div>
                        </div>
                    )}

                    {/* Add/Edit Form */}
                    {showAddForm && (
                        <div className="mb-8 bg-white dark:bg-midnight-accent p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
                                {editingId ? 'Edit Employee Credentials' : 'Add New Employee'}
                            </h3>
                            <form onSubmit={editingId ? handleUpdateEmployee : handleAddEmployee} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            Full Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Enter employee name"
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-midnight focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="Enter email address"
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-midnight focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            CIN (ID) *
                                        </label>
                                        <input
                                            type="text"
                                            name="cin"
                                            value={formData.cin}
                                            onChange={handleInputChange}
                                            placeholder="Enter CIN (8 digits)"
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-midnight focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                            {editingId ? 'New Password (leave empty to keep current)' : 'Password *'}
                                        </label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            placeholder={editingId ? 'Leave empty to keep current password' : 'Enter password'}
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-midnight focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white"
                                            required={!editingId}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all"
                                    >
                                        <span className="material-symbols-outlined">save</span>
                                        {editingId ? 'Update Employee' : 'Create Employee'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-6 py-2 rounded-lg font-semibold transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Employees List */}
                    <div className="bg-white dark:bg-midnight-accent rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Employees ({employees.length})
                            </h3>
                        </div>

                        {loading ? (
                            <div className="p-8 text-center text-slate-500">
                                <span className="material-symbols-outlined text-4xl animate-spin mx-auto block mb-3">settings</span>
                                Loading employees...
                            </div>
                        ) : employees.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <span className="material-symbols-outlined text-4xl mx-auto block mb-3 opacity-40">people</span>
                                No employees found. Create your first employee.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-midnight/50 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                            <th className="px-6 py-4 text-left">Name</th>
                                            <th className="px-6 py-4 text-left">Email</th>
                                            <th className="px-6 py-4 text-left">CIN</th>
                                            <th className="px-6 py-4 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {employees.map((employee) => (
                                            <tr
                                                key={employee.id}
                                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                                            >
                                                <td className="px-6 py-4 text-slate-900 dark:text-white font-semibold">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                            {(employee.nom || employee.name || '?').charAt(0)}
                                                        </div>
                                                        <button
                                                            onClick={() => handleViewStats(employee.id)}
                                                            className="text-left hover:text-primary transition-colors group/name"
                                                            title="View performance stats"
                                                        >
                                                            <span className="group-hover/name:underline">{employee.nom || employee.name}</span>
                                                            <span className="material-symbols-outlined text-xs ml-1 opacity-0 group-hover/name:opacity-100 transition-opacity align-middle text-primary">bar_chart</span>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                    {employee.mail || employee.email}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                    {employee.cin}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEditEmployee(employee)}
                                                            title="Edit employee"
                                                            className="size-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-base">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteEmployee(employee.id)}
                                                            title="Delete employee"
                                                            className="size-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-base">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Employee Performance Stats Modal */}
            {(selectedEmployeeStats || statsLoading) && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-midnight-accent rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
                        {statsLoading ? (
                            <div className="p-16 text-center">
                                <span className="material-symbols-outlined text-5xl animate-spin mx-auto block mb-4 text-primary">settings</span>
                                <p className="text-slate-500 font-medium">Loading performance data...</p>
                            </div>
                        ) : selectedEmployeeStats && (() => {
                            const { employee: emp, stats: s, rating_distribution, status_breakdown, priority_breakdown, monthly_trend, recent_tickets } = selectedEmployeeStats;
                            const ratingDistData = Object.entries(rating_distribution || {}).map(([star, count]) => ({ star: `${star}★`, count }));
                            const statusData = Object.entries(status_breakdown || {}).map(([status, count]) => ({ name: status, value: count }));
                            return (
                                <>
                                    {/* Modal Header */}
                                    <div className="sticky top-0 z-10 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-midnight-accent flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl">
                                                {(emp.name || '?').charAt(0)}
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{emp.name}</h2>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-sm text-slate-500">{emp.email}</span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">CIN: {emp.cin}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedEmployeeStats(null)}
                                            className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center transition-colors"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* KPI Cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Total Tickets</span>
                                                <span className="text-3xl font-black text-slate-900 dark:text-white">{s.tickets_total}</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Completed</span>
                                                <span className="text-3xl font-black text-emerald-500">{s.tickets_completed}</span>
                                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${s.tickets_total > 0 ? Math.round((s.tickets_completed / s.tickets_total) * 100) : 0}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Avg Rating</span>
                                                <span className="text-3xl font-black text-yellow-500">⭐ {(s.avg_rating || 0).toFixed(1)}</span>
                                                <span className="text-[10px] text-slate-400 block mt-1">{s.total_ratings} ratings</span>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Avg Resolution</span>
                                                <span className="text-3xl font-black text-blue-500">{(s.avg_resolution_hours || 0).toFixed(1)}h</span>
                                                <span className="text-[10px] text-slate-400 block mt-1">{s.satisfaction_rate}% satisfaction</span>
                                            </div>
                                        </div>

                                        {/* Charts Row */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Monthly Trend */}
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Monthly Activity</h4>
                                                <div className="h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={monthly_trend || []}>
                                                            <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#e5e7eb" />
                                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                                            <Line type="monotone" dataKey="assigned" stroke="var(--color-chart-1, #6366f1)" strokeWidth={2.5} dot={false} name="Assigned" />
                                                            <Line type="monotone" dataKey="completed" stroke="var(--color-chart-2, #10b981)" strokeWidth={2.5} dot={false} name="Completed" />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Rating Distribution */}
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Rating Distribution</h4>
                                                {ratingDistData.some(d => d.count > 0) ? (
                                                    <div className="h-[200px] w-full">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={ratingDistData} barSize={32}>
                                                                <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="#e5e7eb" />
                                                                <XAxis dataKey="star" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                                                                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                                                                <Bar dataKey="count" fill="#eab308" name="Ratings" radius={[8, 8, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : (
                                                    <div className="h-[200px] flex items-center justify-center">
                                                        <p className="text-sm text-slate-400">No ratings yet</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status & Priority Breakdown */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Status Breakdown</h4>
                                                {statusData.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {statusData.map(({ name, value }) => (
                                                            <div key={name} className="flex items-center gap-3">
                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize w-24 truncate">{name}</span>
                                                                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full transition-all"
                                                                        style={{
                                                                            width: `${s.tickets_total > 0 ? Math.round((value / s.tickets_total) * 100) : 0}%`,
                                                                            backgroundColor: name === 'resolved' || name === 'closed' ? '#10b981' : name === 'in progress' ? '#f59e0b' : name === 'escalated' || name === 'tech' ? '#ef4444' : '#6366f1',
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-black text-slate-900 dark:text-white w-8 text-right">{value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 text-center py-6">No ticket data</p>
                                                )}
                                            </div>

                                            <div className="bg-slate-50 dark:bg-midnight rounded-xl p-5">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Priority Distribution</h4>
                                                {Object.keys(priority_breakdown || {}).length > 0 ? (
                                                    <div className="space-y-3">
                                                        {Object.entries(priority_breakdown).map(([priority, count]) => (
                                                            <div key={priority} className="flex items-center gap-3">
                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 capitalize w-24 truncate">{priority || 'N/A'}</span>
                                                                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full transition-all"
                                                                        style={{
                                                                            width: `${s.tickets_total > 0 ? Math.round((count / s.tickets_total) * 100) : 0}%`,
                                                                            backgroundColor: priority === 'urgent' ? '#ef4444' : priority === 'high' ? '#f97316' : priority === 'medium' ? '#eab308' : '#22c55e',
                                                                        }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs font-black text-slate-900 dark:text-white w-8 text-right">{count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 text-center py-6">No ticket data</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Recent Tickets */}
                                        <div className="bg-slate-50 dark:bg-midnight rounded-xl p-5">
                                            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4">Recent Tickets</h4>
                                            {(recent_tickets || []).length > 0 ? (
                                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-white dark:bg-midnight-accent">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">ID</th>
                                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</th>
                                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Client</th>
                                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Rating</th>
                                                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {recent_tickets.map(ticket => (
                                                                <tr key={ticket.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">#{ticket.id}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{ticket.titre || ticket.description || 'N/A'}</td>
                                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ticket.client_name}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                            ticket.status === 'resolved' || ticket.status === 'closed'
                                                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                                                : ticket.status === 'in progress'
                                                                                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                                        }`}>{ticket.status}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-xs">{ticket.client_rating ? `⭐ ${ticket.client_rating}` : <span className="text-slate-400">—</span>}</td>
                                                                    <td className="px-4 py-3 text-xs text-slate-500">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-400 text-center py-6">No tickets assigned yet</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Modal Footer */}
                                    <div className="border-t border-slate-200 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-midnight/50 flex justify-end">
                                        <button
                                            onClick={() => setSelectedEmployeeStats(null)}
                                            className="px-5 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
