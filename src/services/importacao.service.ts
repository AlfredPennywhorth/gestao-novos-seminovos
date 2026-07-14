import * as XLSX from 'xlsx'
import type { LoteImportacao, InsertSaidaItem, Almoxarifado } from '@/types/database'
import { TipoSaida, OrigemSaida } from '@/types/database'
import { supabase } from '@/services/supabase'
import {
  findOrCreate as findOrCreateSetor,
  normalizarNomeSetor,
  setorExigeReclassificacao,
} from '@/services/setores.service'
import { findOrCreate as findOrCreateItem, vincularItemSetor } from '@/services/itens.service'
import { createSaidasLote } from '@/services/saidas.service'
import classificacaoSetores from '@/data/classificacao-setores.json'

export interface LinhaExcel {
  periodo: string
  setor: string
  codigo: string | null
  item: string
  itemOriginal: string
  tipo: TipoSaida
  quantidade: number
  mesAno: string | number
  almoxarifadoCodigo: string | null
  almoxarifadoNome: string | null
  linhaOrigem: number
}

export interface ResultadoImportacao {
  totalLinhas: number
  totalNovo: number
  totalSeminovo: number
  totalQtdNovo: number
  totalQtdSeminovo: number
  setoresNovos: string[]
  itensNovos: string[]
  almoxarifadosEncontrados: string[]
  inconsistencias: string[]
  avisos: string[]
  codigosNaoClassificados: string[]
  economiaEstimada: number
}

interface ClassificacaoResolvida {
  setor: string
  itemId: string | null
  origem: 'CADASTRO' | 'CATALOGO' | 'OUTROS'
}

const COLUNAS_OBRIGATORIAS_ANTIGO = ['PERÍODO', 'SETOR', 'ITEM', 'NOVOS', 'SEMINOVOS', 'Mês-Ano']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_IMPORT_ROWS = 20_000
const MAX_TEXT_LENGTH = 200
const SETOR_OUTROS = 'OUTROS'
const CLASSIFICACAO_SETORES = classificacaoSetores as Record<string, string>

const ALMOXARIFADO_ALIASES: Record<string, string[]> = {
  VP: ['VP', 'VPR', 'VILA PRUDENTE'],
  SPB: ['SPB', 'SAP', 'SAPOPEMBA'],
  VG: ['VG', 'VGU', 'VILA GUARANI'],
}

const MESES_PT: Record<string, string> = {
  JANEIRO: '01',
  FEVEREIRO: '02',
  MARCO: '03',
  MARÇO: '03',
  ABRIL: '04',
  MAIO: '05',
  JUNHO: '06',
  JULHO: '07',
  AGOSTO: '08',
  SETEMBRO: '09',
  OUTUBRO: '10',
  NOVEMBRO: '11',
  DEZEMBRO: '12',
}

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function removerAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function chaveTexto(valor: string): string {
  return removerAcentos(valor).toUpperCase().replace(/\s+/g, ' ').trim()
}

function parseQuantidade(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return Number.NaN
    return Math.trunc(valor)
  }

  const texto = String(valor).trim().replace(/\./g, '').replace(',', '.')
  if (!texto) return 0
  const numero = Number(texto)
  if (!Number.isFinite(numero) || numero < 0) return Number.NaN
  return Math.trunc(numero)
}

function normalizarCodigo(valor: unknown): string | null {
  const codigo = normalizarTexto(valor).toUpperCase()
  return codigo || null
}

