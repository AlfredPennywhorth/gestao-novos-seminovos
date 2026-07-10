import type { Almoxarifado, InsertAlmoxarifado, UpdateAlmoxarifado } from '@/types/database'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// listAlmoxarifados
// ─────────────────────────────────────────────
export async function listAlmoxarifados(apenasAtivos = false): Promise<Almoxarifado[]> {
  let query = supabase.from('almoxarifados').select('*').order('nome', { ascending: true })

  if (apenasAtivos) {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[almoxarifados] Erro ao listar:', error.message)
    return []
  }

  return (data ?? []) as Almoxarifado[]
}

// ─────────────────────────────────────────────
// getAlmoxarifado
// ─────────────────────────────────────────────
export async function getAlmoxarifado(id: string): Promise<Almoxarifado | null> {
  const { data, error } = await supabase
    .from('almoxarifados')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[almoxarifados] Erro ao buscar:', error.message)
    return null
  }

  return data as Almoxarifado
}

// ─────────────────────────────────────────────
// createAlmoxarifado
// ─────────────────────────────────────────────
export async function createAlmoxarifado(
  data: InsertAlmoxarifado
): Promise<{ data: Almoxarifado | null; error: string | null }> {
  const { data: created, error } = await supabase
    .from('almoxarifados')
    .insert(data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Já existe um almoxarifado com este nome.' }
    }
    return { data: null, error: 'Erro ao criar almoxarifado: ' + error.message }
  }

  return { data: created as Almoxarifado, error: null }
}

// ─────────────────────────────────────────────
// updateAlmoxarifado
// ─────────────────────────────────────────────
export async function updateAlmoxarifado(
  id: string,
  data: UpdateAlmoxarifado
): Promise<{ data: Almoxarifado | null; error: string | null }> {
  const { data: updated, error } = await supabase
    .from('almoxarifados')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar almoxarifado: ' + error.message }
  }

  return { data: updated as Almoxarifado, error: null }
}

// ─────────────────────────────────────────────
// toggleActive
// ─────────────────────────────────────────────
export async function toggleActive(
  id: string,
  ativo: boolean
): Promise<{ data: Almoxarifado | null; error: string | null }> {
  const { data, error } = await supabase
    .from('almoxarifados')
    .update({ ativo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return {
      data: null,
      error: `Erro ao ${ativo ? 'ativar' : 'desativar'} almoxarifado: ` + error.message,
    }
  }

  return { data: data as Almoxarifado, error: null }
}

// ─────────────────────────────────────────────
// validarTipoPermitido
// ─────────────────────────────────────────────
export async function validarTipoPermitido(
  almoxarifadoId: string | null | undefined,
  tipo: 'NOVO' | 'SEMINOVO'
): Promise<boolean> {
  if (!almoxarifadoId) return true

  const almoxarifado = await getAlmoxarifado(almoxarifadoId)

  if (!almoxarifado) return true

  // Se o almoxarifado tiver o campo tipos_permitidos, verifica.
  // Caso a coluna não exista no banco, aceita tudo.
  const tipos = (almoxarifado as unknown as Record<string, unknown>)['tipos_permitidos'] as
    | string[]
    | null
    | undefined

  if (!tipos || tipos.length === 0) return true

  return tipos.includes(tipo)
}
