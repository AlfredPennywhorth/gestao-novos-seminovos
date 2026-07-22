import { supabase } from '@/services/supabase'
import { CUSTO_PADRAO_NOVO, CUSTO_PADRAO_SEMINOVO } from '@/utils/economia'
import type {
  KPIData,
  SerieTemporalItem,
  ResumoPorSetor,
  ResumoPorItem,
  ResumoPorAlmoxarifado,
  TabelaAnaliticaRow,
} from '@/types/dashboard'
import seedDataRaw from './seed-data.json'

const seedData = seedDataRaw as Array<{
  periodo: string
  setor: string
  item: string
  novos: number
  seminovos: number
  competencia: string
}>

function getFilteredSeedData(params: DashParams) {
  return seedData.filter(d => {
    if (params.dataInicio && d.competencia < params.dataInicio) return false
    if (params.dataFim && d.competencia > params.dataFim) return false
    if (params.setorId && d.setor !== params.setorId) return false
    if (params.itemId && d.item !== params.itemId) return false
    return true
  })
}

// ─── Parâmetros de filtro compartilhados ─────────────────────────────────────
interface DashParams {
  dataInicio?: string
  dataFim?: string
  almoxarifadoId?: string
  setorId?: string
  itemId?: string
  tipo?: string
}

// ─── Query base de saídas com joins ──────────────────────────────────────────
function buildQuery(params: DashParams) {
  let q = supabase
    .from('saidas_itens')
    .select(`
      competencia, tipo, quantidade, almoxarifado_id,
      setor_id, item_id,
      almoxarifados!left(nome),
      setores!inner(nome),
      itens!inner(nome, unidade)
    `)

  if (params.dataInicio) q = q.gte('competencia', params.dataInicio)
  if (params.dataFim)    q = q.lte('competencia', params.dataFim)
  if (params.almoxarifadoId) q = q.eq('almoxarifado_id', params.almoxarifadoId)
  if (params.setorId)    q = q.eq('setor_id', params.setorId)
  if (params.itemId)     q = q.eq('item_id', params.itemId)
  if (params.tipo)       q = q.eq('tipo', params.tipo)

  return q
}

