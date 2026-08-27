import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { adminRequestEmailChange, isApiError, type AdminCapabilities } from '@/lib/api-client';
import { AdminCard } from './AdminCard';
import { AdminNotice } from './AdminNotice';
import { AdminPageHeader } from './AdminPageHeader';

export type CapabilityLoadState = 'loading' | 'ready' | 'error';

export interface AccountSecurityPanelProps {
    capabilityState: CapabilityLoadState;
    capabilities: AdminCapabilities | null;
    onRetryCapabilities: () => void;
}

export function AccountSecurityPanel({
    capabilityState,
    capabilities,
    onRetryCapabilities,
}: AccountSecurityPanelProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const emailReady = capabilityState === 'ready' && Boolean(capabilities?.passwordResetEmailConfigured);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !emailReady) return;
        setResult(null);
        setIsSubmitting(true);
        try {
            const res = await adminRequestEmailChange(currentPassword, newEmail);
            setResult({ type: 'success', text: res.message });
            setCurrentPassword('');
            setNewEmail('');
        } catch (err: unknown) {
            setResult({
                type: 'error',
                text: isApiError(err) ? err.message : 'Could not start the email change. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-xl space-y-4">
            <AdminPageHeader
                title="Account & Security"
                description="Manage your admin login email and how password recovery works."
            />

            {capabilityState === 'loading' && (
                <div
                    className="space-y-3"
                    role="status"
                    aria-live="polite"
                    aria-label="Loading account security settings"
                >
                    <div className="h-16 animate-pulse rounded-xl bg-slate-800 admin-motion" />
                    <div className="h-36 animate-pulse rounded-xl bg-slate-800 admin-motion" />
                </div>
            )}

            {capabilityState === 'error' && (
                <AdminNotice
                    variant="error"
                    title="Could not load email feature status"
                    action={
                        <Button type="button" variant="primary" size="sm" onClick={onRetryCapabilities}>
                            Try again
                        </Button>
                    }
                >
                    Check your connection and try again. This is not the same as email being unconfigured.
                </AdminNotice>
            )}

            {capabilityState === 'ready' && !emailReady && (
                <AdminNotice variant="warning" title="Email features unavailable">
                    Transactional email is not configured for this deployment. Password recovery and changes to
                    the login email are currently unavailable. Contact the deployment administrator to complete
                    the email configuration.
                </AdminNotice>
            )}

            {emailReady && (
                <>
                    <AdminNotice variant="success" title="Email features ready">
                        Password recovery and login-email changes are available. The app sends transactional
                        messages only — it does not create a mailbox.
                    </AdminNotice>

                    <AdminCard>
                        <h2 className="text-lg font-bold text-slate-900">Change login email</h2>
                        <p className="mt-2 text-sm text-slate-700">
                            To change your login email, confirm your current password and verify the link sent to
                            your new address. For security, you will need to sign in again after the email address
                            is changed.
                        </p>

                        {result && (
                            <div className="mt-4">
                                <AdminNotice
                                    variant={result.type === 'success' ? 'success' : 'error'}
                                    title={result.type === 'success' ? 'Verification email sent' : 'Could not send verification'}
                                >
                                    {result.text}
                                </AdminNotice>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                            <div>
                                <label htmlFor="admin-current-password" className="admin-label">
                                    Current password
                                </label>
                                <input
                                    id="admin-current-password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    minLength={8}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="admin-field"
                                />
                            </div>
                            <div>
                                <label htmlFor="admin-new-email" className="admin-label">
                                    New admin email
                                </label>
                                <input
                                    id="admin-new-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="you@your-organization.example"
                                    className="admin-field"
                                />
                            </div>
                            <Button type="submit" variant="accent" disabled={isSubmitting}>
                                {isSubmitting ? 'Sending…' : 'Send verification link'}
                            </Button>
                        </form>
                    </AdminCard>

                    <AdminCard>
                        <h2 className="text-lg font-bold text-slate-900">Password recovery</h2>
                        <p className="mt-2 text-sm text-slate-700">
                            Use the sign-in page if you need a reset link. Recovery only works for an inbox you
                            can actually open — the login email is an account identifier, not a mailbox this app
                            creates.
                        </p>
                        <p className="mt-3">
                            <Link
                                to="/admin/forgot-password"
                                className="text-sm font-semibold text-brand-800 underline decoration-brand-700 underline-offset-2 hover:text-brand-950 focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                Open forgot password
                            </Link>
                        </p>
                    </AdminCard>
                </>
            )}
        </div>
    );
}
