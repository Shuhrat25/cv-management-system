import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

const GOOGLE_CLIENT_ID = '527507557125-4m88q64a20o1jknlqbokqt4tr43stqbe.apps.googleusercontent.com';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err?.error || 'Invalid email or password');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleCredential = async (response: { credential: string }) => {
        setError('');
        try {
            const data = await apiRequest<{ token: string; user: any }>('/auth/google', {
                method: 'POST',
                body: JSON.stringify({ credential: response.credential }),
            });
            localStorage.setItem('token', data.token);
            window.location.href = '/';
        } catch (err: any) {
            setError(err?.error || 'Google sign-in failed');
        }
    };

    useEffect(() => {
        const w = window as any;
        if (w.google?.accounts?.id) {
            w.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredential,
            });
            w.google.accounts.id.renderButton(document.getElementById('googleSignInBtn'), {
                theme: 'outline',
                size: 'large',
                width: 336,
            });
        }
    }, []);

    return (
        <div className="max-w-md mx-auto mt-12 bg-white dark:bg-slate-900 rounded-xl shadow p-8 border border-slate-200 dark:border-slate-800">
            <h1 className="text-2xl font-bold mb-6">Sign In</h1>

            {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 rounded-md p-3">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2 rounded-md transition-colors"
                >
                    {submitting ? 'Signing in...' : 'Sign In'}
                </button>
            </form>

            <div className="flex items-center gap-3 my-5">
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
                <span className="text-xs text-slate-400">OR</span>
                <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
            </div>

            <div id="googleSignInBtn" className="flex justify-center" />

            <a
                href="https://cv-management-system-6oyt.onrender.com/api/auth/github"
                className="mt-3 flex items-center justify-center gap-2 w-full border border-slate-300 dark:border-slate-700 rounded-md py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                Sign in with GitHub
            </a>

            <p className="mt-4 text-sm text-center text-slate-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                    Register
                </Link>
            </p>
        </div>
    );
};