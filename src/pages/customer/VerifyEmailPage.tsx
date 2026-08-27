import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { customerConfirmEmailVerification, isApiError } from '@/lib/api-client';
import { Button } from '@/components/common/Button';

type VerificationStatus = 'verifying' | 'success' | 'already_verified' | 'error';

export function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser, isAuthenticated } = useCustomerAuth();

    const token = searchParams.get('token')?.trim() || '';

    const [status, setStatus] = useState<VerificationStatus>(() =>
        token ? 'verifying' : 'error'
    );
    const [message, setMessage] = useState<string>(() =>
        token
            ? 'Verifying your email address...'
            : 'No verification token provided in the link. Please check your email for the complete link.'
    );
    const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

    const hasAttempted = useRef(false);

    useEffect(() => {
        if (hasAttempted.current || !token) return;
        hasAttempted.current = true;

        // Scrub the token from the browser URL immediately
        if (window.history.replaceState) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }

        const verify = async () => {
            try {
                const res = await customerConfirmEmailVerification(token);
                setStatus('success');
                setMessage(res.message || 'Your email address has been successfully verified!');
                if (res.email) setVerifiedEmail(res.email);
                await refreshUser();
            } catch (err: unknown) {
                const errorMsg = isApiError(err) ? err.message : 'The verification link is invalid, expired, or has already been used.';
                setStatus('error');
                setMessage(errorMsg);
            }
        };

        void verify();
    }, [token, refreshUser]);

    return (
        <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
                {status === 'verifying' && (
                    <div>
                        <div className="mx-auto w-12 h-12 rounded-full bg-brand-950 border border-brand-800 flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Verifying Your Email</h1>
                        <p className="text-sm text-slate-400">{message}</p>
                    </div>
                )}

                {status === 'success' && (
                    <div>
                        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Email Verified!</h1>
                        <p className="text-sm text-slate-300 mb-6">{message}</p>
                        {verifiedEmail && (
                            <p className="text-xs text-slate-400 mb-6 font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                                {verifiedEmail}
                            </p>
                        )}
                        <div className="space-y-3">
                            <Button
                                type="button"
                                variant="primary"
                                className="w-full"
                                onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
                            >
                                {isAuthenticated ? 'Go to Account Dashboard' : 'Proceed to Sign In'}
                            </Button>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div>
                        <div className="mx-auto w-12 h-12 rounded-full bg-red-950 border border-red-800 flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-white mb-2">Verification Failed</h1>
                        <p className="text-sm text-slate-300 mb-6">{message}</p>
                        <div className="space-y-3">
                            {isAuthenticated ? (
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="w-full"
                                    onClick={() => navigate('/account')}
                                >
                                    Return to Account Dashboard
                                </Button>
                            ) : (
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors text-sm"
                                >
                                    Back to Sign In
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
