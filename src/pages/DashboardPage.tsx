import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Package, Recycle, TrendingUp,
  BarChart2, Presentation,
  AlertCircle, RefreshCw, Filter, Award, Baby, UsersRound, Sparkles
} from 'lucide-react'
import { getDashboardKPIs, getSerieTemporal, getResumoPorSetor, getResumoPorItem, getResumoPorAlmoxarifado, getTabelaAnalitica } from '@/services/dashboard.service'
import { useAlmoxarifados } from '@/hooks/useAlmoxarifados'
import { useSetores } from '@/hooks/useSetores'
import { formatCurrency, formatNumber, formatPercent, formatCompetencia, formatMesResumido } from '@/utils/formatters'
import { LoadingPage, EmptyState, Alert, Pagination } from '@/components/ui'
import type { KPIData, SerieTemporalItem, ResumoPorSetor, ResumoPorItem, FiltrosDashboard } from '@/types/dashboard'

// ─── Paleta de cores ────────────────────────────────────────────────────────
const COLORS = {
  novo:     '#10b981',
  seminovo: '#f97316',
  total:    '#1a3a6b',
  economy:  '#16a34a',
  pie:      ['#10b981', '#f97316'],
}

// ─── Componente KPI Card ─────────────────────────────────────────────────────
interface KPICardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  iconBg?: string
  highlight?: boolean
}

