import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, LogIn, UserCircle } from 'lucide-react';
// @ts-ignore
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';
import { getCaptchaChallenge, verifyCaptcha } from '../../services/api';

export function Login({ onLogin, onSwitchToRegister }) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const vantaRef = useRef(null);
    const vantaEffectRef = useRef(null);
    const [captchaImage, setCaptchaImage] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [captchaLoading, setCaptchaLoading] = useState(false);
    const [captchaChecking, setCaptchaChecking] = useState(false);
    const [captchaValid, setCaptchaValid] = useState(null);
    const [toast, setToast] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!vantaEffectRef.current && vantaRef.current) {
            vantaEffectRef.current = NET({
                el: vantaRef.current,
                THREE: THREE,
                mouseControls: true,
                touchControls: true,
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 1.00,
                color: 0xf96f06,
                backgroundColor: 0x0f172a,
                points: 11.00
            });
        }
        return () => {
            if (vantaEffectRef.current) {
                vantaEffectRef.current.destroy();
                vantaEffectRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const loadCaptcha = async () => {
            setCaptchaLoading(true);
            try {
                const data = await getCaptchaChallenge();
                setCaptchaImage(data?.image || '');
                setCaptchaToken(data?.token || '');
                setCaptchaAnswer('');
                setCaptchaValid(null);
            } catch (_) {
                setCaptchaImage('');
                setCaptchaToken('');
                setCaptchaValid(null);
            } finally {
                setCaptchaLoading(false);
            }
        };

        loadCaptcha();
    }, []);

    useEffect(() => {
        let timerId;
        const answer = captchaAnswer || '';

        if (!captchaToken || answer.length < 6) {
            setCaptchaValid(null);
            return () => {};
        }

        timerId = setTimeout(async () => {
            setCaptchaChecking(true);
            try {
                const res = await verifyCaptcha(captchaToken, answer);
                setCaptchaValid(Boolean(res?.ok));
            } catch (_) {
                setCaptchaValid(false);
            } finally {
                setCaptchaChecking(false);
            }
        }, 300);

        return () => clearTimeout(timerId);
    }, [captchaAnswer, captchaToken]);

    useEffect(() => {
        if (!toast) return;
        const timerId = setTimeout(() => setToast(null), 3500);
        return () => clearTimeout(timerId);
    }, [toast]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        try {
            await onLogin(identifier, password, captchaToken, captchaAnswer);
        } catch (err) {
            const message = err?.message || 'Login failed. Please try again.';
            const lower = message.toLowerCase();
            if (lower.includes('verification') || lower.includes('captcha')) {
                setToast({ type: 'error', message: 'Captcha is wrong. Try again.' });
            } else if (lower.includes('identifiants') || lower.includes('invalid credentials')) {
                setToast({ type: 'error', message: 'Login info is wrong. Please check your CIN/code and password.' });
            } else {
                setToast({ type: 'error', message });
            }
            setError('');
            setCaptchaValid(false);
            refreshCaptcha();
        }
    };

    const refreshCaptcha = async () => {
        setCaptchaLoading(true);
        setError('');
        setInfo('');

        try {
            const data = await getCaptchaChallenge();
            setCaptchaImage(data?.image || '');
            setCaptchaToken(data?.token || '');
            setCaptchaAnswer('');
            setCaptchaValid(null);
        } catch (_) {
            setCaptchaImage('');
            setCaptchaToken('');
            setCaptchaValid(null);
        } finally {
            setCaptchaLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900" ref={vantaRef}>
            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 w-full">
                    {toast && (
                        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${toast.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                            {toast.message}
                        </div>
                    )}
                    <div className="flex justify-center mb-6">
                        <div className="bg-primary p-4 rounded-full">
                            <UserCircle className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
                        After-Sales Service
                    </h1>
                    <p className="text-center text-gray-600 mb-8">Sign in to your account</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
                                CIN / Fiscal Code
                            </label>
                            <input
                                id="identifier"
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Enter your CIN or fiscal code"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Enter your password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-gray-700">Verification</p>
                                <button
                                    type="button"
                                    onClick={refreshCaptcha}
                                    className="text-xs font-semibold text-primary hover:text-primary/80"
                                    disabled={captchaLoading}
                                >
                                    Refresh
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    {captchaLoading ? (
                                        <div className="text-sm font-semibold text-gray-800">Loading...</div>
                                    ) : captchaImage ? (
                                        <img
                                            src={captchaImage}
                                            alt="Verification code"
                                            className="h-12 rounded border border-gray-200 bg-white"
                                        />
                                    ) : (
                                        <div className="text-sm font-semibold text-gray-800">Unavailable</div>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={captchaAnswer}
                                        onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\s+/g, '').toUpperCase())}
                                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center uppercase tracking-widest"
                                    
                                        required
                                        disabled={captchaLoading}
                                    />
                                    {captchaChecking && (
                                        <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
                                    )}
                                    {captchaValid === true && !captchaChecking && (
                                        <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-emerald-500 text-lg">✓</span>
                                    )}
                                    {captchaValid === false && !captchaChecking && captchaAnswer.length === 6 && (
                                        <span className="absolute -right-6 top-1/2 -translate-y-1/2 text-rose-500 text-lg">✕</span>
                                    )}
                                </div>
                            </div>
                        </div>

                            {info && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-600">
                                    {info}
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                        <button
                            type="submit"
                            className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 font-medium"
                            disabled={captchaLoading || !captchaToken || captchaValid === false}
                        >
                            <LogIn className="w-5 h-5" />
                            Sign In
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <button
                                onClick={onSwitchToRegister}
                                className="text-primary hover:text-primary/90 font-medium"
                            >
                                Register here
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
