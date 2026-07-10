import * as XLSX from 'xlsx'
import type { LoteImportacao, InsertSaidaItem } from '@/types/database'
import { TipoSaida, OrigemSaida } from '@/types/database'
import { supabase } from '@/services/supabase'
import { findOrCreate as findOrCreateSetor } from '@/services/setores.service'
import { findOrCreate as findOrCreateItem, vincularItemSetor } from '@/services/itens.service'
import { createSaidasLote } from '@/services/saidas.service'

// ─────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────
export interface LinhaExcel {
  periodo: string
  setor: string
  item: string
  novos: number
  seminovos: number
  mesAno: string | number
}

export interface ResultadoImportacao {
  totalLinhas: number
  totalNovo: number
  totalSeminovo: number
  totalQtdNovo: number
  totalQtdSeminovo: number
  setoresNovos: string[]
  itensNovos: string[]
  inconsistencias: string[]
  economiaEstimada: number
}

// Colunas obrigatórias esperadas na aba
const COLUNAS_OBRIGATORIAS = ['PERÍODO', 'SETOR', 'ITEM', 'NOVOS', 'SEMINOVOS', 'Mês-Ano']

// ─────────────────────────────────────────────
// normalizarMesAno
// ─────────────────────────────────────────────
export function normalizarMesAno(valor: string | number): string {
  // Serial Excel (número) → data
  if (typeof valor === 'number') {
    // Excel serial: dias desde 1900-01-01 (com bug de 1900 como bissexto)
    const date = new Date(Date.UTC(1899, 11, 30) + valor * 86400000)
    const ano = date.getUTCFullYear()
    const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
    return `${ano}-${mes}-01`
  }

  const str = String(valor).trim()

  // Formato "YYYY-MM" ou "YYYY-MM-DD"
  const matchISO = str.match(/^(\d{4})-(\d{2})/)
  if (matchISO) {
    return `${matchISO[1]}-${matchISO[2]}-01`
  }

  // Formato "MM/YYYY"
  const matchMMAAAA = str.match(/^(\d{2})\/(\d{4})$/)
  if (matchMMAAAA) {
    return `${matchMMAAAA[2]}-${matchMMAAAA[1]}-01`
  }

  // Formato "jan/2024", "Jun/2026", "jan/24", etc.
  const mesesPT: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  }
  const mesesEN: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }

  const matchMesAno = str.match(/^([a-zA-ZÀ-ú]+)[./-]?(\d{2,4})$/i)
  if (matchMesAno) {
    const nomeMes = matchMesAno[1].toLowerCase().substring(0, 3)
    let anoStr = matchMesAno[2]
    if (anoStr.length === 2) {
      anoStr = parseInt(anoStr) > 50 ? `19${anoStr}` : `20${anoStr}`
    }
    const numMes = mesesPT[nomeMes] ?? mesesEN[nomeMes]
    if (numMes) {
      return `${anoStr}-${numMes}-01`
    }
  }

  throw new Error(`Formato de Mês-Ano não reconhecido: "${str}"`)
}

// ─────────────────────────────────────────────
// parseExcel
// ─────────────────────────────────────────────
export async function parseExcel(file: File): Promise<LinhaExcel[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })

  const nomesAbas = workbook.SheetNames
  const abaAlvo = nomesAbas.find(
    (n) => n.toLowerCase().replace(/\s/g, '') === 'tblseminovos'
  )

  if (!abaAlvo) {
    throw new Error(
      `Aba "tblSeminovos" não encontrada. Abas disponíveis: ${nomesAbas.join(', ')}`
    )
  }

  const sheet = workbook.Sheets[abaAlvo]
  const linhas = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
    defval: '',
    raw: true,
  })

  if (linhas.length === 0) {
    throw new Error('A planilha está vazia ou não possui dados.')
  }

  // Valida colunas obrigatórias
  const cabecalho = Object.keys(linhas[0])
  const colunasFaltando = COLUNAS_OBRIGATORIAS.filter(
    (col) => !cabecalho.some((h) => h.trim().toLowerCase() === col.toLowerCase())
  )

  if (colunasFaltando.length > 0) {
    throw new Error(
      `Colunas obrigatórias não encontradas: ${colunasFaltando.join(', ')}. ` +
        `Colunas presentes: ${cabecalho.join(', ')}`
    )
  }

  // Normaliza e mapeia
  const resultado: LinhaExcel[] = linhas
    .filter((linha) => {
      const setor = String(linha['SETOR'] ?? '').trim()
      const item = String(linha['ITEM'] ?? '').trim()
      return setor !== '' && item !== ''
    })
    .map((linha) => ({
      periodo: String(linha['PERÍODO'] ?? linha['PERIODO'] ?? '').trim(),
      setor: String(linha['SETOR'] ?? '').trim(),
      item: String(linha['ITEM'] ?? '').trim(),
      novos: Number(linha['NOVOS'] ?? 0),
      seminovos: Number(linha['SEMINOVOS'] ?? 0),
      mesAno: linha['Mês-Ano'] ?? linha['Mes-Ano'] ?? linha['MES-ANO'] ?? '',
    }))

  return resultado
}