function KPICard({ label, value, sub, icon, iconBg = 'bg-institutional-blue-light', highlight }: KPICardProps) {
  const isCurrency = typeof value === 'string' && value.includes('R$');
  const cleanValue = isCurrency 
    ? value.replace(/R\$\s*|R\$\u00a0/g, '').trim()
    : value;

  return (
    <div className={`kpi-card dashboard-kpi animate-fade-in ${highlight ? 'border-economy-green' : ''} p-5 min-h-[140px] flex flex-col justify-between`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="kpi-label block font-semibold text-slate-500 text-xs uppercase tracking-wider leading-tight min-h-[32px] break-words">
            {label}
          </p>
          {isCurrency ? (
            <div className="mt-2">
              <span className="text-[10px] font-bold text-slate-400 block leading-none mb-0.5">R$</span>
              <span className={`text-xl md:text-2xl font-extrabold tracking-tight block leading-none ${highlight ? 'text-economy-green' : 'text-institutional-blue'}`}>
                {cleanValue}
              </span>
            </div>
          ) : (
            <p className="text-xl md:text-2xl font-extrabold tracking-tight text-institutional-blue mt-2 leading-none">
              {value}
            </p>
          )}
          {sub && <p className="kpi-sub mt-2 text-[11px] text-slate-400 font-medium leading-normal break-words">{sub}</p>}
        </div>
        <div className={`${iconBg} p-2.5 rounded-xl shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ─── Filtros do Dashboard ────────────────────────────────────────────────────
interface FiltrosBarProps {
  filtros: FiltrosDashboard
  onChange: (f: Partial<FiltrosDashboard>) => void
  onReset: () => void
  almoxarifados: { id: string; nome: string }[]
  setores: { id: string; nome: string }[]
}

const ANOS = Array.from({ length: 6 }, (_, i) => 2022 + i)
const MESES = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
  { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
]

function FiltrosBar({ filtros, onChange, onReset, almoxarifados, setores }: FiltrosBarProps) {
  return (
    <div className="filter-bar">
      <div className="flex items-center gap-2 text-slate-500 mr-2">
        <Filter size={16} />
        <span className="text-sm font-medium">Filtros</span>
      </div>

      <div className="filter-group">
        <label className="label text-xs">Ano</label>
        <select className="select text-sm py-1.5"
          value={filtros.ano ?? ''}
          onChange={e => onChange({ ano: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Todos</option>
          {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="label text-xs">Mês inicial</label>
        <select className="select text-sm py-1.5"
          value={filtros.mesInicio ?? ''}
          onChange={e => onChange({ mesInicio: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Todos</option>
          {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="label text-xs">Mês final</label>
        <select className="select text-sm py-1.5"
          value={filtros.mesFim ?? ''}
          onChange={e => onChange({ mesFim: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">Todos</option>
          {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="label text-xs">Almoxarifado</label>
        <select className="select text-sm py-1.5"
          value={filtros.almoxarifadoId ?? ''}
          onChange={e => onChange({ almoxarifadoId: e.target.value || undefined })}>
          <option value="">Todos</option>
          {almoxarifados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="label text-xs">Setor</label>
        <select className="select text-sm py-1.5"
          value={filtros.setorId ?? ''}
          onChange={e => onChange({ setorId: e.target.value || undefined })}>
          <option value="">Todos</option>
          {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="label text-xs">Tipo</label>
        <select className="select text-sm py-1.5"
          value={filtros.tipo ?? ''}
          onChange={e => { const v = e.target.value; onChange({ tipo: v ? (v as import('@/types/database').TipoSaida) : undefined }) }}>
          <option value="">Todos</option>
          <option value="NOVO">Novo</option>
          <option value="SEMINOVO">Seminovo</option>
        </select>
      </div>

      <button className="btn-secondary btn-sm self-end" onClick={onReset}>
        <RefreshCw size={14} />
        Limpar
      </button>
    </div>
  )
}

// ─── Tooltip customizado do Recharts ─────────────────────────────────────────
function CustomTooltip({ active, payload, label, percent = false }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; percent?: boolean }) {
  if (!active || !payload) return null
  return (
    <div className="bg-white border border-institutional-gray-border rounded-lg shadow-card-hover p-3 text-sm">
      <p className="font-semibold text-institutional-blue mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-medium">{percent ? formatPercent(p.value) : formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function EconomyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="bg-white border border-institutional-gray-border rounded-lg shadow-card-hover p-3 text-sm">
      <p className="font-semibold text-institutional-blue mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-medium text-economy-green">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Página principal do Dashboard ───────────────────────────────────────────
const FILTROS_INICIAIS: FiltrosDashboard = {
  ano: new Date().getFullYear(),
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { almoxarifados } = useAlmoxarifados()
  const { setores } = useSetores()

  const [filtros, setFiltros] = useState<FiltrosDashboard>(FILTROS_INICIAIS)
  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [serie, setSerie] = useState<SerieTemporalItem[]>([])
  const [porSetor, setPorSetor] = useState<ResumoPorSetor[]>([])
  const [topItens, setTopItens] = useState<ResumoPorItem[]>([])
  const [porAlmoxarifado, setPorAlmoxarifado] = useState<import('@/types/dashboard').ResumoPorAlmoxarifado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertaCusto, setAlertaCusto] = useState(false)
  const [chartMode, setChartMode] = useState<'absoluto' | 'percentual'>('absoluto')

  // Tabela analítica
  const [tabelaPage, setTabelaPage] = useState(1)
  const [tabelaData, setTabelaData] = useState<{ rows: unknown[]; count: number }>({ rows: [], count: 0 })
  const TABELA_LIMIT = 15

  const buildParams = useCallback(() => {
    const params: Record<string, string | undefined> = {}
    if (filtros.ano) {
      const ini = filtros.mesInicio ?? 1
      const fim = filtros.mesFim ?? 12
      params.dataInicio = `${filtros.ano}-${String(ini).padStart(2,'0')}-01`
      params.dataFim   = `${filtros.ano}-${String(fim).padStart(2,'0')}-01`
      // Ajustar para último dia do mês final
      const lastDay = new Date(filtros.ano, fim, 0).getDate()
      params.dataFim = `${filtros.ano}-${String(fim).padStart(2,'0')}-${lastDay}`
    }
    if (filtros.almoxarifadoId) params.almoxarifadoId = filtros.almoxarifadoId
    if (filtros.setorId) params.setorId = filtros.setorId
    if (filtros.itemId) params.itemId = filtros.itemId
    if (filtros.tipo) params.tipo = filtros.tipo
    return params
  }, [filtros])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = buildParams()
      const [kpiRes, serieRes, setorRes, itensRes, almoxRes] = await Promise.all([
        getDashboardKPIs(params),
        getSerieTemporal(params),
        getResumoPorSetor(params),
        getResumoPorItem(params, 10),
        getResumoPorAlmoxarifado(params),
      ])
      setKpis(kpiRes)
      setSerie(serieRes)
      setPorSetor(setorRes)
      setTopItens(itensRes)
      setPorAlmoxarifado(almoxRes)
      // Verifica uso de custo padrão
      setAlertaCusto(kpiRes?.usandoCustoPadrao ?? false)
    } catch {
      setError('Erro ao carregar dados do dashboard. Verifique a conexão com o banco.')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const fetchTabela = useCallback(async () => {
    const params = buildParams()
    const res = await getTabelaAnalitica(params, tabelaPage, TABELA_LIMIT)
    setTabelaData({ rows: res.data, count: res.count })
  }, [buildParams, tabelaPage])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { fetchTabela() }, [fetchTabela])

  const handleFiltroChange = (partial: Partial<FiltrosDashboard>) => {
    setFiltros(prev => ({ ...prev, ...partial }))
    setTabelaPage(1)
  }

  const totalPaginas = Math.ceil(tabelaData.count / TABELA_LIMIT)

  // Dados do gráfico de composição (donut)
  const composicaoData = kpis ? [
    { name: 'Novos', value: Number(kpis.totalNovos) },
    { name: 'Seminovos', value: Number(kpis.totalSeminovos) },
  ] : []

  const mesRecordista = useMemo(() => {
    if (serie.length === 0) return null
    return [...serie].sort((a, b) => b.totalGeral - a.totalGeral)[0]
  }, [serie])

  const economiaPorAno = useMemo(() => {
    const grupos = new Map<string, { economia: number; itens: number }>()
    serie.forEach(item => {
      const ano = item.mes.slice(0, 4)
      const atual = grupos.get(ano) ?? { economia: 0, itens: 0 }
      atual.economia += item.economiaLiquida
      atual.itens += item.totalSeminovos
      grupos.set(ano, atual)
    })
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [serie])

  const comparativos = useMemo(() => {
    const categoria = {
      Feminino: { Novos: 0, Seminovos: 0 },
      Masculino: { Novos: 0, Seminovos: 0 },
      Diversos: { Novos: 0, Seminovos: 0 },
    }
    const faixa = {
      Adulto: { Novos: 0, Seminovos: 0 },
      Infantil: { Novos: 0, Seminovos: 0 },
    }

    porSetor.forEach(setor => {
      const nome = setor.setorNome.toLocaleUpperCase('pt-BR')
      const genero = nome.includes('FEMIN') ? 'Feminino' : nome.includes('MASCUL') ? 'Masculino' : 'Diversos'
      categoria[genero].Novos += setor.totalNovos
      categoria[genero].Seminovos += setor.totalSeminovos

      if (nome.includes('INFANTIL') || nome.includes('BEBÊ') || nome.includes('BEBE')) {
        faixa.Infantil.Novos += setor.totalNovos
        faixa.Infantil.Seminovos += setor.totalSeminovos
      } else if (nome.includes('ADULTO')) {
        faixa.Adulto.Novos += setor.totalNovos
        faixa.Adulto.Seminovos += setor.totalSeminovos
      }
    })

    return {
      categoria: Object.entries(categoria).map(([nome, valores]) => ({ nome, ...valores })),
      faixa: Object.entries(faixa).map(([nome, valores]) => ({ nome, ...valores })),
    }
  }, [porSetor])

  const ALMOX_COLORS: Record<string, string> = useMemo(() => ({
    'Vila Prudente': '#f97316',
    'Vila Guarani': '#3b82f6',
    'Sapopemba': '#8b5cf6',
    'Canindé': '#eab308',
    'Geral': '#64748b',
  }), [])
  const DEFAULT_ALMOX_COLORS = useMemo(() => ['#f97316', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899', '#06b6d4', '#64748b'], [])

  const almoxChartData = useMemo(() => {
    if (porAlmoxarifado.length === 0) return []
    const totalNovosGeral = porAlmoxarifado.reduce((sum, a) => sum + a.totalNovos, 0)
    const seminovosPorAlmox: Record<string, number> = {}
    porAlmoxarifado.forEach((a) => {
      const nome = a.almoxarifadoNome
      seminovosPorAlmox[nome] = (seminovosPorAlmox[nome] || 0) + a.totalSeminovos
    })
    return [
      {
        categoria: 'Novos',
        'Itens Novos': totalNovosGeral,
      },
      {
        categoria: 'Seminovos',
        ...seminovosPorAlmox,
      },
    ]
  }, [porAlmoxarifado])

  if (loading) return <LoadingPage />

  return (
    <div className="animate-fade-in">
      {/* Cabeçalho da página */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Visão geral de saídas de itens novos e seminovos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDashboard} className="btn-secondary btn-sm" title="Atualizar">
            <RefreshCw size={15} />
            Atualizar
          </button>
          <button onClick={() => navigate('/apresentacao')} className="btn-primary btn-sm">
            <Presentation size={15} />
            Modo Apresentação
          </button>
        </div>
      </div>

      {/* Alerta de erro */}
      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Alerta custo padrão */}
      {alertaCusto && (
        <Alert variant="warning" className="mb-4">
          <strong>Atenção:</strong> Alguns itens estão usando o custo médio padrão
          (Novo: R$ 40,00 | Seminovo: R$ 4,00) pois não há custo específico cadastrado.
          <a href="/custos" className="underline ml-1 font-medium">Cadastrar custos →</a>
        </Alert>
      )}

      {/* Filtros */}
      <FiltrosBar
        filtros={filtros}
        onChange={handleFiltroChange}
        onReset={() => setFiltros(FILTROS_INICIAIS)}
        almoxarifados={almoxarifados}
        setores={setores}
      />

      <div className="dashboard-hero dashboard-section">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <Sparkles size={18} />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">Visão consolidada</span>
          </div>
          <h2>Painel dos atendimentos com itens novos e seminovos</h2>
          <p>Análise comparativa do volume distribuído e do impacto do reaproveitamento para os atendimentos realizados.</p>
        </div>
        <span className="dashboard-status">Dados atualizados</span>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard
            label="Total de itens atendidos"
            value={formatNumber(Number(kpis?.totalSaidas ?? 0))}
            icon={<Package size={20} className="text-institutional-blue" />}
            sub="Consolidado no período"
          />
          <KPICard
            label="Atendimentos com itens novos"
            value={formatNumber(Number(kpis?.totalNovos ?? 0))}
            sub={`${formatPercent(kpis && kpis.totalSaidas > 0 ? (kpis.totalNovos / kpis.totalSaidas) * 100 : 0)} do total`}
            icon={<Sparkles size={20} className="text-emerald-500" />}
            iconBg="bg-emerald-50"
          />
          <KPICard
            label="Atendimentos com itens seminovos"
            value={formatNumber(Number(kpis?.totalSeminovos ?? 0))}
            sub={`${formatPercent(Number(kpis?.percentualSeminovos ?? 0))} do total`}
            icon={<Recycle size={20} className="text-orange-500" />}
            iconBg="bg-orange-50"
          />
          <KPICard
            label="Mês recordista"
            value={mesRecordista ? formatCompetencia(mesRecordista.mes) : 'Sem dados'}
            sub={mesRecordista ? `${formatNumber(mesRecordista.totalGeral)} itens atendidos` : undefined}
            icon={<Award size={20} className="text-violet-500" />}
            iconBg="bg-violet-50"
          />
        </div>
      </div>

      <div className="dashboard-economy dashboard-section">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-emerald-500/20 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-lg">
              <TrendingUp size={21} />
              Demonstrativo de economia com reaproveitamento
            </div>
            <p className="text-sm mt-1">Impacto estimado pela utilização de itens seminovos em vez da compra de itens novos.</p>
          </div>
          <span className="dashboard-status">Impacto financeiro positivo</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="economy-stat economy-stat-primary">
            <span>Economia total gerada</span>
            <strong>{formatCurrency(Number(kpis?.economiaEstimada ?? 0))}</strong>
            <small>{formatNumber(Number(kpis?.totalSeminovos ?? 0))} itens reaproveitados</small>
          </div>
          {economiaPorAno.slice(-3).map(([ano, valor]) => (
            <div className="economy-stat" key={ano}>
              <span>Impacto em {ano}</span>
              <strong>{formatCurrency(valor.economia)}</strong>
              <small>{formatNumber(valor.itens)} itens atendidos</small>
            </div>
          ))}
          {economiaPorAno.length === 0 && (
            <div className="economy-stat">
              <span>Média mensal</span>
              <strong>{formatCurrency(Number(kpis?.mediaMensalEconomia ?? 0))}</strong>
              <small>Sem detalhamento anual no período</small>
            </div>
          )}
        </div>
      </div>

      {/* ── Gráfico Principal: Série Temporal ──────────────────────────── */}
      <div className="dashboard-section">
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="section-title mb-0">
              <BarChart2 size={18} />
              Evolução dos atendimentos ao longo do tempo
            </div>
            <div className="chart-mode-toggle" aria-label="Formato do gráfico">
              <button className={chartMode === 'absoluto' ? 'active' : ''} onClick={() => setChartMode('absoluto')}>Absoluto</button>
              <button className={chartMode === 'percentual' ? 'active' : ''} onClick={() => setChartMode('percentual')}>Percentual</button>
            </div>
          </div>
          {serie.length === 0 ? (
            <EmptyState
              title="Nenhum dado para o período selecionado"
              description="Ajuste os filtros ou importe dados da planilha."
            />
          ) : chartMode === 'percentual' ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={serie.map(s => ({
                mes: formatMesResumido(s.mes),
                Novos: s.totalGeral > 0 ? (s.totalNovos / s.totalGeral) * 100 : 0,
                Seminovos: s.totalGeral > 0 ? (s.totalSeminovos / s.totalGeral) * 100 : 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip percent={true} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Novos" stackId="a" fill={COLORS.novo} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Seminovos" stackId="a" fill={COLORS.seminovo} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={serie.map(s => ({
                mes: formatMesResumido(s.mes),
                Novos: s.totalNovos,
                Seminovos: s.totalSeminovos,
                Total: s.totalGeral,
              }))}>
                <defs>
                  <linearGradient id="gradNovo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.novo} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.novo} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSeminovo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.seminovo} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.seminovo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Total" stroke={COLORS.total} fill="none"
                  strokeWidth={2} strokeDasharray="4 2" dot={false} />
                <Area type="monotone" dataKey="Novos" stroke={COLORS.novo}
                  fill="url(#gradNovo)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="Seminovos" stroke={COLORS.seminovo}
                  fill="url(#gradSeminovo)" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Linha 3: Gráficos auxiliares ──────────────────────────────── */}
      <div className="dashboard-section grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Barras por setor */}
        <div className="card lg:col-span-2">
          <div className="section-title">Novos × Seminovos por Setor</div>
          {porSetor.length === 0 ? (
            <EmptyState title="Sem dados" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porSetor.map(s => ({
                setor: s.setorNome.length > 18 ? s.setorNome.slice(0, 18) + '…' : s.setorNome,
                Novos: s.totalNovos,
                Seminovos: s.totalSeminovos,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="setor" width={130} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Novos" fill={COLORS.novo} radius={[0, 3, 3, 0]} />
                <Bar dataKey="Seminovos" fill={COLORS.seminovo} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut — composição */}
        <div className="card flex flex-col">
          <div className="section-title">Composição %</div>
          {composicaoData.every(d => d.value === 0) ? (
            <EmptyState title="Sem dados" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={composicaoData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value">
                    {composicaoData.map((_, i) => (
                      <Cell key={i} fill={COLORS.pie[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatNumber(v), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {composicaoData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS.pie[i] }} />
                    <span className="text-slate-600">{d.name}</span>
                    <span className="font-semibold">
                      {formatPercent(d.value / (composicaoData.reduce((s, x) => s + x.value, 0) || 1) * 100)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="strategic-note">
                <Sparkles size={18} />
                <div>
                  <strong>Leitura estratégica</strong>
                  <p>
                    {Number(kpis?.percentualSeminovos ?? 0) >= 50
                      ? 'Os itens seminovos predominam no período, ampliando o reaproveitamento e a economia estimada.'
                      : 'Os itens novos ainda predominam no período; acompanhe a evolução do reaproveitamento por setor.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Gráfico por Almoxarifado ───────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="card">
          <div className="section-title mb-1">Atendimentos por Almoxarifado</div>
          <p className="chart-description text-slate-500 text-xs mb-4">
            Distribuição de itens Novos e Seminovos separados por almoxarifado (Vila Prudente, Vila Guarani, Sapopemba, Canindé).
          </p>
          {porAlmoxarifado.length === 0 ? (
            <EmptyState title="Sem dados por almoxarifado" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={almoxChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="categoria" tick={{ fontSize: 12, fontWeight: 600, fill: '#1e293b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Itens Novos" stackId="a" fill={COLORS.novo} radius={[4, 4, 0, 0]} />
                {porAlmoxarifado.map((almox, idx) => (
                  <Bar
                    key={almox.almoxarifadoNome}
                    dataKey={almox.almoxarifadoNome}
                    stackId="a"
                    fill={ALMOX_COLORS[almox.almoxarifadoNome] || DEFAULT_ALMOX_COLORS[idx % DEFAULT_ALMOX_COLORS.length]}
                    radius={idx === porAlmoxarifado.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="dashboard-section grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <div className="section-title">Atendimentos por categoria</div>
          <p className="chart-description">Comparativo entre categorias femininas, masculinas e demais setores.</p>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={comparativos.categoria} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Novos" fill={COLORS.novo} radius={[5, 5, 0, 0]} />
              <Bar dataKey="Seminovos" fill={COLORS.seminovo} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Faixa etária beneficiada</div>
          <p className="chart-description">Distribuição entre setores de público adulto e infantil.</p>
          <div className="grid grid-cols-2 gap-3 my-4">
            {comparativos.faixa.map((grupo, index) => {
              const total = grupo.Novos + grupo.Seminovos
              const totalFaixas = comparativos.faixa.reduce((s, item) => s + item.Novos + item.Seminovos, 0)
              return (
                <div className="audience-stat" key={grupo.nome}>
                  {index === 0 ? <UsersRound size={23} /> : <Baby size={23} />}
                  <div>
                    <span>Público {grupo.nome}</span>
                    <strong>{formatNumber(total)}</strong>
                    <small>{formatPercent(totalFaixas > 0 ? total / totalFaixas * 100 : 0)} dos classificados</small>
                  </div>
                </div>
              )
            })}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparativos.faixa} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'var(--chart-text)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--chart-text)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Novos" fill="#3b82f6" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Seminovos" fill="#ec4899" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top 10 Itens + Economia por Setor ────────────────────────── */}
      <div className="dashboard-section grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 itens */}
        <div className="card">
          <div className="section-title">Top 10 Itens — Maior Volume</div>
          {topItens.length === 0 ? (
            <EmptyState title="Sem dados" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topItens.map(i => ({
                item: i.itemNome.length > 22 ? i.itemNome.slice(0, 22) + '…' : i.itemNome,
                Total: i.totalGeral,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="item" width={150} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Total" fill={COLORS.total} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Economia por setor */}
        <div className="card">
          <div className="section-title">Economia Estimada por Setor</div>
          {porSetor.length === 0 ? (
            <EmptyState title="Sem dados" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porSetor.map(s => ({
                setor: s.setorNome.length > 18 ? s.setorNome.slice(0, 18) + '…' : s.setorNome,
                Economia: s.economiaLiquida,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="setor" width={130} tick={{ fontSize: 10 }} />
                <Tooltip content={<EconomyTooltip />} />
                <Bar dataKey="Economia" fill={COLORS.economy} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Tabela Analítica ───────────────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-institutional-gray-border flex items-center justify-between">
            <div className="section-title mb-0">
              <AlertCircle size={16} />
              Tabela Analítica
            </div>
            <span className="text-xs text-slate-400">{tabelaData.count} registros</span>
          </div>

          {tabelaData.rows.length === 0 ? (
            <div className="p-8">
              <EmptyState title="Nenhum registro encontrado" description="Ajuste os filtros para ver dados." />
            </div>
          ) : (
            <div>
              <div className="table-wrapper border-0 rounded-none shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Competência</th>
                      <th>Almoxarifado</th>
                      <th>Setor</th>
                      <th>Item</th>
                      <th className="text-right">Qtd Novos</th>
                      <th className="text-right">Qtd Seminovos</th>
                      <th className="text-right">Custo Novo</th>
                      <th className="text-right">Custo Seminovo</th>
                      <th className="text-right">Economia</th>
                      <th>Fonte Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tabelaData.rows as Record<string, unknown>[]).map((row, i) => (
                      <tr key={i}>
                        <td>{formatCompetencia(String(row.competencia))}</td>
                        <td>{String(row.almoxarifadoNome ?? 'Geral')}</td>
                        <td className="max-w-[150px] truncate">{String(row.setorNome ?? '')}</td>
                        <td className="max-w-[150px] truncate">{String(row.itemNome ?? '')}</td>
                        <td className="text-right">{formatNumber(Number(row.totalNovos ?? 0))}</td>
                        <td className="text-right">{formatNumber(Number(row.totalSeminovos ?? 0))}</td>
                        <td className="text-right">{formatCurrency(Number(row.valorNovo ?? 0))}</td>
                        <td className="text-right">{formatCurrency(Number(row.valorSeminovo ?? 0))}</td>
                        <td className="text-right text-economy-green font-semibold">
                          {formatCurrency(Number(row.economiaLiquida ?? 0))}
                        </td>
                        <td>
                          <span className={`badge text-[10px] ${
                            String(row.fonteCusto) === 'padrao' ? 'badge-yellow' : 'badge-green'
                          }`}>
                            {String(row.fonteCusto ?? 'padrão')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-institutional-gray-border">
                <Pagination page={tabelaPage} totalPages={totalPaginas} onPage={setTabelaPage} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
