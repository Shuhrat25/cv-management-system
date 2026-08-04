import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

const GOOGLE_CLIENT_ID = '527507557125-4m88q64a20o1jknlqbokqt4tr43stqbe.apps.googleusercontent.com';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'CANDIDATE', location: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/');
    } catch (err: any) {
      setError(err?.error || 'Registration failed');
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
      w.google.accounts.id.renderButton(document.getElementById('googleSignUpBtn'), {
        theme: 'outline',
        size: 'large',
        width: 336,
        text: 'signup_with',
      });
    }
  }, []);

  return (
    <div className="max-w-md mx-auto mt-10 mb-10">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-8 border border-slate-200 dark:border-slate-800">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Join TalentPulse to build your profile and apply for positions.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400 rounded-lg p-3 border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Full Name</label>
            <input
              required
              value={form.name}
              onChange={handleChange('name')}
              placeholder="John Smith"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={handleChange('email')}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={handleChange('password')}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">I am a</label>
              <select
                value={form.role}
                onChange={handleChange('role')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="CANDIDATE">Candidate</option>
                <option value="RECRUITER">Recruiter</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Location</label>
              <input
                value={form.location}
                onChange={handleChange('location')}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm shadow-blue-500/20"
          >
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or sign up with</span>
          <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
        </div>

        <div className="space-y-2.5">
          <div id="googleSignUpBtn" className="flex justify-center" />

          <a
            href="https://cv-management-system-6oyt.onrender.com/api/auth/github"
            className="flex items-center justify-center gap-2 w-full border border-slate-300 dark:border-slate-700 rounded-lg py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.793-.258.793-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.303-5.467-1.334-5.467-5.93 0-1.31.468-2.38 1.235-3.22-.123-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.24 2.874.118 3.176.77.84 1.233 1.911 1.233 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.604-.015 2.895-.015 3.29 0 .32.192.694.8.576C20.565 21.796 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Sign up with GitHub
          </a>
        </div>

        <p className="mt-6 text-sm text-center text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};