import type { SaidaItem, InsertSaidaItem, UpdateSaidaItem } from '@/types/database'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// Tipos auxiliares
// ─────────────────────────────────────────────
interface FiltrosSaidas {
  dataInicio?: string
  dataFim?: string
  almoxarifadoId?: string
  setorId?: string
  itemId?: string
  tipo?: 'NOVO' | 'SEMINOVO'
  loteId?: string
  page?: number
  limit?: number
}

// ─────────────────────────────────────────────
// listSaidas
// ─────────────────────────────────────────────
export async function listSaidas(
  filtros: FiltrosSaidas = {}
): Promise<{ data: SaidaItem[]; count: number }> {
  const {
    dataInicio,
    dataFim,
    almoxarifadoId,
    setorId,
    itemId,
    tipo,
    loteId,
    page = 1,
    limit = 50,
  } = filtros

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('saidas_itens')
    .select('*', { count: 'exact' })
    .order('data_saida', { ascending: false })
    .range(from, to)

  if (dataInicio) query = query.gte('data_saida', dataInicio)
  if (dataFim) query = query.lte('data_saida', dataFim)
  if (almoxarifadoId) query = query.eq('almoxarifado_id', almoxarifadoId)
  if (setorId) query = query.eq('setor_id', setorId)
  if (itemId) query = query.eq('item_id', itemId)
  if (tipo) query = query.eq('tipo', tipo)
  if (loteId) query = query.eq('lote_importacao_id', loteId)

  const { data, count, error } = await query

  if (error) {
    console.error('[saidas] Erro ao listar:', error.message)
    return { data: [], count: 0 }
  }

  return { data: (data ?? []) as SaidaItem[], count: count ?? 0 }
}

// ─────────────────────────────────────────────
// getSaida
// ─────────────────────────────────────────────
export async function getSaida(id: string): Promise<SaidaItem | null> {
  const { data, error } = await supabase
    .from('saidas_itens')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[saidas] Erro ao buscar:', error.message)
    return null
  }

  return data as SaidaItem
}

// ─────────────────────────────────────────────
// createSaida
// ─────────────────────────────────────────────
export async function createSaida(
  data: InsertSaidaItem
): Promise<{ data: SaidaItem | null; error: string | null }> {
  const { data: created, error } = await supabase
    .from('saidas_itens')
    .insert(data)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao registrar saída: ' + error.message }
  }

  return { data: created as SaidaItem, error: null }
}

// ─────────────────────────────────────────────
// updateSaida
// ─────────────────────────────────────────────
export async function updateSaida(
  id: string,
  data: UpdateSaidaItem
): Promise<{ data: SaidaItem | null; error: string | null }> {
  const { data: updated, error } = await supabase
    .from('saidas_itens')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar saída: ' + error.message }
  }

  return { data: updated as SaidaItem, error: null }
}

// ─────────────────────────────────────────────
// deleteSaida
// ─────────────────────────────────────────────
export async function deleteSaida(
  id: string
): Promise<{ data: SaidaItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('saidas_itens')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao excluir saída: ' + error.message }
  }

  return { data: data as SaidaItem, error: null }
}

// ─────────────────────────────────────────────
// createSaidasLote — inserção em lote
// ─────────────────────────────────────────────
export async function createSaidasLote(
  saidas: InsertSaidaItem[]
): Promise<{ data: SaidaItem[] | null; error: string | null; total: number }> {
  if (saidas.length === 0) {
    return { data: [], error: null, total: 0 }
  }

  const { data, error } = await supabase
    .from('saidas_itens')
    .insert(saidas)
    .select()

  if (error) {
    const detalhes = [error.message, error.details, error.hint]
      .filter(Boolean)
      .join(' | ')
    return { data: null, error: 'Erro ao inserir saídas em lote: ' + detalhes, total: 0 }
  }

  return { data: (data ?? []) as SaidaItem[], error: null, total: data?.length ?? 0 }
}
