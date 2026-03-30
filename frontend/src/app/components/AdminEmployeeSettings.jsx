import { useState, useEffect } from 'react';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../services/api';

export function AdminEmployeeSettings({ user, onLogout }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
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
                                                        <span>{employee.nom || employee.name}</span>
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
        </div>
    );
}