// ─────────────────────────────────────────────
// gerarPreview
// ─────────────────────────────────────────────
export async function gerarPreview(
  linhas: LinhaExcel[],
  _almoxarifadoId: string
): Promise<ResultadoImportacao> {
  const inconsistencias: string[] = []
  let totalNovo = 0
  let totalSeminovo = 0
  let totalQtdNovo = 0
  let totalQtdSeminovo = 0
  const setoresVistosNomes = new Set<string>()
  const itensVistosNomes = new Set<string>()

  // Busca nomes existentes
  const { data: setoresExistentes } = await supabase.from('setores').select('nome')
  const { data: itensExistentes } = await supabase.from('itens').select('nome')

  const setoresExistentesSet = new Set(
    (setoresExistentes ?? []).map((s) => s.nome.toLowerCase())
  )
  const itensExistentesSet = new Set(
    (itensExistentes ?? []).map((i) => i.nome.toLowerCase())
  )

  const setoresNovos: string[] = []
  const itensNovos: string[] = []

  linhas.forEach((linha, idx) => {
    const num = idx + 2 // +2 porque linha 1 é cabeçalho

    if (!linha.setor) {
      inconsistencias.push(`Linha ${num}: setor vazio.`)
    }
    if (!linha.item) {
      inconsistencias.push(`Linha ${num}: item vazio.`)
    }
    if (linha.novos < 0) {
      inconsistencias.push(`Linha ${num}: quantidade de novos negativa (${linha.novos}).`)
    }
    if (linha.seminovos < 0) {
      inconsistencias.push(`Linha ${num}: quantidade de seminovos negativa (${linha.seminovos}).`)
    }

    try {
      normalizarMesAno(linha.mesAno)
    } catch {
      inconsistencias.push(`Linha ${num}: data inválida (${linha.mesAno}).`)
    }

    // Totais
    totalQtdNovo += Math.max(0, linha.novos)
    totalQtdSeminovo += Math.max(0, linha.seminovos)
    if (linha.novos > 0) totalNovo++
    if (linha.seminovos > 0) totalSeminovo++

    // Novos setores e itens
    if (linha.setor && !setoresVistosNomes.has(linha.setor.toLowerCase())) {
      setoresVistosNomes.add(linha.setor.toLowerCase())
      if (!setoresExistentesSet.has(linha.setor.toLowerCase())) {
        setoresNovos.push(linha.setor)
      }
    }
    if (linha.item && !itensVistosNomes.has(linha.item.toLowerCase())) {
      itensVistosNomes.add(linha.item.toLowerCase())
      if (!itensExistentesSet.has(linha.item.toLowerCase())) {
        itensNovos.push(linha.item)
      }
    }
  })

  // Economia estimada: qtd seminovos * 36 (diferença média padrão por unidade)
  const economiaEstimada = totalQtdSeminovo * 36

  return {
    totalLinhas: linhas.length,
    totalNovo,
    totalSeminovo,
    totalQtdNovo,
    totalQtdSeminovo,
    setoresNovos,
    itensNovos,
    inconsistencias,
    economiaEstimada,
  }
}

