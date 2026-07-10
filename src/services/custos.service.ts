import type { CustoMensalItem, InsertCustoMensalItem, UpdateCustoMensalItem } from '@/types/database'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// Tipos auxiliares
// ─────────────────────────────────────────────
interface FiltrosCusto {
  competencia?: string
  itemId?: string
  almoxarifadoId?: string
}

interface CustoEfetivo {
  valorNovo: number
  valorSeminovo: number
  fonte: string
}

// ─────────────────────────────────────────────
// listCustos
// ─────────────────────────────────────────────
export async function listCustos(filtros?: FiltrosCusto): Promise<CustoMensalItem[]> {
  let query = supabase
    .from('custos_mensais_itens')
    .select('*')
    .order('competencia', { ascending: false })

  if (filtros?.competencia) {
    query = query.eq('competencia', filtros.competencia)
  }
  if (filtros?.itemId) {
    query = query.eq('item_id', filtros.itemId)
  }
  if (filtros?.almoxarifadoId) {
    query = query.eq('almoxarifado_id', filtros.almoxarifadoId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[custos] Erro ao listar:', error.message)
    return []
  }

  return (data ?? []) as CustoMensalItem[]
}

// ─────────────────────────────────────────────
// getCusto
// ─────────────────────────────────────────────
export async function getCusto(id: string): Promise<CustoMensalItem | null> {
  const { data, error } = await supabase
    .from('custos_mensais_itens')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[custos] Erro ao buscar:', error.message)
    return null
  }

  return data as CustoMensalItem
}

// ─────────────────────────────────────────────
// createCusto
// ─────────────────────────────────────────────
export async function createCusto(
  data: InsertCustoMensalItem
): Promise<{ data: CustoMensalItem | null; error: string | null }> {
  const { data: created, error } = await supabase
    .from('custos_mensais_itens')
    .insert(data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return {
        data: null,
        error: 'Já existe um custo cadastrado para este item/almoxarifado/competência.',
      }
    }
    return { data: null, error: 'Erro ao criar custo: ' + error.message }
  }

  return { data: created as CustoMensalItem, error: null }
}

// ─────────────────────────────────────────────
// updateCusto
// ─────────────────────────────────────────────
export async function updateCusto(
  id: string,
  data: UpdateCustoMensalItem
): Promise<{ data: CustoMensalItem | null; error: string | null }> {
  const { data: updated, error } = await supabase
    .from('custos_mensais_itens')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar custo: ' + error.message }
  }

  return { data: updated as CustoMensalItem, error: null }
}

// ─────────────────────────────────────────────
// deleteCusto
// ─────────────────────────────────────────────
export async function deleteCusto(
  id: string
): Promise<{ data: CustoMensalItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('custos_mensais_itens')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao excluir custo: ' + error.message }
  }

  return { data: data as CustoMensalItem, error: null }
}

// ─────────────────────────────────────────────
// getCustoEfetivo — chama RPC ou retorna padrão
// ─────────────────────────────────────────────
export async function getCustoEfetivo(
  competencia: string,
  itemId: string,
  almoxarifadoId?: string
): Promise<CustoEfetivo> {
  const CUSTO_PADRAO: CustoEfetivo = {
    valorNovo: 40,
    valorSeminovo: 4,
    fonte: 'padrao',
  }

  try {
    const { data, error } = await supabase.rpc('get_custo_efetivo', {
      p_competencia: competencia,
      p_item_id: itemId,
      p_almoxarifado_id: almoxarifadoId ?? null,
    })

    if (error || !data) {
      console.warn('[custos] RPC get_custo_efetivo falhou, usando padrão:', error?.message)
      return CUSTO_PADRAO
    }

    return {
      valorNovo: (data as Record<string, number>)['valor_novo'] ?? CUSTO_PADRAO.valorNovo,
      valorSeminovo:
        (data as Record<string, number>)['valor_seminovo'] ?? CUSTO_PADRAO.valorSeminovo,
      fonte: (data as Record<string, string>)['fonte'] ?? 'rpc',
    }
  } catch {
    return CUSTO_PADRAO
  }
}