function normalizarSetor(valor: unknown): string {
  return normalizarTexto(valor)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function sanitizarNomeItem(nomeOriginal: string, setor: string): string {
  let nome = normalizarTexto(nomeOriginal).toUpperCase()
  const setorBase = chaveTexto(setor)

  const palavrasSetor = setorBase
    .split(' ')
    .filter((p) => p.length >= 4 && !['ADULTO', 'ADULTA', 'INFANTIL'].includes(p))

  for (const palavra of palavrasSetor) {
    nome = nome.replace(new RegExp(`\\b${palavra}\\b`, 'gi'), ' ')
  }

  nome = nome
    .replace(/\b(FEM|MASC|FEMININO|MASCULINO|ADULTO|ADULTA|INFANTIL)\b\.?/gi, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\bN[º°]?\s*\d+\b/gi, ' ')
    .replace(/\bA PARTIR DO\b/gi, ' ')
    .replace(/[.;:]+$/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()

  return nome || normalizarTexto(nomeOriginal).toUpperCase()
}

function validarArquivo(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('A planilha excede o limite de 10 MB.')
  }
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error('Formato inválido. Selecione um arquivo .xlsx ou .xls.')
  }
}

function extrairCompetenciaDoArquivo(workbook: XLSX.WorkBook, nomeArquivo: string): string {
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: true,
    })

    for (const row of rows.slice(0, 15)) {
      for (const cell of row) {
        const texto = normalizarTexto(cell)
        const matchPeriodo = texto.match(/Per[ií]odo:\s*\d{1,2}\/(\d{1,2})(?:\/\d{2,4})?\s*a\s*\d{1,2}\/(\d{1,2})\/(\d{2,4})/i)
        if (matchPeriodo) {
          const mes = matchPeriodo[2].padStart(2, '0')
          const anoRaw = matchPeriodo[3]
          const ano = anoRaw.length === 2 ? `20${anoRaw}` : anoRaw
          return `${ano}-${mes}-01`
        }

        const matchMesAno = texto.match(/Per[ií]odo:.*?(\d{1,2})\/(\d{2,4})/i)
        if (matchMesAno) {
          const mes = matchMesAno[1].padStart(2, '0')
          const anoRaw = matchMesAno[2]
          const ano = anoRaw.length === 2 ? `20${anoRaw}` : anoRaw
          return `${ano}-${mes}-01`
        }
      }
    }
  }

  const nomeNormalizado = chaveTexto(nomeArquivo)
  const anoMatch = nomeNormalizado.match(/20\d{2}/)
  const mes = Object.entries(MESES_PT).find(([nome]) => nomeNormalizado.includes(nome))?.[1]
  if (anoMatch && mes) return `${anoMatch[0]}-${mes}-01`

  throw new Error('Não foi possível identificar a competência/mês da planilha.')
}

function isCabecalhoComparativo(row: unknown[]): boolean {
  return chaveTexto(normalizarTexto(row[0])) === 'CODIGO' &&
    chaveTexto(normalizarTexto(row[1])) === 'ITEM' &&
    chaveTexto(normalizarTexto(row[2])) === 'NOVOS'
}

