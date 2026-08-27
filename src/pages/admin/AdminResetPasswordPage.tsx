import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, isApiError } from '@/lib/api-client';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/common/Button';
import { AdminAuthShell } from '@/components/admin/AdminAuthShell';
import { AdminNotice } from '@/components/admin/AdminNotice';

const MIN_PASSWORD_LENGTH = 10;

function validatePassword(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Password must include both letters and numbers.';
    }
    return null;
}

export function AdminResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token') ?? '';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [outcome, setOutcome] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFieldError(null);
        setOutcome(null);

        if (newPassword !== confirmPassword) {
            setFieldError('Passwords do not match.');
            return;
        }
        const validation = validatePassword(newPassword);
        if (validation) {
            setFieldError(validation);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await confirmPasswordReset(token, newPassword);
            setOutcome({ type: 'success', text: res.message });
            window.setTimeout(() => navigate('/admin/login', { replace: true }), 2500);
        } catch (err: unknown) {
            setOutcome({
                type: 'error',
                text: isApiError(err)
                    ? err.message
                    : 'This reset link is invalid or has expired. Please request a new one.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminAuthShell title="Set a new password">
            {!token ? (
                <>
                    <AdminNotice variant="error" title="Missing reset token">
                        This reset link is missing its token. Please request a new one.
                    </AdminNotice>
                    <p className="mt-6 text-center">
                        <Link to="/admin/forgot-password" className="text-sm font-semibold text-brand-800 underline underline-offset-2">
                            Request a new reset link
                        </Link>
                    </p>
                </>
            ) : outcome ? (
                <>
                    <AdminNotice
                        variant={outcome.type === 'success' ? 'success' : 'error'}
                        title={outcome.type === 'success' ? 'Password updated' : 'Reset failed'}
                    >
                        {outcome.text}
                    </AdminNotice>
                    {outcome.type === 'error' && (
                        <p className="mt-6 text-center">
                            <Link to="/admin/forgot-password" className="text-sm font-semibold text-brand-800 underline underline-offset-2">
                                Request a new reset link
                            </Link>
                        </p>
                    )}
                </>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-2">
                    {fieldError && (
                        <div className="mb-4">
                            <AdminNotice variant="error" title="Check your password">{fieldError}</AdminNotice>
                        </div>
                    )}
                    <FormField
                        label="New password"
                        name="newPassword"
                        type="password"
                        required
                        inputProps={{
                            value: newPassword,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value),
                            autoComplete: 'new-password',
                        }}
                    />
                    <FormField
                        label="Confirm new password"
                        name="confirmPassword"
                        type="password"
                        required
                        inputProps={{
                            value: confirmPassword,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value),
                            autoComplete: 'new-password',
                        }}
                    />
                    <Button type="submit" variant="accent" size="lg" fullWidth disabled={isSubmitting}>
                        {isSubmitting ? 'Resetting…' : 'Reset password'}
                    </Button>
                </form>
            )}
        </AdminAuthShell>
    );
}