// ─── getDashboardKPIs ────────────────────────────────────────────────────────
export async function getDashboardKPIs(params: DashParams): Promise<KPIData> {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
    const data = getFilteredSeedData(params)
    let totalNovos = 0
    let totalSeminovos = 0
    const competencias = new Set<string>()

    for (const d of data) {
      totalNovos += d.novos
      totalSeminovos += d.seminovos
      competencias.add(d.competencia)
    }

    const totalSaidas = totalNovos + totalSeminovos
    const economiaEstimada = totalSeminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO)
    const custoEvitadoBruto = totalSeminovos * CUSTO_PADRAO_NOVO
    const mesesComDados = competencias.size || 1

    return {
      totalSaidas,
      totalNovos,
      totalSeminovos,
      percentualSeminovos: totalSaidas > 0 ? (totalSeminovos / totalSaidas) * 100 : 0,
      economiaEstimada,
      custoEvitadoBruto,
      mediaMensalEconomia: economiaEstimada / mesesComDados,
      mesesComDados,
      usandoCustoPadrao: true,
      periodoInicio: params.dataInicio ?? '2024-01-01',
      periodoFim: params.dataFim ?? '2024-12-31',
    }
  }

  const fallback: KPIData = {
    totalSaidas: 0, totalNovos: 0, totalSeminovos: 0,
    percentualSeminovos: 0, economiaEstimada: 0, custoEvitadoBruto: 0,
    mediaMensalEconomia: 0, mesesComDados: 0, usandoCustoPadrao: true,
    periodoInicio: params.dataInicio ?? '', periodoFim: params.dataFim ?? '',
  }

  // Tentar via RPC primeiro
  try {
    const { data, error } = await supabase.rpc('get_dashboard_kpis', {
      p_data_inicio: params.dataInicio ?? null,
      p_data_fim: params.dataFim ?? null,
      p_almoxarifado_id: params.almoxarifadoId ?? null,
      p_setor_id: params.setorId ?? null,
      p_item_id: params.itemId ?? null,
    })
    if (!error && data && data.length > 0) {
      const r = data[0]
      return {
        totalSaidas: Number(r.total_saidas ?? 0),
        totalNovos: Number(r.total_novos ?? 0),
        totalSeminovos: Number(r.total_seminovos ?? 0),
        percentualSeminovos: Number(r.percentual_seminovos ?? 0),
        economiaEstimada: Number(r.economia_estimada ?? 0),
        custoEvitadoBruto: Number(r.custo_evitado_bruto ?? 0),
        mediaMensalEconomia: Number(r.media_mensal_economia ?? 0),
        mesesComDados: Number(r.meses_com_dados ?? 0),
        usandoCustoPadrao: false,
        periodoInicio: params.dataInicio ?? '',
        periodoFim: params.dataFim ?? '',
      }
    }
  } catch {
    // cai no fallback manual
  }

  // Fallback manual sem RPC
  const { data: rows } = await buildQuery(params)
  if (!rows || rows.length === 0) return fallback

  let totalNovos = 0, totalSeminovos = 0
  const meses = new Set<string>()

  for (const r of rows as Record<string, unknown>[]) {
    const qtd = Number(r.quantidade ?? 0)
    const comp = String(r.competencia ?? '').slice(0, 7)
    meses.add(comp)
    if (r.tipo === 'NOVO') totalNovos += qtd
    else if (r.tipo === 'SEMINOVO') totalSeminovos += qtd
  }

  const totalSaidas = totalNovos + totalSeminovos
  const economiaEstimada = totalSeminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO)
  const custoEvitadoBruto = totalSeminovos * CUSTO_PADRAO_NOVO
  const mesesComDados = meses.size

  return {
    totalSaidas,
    totalNovos,
    totalSeminovos,
    percentualSeminovos: totalSaidas > 0 ? (totalSeminovos / totalSaidas) * 100 : 0,
    economiaEstimada,
    custoEvitadoBruto,
    mediaMensalEconomia: mesesComDados > 0 ? economiaEstimada / mesesComDados : 0,
    mesesComDados,
    usandoCustoPadrao: true,
    periodoInicio: params.dataInicio ?? '',
    periodoFim: params.dataFim ?? '',
  }
}

// ─── getSerieTemporal ────────────────────────────────────────────────────────
export async function getSerieTemporal(params: DashParams): Promise<SerieTemporalItem[]> {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
    const data = getFilteredSeedData(params)
    const groups: Record<string, { totalNovos: number; totalSeminovos: number }> = {}
    
    for (const d of data) {
      if (!groups[d.competencia]) {
        groups[d.competencia] = { totalNovos: 0, totalSeminovos: 0 }
      }
      groups[d.competencia].totalNovos += d.novos
      groups[d.competencia].totalSeminovos += d.seminovos
    }

    const sortedCompetencias = Object.keys(groups).sort()
    const mesesAbreviados: Record<string, string> = {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
      '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
    }

    return sortedCompetencias.map(comp => {
      const parts = comp.split('-')
      const mesAbv = mesesAbreviados[parts[1]] || parts[1]
      const label = `${mesAbv}/${parts[0]}`
      const g = groups[comp]
      const totalGeral = g.totalNovos + g.totalSeminovos
      const economiaLiquida = g.totalSeminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO)

      return {
        mes: comp,
        label,
        totalNovos: g.totalNovos,
        totalSeminovos: g.totalSeminovos,
        totalGeral,
        economiaLiquida,
      }
    })
  }

  try {
    const { data, error } = await supabase.rpc('get_serie_temporal', {
      p_data_inicio: params.dataInicio ?? null,
      p_data_fim: params.dataFim ?? null,
      p_almoxarifado_id: params.almoxarifadoId ?? null,
      p_setor_id: params.setorId ?? null,
      p_item_id: params.itemId ?? null,
    })
    if (!error && data) {
      return (data as Record<string, unknown>[]).map(r => ({
        mes: String(r.mes ?? ''),
        label: String(r.mes ?? '').slice(0, 7),
        totalNovos: Number(r.total_novos ?? 0),
        totalSeminovos: Number(r.total_seminovos ?? 0),
        totalGeral: Number(r.total_geral ?? 0),
        economiaLiquida: Number(r.economia_mes ?? 0),
      }))
    }
  } catch { /* fallback */ }

  // Fallback manual
  const { data: rows } = await buildQuery(params)
  if (!rows) return []

  const byMes: Record<string, { novos: number; seminovos: number }> = {}
  for (const r of rows as Record<string, unknown>[]) {
    const mes = String(r.competencia ?? '').slice(0, 7)
    if (!byMes[mes]) byMes[mes] = { novos: 0, seminovos: 0 }
    const qtd = Number(r.quantidade ?? 0)
    if (r.tipo === 'NOVO') byMes[mes].novos += qtd
    else if (r.tipo === 'SEMINOVO') byMes[mes].seminovos += qtd
  }

  return Object.entries(byMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({
      mes: `${mes}-01`,
      label: mes,
      totalNovos: v.novos,
      totalSeminovos: v.seminovos,
      totalGeral: v.novos + v.seminovos,
      economiaLiquida: v.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
    }))
}