function parseRelatorioComparativo(workbook: XLSX.WorkBook, nomeArquivo: string): LinhaExcel[] {
  const competencia = extrairCompetenciaDoArquivo(workbook, nomeArquivo)
  const periodo = competencia.slice(0, 7)
  const linhas: LinhaExcel[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    })

    let setorAtual = ''
    let almoxarifadoCols: Array<{ col: number; codigo: string }> = []

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const colA = normalizarTexto(row[0])
      const colB = normalizarTexto(row[1])

      if (isCabecalhoComparativo(row)) {
        const subHeader = rows[index + 1] ?? []
        almoxarifadoCols = []
        for (let col = 3; col < Math.min(subHeader.length, 12); col++) {
          const codigo = normalizarCodigo(subHeader[col])
          if (codigo && codigo !== 'TOTAL SEMINOVOS') {
            almoxarifadoCols.push({ col, codigo })
          }
        }
        continue
      }

      if (colA && !colB && !normalizarCodigo(row[2]) && !isCabecalhoComparativo(row)) {
        const setor = normalizarSetor(colA)
        if (setor && !['TOTAL', 'NOVOS', 'SEMINOVOS'].includes(chaveTexto(setor))) {
          setorAtual = setor
        }
        continue
      }

      const codigo = normalizarCodigo(row[0])
      const itemOriginal = normalizarTexto(row[1])
      if (!codigo || !itemOriginal || !setorAtual || isCabecalhoComparativo(row)) continue

      const item = sanitizarNomeItem(itemOriginal, setorAtual)
      const novos = parseQuantidade(row[2])
      if (Number.isNaN(novos)) {
        throw new Error(`Linha ${index + 1}: quantidade de novos inválida para o item ${codigo}.`)
      }

      if (novos > 0) {
        linhas.push({
          periodo,
          setor: setorAtual,
          codigo,
          item,
          itemOriginal,
          tipo: TipoSaida.NOVO,
          quantidade: novos,
          mesAno: competencia,
          almoxarifadoCodigo: null,
          almoxarifadoNome: null,
          linhaOrigem: index + 1,
        })
      }

      for (const almox of almoxarifadoCols) {
        const quantidade = parseQuantidade(row[almox.col])
        if (Number.isNaN(quantidade)) {
          throw new Error(`Linha ${index + 1}: quantidade inválida para ${almox.codigo} no item ${codigo}.`)
        }
        if (quantidade <= 0) continue

        linhas.push({
          periodo,
          setor: setorAtual,
          codigo,
          item,
          itemOriginal,
          tipo: TipoSaida.SEMINOVO,
          quantidade,
          mesAno: competencia,
          almoxarifadoCodigo: almox.codigo,
          almoxarifadoNome: almox.codigo,
          linhaOrigem: index + 1,
        })
      }
    }
  }

  if (linhas.length === 0) {
    throw new Error('Nenhum lançamento foi encontrado no relatório comparativo.')
  }

  return linhas
}

