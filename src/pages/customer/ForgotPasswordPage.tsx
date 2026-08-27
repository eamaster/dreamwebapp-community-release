import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { customerRequestPasswordReset, isApiError } from '@/lib/api-client';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsSubmitting(true);

        try {
            const res = await customerRequestPasswordReset(email);
            setMessage(res.message || 'If an account exists with this email, instructions have been recorded.');
        } catch (err) {
            if (isApiError(err)) {
                setError(err.message);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to request password reset. Please try again.');
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight">
                        Reset your password
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-400">
                        Enter your email address and we'll process your password reset request.
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
                            className="w-full flex justify-center py-2.5 px-4 border border-slate-700 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                            Return to sign in
                        </Link>
                    </div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-3.5 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm transition-colors"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isSubmitting ? 'Submitting...' : 'Send reset instructions'}
                            </button>
                        </div>

                        <div className="text-center">
                            <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
                                Back to sign in
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