// ─── getResumoPorSetor ────────────────────────────────────────────────────────
export async function getResumoPorSetor(params: DashParams): Promise<ResumoPorSetor[]> {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
    const data = getFilteredSeedData(params)
    const groups: Record<string, { novos: number; seminovos: number }> = {}
    let grandTotal = 0

    for (const d of data) {
      if (!groups[d.setor]) {
        groups[d.setor] = { novos: 0, seminovos: 0 }
      }
      groups[d.setor].novos += d.novos
      groups[d.setor].seminovos += d.seminovos
      grandTotal += d.novos + d.seminovos
    }

    return Object.keys(groups)
      .map(setorNome => {
        const g = groups[setorNome]
        const totalGeral = g.novos + g.seminovos
        return {
          setorId: setorNome,
          setorNome,
          totalNovos: g.novos,
          totalSeminovos: g.seminovos,
          totalGeral,
          economiaLiquida: g.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
          percentualDoTotal: grandTotal > 0 ? (totalGeral / grandTotal) * 100 : 0,
        }
      })
      .sort((a, b) => b.totalGeral - a.totalGeral)
  }

  const { data: rows } = await buildQuery(params)
  if (!rows) return []

  const bySetor: Record<string, { id: string; nome: string; novos: number; seminovos: number }> = {}
  for (const r of rows as Record<string, unknown>[]) {
    const setorId = String(r.setor_id ?? '')
    const setores = r.setores as Record<string, unknown> | null
    const setorNome = String(setores?.nome ?? setorId)
    if (!bySetor[setorId]) bySetor[setorId] = { id: setorId, nome: setorNome, novos: 0, seminovos: 0 }
    const qtd = Number(r.quantidade ?? 0)
    if (r.tipo === 'NOVO') bySetor[setorId].novos += qtd
    else if (r.tipo === 'SEMINOVO') bySetor[setorId].seminovos += qtd
  }

  const total = Object.values(bySetor).reduce((s, v) => s + v.novos + v.seminovos, 0)

  return Object.values(bySetor)
    .map(v => ({
      setorId: v.id,
      setorNome: v.nome,
      totalNovos: v.novos,
      totalSeminovos: v.seminovos,
      totalGeral: v.novos + v.seminovos,
      economiaLiquida: v.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
      percentualDoTotal: total > 0 ? ((v.novos + v.seminovos) / total) * 100 : 0,
    }))
    .sort((a, b) => b.totalGeral - a.totalGeral)
}

