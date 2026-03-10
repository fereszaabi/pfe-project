import { useState } from 'react';

export function ClientProfile({ user, onLogout, onNavigate, activeView }) {
    const [showPassword, setShowPassword] = useState(false);
    const [profileData, setProfileData] = useState({
        businessName: user?.name || 'Gourmet Haven Ltd.',
        email: user?.email || 'contact@gourmethaven.com',
        phone: '71 000 000',
        businessType: 'Restaurant/Retail',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [anydeskCodes, setAnydeskCodes] = useState([
        { id: 1, label: 'Main POS Terminal', code: '123 456 789' },
        { id: 2, label: 'Office Server', code: '987 654 321' }
    ]);
    const [addingCode, setAddingCode] = useState(false);
    const [newCode, setNewCode] = useState({ label: '', code: '' });

    const handleSaveProfile = () => {
        console.log('Saving profile:', profileData);
    };

    const handleAddAnydeskCode = () => {
        setAddingCode(true);
        setNewCode({ label: '', code: '' });
    };

    const handleConfirmAddCode = () => {
        if (!newCode.label.trim() || !newCode.code.trim()) return;
        setAnydeskCodes([...anydeskCodes, { id: Date.now(), label: newCode.label.trim(), code: newCode.code.trim() }]);
        setAddingCode(false);
        setNewCode({ label: '', code: '' });
    };

    const handleDeleteAnydeskCode = (id) => {
        setAnydeskCodes(anydeskCodes.filter(code => code.id !== id));
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
    };

    return (
        <div className="flex min-h-screen">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Sidebar */}
            <aside className="w-64 bg-midnight text-slate-300 flex flex-col border-r border-border-dark fixed h-full z-10">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">shield_person</span>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-none">IDSoft</h1>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-semibold">After-Sales</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2">
                    <button
                        onClick={() => onNavigate?.('dashboard')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeView === 'dashboard' ? 'bg-surface-dark text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-surface-dark/50'
                        }`}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </button>
                    <button
                        onClick={() => onNavigate?.('profile')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            activeView === 'profile' ? 'text-white bg-primary/20 border-l-4 border-primary rounded-r-lg' : 'text-slate-400 hover:text-white hover:bg-surface-dark/50'
                        }`}
                    >
                        <span className={`material-symbols-outlined ${activeView === 'profile' ? 'text-primary' : ''}`}>person_edit</span>
                        <span className="text-sm font-medium">Profile & Machines</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 p-8 lg:p-12 overflow-y-auto bg-background-light dark:bg-background-dark">
                <div className="max-w-6xl mx-auto">
                    {/* Page Header */}
                    <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Client Profile & Machines</h2>
                        </div>
                        <div className="flex gap-3">
                            <button className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                                Discard
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Sidebar Cards */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Profile Card */}
                            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative group">
                                        <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-primary/20 mb-4 bg-slate-200 dark:bg-slate-700">
                                            <img
                                                className="w-full h-full object-cover"
                                                alt="Client profile avatar"
                                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5nNk_23zL3CyC_Cy6lADIFNiMXncrGTOQPG8DNdClHPglGqo1aB9s1Qb1sYrDLkyevKvDPurQy-KHODzKPnfTVyk52P8B73r_EEOdjGendzHKlnkaAEp0_dKFPJeEGfU3iYLku314lh95F1pS4Y5Pqe7pqMSkq4eSG5ZevGx4rKvxqfpUbX-pPw_601xWioIbyBUN6uTxdR727X9ImrNThtsgrMZOfGmsuxa4yMi_uohVml8Idy4bcx5oSlmwaJtbTHYKi2Rdn1s"
                                            />
                                        </div>
                                        <button className="absolute bottom-2 -right-2 w-9 h-9 bg-primary text-white rounded-lg flex items-center justify-center shadow-lg border-2 border-white dark:border-surface-dark hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-sm">photo_camera</span>
                                        </button>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{profileData.businessName}</h3>
                                    <p className="text-slate-500 font-medium text-sm mb-4">Client ID: #CLI-90210</p>
                                    <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Business Type</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{profileData.businessType}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Member Since</span>
                                            <span className="text-slate-700 dark:text-slate-300">Mar 2023</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Balance Card */}
                            <div className="bg-gradient-to-br from-primary to-orange-600 rounded-xl shadow-lg shadow-primary/20 p-6 text-white">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Available Balance</p>
                                        <h4 className="text-3xl font-black mt-1">2,450.000 <span className="text-sm font-normal">TND</span></h4>
                                    </div>
                                    <span className="material-symbols-outlined text-white/40 text-3xl">account_balance_wallet</span>
                                </div>
                                <button className="w-full py-3 bg-white text-primary rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-lg">add_circle</span>
                                    Add Balance
                                </button>
                            </div>

                            {/* AnyDesk Codes Card */}
                            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                    <h4 className="font-bold flex items-center gap-2 text-sm">
                                        <span className="material-symbols-outlined text-primary text-lg">desktop_windows</span>
                                        AnyDesk Machine Codes
                                    </h4>
                                    <button
                                        onClick={handleAddAnydeskCode}
                                        className="p-1 hover:bg-primary/10 rounded text-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {addingCode && (
                                        <div className="p-4 space-y-2 bg-primary/5 border-b border-slate-100 dark:border-slate-700">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Label (e.g. Office PC)"
                                                value={newCode.label}
                                                onChange={(e) => setNewCode({ ...newCode, label: e.target.value })}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                            />
                                            <input
                                                type="text"
                                                placeholder="AnyDesk ID (e.g. 123 456 789)"
                                                value={newCode.code}
                                                onChange={(e) => setNewCode({ ...newCode, code: e.target.value })}
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary font-mono text-slate-900 dark:text-white"
                                            />
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={handleConfirmAddCode}
                                                    className="flex-1 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors"
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    onClick={() => setAddingCode(false)}
                                                    className="flex-1 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {anydeskCodes.map((machine) => (
                                        <div key={machine.id} className="p-4 flex justify-between items-center group">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{machine.label}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-mono text-sm text-slate-900 dark:text-slate-100">{machine.code}</p>
                                                    <span
                                                        onClick={() => handleCopyCode(machine.code)}
                                                        className="material-symbols-outlined text-xs text-slate-400 cursor-pointer hover:text-primary"
                                                    >
                                                        content_copy
                                                    </span>
                                                </div>
                                            </div>
                                            <span
                                                onClick={() => handleDeleteAnydeskCode(machine.id)}
                                                className="material-symbols-outlined text-slate-400 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-red-500 text-lg transition-opacity"
                                            >
                                                delete
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 text-center">
                                    <p className="text-[10px] text-slate-500">Provide these IDs to support for remote assistance.</p>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Area */}
                        <div className="lg:col-span-8 space-y-8">
                            {/* Contact Information */}
                            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                        <span className="material-symbols-outlined text-primary">contact_mail</span>
                                        Contact Information
                                    </h3>
                                    <p className="text-sm text-slate-500">Essential contact details for notifications and support billing.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Business Name</label>
                                        <input
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                            type="text"
                                            value={profileData.businessName}
                                            onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <input
                                                className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                                type="email"
                                                value={profileData.email}
                                                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                            />
                                            <span className="material-symbols-outlined absolute left-3 top-3.5 text-slate-400">alternate_email</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
                                        <div className="flex gap-2">
                                            <div className="w-24 px-3 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm flex items-center justify-center font-medium">
                                                +216
                                            </div>
                                            <input
                                                className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                                type="tel"
                                                value={profileData.phone}
                                                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Security & Credentials */}
                            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
                                <div className="mb-6 flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                            <span className="material-symbols-outlined text-primary">key</span>
                                            Security & Credentials
                                        </h3>
                                        <p className="text-sm text-slate-500">Change your password to maintain account integrity.</p>
                                    </div>
                                    <div className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest">
                                        Highly Secure
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Current Password</label>
                                        <div className="relative">
                                            <input
                                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                                type={showPassword ? "text" : "password"}
                                                value={profileData.currentPassword}
                                                onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                                                placeholder="••••••••••••"
                                            />
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            >
                                                <span className="material-symbols-outlined text-xl">
                                                    {showPassword ? 'visibility' : 'visibility_off'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                                            <input
                                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                                placeholder="New secure password"
                                                type="password"
                                                value={profileData.newPassword}
                                                onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                                            />
                                            <div className="flex gap-1 mt-2">
                                                <div className="h-1 flex-1 rounded bg-slate-200 dark:bg-slate-700"></div>
                                                <div className="h-1 flex-1 rounded bg-slate-200 dark:bg-slate-700"></div>
                                                <div className="h-1 flex-1 rounded bg-slate-200 dark:bg-slate-700"></div>
                                                <div className="h-1 flex-1 rounded bg-slate-200 dark:bg-slate-700"></div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                                            <input
                                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-primary focus:border-primary text-slate-900 dark:text-white"
                                                placeholder="Repeat new password"
                                                type="password"
                                                value={profileData.confirmPassword}
                                                onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2FA Banner */}
                            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-900/50 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined">info</span>
                                    </div>
                                    <div>
                                        <h4 className="text-blue-900 dark:text-blue-400 font-bold">Two-Factor Authentication</h4>
                                        <p className="text-sm text-blue-700/70 dark:text-blue-400/60">Enhance your account security by enabling 2FA for all login attempts.</p>
                                    </div>
                                </div>
                                <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
                                    Enable 2FA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}