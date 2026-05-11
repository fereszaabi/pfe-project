import { useState, useEffect, useRef } from 'react';
import { LogIn, UserCircle } from 'lucide-react';
// @ts-ignore
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';
import { getCaptchaChallenge, verifyCaptcha } from '../../services/api';

export function Login({ onLogin, onVerifyOtp, onSwitchToRegister }) {
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
    const [otpRequired, setOtpRequired] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [loginToken, setLoginToken] = useState('');

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        try {
            const response = await onLogin(identifier, password, captchaToken, captchaAnswer);
            if (response?.two_factor_required) {
                setOtpRequired(true);
                setLoginToken(response.login_token);
                setInfo('A verification code has been sent to your email.');
            }
        } catch (err) {
            setError(err?.message || 'Invalid credentials. Please try again.');
            setCaptchaValid(false);
            refreshCaptcha();
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setInfo('');

        try {
            await onVerifyOtp(loginToken, otpCode);
        } catch (err) {
            setError(err?.message || 'Verification failed. Please try again.');
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
                    <div className="flex justify-center mb-6">
                        <div className="bg-primary p-4 rounded-full">
                            <UserCircle className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
                        After-Sales Service
                    </h1>
                    <p className="text-center text-gray-600 mb-8">Sign in to your account</p>

                    {!otpRequired ? (
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
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="Enter your password"
                                    required
                                />
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
                                            placeholder="6 chars"
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
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                                    Verification Code
                                </label>
                                <input
                                    id="otp"
                                    type="text"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent tracking-[0.35em] text-center font-semibold"
                                    placeholder="6-digit code"
                                    required
                                />
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
                            >
                                Verify Code
                            </button>
                        </form>
                    )}

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
