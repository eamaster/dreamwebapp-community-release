import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmEmailChange, isApiError, setStoredAdminToken } from '@/lib/api-client';
import { Button } from '@/components/common/Button';
import { AdminAuthShell } from '@/components/admin/AdminAuthShell';
import { AdminNotice } from '@/components/admin/AdminNotice';

/**
 * Confirms a pending admin-email change. Requires an explicit click rather
 * than acting on page load so mail-client link prefetch cannot consume the
 * one-use token.
 */
export function AdminVerifyEmailChangePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') ?? '';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            const res = await confirmEmailChange(token);
            setOutcome({ type: 'success', text: res.message });
            setStoredAdminToken(null);
            window.setTimeout(() => navigate('/admin/login', { replace: true }), 2500);
        } catch (err: unknown) {
            setOutcome({
                type: 'error',
                text: isApiError(err) ? err.message : 'This verification link is invalid or has expired.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminAuthShell title="Confirm new admin email">
            {!token ? (
                <AdminNotice variant="error" title="Missing verification token">
                    This link is missing its verification token. Restart the email change from the admin dashboard.
                </AdminNotice>
            ) : outcome ? (
                <AdminNotice
                    variant={outcome.type === 'success' ? 'success' : 'error'}
                    title={outcome.type === 'success' ? 'Email updated' : 'Verification failed'}
                >
                    {outcome.text}
                </AdminNotice>
            ) : (
                <>
                    <p className="text-sm text-slate-800">
                        Confirming will update the admin login email and sign every current session out. Continue only
                        if you opened this link yourself.
                    </p>
                    <div className="mt-4">
                        <Button type="button" variant="accent" size="lg" fullWidth disabled={isSubmitting} onClick={() => void handleConfirm()}>
                            {isSubmitting ? 'Confirming…' : 'Confirm this email change'}
                        </Button>
                    </div>
                </>
            )}
            <p className="mt-6 text-center">
                <Link
                    to="/admin/login"
                    className="text-sm font-semibold text-brand-800 underline underline-offset-2 hover:text-brand-950"
                >
                    Back to sign in
                </Link>
            </p>
        </AdminAuthShell>
    );
}