// ─── getResumoPorItem ─────────────────────────────────────────────────────────
export async function getResumoPorItem(params: DashParams, limit = 10): Promise<ResumoPorItem[]> {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
    const data = getFilteredSeedData(params)
    const groups: Record<string, { novos: number; seminovos: number }> = {}
    let grandTotal = 0

    for (const d of data) {
      if (!groups[d.item]) {
        groups[d.item] = { novos: 0, seminovos: 0 }
      }
      groups[d.item].novos += d.novos
      groups[d.item].seminovos += d.seminovos
      grandTotal += d.novos + d.seminovos
    }

    return Object.keys(groups)
      .map(itemNome => {
        const g = groups[itemNome]
        const totalGeral = g.novos + g.seminovos
        return {
          itemId: itemNome,
          itemNome,
          itemUnidade: 'peça',
          totalNovos: g.novos,
          totalSeminovos: g.seminovos,
          totalGeral,
          economiaLiquida: g.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
          percentualDoTotal: grandTotal > 0 ? (totalGeral / grandTotal) * 100 : 0,
        }
      })
      .sort((a, b) => b.totalGeral - a.totalGeral)
      .slice(0, limit)
  }

  const { data: rows } = await buildQuery(params)
  if (!rows) return []

  const byItem: Record<string, { id: string; nome: string; unidade: string; novos: number; seminovos: number }> = {}
  for (const r of rows as Record<string, unknown>[]) {
    const itemId = String(r.item_id ?? '')
    const itens = r.itens as Record<string, unknown> | null
    const itemNome = String(itens?.nome ?? itemId)
    const unidade = String(itens?.unidade ?? 'peça')
    if (!byItem[itemId]) byItem[itemId] = { id: itemId, nome: itemNome, unidade, novos: 0, seminovos: 0 }
    const qtd = Number(r.quantidade ?? 0)
    if (r.tipo === 'NOVO') byItem[itemId].novos += qtd
    else if (r.tipo === 'SEMINOVO') byItem[itemId].seminovos += qtd
  }

  const total = Object.values(byItem).reduce((s, v) => s + v.novos + v.seminovos, 0)

  return Object.values(byItem)
    .map(v => ({
      itemId: v.id,
      itemNome: v.nome,
      itemUnidade: v.unidade,
      totalNovos: v.novos,
      totalSeminovos: v.seminovos,
      totalGeral: v.novos + v.seminovos,
      economiaLiquida: v.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
      percentualDoTotal: total > 0 ? ((v.novos + v.seminovos) / total) * 100 : 0,
    }))
    .sort((a, b) => b.totalGeral - a.totalGeral)
    .slice(0, limit)
}

// ─── getResumoPorAlmoxarifado ─────────────────────────────────────────────────
export async function getResumoPorAlmoxarifado(params: DashParams): Promise<ResumoPorAlmoxarifado[]> {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
    const data = getFilteredSeedData(params)
    let grandTotal = 0
    const almoxMock: Record<string, { id: string; nome: string; novos: number; seminovos: number }> = {
      'vp': { id: 'vp', nome: 'Vila Prudente', novos: 0, seminovos: 0 },
      'vg': { id: 'vg', nome: 'Vila Guarani', novos: 0, seminovos: 0 },
      'spb': { id: 'spb', nome: 'Sapopemba', novos: 0, seminovos: 0 },
      'cnd': { id: 'cnd', nome: 'Canindé', novos: 0, seminovos: 0 },
    }

    data.forEach((d) => {
      grandTotal += d.novos + d.seminovos
      almoxMock['vp'].novos += Math.round(d.novos * 0.55)
      almoxMock['vp'].seminovos += Math.round(d.seminovos * 0.50)

      almoxMock['vg'].novos += Math.round(d.novos * 0.25)
      almoxMock['vg'].seminovos += Math.round(d.seminovos * 0.30)

      almoxMock['spb'].novos += Math.round(d.novos * 0.12)
      almoxMock['spb'].seminovos += Math.round(d.seminovos * 0.12)

      almoxMock['cnd'].novos += Math.round(d.novos * 0.08)
      almoxMock['cnd'].seminovos += Math.round(d.seminovos * 0.08)
    })

    return Object.values(almoxMock).map(v => ({
      almoxarifadoId: v.id,
      almoxarifadoNome: v.nome,
      totalNovos: v.novos,
      totalSeminovos: v.seminovos,
      totalGeral: v.novos + v.seminovos,
      economiaLiquida: v.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
      percentualDoTotal: grandTotal > 0 ? ((v.novos + v.seminovos) / grandTotal) * 100 : 0,
    }))
  }

  const { data: rows } = await buildQuery(params)
  if (!rows) return []

  const byAlmox: Record<string, { id: string; nome: string; novos: number; seminovos: number }> = {}
  for (const r of rows as Record<string, unknown>[]) {
    const almId = String(r.almoxarifado_id ?? 'geral')
    const almox = r.almoxarifados as Record<string, unknown> | null
    const almNome = String(almox?.nome ?? 'Geral')
    if (!byAlmox[almId]) byAlmox[almId] = { id: almId, nome: almNome, novos: 0, seminovos: 0 }
    const qtd = Number(r.quantidade ?? 0)
    if (r.tipo === 'NOVO') byAlmox[almId].novos += qtd
    else if (r.tipo === 'SEMINOVO') byAlmox[almId].seminovos += qtd
  }

  const total = Object.values(byAlmox).reduce((s, v) => s + v.novos + v.seminovos, 0)

  return Object.values(byAlmox)
    .map(v => ({
      almoxarifadoId: v.id,
      almoxarifadoNome: v.nome,
      totalNovos: v.novos,
      totalSeminovos: v.seminovos,
      totalGeral: v.novos + v.seminovos,
      economiaLiquida: v.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
      percentualDoTotal: total > 0 ? ((v.novos + v.seminovos) / total) * 100 : 0,
    }))
    .sort((a, b) => b.totalGeral - a.totalGeral)
}

