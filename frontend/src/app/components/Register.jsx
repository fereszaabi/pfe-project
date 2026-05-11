import { useState } from 'react';
import * as api from '../../services/api';

export function Register({ onRegister, onSwitchToLogin }) {
    const [formData, setFormData] = useState({
        name: '',
        prenom: '',
        email: '',
        email_code: '',
        cin: '',
        code_fiscal: '',
        code_anydesk: '',
        numero: '',
        password: '',
        password_confirmation: ''
    });
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [codeSending, setCodeSending] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (formData.password !== formData.password_confirmation) {
            setError('Passwords do not match.');
            return;
        }

        if (!formData.email_code) {
            setError('Please enter the verification code sent to your email.');
            return;
        }

        onRegister(formData, setError);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSendCode = async () => {
        setError('');
        setInfo('');

        if (!formData.email) {
            setError('Please enter a valid email address before requesting a verification code.');
            return;
        }

        setCodeSending(true);
        try {
            const data = await api.sendRegisterVerificationCode({ email: formData.email });
            const debugCode = data?.debug_code ? ` ${data.debug_code}` : '';
            setInfo((data.message || 'Verification code sent to your email.') + debugCode);
        } catch (err) {
            const messages = err?.errors
                ? Object.values(err.errors).flat().join(' ')
                : err?.message || 'Unable to send verification code. Please check your email and try again.';
            setError(messages);
        } finally {
            setCodeSending(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen w-full">
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            {/* Left Branding Panel */}
            <div className="lg:w-[40%] bg-midnight relative flex flex-col justify-between p-12 overflow-hidden border-r border-slate-800">
                {/* Background Decorative Element */}
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-primary/5 rounded-full blur-2xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-white mb-16">
                        <div className="p-2 bg-primary rounded-lg">
                            <span className="material-symbols-outlined text-white text-3xl">settings_input_component</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">IDSoft</h2>
                    </div>

                    <div className="space-y-6 max-w-md">
                        <h1 className="text-white text-5xl font-black leading-[1.1] tracking-tight">
                            Streamlining your after-sales experience.
                        </h1>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Join IDSoft today for seamless ticketing and support tracking. Empower your clients with modern tools.
                        </p>
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                            <span className="text-sm font-medium">Real-time Ticket Tracking</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                            <span className="text-sm font-medium">Automated Reporting</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="material-symbols-outlined text-primary">check_circle</span>
                            <span className="text-sm font-medium">24/7 Dedicated Support</span>
                        </div>
                    </div>
                    <div className="mt-12 text-slate-500 text-xs">
                        © 2024 IDSoft Solutions Ltd. All rights reserved.
                    </div>
                </div>

                {/* Abstract Image Decor */}
                <div className="absolute bottom-0 right-0 opacity-20 pointer-events-none">
                    <div className="w-80 h-80 bg-primary/20 rounded-full blur-[100px]"></div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="lg:w-[60%] bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 md:p-12 lg:p-20 overflow-y-auto">
                <div className="w-full max-w-2xl">
                    {/* Top Navigation for Mobile/Desktop */}
                    <div className="flex items-center justify-between mb-12 w-full">
                        <div className="flex items-center gap-2 text-primary cursor-pointer hover:opacity-80 transition-opacity">
                            <span className="material-symbols-outlined">arrow_back</span>
                            <span className="font-bold text-sm tracking-wide uppercase">Back to Dashboard</span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Already have an account? <button onClick={onSwitchToLogin} className="text-primary font-bold hover:underline">Log In</button>
                        </div>
                    </div>

                    <div className="mb-10">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-2">Client Registration</h2>
                        <p className="text-slate-500 dark:text-slate-400">Fill in the details below to create a new client profile in the IDSoft ecosystem.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Last Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">person</span>
                                    Last Name
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="e.g. Doe"
                                />
                            </div>

                            {/* First Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">badge</span>
                                    First Name
                                </label>
                                <input
                                    name="prenom"
                                    type="text"
                                    required
                                    value={formData.prenom}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="e.g. John"
                                />
                            </div>

                            {/* CIN */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">badge</span>
                                    CIN (8-digit National ID)
                                </label>
                                <input
                                    name="cin"
                                    type="text"
                                    required
                                    value={formData.cin}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="e.g. 12345678"
                                />
                            </div>

                            {/* Fiscal Code */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">fingerprint</span>
                                    Fiscal Code
                                </label>
                                <input
                                    name="code_fiscal"
                                    type="text"
                                    required
                                    value={formData.code_fiscal}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="e.g. ID-9988-X"
                                />
                            </div>

                            {/* Initial AnyDesk Code */}
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">desktop_windows</span>
                                    Initial AnyDesk Code
                                </label>
                                <input
                                    name="code_anydesk"
                                    type="text"
                                    required
                                    value={formData.code_anydesk}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors font-mono"
                                    placeholder="e.g. 123 456 789"
                                />
                            </div>

                            {/* Email */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">mail</span>
                                    Email Address
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                        placeholder="client@company.com"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendCode}
                                        disabled={codeSending}
                                        className="whitespace-nowrap rounded-lg bg-primary px-4 text-white font-semibold transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {codeSending ? 'Sending…' : 'Send Code'}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    A 6-digit verification code will be sent to the email above.
                                </p>
                            </div>

                            {/* Email verification code */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">verified</span>
                                    Verification Code
                                </label>
                                <input
                                    name="email_code"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    required
                                    value={formData.email_code}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="123456"
                                />
                                {info && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{info}</p>
                                )}
                            </div>

                            {/* Phone */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">call</span>
                                    Phone Number
                                </label>
                                <input
                                    name="numero"
                                    type="tel"
                                    required
                                    value={formData.numero}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="+216 XX XXX XXX"
                                />
                            </div>

                            {/* Password */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">lock</span>
                                    Password
                                </label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="Min. 8 characters"
                                />
                            </div>

                            {/* Confirm Password */}
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg opacity-60">lock_reset</span>
                                    Confirm Password
                                </label>
                                <input
                                    name="password_confirmation"
                                    type="password"
                                    required
                                    value={formData.password_confirmation}
                                    onChange={handleChange}
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:ring-primary h-12 px-4 placeholder:text-slate-400 transition-colors"
                                    placeholder="Repeat password"
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-3 mt-8">
                            <input
                                className="mt-1 rounded border-slate-300 text-primary focus:ring-primary bg-transparent"
                                id="terms"
                                type="checkbox"
                                required
                            />
                            <label className="text-sm text-slate-500 dark:text-slate-400 leading-tight" htmlFor="terms">
                                I agree to the <a className="text-primary hover:underline" href="#">Terms of Service</a> and <a className="text-primary hover:underline" href="#">Privacy Policy</a> regarding client data management.
                            </label>
                        </div>

                        <div className="pt-6">
                            <button
                                type="submit"
                                className="w-full md:w-auto min-w-[200px] h-14 px-8 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-base transition-all transform active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                            >
                                <span>Register Client</span>
                                <span className="material-symbols-outlined">person_add</span>
                            </button>
                        </div>
                    </form>

                    <div className="mt-12 flex items-center gap-4 py-6 border-t border-slate-200 dark:border-slate-800">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">support_agent</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">Need help setting up?</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Contact our administrative support team at support@idsoft.com</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
