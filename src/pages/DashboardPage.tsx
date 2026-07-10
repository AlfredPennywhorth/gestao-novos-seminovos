import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Package, Recycle, TrendingUp, Percent,
  DollarSign, ShieldCheck, BarChart2, Presentation,
  AlertCircle, RefreshCw, Filter
} from 'lucide-react'
import { getDashboardKPIs, getSerieTemporal, getResumoPorSetor, getResumoPorItem, getTabelaAnalitica } from '@/services/dashboard.service'
import { useAlmoxarifados } from '@/hooks/useAlmoxarifados'
import { useSetores } from '@/hooks/useSetores'
import { formatCurrency, formatNumber, formatPercent, formatCompetencia } from '@/utils/formatters'
import { LoadingPage, EmptyState, Alert, Pagination } from '@/components/ui'
import type { KPIData, SerieTemporalItem, ResumoPorSetor, ResumoPorItem, FiltrosDashboard } from '@/types/dashboard'

// ─── Paleta de cores ────────────────────────────────────────────────────────
const COLORS = {
  novo:     '#2563eb',
  seminovo: '#16a34a',
  total:    '#1a3a6b',
  economy:  '#16a34a',
  pie:      ['#2563eb', '#16a34a'],
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
    <div className={`kpi-card animate-fade-in ${highlight ? 'border-economy-green' : ''} p-5 min-h-[140px] flex flex-col justify-between`}>
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
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="bg-white border border-institutional-gray-border rounded-lg shadow-card-hover p-3 text-sm">
      <p className="font-semibold text-institutional-blue mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-medium">{formatNumber(p.value)}</span>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alertaCusto, setAlertaCusto] = useState(false)

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
      const [kpiRes, serieRes, setorRes, itensRes] = await Promise.all([
        getDashboardKPIs(params),
        getSerieTemporal(params),
        getResumoPorSetor(params),
        getResumoPorItem(params, 10),
      ])
      setKpis(kpiRes)
      setSerie(serieRes)
      setPorSetor(setorRes)
      setTopItens(itensRes)
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

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="dashboard-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <KPICard
            label="Total de Saídas"
            value={formatNumber(Number(kpis?.totalSaidas ?? 0))}
            icon={<Package size={20} className="text-institutional-blue" />}
          />
          <KPICard
            label="Itens Novos"
            value={formatNumber(Number(kpis?.totalNovos ?? 0))}
            icon={<Package size={20} className="text-institutional-blue-medium" />}
            iconBg="bg-blue-50"
          />
          <KPICard
            label="Itens Seminovos"
            value={formatNumber(Number(kpis?.totalSeminovos ?? 0))}
            icon={<Recycle size={20} className="text-economy-green" />}
            iconBg="bg-economy-green-light"
          />
          <KPICard
            label="% Novos"
            value={formatPercent(kpis ? (kpis.totalSaidas > 0 ? (kpis.totalNovos / kpis.totalSaidas) * 100 : 0) : 0)}
            sub="sobre o total"
            icon={<Percent size={20} className="text-slate-500" />}
            iconBg="bg-slate-100"
          />
          <KPICard
            label="% Seminovos"
            value={formatPercent(Number(kpis?.percentualSeminovos ?? 0))}
            sub="sobre o total"
            icon={<Percent size={20} className="text-slate-500" />}
            iconBg="bg-slate-100"
          />
          <KPICard
            label="Economia Estimada"
            value={formatCurrency(Number(kpis?.economiaEstimada ?? 0))}
            sub="líquida acumulada"
            icon={<DollarSign size={20} className="text-economy-green" />}
            iconBg="bg-economy-green-light"
            highlight
          />
          <KPICard
            label="Custo Evitado Bruto"
            value={formatCurrency(Number(kpis?.custoEvitadoBruto ?? 0))}
            sub="se fossem todos novos"
            icon={<ShieldCheck size={20} className="text-institutional-blue" />}
          />
          <KPICard
            label="Média Mensal"
            value={formatCurrency(Number(kpis?.mediaMensalEconomia ?? 0))}
            sub={`em ${kpis?.mesesComDados ?? 0} meses`}
            icon={<TrendingUp size={20} className="text-institutional-blue" />}
          />
        </div>
      </div>

      {/* ── Gráfico Principal: Série Temporal ──────────────────────────── */}
      <div className="dashboard-section">
        <div className="card">
          <div className="section-title">
            <BarChart2 size={18} />
            Evolução Mensal — Novos × Seminovos × Total
          </div>
          {serie.length === 0 ? (
            <EmptyState
              title="Nenhum dado para o período selecionado"
              description="Ajuste os filtros ou importe dados da planilha."
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={serie.map(s => ({
                mes: formatCompetencia(s.mes),
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
            </>
          )}
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
