import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset, isApiError } from '@/lib/api-client';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/common/Button';
import { AdminAuthShell } from '@/components/admin/AdminAuthShell';
import { AdminNotice } from '@/components/admin/AdminNotice';

export function AdminForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setResult(null);

        try {
            const res = await requestPasswordReset(email);
            setResult({ type: 'success', text: res.message });
        } catch (err: unknown) {
            setResult({
                type: 'error',
                text: isApiError(err) ? err.message : 'Something went wrong. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminAuthShell
            title="Reset admin password"
            description="Enter your admin email. If an account exists, a reset link will be sent."
        >
            {result ? (
                <AdminNotice
                    variant={result.type === 'success' ? 'success' : 'error'}
                    title={result.type === 'success' ? 'Request received' : 'Could not send reset email'}
                >
                    {result.text}
                </AdminNotice>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-2">
                    <FormField
                        label="Admin email"
                        name="email"
                        type="email"
                        required
                        inputProps={{
                            value: email,
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
                            autoComplete: 'username',
                        }}
                    />
                    <Button type="submit" variant="accent" size="lg" fullWidth disabled={isSubmitting}>
                        {isSubmitting ? 'Sending…' : 'Send reset link'}
                    </Button>
                </form>
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
