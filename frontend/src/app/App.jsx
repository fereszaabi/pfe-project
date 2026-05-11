import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ClientDashboard } from './components/ClientDashboard';
import { ClientProfile } from './components/ClientProfile';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { Escalated } from './components/Escalated';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminEmployeeSettings } from './components/AdminEmployeeSettings';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { TicketTracking } from './components/TicketTracking';
import * as api from '../services/api';

export default function App() {
    const [view, setView] = useState('login');
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Restore session from localStorage on first load
    useEffect(() => {
        let isMounted = true;

        const restoreSession = async () => {
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('auth_user');

            if (!storedToken || !storedUser) {
                if (!isMounted) return;
                setCurrentUser(null);
                setView('login');
                setActiveView('dashboard');
                setAuthLoading(false);
                window.history.replaceState({ view: 'login', activeView: 'dashboard' }, '');
                return;
            }

            try {
                const me = await api.getMe();
                if (!isMounted) return;

                localStorage.setItem('auth_user', JSON.stringify(me));
                setCurrentUser(me);
                setView('dashboard');
                setActiveView('dashboard');
                window.history.replaceState({ view: 'dashboard', activeView: 'dashboard' }, '');
            } catch (_) {
                if (!isMounted) return;

                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
                setCurrentUser(null);
                setView('login');
                setActiveView('dashboard');
                window.history.replaceState({ view: 'login', activeView: 'dashboard' }, '');
            } finally {
                if (isMounted) {
                    setAuthLoading(false);
                }
            }
        };

        restoreSession();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        const onPopState = (e) => {
            if (!e.state) return;
            const { view: v, activeView: av, ticketId } = e.state;
            setView(v);
            setActiveView(av || 'dashboard');
            if (ticketId !== undefined) setSelectedTicketId(ticketId);
            if (v === 'login') {
                setCurrentUser(null);
                localStorage.removeItem('auth_user');
                localStorage.removeItem('auth_token');
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const navigate = (newView, extra = {}) => {
        const normalizedView = ['it', 'it-component', 'it-queue'].includes(newView) ? 'escalated' : newView;
        const state = { view: normalizedView, activeView: normalizedView, ...extra };
        window.history.pushState(state, '');
        setView(normalizedView);
        setActiveView(normalizedView);
    };

    const handleNavigate = (newView) => {
        if (['it', 'it-component', 'it-queue', 'escalated'].includes(newView)) {
            navigate('escalated');
            return;
        }

        navigate(newView);
    };

    const handleLogin = async (identifier, password, captchaToken, captchaAnswer) => {
        try {
            const data = await api.login(identifier, password, captchaToken, captchaAnswer);
            if (data?.two_factor_required) {
                return data;
            }

            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            navigate('dashboard');
            return data;
        } catch (err) {
            const messages = err?.errors
                ? Object.values(err.errors).flat().join(' ')
                : err?.message || 'Invalid credentials. Please try again.';
            throw new Error(messages);
        }
    };

    const handleVerifyOtp = async (loginToken, otp) => {
        try {
            const data = await api.verifyLoginOtp(loginToken, otp);
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            navigate('dashboard');
            return data;
        } catch (err) {
            const messages = err?.errors
                ? Object.values(err.errors).flat().join(' ')
                : err?.message || 'Verification failed. Please try again.';
            throw new Error(messages);
        }
    };

    const handleRegister = async (userData, setError) => {
        try {
            const data = await api.register(userData);
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            setCurrentUser(data.user);
            navigate('dashboard');
        } catch (err) {
            const messages = err?.errors
                ? Object.values(err.errors).flat().join(' ')
                : err?.message || 'Registration failed. Please try again.';
            setError(messages);
        }
    };

    const handleLogout = async () => {
        try { await api.logout(); } catch (_) { /* ignore */ }
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setCurrentUser(null);
        window.history.replaceState({ view: 'login', activeView: 'dashboard' }, '');
        setView('login');
        setActiveView('dashboard');
    };

    if (authLoading) return null;

    if (view === 'login') {
        return (
            <Login
                onLogin={handleLogin}
                onVerifyOtp={handleVerifyOtp}
                onSwitchToRegister={() => setView('register')}
            />
        );
    }

    if (view === 'register') {
        return (
            <Register
                onRegister={handleRegister}
                onSwitchToLogin={() => setView('login')}
            />
        );
    }

    if (view === 'dashboard' && currentUser) {
        if (currentUser.role === 'client') {
            return (
                <ClientDashboard
                    user={currentUser}
                    activeView={activeView}
                    onViewTicket={(ticketId) => {
                        setSelectedTicketId(ticketId);
                        navigate('tracking', { ticketId });
                    }}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                />
            );
        }

        if (currentUser.role === 'employee') {
            return (
                <EmployeeDashboard
                    user={currentUser}
                    activeView={activeView}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                />
            );
        }
    }

    if (
        (view === 'escalated' || activeView === 'escalated') &&
        (currentUser?.role === 'employee' || currentUser?.role === 'admin')
    ) {
        return (
            <Escalated
                user={currentUser}
                activeView='escalated'
                onLogout={handleLogout}
                onNavigate={handleNavigate}
            />
        );
    }

    if (view === 'dashboard' && currentUser) {
        if (currentUser.role === 'admin') {
            return (
                <AdminDashboard
                    user={currentUser}
                    activeView={activeView}
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                />
            );
        }
    }

    if (view === 'settings' && currentUser?.role === 'admin') {
        return (
            <AdminEmployeeSettings
                user={currentUser}
                onLogout={handleLogout}
            />
        );
    }

    if (view === 'profile' && currentUser && currentUser.role === 'client') {
        return (
            <ClientProfile
                user={currentUser}
                activeView={activeView}
                onLogout={handleLogout}
                onNavigate={handleNavigate}
            />
        );
    }

    if (view === 'tracking' && selectedTicketId) {
        return (
            <TicketTracking
                ticketId={selectedTicketId}
                onBack={() => window.history.back()}
            />
        );
    }

    if (view === 'analytics' && currentUser?.role === 'admin') {
        return (
            <AnalyticsDashboard
                user={currentUser}
                onLogout={handleLogout}
                onNavigate={handleNavigate}
            />
        );
    }

    // Fallback debug view if we reach this point unexpectedly
    if (currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Debug Info</h2>
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <p><strong>View:</strong> {view}</p>
                        <p><strong>Role:</strong> {currentUser.role || 'MISSING'}</p>
                        <p><strong>ID:</strong> {currentUser.id || 'MISSING'}</p>
                        <button
                            onClick={handleLogout}
                            className="mt-4 w-full px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                        >
                            Logout & Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
