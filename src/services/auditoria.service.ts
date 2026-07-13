import type { Auditoria } from '@/types/database'
import { supabase } from '@/services/supabase'

// ─────────────────────────────────────────────
// Tipos auxiliares
// ─────────────────────────────────────────────
interface RegistrarAuditoriaParams {
  userId: string
  acao: string
  tabela?: string
  registroId?: string
  dadosAnteriores?: object
  dadosNovos?: object
}

interface FiltrosAuditoria {
  usuarioId?: string
  tabela?: string
  dataInicio?: string
  dataFim?: string
}

// ─────────────────────────────────────────────
// registrar — nunca lança exceção
// ─────────────────────────────────────────────
export async function registrar(params: RegistrarAuditoriaParams): Promise<void> {
  try {
    const { acao, tabela, registroId, dadosAnteriores, dadosNovos } = params

    await supabase.rpc('registrar_auditoria', {
      p_acao: acao,
      p_tabela_afetada: tabela ?? null,
      p_registro_id: registroId ?? null,
      p_dados_anteriores: dadosAnteriores ?? null,
      p_dados_novos: dadosNovos ?? null,
    })
  } catch (err) {
    // Silencia erros para não quebrar o fluxo principal
    console.warn('[auditoria] Falha silenciosa ao registrar auditoria:', err)
  }
}

// ─────────────────────────────────────────────
// listAuditoria
// ─────────────────────────────────────────────
export async function listAuditoria(
  filtros: FiltrosAuditoria = {},
  page = 1,
  limit = 50
): Promise<{ data: Auditoria[]; count: number }> {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('auditoria')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(from, to)

  if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId)
  if (filtros.tabela) query = query.eq('tabela', filtros.tabela)
  if (filtros.dataInicio) query = query.gte('criado_em', filtros.dataInicio)
  if (filtros.dataFim) query = query.lte('criado_em', filtros.dataFim)

  const { data, count, error } = await query

  if (error) {
    console.error('[auditoria] Erro ao listar:', error.message)
    return { data: [], count: 0 }
  }

  return { data: (data ?? []) as Auditoria[], count: count ?? 0 }
}
