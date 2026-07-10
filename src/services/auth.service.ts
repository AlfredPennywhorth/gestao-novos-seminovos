import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// signIn
// ─────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string
): Promise<{ data: { user: User | null; session: Session | null } | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    let mensagem = 'Erro ao realizar login.'
    if (error.message.includes('Invalid login credentials')) {
      mensagem = 'E-mail ou senha inválidos.'
    } else if (error.message.includes('Email not confirmed')) {
      mensagem = 'E-mail não confirmado. Verifique sua caixa de entrada.'
    }
    return { data: null, error: mensagem }
  }

  return { data, error: null }
}

// ─────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

// ─────────────────────────────────────────────
// getSession
// ─────────────────────────────────────────────
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ─────────────────────────────────────────────
// getCurrentUser
// ─────────────────────────────────────────────
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user
}

// ─────────────────────────────────────────────
// onAuthStateChange
// ─────────────────────────────────────────────
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  }
}
