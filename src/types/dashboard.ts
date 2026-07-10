import { TipoSaida } from '@/types/database'

// ============================================================
// KPI principal do dashboard
// ============================================================
export interface KPIData {
  // Totais de quantidade
  totalSaidas:           number
  totalNovos:            number
  totalSeminovos:        number
  percentualSeminovos:   number  // 0-100

  // Economia
  economiaEstimada:      number  // líquida = Qtd × (Novo - Seminovo)
  custoEvitadoBruto:     number  // Qtd × Valor Novo
  mediaMensalEconomia:   number  // economiaEstimada / mesesComDados
  mesesComDados:         number

  // Meta-informação
  usandoCustoPadrao:     boolean  // true se algum registro usou fallback padrão
  periodoInicio:         string   // "YYYY-MM-DD"
  periodoFim:            string   // "YYYY-MM-DD"
}

// ============================================================
// Série temporal mensal (gráfico principal)
// ============================================================
export interface SerieTemporalItem {
  mes:             string  // "YYYY-MM-DD" (primeiro dia do mês)
  label:           string  // "jan/2024"
  totalNovos:      number
  totalSeminovos:  number
  totalGeral:      number
  economiaLiquida: number
}

// ============================================================
// Resumo por setor
// ============================================================
export interface ResumoPorSetor {
  setorId:           string
  setorNome:         string
  totalNovos:        number
  totalSeminovos:    number
  totalGeral:        number
  economiaLiquida:   number
  percentualDoTotal: number  // 0-100
}

// ============================================================
// Resumo por item
// ============================================================
export interface ResumoPorItem {
  itemId:            string
  itemNome:          string
  itemUnidade:       string
  totalNovos:        number
  totalSeminovos:    number
  totalGeral:        number
  economiaLiquida:   number
  percentualDoTotal: number  // 0-100
}

// ============================================================
// Resumo por almoxarifado
// ============================================================
export interface ResumoPorAlmoxarifado {
  almoxarifadoId:    string
  almoxarifadoNome:  string
  totalNovos:        number
  totalSeminovos:    number
  totalGeral:        number
  economiaLiquida:   number
  percentualDoTotal: number  // 0-100
}

// ============================================================
// Linha da tabela analítica detalhada
// ============================================================
export interface TabelaAnaliticaRow {
  competencia:         string   // "YYYY-MM-DD"
  almoxarifadoNome:    string
  setorNome:           string
  itemNome:            string
  totalNovos:          number
  totalSeminovos:      number
  valorNovo:           number
  valorSeminovo:       number
  economiaLiquida:     number
  fonteCusto:          string   // 'item+almoxarifado' | 'item' | 'geral' | 'padrao'
}

// ============================================================
// Filtros do dashboard
// ============================================================
export interface FiltrosDashboard {
  ano?:              number
  mesInicio?:        number   // 1-12
  mesFim?:           number   // 1-12
  almoxarifadoId?:   string
  setorId?:          string
  itemId?:           string
  tipo?:             TipoSaida
}

// ============================================================
// Estado completo do dashboard
// ============================================================
export interface DashboardState {
  filtros:             FiltrosDashboard
  kpi:                 KPIData | null
  serieTemporal:       SerieTemporalItem[]
  resumoPorSetor:      ResumoPorSetor[]
  resumoPorItem:       ResumoPorItem[]
  resumoPorAlmoxarifado: ResumoPorAlmoxarifado[]
  loading:             boolean
  error:               string | null
}