// ─────────────────────────────────────────────
// confirmarImportacao
// ─────────────────────────────────────────────
export async function confirmarImportacao(
  linhas: LinhaExcel[],
  almoxarifadoId: string,
  userId: string,
  nomeArquivo: string
): Promise<{ loteId: string; error?: string }> {
  // 1. Cria lote com status PROCESSANDO
  const { data: lote, error: erroLote } = await supabase
    .from('lotes_importacao')
    .insert({
      nome_arquivo: nomeArquivo,
      almoxarifado_id: almoxarifadoId,
      usuario_id: userId,
      status: 'PROCESSANDO',
      total_linhas: linhas.length,
    })
    .select()
    .single()

  if (erroLote || !lote) {
    return { loteId: '', error: 'Erro ao criar lote de importação: ' + erroLote?.message }
  }

  const loteId = (lote as Record<string, string>)['id']

  try {
    const saidas: InsertSaidaItem[] = []
    let totalNovo = 0
    let totalSeminovo = 0

    for (const linha of linhas) {
      const dataSaida = normalizarMesAno(linha.mesAno)

      // Upsert setor
      const { setor } = await findOrCreateSetor(linha.setor)

      // Upsert item
      const { item } = await findOrCreateItem(linha.item)

      // Vincula item ao setor
      await vincularItemSetor(item.id, setor.id)

      // Gera saída NOVO
      if (linha.novos > 0) {
        saidas.push({
          competencia: dataSaida,
          periodo_texto: linha.periodo || null,
          almoxarifado_id: almoxarifadoId,
          setor_id: setor.id,
          item_id: item.id,
          tipo: TipoSaida.NOVO,
          quantidade: linha.novos,
          observacao: null,
          origem: OrigemSaida.IMPORTACAO,
          lote_importacao_id: loteId,
          created_by: userId,
        })
        totalNovo += linha.novos
      }

      // Gera saída SEMINOVO
      if (linha.seminovos > 0) {
        saidas.push({
          competencia: dataSaida,
          periodo_texto: linha.periodo || null,
          almoxarifado_id: almoxarifadoId,
          setor_id: setor.id,
          item_id: item.id,
          tipo: TipoSaida.SEMINOVO,
          quantidade: linha.seminovos,
          observacao: null,
          origem: OrigemSaida.IMPORTACAO,
          lote_importacao_id: loteId,
          created_by: userId,
        })
        totalSeminovo += linha.seminovos
      }
    }

    // Insere saídas em lote (chunks de 500)
    const chunkSize = 500
    for (let i = 0; i < saidas.length; i += chunkSize) {
      const chunk = saidas.slice(i, i + chunkSize)
      const { error: erroSaidas } = await createSaidasLote(chunk)
      if (erroSaidas) throw new Error(erroSaidas)
    }

    // Atualiza lote como CONCLUIDO
    await supabase
      .from('lotes_importacao')
      .update({
        status: 'CONCLUIDO',
        total_novo: totalNovo,
        total_seminovo: totalSeminovo,
        concluido_em: new Date().toISOString(),
      })
      .eq('id', loteId)

    return { loteId }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro desconhecido na importação'

    // Atualiza lote com status ERRO
    await supabase
      .from('lotes_importacao')
      .update({ status: 'ERRO', erro_mensagem: mensagem })
      .eq('id', loteId)

    return { loteId, error: mensagem }
  }
}

// ─────────────────────────────────────────────
// verificarDuplicidade
// ─────────────────────────────────────────────
export async function verificarDuplicidade(
  nomeArquivo: string,
  almoxarifadoId: string
): Promise<LoteImportacao[]> {
  const { data, error } = await supabase
    .from('lotes_importacao')
    .select('*')
    .or(`nome_arquivo.eq.${nomeArquivo},almoxarifado_id.eq.${almoxarifadoId}`)
    .neq('status', 'DESFEITO')
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('[importacao] Erro ao verificar duplicidade:', error.message)
    return []
  }

  return (data ?? []) as LoteImportacao[]
}

// ─────────────────────────────────────────────
// desfazerLote
// ─────────────────────────────────────────────
export async function desfazerLote(
  loteId: string,
  userId: string
): Promise<{ data: LoteImportacao | null; error: string | null }> {
  // 1. Deleta saídas vinculadas ao lote
  const { error: erroDelete } = await supabase
    .from('saidas_itens')
    .delete()
    .eq('lote_importacao_id', loteId)

  if (erroDelete) {
    return { data: null, error: 'Erro ao remover saídas do lote: ' + erroDelete.message }
  }

  // 2. Atualiza lote para DESFEITO
  const { data: loteAtualizado, error: erroLote } = await supabase
    .from('lotes_importacao')
    .update({ status: 'DESFEITO', desfeito_por: userId, desfeito_em: new Date().toISOString() })
    .eq('id', loteId)
    .select()
    .single()

  if (erroLote) {
    return { data: null, error: 'Erro ao atualizar status do lote: ' + erroLote.message }
  }

  Promise.resolve(
    supabase.rpc('registrar_auditoria', {
      p_usuario_id: userId,
      p_acao: 'DESFAZER_LOTE',
      p_tabela: 'lotes_importacao',
      p_registro_id: loteId,
      p_dados_anteriores: null,
      p_dados_novos: { status: 'DESFEITO' },
    })
  ).catch(console.error)

  return { data: loteAtualizado as LoteImportacao, error: null }
}
