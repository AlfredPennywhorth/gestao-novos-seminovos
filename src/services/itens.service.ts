import type { Item, InsertItem, UpdateItem } from '@/types/database'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// listItens
// ─────────────────────────────────────────────
export async function listItens(apenasAtivos = false): Promise<Item[]> {
  let query = supabase.from('itens').select('*').order('nome', { ascending: true })

  if (apenasAtivos) {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[itens] Erro ao listar:', error.message)
    return []
  }

  return (data ?? []) as Item[]
}

// ─────────────────────────────────────────────
// listItensPorSetor — via item_setor
// ─────────────────────────────────────────────
export async function listItensPorSetor(setorId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('item_setor')
    .select('itens(*)')
    .eq('setor_id', setorId)

  if (error) {
    console.error('[itens] Erro ao listar por setor:', error.message)
    return []
  }

  return ((data ?? []) as any[])
    .map((row) => row.itens)
    .filter((item): item is Item => item !== null && item !== undefined)
}

// ─────────────────────────────────────────────
// getItem
// ─────────────────────────────────────────────
export async function getItem(id: string): Promise<Item | null> {
  const { data, error } = await supabase.from('itens').select('*').eq('id', id).single()

  if (error) {
    console.error('[itens] Erro ao buscar:', error.message)
    return null
  }

  return data as Item
}

// ─────────────────────────────────────────────
// createItem
// ─────────────────────────────────────────────
export async function createItem(
  data: InsertItem
): Promise<{ data: Item | null; error: string | null }> {
  const { data: created, error } = await supabase.from('itens').insert(data).select().single()

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Já existe um item com este nome.' }
    }
    return { data: null, error: 'Erro ao criar item: ' + error.message }
  }

  return { data: created as Item, error: null }
}

// ─────────────────────────────────────────────
// updateItem
// ─────────────────────────────────────────────
export async function updateItem(
  id: string,
  data: UpdateItem
): Promise<{ data: Item | null; error: string | null }> {
  const { data: updated, error } = await supabase
    .from('itens')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar item: ' + error.message }
  }

  return { data: updated as Item, error: null }
}

// ─────────────────────────────────────────────
// toggleActive
// ─────────────────────────────────────────────
export async function toggleActive(
  id: string,
  ativo: boolean
): Promise<{ data: Item | null; error: string | null }> {
  const { data, error } = await supabase
    .from('itens')
    .update({ ativo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return {
      data: null,
      error: `Erro ao ${ativo ? 'ativar' : 'desativar'} item: ` + error.message,
    }
  }

  return { data: data as Item, error: null }
}

// ─────────────────────────────────────────────
// findOrCreate
// ─────────────────────────────────────────────
export async function findOrCreate(
  nome: string
): Promise<{ item: Item; criado: boolean }> {
  const nomeTrimado = nome.trim()

  const { data: existente, error: erroBusca } = await supabase
    .from('itens')
    .select('*')
    .ilike('nome', nomeTrimado)
    .limit(1)
    .single()

  if (!erroBusca && existente) {
    return { item: existente as Item, criado: false }
  }

  const { data: criado, error: erroCriacao } = await supabase
    .from('itens')
    .insert({ nome: nomeTrimado, ativo: true })
    .select()
    .single()

  if (erroCriacao || !criado) {
    // Race condition — tenta novamente
    const { data: recheck } = await supabase
      .from('itens')
      .select('*')
      .ilike('nome', nomeTrimado)
      .limit(1)
      .single()

    if (recheck) {
      return { item: recheck as Item, criado: false }
    }

    throw new Error(
      `Falha ao criar item "${nomeTrimado}": ` + (erroCriacao?.message ?? 'erro desconhecido')
    )
  }

  return { item: criado as Item, criado: true }
}

// ─────────────────────────────────────────────
// vincularItemSetor — upsert com ON CONFLICT DO NOTHING
// ─────────────────────────────────────────────
export async function vincularItemSetor(
  itemId: string,
  setorId: string
): Promise<{ data: unknown; error: string | null }> {
  const { data, error } = await supabase
    .from('item_setor')
    .upsert(
      { item_id: itemId, setor_id: setorId },
      { onConflict: 'item_id,setor_id', ignoreDuplicates: true }
    )
    .select()

  if (error) {
    return { data: null, error: 'Erro ao vincular item ao setor: ' + error.message }
  }

  return { data, error: null }
}
