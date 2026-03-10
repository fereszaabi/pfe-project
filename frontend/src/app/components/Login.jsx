import { useState, useEffect, useRef } from 'react';
import { LogIn, UserCircle } from 'lucide-react';
// @ts-ignore
import NET from 'vanta/dist/vanta.net.min';
import * as THREE from 'three';

export function Login({ onLogin, onSwitchToRegister }) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [vantaEffect, setVantaEffect] = useState(null);
    const vantaRef = useRef(null);

    useEffect(() => {
        if (!vantaEffect && vantaRef.current) {
            const effect = NET({
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
            setVantaEffect(effect);
        }
        return () => {
            if (vantaEffect) vantaEffect.destroy();
        };
    }, [vantaEffect]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        onLogin(identifier, password, setError);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" ref={vantaRef}>
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

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 font-medium"
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
