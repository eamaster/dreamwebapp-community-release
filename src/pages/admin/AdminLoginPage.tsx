import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/common/Button';
import { AdminAuthShell } from '@/components/admin/AdminAuthShell';
import { AdminNotice } from '@/components/admin/AdminNotice';
import { isApiError } from '@/lib/api-client';

export function AdminLoginPage() {
    const { isAuthenticated, login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (isAuthenticated) {
        return <Navigate to="/admin" replace />;
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await login(email, password);
            navigate('/admin', { replace: true });
        } catch (err: unknown) {
            setError(isApiError(err) ? err.message : 'Invalid email or password');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminAuthShell title="DreamWebApp Admin" description="Content management and leads portal">
            <form onSubmit={handleSubmit} className="space-y-2">
                {error && (
                    <div className="mb-4">
                        <AdminNotice variant="error" title="Sign-in failed">{error}</AdminNotice>
                    </div>
                )}
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
                <FormField
                    label="Password"
                    name="password"
                    type="password"
                    required
                    inputProps={{
                        value: password,
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
                        autoComplete: 'current-password',
                    }}
                />
                <Button type="submit" variant="accent" size="lg" fullWidth disabled={isSubmitting}>
                    {isSubmitting ? 'Signing in…' : 'Sign in to dashboard'}
                </Button>
                <p className="pt-4 text-center">
                    <Link
                        to="/admin/forgot-password"
                        className="text-sm font-semibold text-brand-800 underline underline-offset-2 hover:text-brand-950 focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        Forgot password?
                    </Link>
                </p>
            </form>
        </AdminAuthShell>
    );
}
