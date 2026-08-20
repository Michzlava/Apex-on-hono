import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  signOut: async () => {},
  refetch: async () => {},
  login: async () => ({ success: false }),
});

// CRITICAL: Always include credentials so cookies are sent and received
async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  return res;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      console.log('[AUTH] Checking session...')
      const res = await apiFetch('/api/auth/me');

      console.log('[AUTH] /me status:', res.status)

      if (res.ok) {
        const data = await res.json();
        console.log('[AUTH] User:', data.user?.email || 'null')
        setUser(data.user);
      } else {
        console.log('[AUTH] Not authenticated')
        setUser(null);
      }
    } catch (error) {
      console.error('[AUTH] checkAuth error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Login failed' };
      }

      const data = await res.json();
      setUser(data.user);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Network error' };
    }
  }

  async function signOut() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      navigate('/login');
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, signOut, refetch: checkAuth, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
