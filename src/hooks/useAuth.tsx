import { useState, useCallback, createContext, useContext } from 'react';
import { adminLogin, getStoredAdminToken, setStoredAdminToken } from '@/lib/api-client';

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(() => getStoredAdminToken());
    const [isLoading] = useState(false);

    const login = useCallback(async (email: string, password: string) => {
        const res = await adminLogin(email, password);
        setToken(res.token);
    }, []);

    const logout = useCallback(() => {
        setStoredAdminToken(null);
        setToken(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                isAuthenticated: Boolean(token),
                token,
                login,
                logout,
                isLoading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