function parseFormatoAntigo(workbook: XLSX.WorkBook): LinhaExcel[] {
  const nomesAbas = workbook.SheetNames
  const abaAlvo = nomesAbas.find(
    (n) => n.toLowerCase().replace(/\s/g, '') === 'tblseminovos'
  )

  if (!abaAlvo) {
    throw new Error(
      `Formato não reconhecido. A planilha deve ser o relatório comparativo ou conter a aba "tblSeminovos". Abas disponíveis: ${nomesAbas.join(', ')}`
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

  const cabecalho = Object.keys(linhas[0])
  const colunasFaltando = COLUNAS_OBRIGATORIAS_ANTIGO.filter(
    (col) => !cabecalho.some((h) => h.trim().toLowerCase() === col.toLowerCase())
  )

  if (colunasFaltando.length > 0) {
    throw new Error(
      `Colunas obrigatórias não encontradas: ${colunasFaltando.join(', ')}. ` +
        `Colunas presentes: ${cabecalho.join(', ')}`
    )
  }

  return linhas.flatMap((linha, index) => {
    const setor = normalizarSetor(linha['SETOR'])
    const itemOriginal = normalizarTexto(linha['ITEM'])
    const item = sanitizarNomeItem(itemOriginal, setor)
    const codigo = normalizarCodigo(linha['CÓDIGO'] ?? linha['CODIGO'])
    const novos = parseQuantidade(linha['NOVOS'])
    const seminovos = parseQuantidade(linha['SEMINOVOS'])

    if (!setor || !itemOriginal) return []
    if (Number.isNaN(novos) || Number.isNaN(seminovos)) {
      throw new Error(`Linha ${index + 2}: quantidades devem ser números inteiros não negativos.`)
    }
    if (setor.length > MAX_TEXT_LENGTH || item.length > MAX_TEXT_LENGTH) {
      throw new Error(`Linha ${index + 2}: setor ou item excede ${MAX_TEXT_LENGTH} caracteres.`)
    }

    const base = {
      periodo: normalizarTexto(linha['PERÍODO'] ?? linha['PERIODO']),
      setor,
      codigo,
      item,
      itemOriginal,
      mesAno: linha['Mês-Ano'] ?? linha['Mes-Ano'] ?? linha['MES-ANO'] ?? '',
      almoxarifadoCodigo: null,
      almoxarifadoNome: null,
      linhaOrigem: index + 2,
    }

    const resultado: LinhaExcel[] = []
    if (novos > 0) {
      resultado.push({ ...base, tipo: TipoSaida.NOVO, quantidade: novos })
    }
    if (seminovos > 0) {
      resultado.push({ ...base, tipo: TipoSaida.SEMINOVO, quantidade: seminovos })
    }
    return resultado
  })
}

export function normalizarMesAno(valor: string | number): string {
  if (typeof valor === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + valor * 86400000)
    const ano = date.getUTCFullYear()
    const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
    return `${ano}-${mes}-01`
  }

  const str = String(valor).trim()

  const matchISO = str.match(/^(\d{4})-(\d{2})/)
  if (matchISO) {
    return `${matchISO[1]}-${matchISO[2]}-01`
  }

  const matchMMAAAA = str.match(/^(\d{2})\/(\d{4})$/)
  if (matchMMAAAA) {
    return `${matchMMAAAA[2]}-${matchMMAAAA[1]}-01`
  }

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

export async function parseExcel(file: File): Promise<LinhaExcel[]> {
  validarArquivo(file)

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const primeiraAba = workbook.Sheets[workbook.SheetNames[0]]
  const primeirasLinhas = XLSX.utils.sheet_to_json<unknown[]>(primeiraAba, {
    header: 1,
    defval: null,
    raw: true,
  }).slice(0, 20)

  const ehComparativo = primeirasLinhas.some(isCabecalhoComparativo)
  const resultado = ehComparativo
    ? parseRelatorioComparativo(workbook, file.name)
    : parseFormatoAntigo(workbook)

  if (resultado.length > MAX_IMPORT_ROWS) {
    throw new Error(`A planilha excede o limite de ${MAX_IMPORT_ROWS.toLocaleString('pt-BR')} lançamentos.`)
  }

  return resultado
}

async function getAlmoxarifadoMap(): Promise<Map<string, Almoxarifado>> {
  const { data, error } = await supabase
    .from('almoxarifados')
    .select('*')
    .eq('ativo', true)

  if (error) {
    throw new Error('Erro ao carregar almoxarifados: ' + error.message)
  }

  const map = new Map<string, Almoxarifado>()

  for (const almox of (data ?? []) as Almoxarifado[]) {
    const chaves = [
      almox.codigo,
      almox.nome,
      ...(almox.codigo ? ALMOXARIFADO_ALIASES[chaveTexto(almox.codigo)] ?? [] : []),
    ]

    for (const chave of chaves) {
      if (chave) map.set(chaveTexto(chave), almox)
    }
  }

  for (const [codigo, aliases] of Object.entries(ALMOXARIFADO_ALIASES)) {
    const existente = aliases.map(chaveTexto).map((a) => map.get(a)).find(Boolean)
    if (existente) {
      map.set(chaveTexto(codigo), existente)
      aliases.forEach((alias) => map.set(chaveTexto(alias), existente))
    }
  }

  return map
}

function resolverAlmoxarifado(
  linha: LinhaExcel,
  almoxarifadoPadraoId: string,
  almoxMap: Map<string, Almoxarifado>
): string | null {
  if (linha.almoxarifadoCodigo) {
    return almoxMap.get(chaveTexto(linha.almoxarifadoCodigo))?.id ?? null
  }

  return almoxarifadoPadraoId
}

async function resolverClassificacoes(
  linhas: LinhaExcel[]
): Promise<Map<string, ClassificacaoResolvida>> {
  const codigos = Array.from(
    new Set(linhas.map((linha) => linha.codigo).filter((codigo): codigo is string => Boolean(codigo)))
  )
  const itensPorCodigo = new Map<string, ClassificacaoResolvida>()

  for (let i = 0; i < codigos.length; i += 400) {
    const { data, error } = await supabase
      .from('itens')
      .select('id,codigo,item_setor(ativo,setores(nome,ativo))')
      .in('codigo', codigos.slice(i, i + 400))
      .eq('ativo', true)

    if (error) throw new Error('Erro ao carregar classificação dos itens: ' + error.message)

    for (const item of (data ?? []) as unknown as Array<{
      id: string
      codigo: string | null
      item_setor?: Array<{
        ativo: boolean
        setores: Array<{ nome: string; ativo: boolean }> | { nome: string; ativo: boolean } | null
      }>
    }>) {
      if (!item.codigo) continue
      const vinculo = item.item_setor?.find((v) => {
        const setor = Array.isArray(v.setores) ? v.setores[0] : v.setores
        return v.ativo && setor?.ativo
      })
      const setorVinculado = Array.isArray(vinculo?.setores)
        ? vinculo.setores[0]
        : vinculo?.setores
      if (setorVinculado && !setorExigeReclassificacao(setorVinculado.nome)) {
        itensPorCodigo.set(chaveTexto(item.codigo), {
          setor: normalizarNomeSetor(setorVinculado.nome),
          itemId: item.id,
          origem: setorVinculado.nome.toUpperCase() === SETOR_OUTROS ? 'OUTROS' : 'CADASTRO',
        })
      }
    }
  }

  for (const codigo of codigos) {
    const chave = chaveTexto(codigo)
    if (itensPorCodigo.has(chave)) continue
    const setorCatalogo = CLASSIFICACAO_SETORES[chave]
    itensPorCodigo.set(chave, {
      setor: setorCatalogo ? normalizarNomeSetor(setorCatalogo) : SETOR_OUTROS,
      itemId: null,
      origem: setorCatalogo ? 'CATALOGO' : 'OUTROS',
    })
  }

  return itensPorCodigo
}

function classificacaoDaLinha(
  linha: LinhaExcel,
  classificacoes: Map<string, ClassificacaoResolvida>
): ClassificacaoResolvida {
  if (!linha.codigo) return { setor: SETOR_OUTROS, itemId: null, origem: 'OUTROS' }
  return classificacoes.get(chaveTexto(linha.codigo)) ?? {
    setor: SETOR_OUTROS,
    itemId: null,
    origem: 'OUTROS',
  }
}

function consolidarSaidasDuplicadas(saidas: InsertSaidaItem[]): InsertSaidaItem[] {
  const consolidadas = new Map<string, InsertSaidaItem>()

  for (const saida of saidas) {
    const chave = JSON.stringify([
      saida.competencia,
      saida.almoxarifado_id ?? null,
      saida.setor_id,
      saida.item_id,
      saida.tipo,
      saida.lote_importacao_id ?? null,
    ])
    const existente = consolidadas.get(chave)

    if (!existente) {
      consolidadas.set(chave, { ...saida })
      continue
    }

    existente.quantidade += saida.quantidade
    if (saida.observacao && !existente.observacao?.includes(saida.observacao)) {
      existente.observacao = [existente.observacao, saida.observacao]
        .filter(Boolean)
        .join('; ')
    }
  }

  return Array.from(consolidadas.values())
}

export async function gerarPreview(
  linhas: LinhaExcel[],
  almoxarifadoId: string
): Promise<ResultadoImportacao> {
  const inconsistencias: string[] = []
  let totalNovo = 0
  let totalSeminovo = 0
  let totalQtdNovo = 0
  let totalQtdSeminovo = 0
  const setoresVistosNomes = new Set<string>()
  const itensVistos = new Set<string>()
  const almoxarifadosEncontradosSet = new Set<string>()
  const codigosNaoClassificadosSet = new Set<string>()

  const { data: setoresExistentes } = await supabase.from('setores').select('nome')
  const { data: itensExistentes } = await supabase.from('itens').select('nome,codigo')
  const almoxMap = await getAlmoxarifadoMap()
  const classificacoes = await resolverClassificacoes(linhas)

  const setoresExistentesSet = new Set(
    (setoresExistentes ?? []).map((s) => chaveTexto(s.nome))
  )
  const itensExistentesSet = new Set(
    (itensExistentes ?? []).flatMap((i) => [
      chaveTexto(i.nome),
      i.codigo ? chaveTexto(i.codigo) : '',
    ]).filter(Boolean)
  )

  const setoresNovos: string[] = []
  const itensNovos: string[] = []

  linhas.forEach((linha) => {
    if (!linha.item) inconsistencias.push(`Linha ${linha.linhaOrigem}: item vazio.`)
    if (linha.quantidade < 0) {
      inconsistencias.push(`Linha ${linha.linhaOrigem}: quantidade negativa (${linha.quantidade}).`)
    }

    try {
      normalizarMesAno(linha.mesAno)
    } catch {
      inconsistencias.push(`Linha ${linha.linhaOrigem}: data inválida (${linha.mesAno}).`)
    }

    const almoxId = resolverAlmoxarifado(linha, almoxarifadoId, almoxMap)
    if (!almoxId) {
      inconsistencias.push(`Linha ${linha.linhaOrigem}: almoxarifado "${linha.almoxarifadoCodigo}" não encontrado.`)
    } else if (linha.almoxarifadoCodigo) {
      const almox = almoxMap.get(chaveTexto(linha.almoxarifadoCodigo))
      if (almox) almoxarifadosEncontradosSet.add(`${linha.almoxarifadoCodigo} → ${almox.nome}`)
    }

    if (linha.tipo === TipoSaida.NOVO) {
      totalNovo++
      totalQtdNovo += Math.max(0, linha.quantidade)
    } else {
      totalSeminovo++
      totalQtdSeminovo += Math.max(0, linha.quantidade)
    }

    const classificacao = classificacaoDaLinha(linha, classificacoes)
    if (classificacao.origem === 'OUTROS') {
      codigosNaoClassificadosSet.add(linha.codigo ?? `SEM CÓDIGO (linha ${linha.linhaOrigem})`)
    }

    const setorKey = chaveTexto(classificacao.setor)
    if (!setoresVistosNomes.has(setorKey)) {
      setoresVistosNomes.add(setorKey)
      if (!setoresExistentesSet.has(setorKey)) setoresNovos.push(classificacao.setor)
    }

    const itemKey = linha.codigo ? chaveTexto(linha.codigo) : chaveTexto(linha.item)
    if (linha.item && !itensVistos.has(itemKey)) {
      itensVistos.add(itemKey)
      if (!itensExistentesSet.has(itemKey)) {
        itensNovos.push(linha.codigo ? `${linha.codigo} — ${linha.item}` : linha.item)
      }
    }
  })

  const codigosNaoClassificados = Array.from(codigosNaoClassificadosSet).sort()
  const avisos = codigosNaoClassificados.length > 0
    ? [`${codigosNaoClassificados.length} código(s) serão classificados em OUTROS e deverão ser revisados no Catálogo de Itens.`]
    : []

  return {
    totalLinhas: linhas.length,
    totalNovo,
    totalSeminovo,
    totalQtdNovo,
    totalQtdSeminovo,
    setoresNovos,
    itensNovos,
    almoxarifadosEncontrados: Array.from(almoxarifadosEncontradosSet).sort(),
    inconsistencias,
    avisos,
    codigosNaoClassificados,
    economiaEstimada: totalQtdSeminovo * 36,
  }
}

export async function confirmarImportacao(
  linhas: LinhaExcel[],
  almoxarifadoId: string,
  userId: string,
  nomeArquivo: string
): Promise<{ loteId: string; error?: string }> {
  const { data: lote, error: erroLote } = await supabase
    .from('lotes_importacao')
    .insert({
      nome_arquivo: nomeArquivo,
      almoxarifado_id: almoxarifadoId,
      usuario_id: userId,
      status: 'PROCESSANDO',
      total_linhas_lidas: linhas.length,
    })
    .select()
    .single()

  if (erroLote || !lote) {
    return { loteId: '', error: 'Erro ao criar lote de importação: ' + erroLote?.message }
  }

  const loteId = (lote as Record<string, string>)['id']

  try {
    const almoxMap = await getAlmoxarifadoMap()
    const classificacoes = await resolverClassificacoes(linhas)
    const saidas: InsertSaidaItem[] = []
    let totalNovo = 0
    let totalSeminovo = 0

    for (const linha of linhas) {
      const dataSaida = normalizarMesAno(linha.mesAno)
      const almoxDestinoId = resolverAlmoxarifado(linha, almoxarifadoId, almoxMap)
      if (!almoxDestinoId) {
        throw new Error(`Almoxarifado "${linha.almoxarifadoCodigo}" não encontrado na linha ${linha.linhaOrigem}.`)
      }

      const classificacao = classificacaoDaLinha(linha, classificacoes)
      const { setor } = await findOrCreateSetor(classificacao.setor)
      const descricao = linha.itemOriginal !== linha.item ? linha.itemOriginal : null
      const { item } = await findOrCreateItem(linha.item, linha.codigo, descricao)
      await vincularItemSetor(item.id, setor.id)

      saidas.push({
        competencia: dataSaida,
        periodo_texto: linha.periodo || null,
        almoxarifado_id: almoxDestinoId,
        setor_id: setor.id,
        item_id: item.id,
        tipo: linha.tipo,
        quantidade: linha.quantidade,
        observacao: linha.codigo
          ? `Importado da linha ${linha.linhaOrigem}; código ${linha.codigo}; classificação ${classificacao.origem}`
          : `Importado da linha ${linha.linhaOrigem}`,
        origem: OrigemSaida.IMPORTACAO,
        lote_importacao_id: loteId,
        created_by: userId,
      })

      if (linha.tipo === TipoSaida.NOVO) totalNovo += linha.quantidade
      else totalSeminovo += linha.quantidade
    }

    const saidasConsolidadas = consolidarSaidasDuplicadas(saidas)
    const chunkSize = 500
    for (let i = 0; i < saidasConsolidadas.length; i += chunkSize) {
      const chunk = saidasConsolidadas.slice(i, i + chunkSize)
      const { error: erroSaidas } = await createSaidasLote(chunk)
      if (erroSaidas) throw new Error(erroSaidas)
    }

    await supabase
      .from('lotes_importacao')
      .update({
        status: 'CONCLUIDO',
        total_qtd_novo: totalNovo,
        total_qtd_seminovo: totalSeminovo,
        total_registros_novo: saidasConsolidadas.filter((s) => s.tipo === TipoSaida.NOVO).length,
        total_registros_seminovo: saidasConsolidadas.filter((s) => s.tipo === TipoSaida.SEMINOVO).length,
        concluido_em: new Date().toISOString(),
      })
      .eq('id', loteId)

    return { loteId }
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Erro desconhecido na importação'

    await supabase
      .from('lotes_importacao')
      .update({ status: 'ERRO', erro_mensagem: mensagem })
      .eq('id', loteId)

    return { loteId, error: mensagem }
  }
}

export async function verificarDuplicidade(
  nomeArquivo: string,
  almoxarifadoId: string
): Promise<LoteImportacao[]> {
  const { data, error } = await supabase
    .from('lotes_importacao')
    .select('*')
    .eq('nome_arquivo', nomeArquivo)
    .eq('almoxarifado_id', almoxarifadoId)
    .neq('status', 'DESFEITO')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[importacao] Erro ao verificar duplicidade:', error.message)
    return []
  }

  return (data ?? []) as LoteImportacao[]
}

export async function desfazerLote(
  loteId: string,
  userId: string
): Promise<{ data: LoteImportacao | null; error: string | null }> {
  const { error: erroDelete } = await supabase
    .from('saidas_itens')
    .delete()
    .eq('lote_importacao_id', loteId)

  if (erroDelete) {
    return { data: null, error: 'Erro ao remover saídas do lote: ' + erroDelete.message }
  }

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
      p_acao: 'DESFAZER_LOTE',
      p_tabela_afetada: 'lotes_importacao',
      p_registro_id: loteId,
      p_dados_anteriores: null,
      p_dados_novos: { status: 'DESFEITO' },
    })
  ).catch(console.error)

  return { data: loteAtualizado as LoteImportacao, error: null }
}
