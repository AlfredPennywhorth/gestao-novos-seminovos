import type { Profile } from '@/types/database'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// getProfile
// ─────────────────────────────────────────────
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[profiles] Erro ao buscar perfil:', error.message)
    return null
  }

  return data as Profile
}

// ─────────────────────────────────────────────
// updateProfile
// ─────────────────────────────────────────────
export async function updateProfile(
  userId: string,
  data: Partial<Profile>
): Promise<{ data: Profile | null; error: string | null }> {
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar perfil: ' + error.message }
  }

  return { data: updated as Profile, error: null }
}

// ─────────────────────────────────────────────
// listProfiles — apenas ADMIN
// ─────────────────────────────────────────────
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('nome', { ascending: true })

  if (error) {
    console.error('[profiles] Erro ao listar perfis:', error.message)
    return []
  }

  return (data ?? []) as Profile[]
}

// ─────────────────────────────────────────────
// updateUserRole
// ─────────────────────────────────────────────
export async function updateUserRole(
  userId: string,
  role: string
): Promise<{ data: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar papel do usuário: ' + error.message }
  }

  return { data: data as Profile, error: null }
}

// ─────────────────────────────────────────────
// toggleUserActive
// ─────────────────────────────────────────────
export async function toggleUserActive(
  userId: string,
  ativo: boolean
): Promise<{ data: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ativo })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    return {
      data: null,
      error: `Erro ao ${ativo ? 'ativar' : 'desativar'} usuário: ` + error.message,
    }
  }

  return { data: data as Profile, error: null }
}
