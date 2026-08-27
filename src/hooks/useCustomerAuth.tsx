import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    type CustomerUser,
    type CustomerCapabilities,
    customerGetMe,
    customerGetCapabilities,
    customerLogin,
    customerRegister,
    customerLogout,
} from '@/lib/api-client';

interface CustomerAuthContextType {
    user: CustomerUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    capabilities: CustomerCapabilities | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, displayName?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<CustomerUser | null>(null);
    const [capabilities, setCapabilities] = useState<CustomerCapabilities | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const current = await customerGetMe();
            setUser(current);
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const [capsResult, meResult] = await Promise.allSettled([
                    customerGetCapabilities(),
                    customerGetMe(),
                ]);

                if (mounted && capsResult.status === 'fulfilled') {
                    setCapabilities(capsResult.value);
                }

                if (mounted && meResult.status === 'fulfilled') {
                    setUser(meResult.value);
                } else if (mounted) {
                    setUser(null);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        init();
        return () => {
            mounted = false;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await customerLogin({ email, password });
        setUser(res.user);
    }, []);

    const register = useCallback(async (email: string, password: string, displayName?: string) => {
        const res = await customerRegister({ email, password, displayName });
        setUser(res.user);
    }, []);

    const logout = useCallback(async () => {
        try {
            await customerLogout();
        } finally {
            setUser(null);
        }
    }, []);

    return (
        <CustomerAuthContext.Provider
            value={{
                user,
                isAuthenticated: Boolean(user),
                isLoading,
                capabilities,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </CustomerAuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomerAuth() {
    const context = useContext(CustomerAuthContext);
    if (!context) {
        throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
    }
    return context;
}
