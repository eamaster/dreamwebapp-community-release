import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { HomePage } from '@/pages/HomePage';
import { ServicesPage } from '@/pages/ServicesPage';
import { SolutionsPage } from '@/pages/SolutionsPage';
import { PricingPage } from '@/pages/PricingPage';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';
import { PrivacyPolicyPage } from '@/pages/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/pages/TermsOfServicePage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminForgotPasswordPage } from '@/pages/admin/AdminForgotPasswordPage';
import { AdminResetPasswordPage } from '@/pages/admin/AdminResetPasswordPage';
import { AdminVerifyEmailChangePage } from '@/pages/admin/AdminVerifyEmailChangePage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { PaymentReturnPage } from '@/pages/PaymentReturnPage';
import { CryptoCheckoutPage } from '@/pages/CryptoCheckoutPage';
import { LoginPage } from '@/pages/customer/LoginPage';
import { RegisterPage } from '@/pages/customer/RegisterPage';
import { ForgotPasswordPage } from '@/pages/customer/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/customer/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/customer/VerifyEmailPage';
import { AccountDashboardPage } from '@/pages/customer/AccountDashboardPage';

/**
 * React Router configuration
 * Public pages use MainLayout wrapper, admin pages render independently
 */
const router = createBrowserRouter([
    {
        path: '/admin/login',
        element: <AdminLoginPage />,
    },
    {
        path: '/admin/forgot-password',
        element: <AdminForgotPasswordPage />,
    },
    {
        path: '/admin/reset-password',
        element: <AdminResetPasswordPage />,
    },
    {
        path: '/admin/verify-email-change',
        element: <AdminVerifyEmailChangePage />,
    },
    {
        path: '/admin',
        element: <AdminDashboardPage />,
    },
    {
        path: '/',
        element: <MainLayout />,
        children: [
            {
                index: true,
                element: <HomePage />,
            },
            {
                path: 'services',
                element: <ServicesPage />,
            },
            {
                path: 'solutions',
                element: <SolutionsPage />,
            },
            {
                path: 'pricing',
                element: <PricingPage />,
            },
            {
                path: 'about',
                element: <AboutPage />,
            },
            {
                path: 'contact',
                element: <ContactPage />,
            },
            {
                path: 'login',
                element: <LoginPage />,
            },
            {
                path: 'register',
                element: <RegisterPage />,
            },
            {
                path: 'forgot-password',
                element: <ForgotPasswordPage />,
            },
            {
                path: 'reset-password',
                element: <ResetPasswordPage />,
            },
            {
                path: 'verify-email',
                element: <VerifyEmailPage />,
            },
            {
                path: 'account',
                element: <AccountDashboardPage />,
            },
            {
                path: 'account/*',
                element: <AccountDashboardPage />,
            },
            {
                path: 'privacy-policy',
                element: <PrivacyPolicyPage />,
            },
            {
                path: 'terms-of-service',
                element: <TermsOfServicePage />,
            },
            {
                path: 'payment/return',
                element: <PaymentReturnPage />,
            },
            {
                path: 'checkout/crypto',
                element: <CryptoCheckoutPage />,
            },
            {
                path: 'checkout',
                element: <CryptoCheckoutPage />,
            },
            {
                path: '*',
                element: (
                    <div className="min-h-screen flex items-center justify-center bg-slate-50">
                        <div className="text-center">
                            <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
                            <p className="text-xl text-slate-600 mb-8">Page not found</p>
                            <a
                                href="/"
                                className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                            >
                                Go Home
                            </a>
                        </div>
                    </div>
                ),
            },
        ],
    },
]);

/**
 * Router component
 * Wraps the entire application with React Router
 */
export function Router() {
    return <RouterProvider router={router} />;
}
