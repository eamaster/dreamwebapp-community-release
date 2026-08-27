import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { customerConfirmPasswordReset, isApiError } from '@/lib/api-client';

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token) {
            setError('Missing password reset token.');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await customerConfirmPasswordReset(token, newPassword);
            setMessage(res.message || 'Password reset successful.');
        } catch (err) {
            if (isApiError(err)) {
                setError(err.message);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to reset password. The link may be expired.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
            <div className="max-w-md w-full space-y-8 bg-slate-900/90 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur-xl">
                <div>
                    <div className="mx-auto h-12 w-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight">
                        Set new password
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-400">
                        Enter and confirm your new account password.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg bg-red-950/60 border border-red-800/80 p-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {message ? (
                    <div className="space-y-6">
                        <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-4 text-sm text-emerald-200">
                            {message}
                        </div>
                        <Link
                            to="/login"
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all duration-200"
                        >
                            Sign in now
                        </Link>
                    </div>
                ) : (
                    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300">
                                New Password <span className="text-slate-500 font-normal">(min. 8 characters)</span>
                            </label>
                            <div className="mt-1">
                                <input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="appearance-none block w-full px-3.5 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
                                Confirm New Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none block w-full px-3.5 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isSubmitting ? 'Updating password...' : 'Set new password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
