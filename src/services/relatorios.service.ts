import * as XLSX from 'xlsx'
import { supabase } from '@/services/supabase'

interface FiltrosRelatorio {
  dataInicio?: string
  dataFim?: string
  almoxarifadoId?: string
  setorId?: string
  itemId?: string
}

// ─── Exportadores ────────────────────────────────────────────────────────────
export function exportarExcel(dados: object[], nomeArquivo: string, sheetName = 'Dados'): void {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(dados)
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const nomeComExtensao = nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`
  XLSX.writeFile(workbook, nomeComExtensao)
}

export function exportarCSV(dados: object[], nomeArquivo: string): void {
  if (dados.length === 0) return

  const cabecalho = Object.keys(dados[0]).join(';')
  const linhas = dados.map((row) =>
    Object.values(row)
      .map((v) => {
        const str = String(v ?? '')
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      })
      .join(';')
  )

  const csv = [cabecalho, ...linhas].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── Helper de busca de custos ───────────────────────────────────────────────
async function fetchCustosMap() {
  const { data } = await supabase
    .from('custos_mensais_itens')
    .select('*')
    .eq('ativo', true)
  return data ?? []
}

function getCustoRow(custos: any[], competencia: string, itemId: string, almoxarifadoId?: string) {
  const compDate = competencia.slice(0, 10)
  
  if (almoxarifadoId) {
    const c = custos.find(x => x.competencia === compDate && x.item_id === itemId && x.almoxarifado_id === almoxarifadoId)
    if (c) return { novo: Number(c.valor_medio_novo), seminovo: Number(c.valor_medio_seminovo), fonte: 'item+almoxarifado' }
  }

  const c2 = custos.find(x => x.competencia === compDate && x.item_id === itemId && !x.almoxarifado_id)
  if (c2) return { novo: Number(c2.valor_medio_novo), seminovo: Number(c2.valor_medio_seminovo), fonte: 'item' }

  const c3 = custos.find(x => x.competencia === compDate && !x.item_id && !x.almoxarifado_id)
  if (c3) return { novo: Number(c3.valor_medio_novo), seminovo: Number(c3.valor_medio_seminovo), fonte: 'geral' }

  return { novo: 40.00, seminovo: 4.00, fonte: 'padrao' }
}

// ─── 1. Saídas por período ───────────────────────────────────────────────────
export async function getSaidasPorPeriodo(filtros: FiltrosRelatorio = {}): Promise<object[]> {
  let query = supabase
    .from('saidas_itens')
    .select(`
      competencia, periodo_texto, tipo, quantidade, observacao,
      almoxarifados(nome), setores(nome), itens(nome, id)
    `)
    .order('competencia', { ascending: true })

  if (filtros.dataInicio) query = query.gte('competencia', filtros.dataInicio)
  if (filtros.dataFim)    query = query.lte('competencia', filtros.dataFim)
  if (filtros.almoxarifadoId) query = query.eq('almoxarifado_id', filtros.almoxarifadoId)
  if (filtros.setorId)    query = query.eq('setor_id', filtros.setorId)
  if (filtros.itemId)     query = query.eq('item_id', filtros.itemId)

  const [saidasRes, custos] = await Promise.all([query, fetchCustosMap()])
  if (saidasRes.error) return []

  return (saidasRes.data ?? []).map((row: any) => {
    const cost = getCustoRow(custos, row.competencia, row.itens?.id, row.almoxarifado_id)
    const isSeminovo = row.tipo === 'SEMINOVO'
    const valorUnit = isSeminovo ? cost.seminovo : cost.novo
    
    return {
      'Competência': row.competencia,
      'Período Texto': row.periodo_texto ?? '',
      'Almoxarifado': row.almoxarifados?.nome ?? 'Geral',
      'Setor': row.setores?.nome ?? '',
      'Item': row.itens?.nome ?? '',
      'Tipo': row.tipo,
      'Quantidade': row.quantidade,
      'Valor Unitário (R$)': valorUnit,
      'Custo Total (R$)': row.quantidade * valorUnit,
      'Observação': row.observacao ?? '',
    }
  })
}

// ─── 2. Comparativo Novos x Seminovos ────────────────────────────────────────
export async function getComparativoNovosSeminovos(filtros: FiltrosRelatorio = {}): Promise<object[]> {
  let query = supabase
    .from('saidas_itens')
    .select(`competencia, tipo, quantidade`)
    .order('competencia', { ascending: true })

  if (filtros.dataInicio) query = query.gte('competencia', filtros.dataInicio)
  if (filtros.dataFim)    query = query.lte('competencia', filtros.dataFim)
  if (filtros.almoxarifadoId) query = query.eq('almoxarifado_id', filtros.almoxarifadoId)

  const { data, error } = await query
  if (error) return []

  const mapa = new Map<string, { competencia: string; qtdNovo: number; qtdSeminovo: number }>()

  for (const row of data ?? []) {
    const r = row as any
    const comp = r.competencia.slice(0, 7)
    if (!mapa.has(comp)) {
      mapa.set(comp, { competencia: comp, qtdNovo: 0, qtdSeminovo: 0 })
    }
    const entry = mapa.get(comp)!
    if (r.tipo === 'NOVO') {
      entry.qtdNovo += Number(r.quantidade ?? 0)
    } else {
      entry.qtdSeminovo += Number(r.quantidade ?? 0)
    }
  }

  return Array.from(mapa.values())
    .sort((a, b) => a.competencia.localeCompare(b.competencia))
    .map((e) => ({
      'Competência': e.competencia,
      'Qtd Novos': e.qtdNovo,
      'Qtd Seminovos': e.qtdSeminovo,
      'Total': e.qtdNovo + e.qtdSeminovo,
      '% Seminovos': e.qtdNovo + e.qtdSeminovo > 0 ? ((e.qtdSeminovo / (e.qtdNovo + e.qtdSeminovo)) * 100).toFixed(2) + '%' : '0%',
    }))
}

// ─── 3. Economia estimada por mês ───────────────────────────────────────────
export async function getEconomiaPorMes(filtros: FiltrosRelatorio = {}): Promise<object[]> {
  let query = supabase
    .from('saidas_itens')
    .select(`competencia, tipo, quantidade, item_id, almoxarifado_id`)
    .order('competencia', { ascending: true })

  if (filtros.dataInicio) query = query.gte('competencia', filtros.dataInicio)
  if (filtros.dataFim)    query = query.lte('competencia', filtros.dataFim)
  if (filtros.almoxarifadoId) query = query.eq('almoxarifado_id', filtros.almoxarifadoId)

  const [saidasRes, custos] = await Promise.all([query, fetchCustosMap()])
  if (saidasRes.error) return []

  const mapa = new Map<string, { competencia: string; custoEvitadoBruto: number; custoSeminovo: number; economiaLiquida: number }>()

  for (const row of saidasRes.data ?? []) {
    const r = row as any
    if (r.tipo !== 'SEMINOVO') continue
    
    const comp = r.competencia.slice(0, 7)
    const cost = getCustoRow(custos, r.competencia, r.item_id, r.almoxarifado_id)
    const qtd = Number(r.quantidade ?? 0)
    
    const evitado = qtd * cost.novo
    const real = qtd * cost.seminovo
    const economia = evitado - real

    if (!mapa.has(comp)) {
      mapa.set(comp, { competencia: comp, custoEvitadoBruto: 0, custoSeminovo: 0, economiaLiquida: 0 })
    }

    const entry = mapa.get(comp)!
    entry.custoEvitadoBruto += evitado
    entry.custoSeminovo += real
    entry.economiaLiquida += economia
  }

  return Array.from(mapa.values())
    .sort((a, b) => a.competencia.localeCompare(b.competencia))
    .map((e) => ({
      'Competência': e.competencia,
      'Custo Evitado Bruto (R$)': e.custoEvitadoBruto.toFixed(2),
      'Custo Seminovos Real (R$)': e.custoSeminovo.toFixed(2),
      'Economia Líquida (R$)': e.economiaLiquida.toFixed(2),
    }))
}

// ─── 4. Economia estimada por setor ─────────────────────────────────────────
export async function getEconomiaPorSetor(filtros: FiltrosRelatorio = {}): Promise<object[]> {
  let query = supabase
    .from('saidas_itens')
    .select(`competencia, tipo, quantidade, item_id, almoxarifado_id, setores(nome)`)

  if (filtros.dataInicio) query = query.gte('competencia', filtros.dataInicio)
  if (filtros.dataFim)    query = query.lte('competencia', filtros.dataFim)
  if (filtros.almoxarifadoId) query = query.eq('almoxarifado_id', filtros.almoxarifadoId)

  const [saidasRes, custos] = await Promise.all([query, fetchCustosMap()])
  if (saidasRes.error) return []

  const mapa = new Map<string, { setor: string; custoEvitadoBruto: number; custoSeminovo: number; economiaLiquida: number }>()

  for (const row of saidasRes.data ?? []) {
    const r = row as any
    if (r.tipo !== 'SEMINOVO') continue

    const setor = r.setores?.nome ?? 'Sem Setor'
    const cost = getCustoRow(custos, r.competencia, r.item_id, r.almoxarifado_id)
    const qtd = Number(r.quantidade ?? 0)

    const evitado = qtd * cost.novo
    const real = qtd * cost.seminovo
    const economia = evitado - real

    if (!mapa.has(setor)) {
      mapa.set(setor, { setor, custoEvitadoBruto: 0, custoSeminovo: 0, economiaLiquida: 0 })
    }

    const entry = mapa.get(setor)!
    entry.custoEvitadoBruto += evitado
    entry.custoSeminovo += real
    entry.economiaLiquida += economia
  }

  return Array.from(mapa.values())
    .sort((a, b) => b.economiaLiquida - a.economiaLiquida)
    .map((e) => ({
      'Setor': e.setor,
      'Custo Evitado Bruto (R$)': e.custoEvitadoBruto.toFixed(2),
      'Custo Seminovos Real (R$)': e.custoSeminovo.toFixed(2),
      'Economia Líquida (R$)': e.economiaLiquida.toFixed(2),
    }))
}

// ─── 5. Economia estimada por almoxarifado ──────────────────────────────────
export async function getEconomiaPorAlmoxarifado(filtros: FiltrosRelatorio = {}): Promise<object[]> {
  let query = supabase
    .from('saidas_itens')
    .select(`competencia, tipo, quantidade, item_id, almoxarifado_id, almoxarifados(nome)`)

  if (filtros.dataInicio) query = query.gte('competencia', filtros.dataInicio)
  if (filtros.dataFim)    query = query.lte('competencia', filtros.dataFim)

  const [saidasRes, custos] = await Promise.all([query, fetchCustosMap()])
  if (saidasRes.error) return []

  const mapa = new Map<string, { almoxarifado: string; custoEvitadoBruto: number; custoSeminovo: number; economiaLiquida: number }>()

  for (const row of saidasRes.data ?? []) {
    const r = row as any
    if (r.tipo !== 'SEMINOVO') continue

    const almox = r.almoxarifados?.nome ?? 'Geral'
    const cost = getCustoRow(custos, r.competencia, r.item_id, r.almoxarifado_id)
    const qtd = Number(r.quantidade ?? 0)

    const evitado = qtd * cost.novo
    const real = qtd * cost.seminovo
    const economia = evitado - real

    if (!mapa.has(almox)) {
      mapa.set(almox, { almoxarifado: almox, custoEvitadoBruto: 0, custoSeminovo: 0, economiaLiquida: 0 })
    }

    const entry = mapa.get(almox)!
    entry.custoEvitadoBruto += evitado
    entry.custoSeminovo += real
    entry.economiaLiquida += economia
  }

  return Array.from(mapa.values())
    .sort((a, b) => b.economiaLiquida - a.economiaLiquida)
    .map((e) => ({
      'Almoxarifado': e.almoxarifado,
      'Custo Evitado Bruto (R$)': e.custoEvitadoBruto.toFixed(2),
      'Custo Seminovos Real (R$)': e.custoSeminovo.toFixed(2),
      'Economia Líquida (R$)': e.economiaLiquida.toFixed(2),
    }))
}

// ─── 6. Itens sem custo específico cadastrado ────────────────────────────────
export async function getItensSemCusto(_filtros: FiltrosRelatorio = {}): Promise<object[]> {
  const { data: saidas } = await supabase
    .from('saidas_itens')
    .select('competencia, item_id, quantidade, itens(nome)')
    .eq('tipo', 'SEMINOVO')

  const custos = await fetchCustosMap()
  if (!saidas) return []

  const itemsMap = new Map<string, { item: string; competencia: string; totalSaidas: number }>()

  for (const row of saidas) {
    const r = row as any
    const comp = r.competencia.slice(0, 7)
    
    // Verifica se tem custo específico para esse item na competência
    const temCusto = custos.some(c => 
      c.item_id === r.item_id && 
      c.competencia.slice(0,7) === comp &&
      c.ativo === true
    )

    if (!temCusto) {
      const key = `${r.item_id}-${comp}`
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          item: r.itens?.nome ?? 'Desconhecido',
          competencia: comp,
          totalSaidas: 0
        })
      }
      itemsMap.get(key)!.totalSaidas += Number(r.quantidade ?? 0)
    }
  }

  return Array.from(itemsMap.values())
    .sort((a, b) => a.competencia.localeCompare(b.competencia))
    .map(e => ({
      'Item': e.item,
      'Competência Ausente': e.competencia,
      'Saídas no Período': e.totalSaidas,
      'Aviso': 'Utilizando fallback de R$ 40,00 Novo e R$ 4,00 Seminovo'
    }))
}

// ─── 7. Histórico de importações ─────────────────────────────────────────────
export async function getHistoricoImportacoes(_filtros: any = {}): Promise<object[]> {
  const { data, error } = await supabase
    .from('lotes_importacao')
    .select('nome_arquivo, created_at, total_linhas_lidas, total_qtd_novo, total_qtd_seminovo, status, almoxarifados(nome), profiles(nome)')
    .order('created_at', { ascending: false })

  if (error) return []

  return (data ?? []).map((row: any) => ({
    'Nome do Arquivo': row.nome_arquivo,
    'Data de Importação': new Date(row.created_at).toLocaleString('pt-BR'),
    'Almoxarifado': row.almoxarifados?.nome ?? 'Geral',
    'Total de Linhas': row.total_linhas_lidas,
    'Total Novos': row.total_qtd_novo,
    'Total Seminovos': row.total_qtd_seminovo,
    'Status': row.status,
    'Importado Por': row.profiles?.nome ?? 'Sistema',
  }))
}
