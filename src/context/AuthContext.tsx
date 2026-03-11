import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const ADMIN = { login: 'admin', password: 'admin' };

interface AuthContextType {
  isAdmin: boolean;
  login: (login: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return sessionStorage.getItem('iod_admin') === '1';
    } catch {
      return false;
    }
  });

  const login = useCallback((l: string, p: string) => {
    if (l === ADMIN.login && p === ADMIN.password) {
      sessionStorage.setItem('iod_admin', '1');
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('iod_admin');
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
