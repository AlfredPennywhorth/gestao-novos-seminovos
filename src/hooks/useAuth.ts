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
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
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

  const fetchProfile = useCallback(async (userId: string, isRecoveryFlow = false): Promise<void> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[useAuth] Erro ao buscar perfil:', error.message);
      setProfile(null);
    } else {
      const loadedProfile = data as Profile;
      if (!loadedProfile.ativo) {
        setProfile(loadedProfile);
        if (isRecoveryFlow || window.location.pathname === '/resetar-senha') {
          return;
        }
        await supabase.auth.signOut();
        setUser(null);
        return;
      }
      setProfile(loadedProfile);
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
        const isRecovery = window.location.pathname === '/resetar-senha';
        fetchProfile(session.user.id, isRecovery).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listener de mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const isRecovery = event === 'PASSWORD_RECOVERY' || window.location.pathname === '/resetar-senha';
          fetchProfile(session.user.id, isRecovery);
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

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };

        if (data?.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (!profileError && profileData) {
            const loadedProfile = profileData as Profile;
            if (!loadedProfile.ativo) {
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
              return { error: 'Sua conta está inativa. Solicite a ativação ao administrador.' };
            }
          }
        }
        return { error: null };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, nome: string): Promise<{ error: string | null }> => {
      setLoading(true);
      try {
        if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
          return { error: null };
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome,
              role: UserRole.VISUALIZADOR,
            },
          },
        });
        if (error) return { error: error.message };
        return { error: null };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const resetPasswordForEmail = useCallback(
    async (email: string): Promise<{ error: string | null }> => {
      setLoading(true);
      try {
        if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
          return { error: null };
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/resetar-senha`,
        });
        if (error) return { error: error.message };
        return { error: null };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<{ error: string | null }> => {
      setLoading(true);
      try {
        if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
          return { error: null };
        }

        const { error } = await supabase.auth.updateUser({ password });
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
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      isAdmin,
      isOperador,
      isVisualizador,
    }),
    [
      user,
      profile,
      loading,
      signIn,
      signUp,
      resetPasswordForEmail,
      updatePassword,
      signOut,
      isAdmin,
      isOperador,
      isVisualizador,
    ],
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
