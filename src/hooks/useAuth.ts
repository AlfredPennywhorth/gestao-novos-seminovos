import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import type { Profile } from '@/types/database';
import { UserRole } from '@/types/database';

// ============================================================
// Types
// ============================================================

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: () => boolean;
  isOperador: () => boolean;
  isVisualizador: () => boolean;
}

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<void> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[useAuth] Erro ao buscar perfil:', error.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
      setLoading(false);
      return;
    }

    // Sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listener de mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      setLoading(true);
      try {
        if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
          const mockUser = {
            id: 'mock-user-id',
            email: email,
            aud: 'authenticated',
            role: 'authenticated',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
          } as any;
          
          const mockProfile: Profile = {
            id: 'mock-user-id',
            nome: email.split('@')[0].toUpperCase(),
            email: email,
            role: email.toLowerCase().includes('admin') ? UserRole.ADMIN : UserRole.OPERADOR,
            ativo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setUser(mockUser);
          setProfile(mockProfile);
          setLoading(false);
          return { error: null };
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const isAdmin = useCallback((): boolean => profile?.role === UserRole.ADMIN, [profile]);
  const isOperador = useCallback((): boolean => profile?.role === UserRole.OPERADOR, [profile]);
  const isVisualizador = useCallback((): boolean => profile?.role === UserRole.VISUALIZADOR, [profile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signOut,
      isAdmin,
      isOperador,
      isVisualizador,
    }),
    [user, profile, loading, signIn, signOut, isAdmin, isOperador, isVisualizador],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ============================================================
// Hook
// ============================================================

/**
 * Hook que retorna o contexto de autenticação.
 * Deve ser usado dentro de <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  }
  return ctx;
}
