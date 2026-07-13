import type { Item, InsertItem, Setor, UpdateItem } from '@/types/database'
import { supabase } from '@/services/supabase'

export interface ItemComSetor extends Item {
  setor: Setor | null
}

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

export async function listItensComSetor(apenasAtivos = false): Promise<ItemComSetor[]> {
  let query = supabase
    .from('itens')
    .select('*, item_setor(setor_id, ativo, setores(*))')
    .order('nome', { ascending: true })

  if (apenasAtivos) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error) throw new Error('Erro ao listar itens e setores: ' + error.message)

  return ((data ?? []) as unknown as Array<Item & {
    item_setor?: Array<{ ativo: boolean; setores: Setor[] | Setor | null }>
  }>).map((item) => {
    const vinculo = item.item_setor?.find((v) => {
      const setor = Array.isArray(v.setores) ? v.setores[0] : v.setores
      return v.ativo && setor?.ativo
    })
    const setor = Array.isArray(vinculo?.setores) ? vinculo.setores[0] : vinculo?.setores
    const { item_setor: _vinculos, ...base } = item
    return { ...base, setor: setor ?? null }
  })
}

export async function atualizarSetorItem(
  itemId: string,
  setorId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('atualizar_setor_item', {
    p_item_id: itemId,
    p_setor_id: setorId,
  })

  return { error: error ? 'Erro ao atualizar setor do item: ' + error.message : null }
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
  nome: string,
  codigo?: string | null,
  descricao?: string | null
): Promise<{ item: Item; criado: boolean }> {
  const nomeTrimado = nome.trim()
  const codigoTrimado = codigo?.trim().toUpperCase() || null

  if (codigoTrimado) {
    const { data: existentePorCodigo, error: erroCodigo } = await supabase
      .from('itens')
      .select('*')
      .ilike('codigo', codigoTrimado)
      .limit(1)
      .single()

    if (!erroCodigo && existentePorCodigo) {
      return { item: existentePorCodigo as Item, criado: false }
    }
  }

  const { data: existente, error: erroBusca } = codigoTrimado
    ? { data: null, error: null }
    : await supabase
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
    .insert({
      codigo: codigoTrimado,
      nome: nomeTrimado,
      descricao: descricao ?? null,
      ativo: true,
    })
    .select()
    .single()

  if (erroCriacao || !criado) {
    // Race condition — tenta novamente
    const { data: recheckPorCodigo } = codigoTrimado
      ? await supabase
          .from('itens')
          .select('*')
          .ilike('codigo', codigoTrimado)
          .limit(1)
          .single()
      : { data: null }

    if (recheckPorCodigo) {
      return { item: recheckPorCodigo as Item, criado: false }
    }

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