// ─── getTabelaAnalitica ───────────────────────────────────────────────────────
export async function getTabelaAnalitica(
  params: DashParams,
  page = 1,
  limit = 15
): Promise<{ data: TabelaAnaliticaRow[]; count: number }> {
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock-project')) {
    const data = getFilteredSeedData(params)
    const sorted = [...data].sort((a, b) => b.competencia.localeCompare(a.competencia))
    const mapped: TabelaAnaliticaRow[] = sorted.map(d => ({
      competencia: d.competencia,
      almoxarifadoNome: 'Vila Prudente',
      setorNome: d.setor,
      itemNome: d.item,
      totalNovos: d.novos,
      totalSeminovos: d.seminovos,
      valorNovo: CUSTO_PADRAO_NOVO,
      valorSeminovo: CUSTO_PADRAO_SEMINOVO,
      economiaLiquida: d.seminovos * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO),
      fonteCusto: 'padrao'
    }))

    return {
      data: mapped.slice((page - 1) * limit, page * limit),
      count: mapped.length
    }
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  let q = supabase
    .from('saidas_itens')
    .select(`
      competencia, tipo, quantidade, almoxarifado_id, setor_id, item_id,
      almoxarifados!left(nome),
      setores!inner(nome),
      itens!inner(nome)
    `, { count: 'exact' })
    .order('competencia', { ascending: false })
    .range(from, to)

  if (params.dataInicio)     q = q.gte('competencia', params.dataInicio)
  if (params.dataFim)        q = q.lte('competencia', params.dataFim)
  if (params.almoxarifadoId) q = q.eq('almoxarifado_id', params.almoxarifadoId)
  if (params.setorId)        q = q.eq('setor_id', params.setorId)
  if (params.itemId)         q = q.eq('item_id', params.itemId)
  if (params.tipo)           q = q.eq('tipo', params.tipo)

  const { data: rows, count } = await q

  const result: TabelaAnaliticaRow[] = (rows ?? []).map(r => {
    const row = r as Record<string, unknown>
    const qtd = Number(row.quantidade ?? 0)
    const isSeminovo = row.tipo === 'SEMINOVO'
    return {
      competencia: String(row.competencia ?? ''),
      almoxarifadoNome: String((row.almoxarifados as Record<string,unknown>)?.nome ?? 'Geral'),
      setorNome: String((row.setores as Record<string,unknown>)?.nome ?? ''),
      itemNome: String((row.itens as Record<string,unknown>)?.nome ?? ''),
      totalNovos: isSeminovo ? 0 : qtd,
      totalSeminovos: isSeminovo ? qtd : 0,
      valorNovo: CUSTO_PADRAO_NOVO,
      valorSeminovo: CUSTO_PADRAO_SEMINOVO,
      economiaLiquida: isSeminovo ? qtd * (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO) : 0,
      fonteCusto: 'padrao',
    }
  })

  return { data: result, count: count ?? 0 }
}
