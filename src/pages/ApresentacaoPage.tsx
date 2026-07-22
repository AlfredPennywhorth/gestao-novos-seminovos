import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'
import { X, RefreshCw } from 'lucide-react'
import { getDashboardKPIs, getSerieTemporal, getResumoPorSetor } from '@/services/dashboard.service'
import { formatCurrency, formatNumber, formatPercent, formatMesResumido } from '@/utils/formatters'
import { LoadingPage } from '@/components/ui'
import type { KPIData, SerieTemporalItem, ResumoPorSetor } from '@/types/dashboard'

export default function ApresentacaoPage() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [serie, setSerie] = useState<SerieTemporalItem[]>([])
  const [porSetor, setPorSetor] = useState<ResumoPorSetor[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const ano = now.getFullYear()
    const params = {
      dataInicio: `${ano}-01-01`,
      dataFim: `${ano}-12-31`,
    }
    const [k, s, st] = await Promise.all([
      getDashboardKPIs(params),
      getSerieTemporal(params),
      getResumoPorSetor(params),
    ])
    setKpis(k)
    setSerie(s)
    setPorSetor(st.slice(0, 6))
    setLoading(false)
  }, [now])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingPage />

  const ano = now.getFullYear()
  const dataFormatada = now.toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Cabeçalho institucional ─────────────────────────────── */}
      <header className="apresentacao-header">
        <div>
          <h1 className="text-3xl font-bold text-institutional-blue leading-tight">
            Gestão de Itens Novos &amp; Seminovos
          </h1>
          <p className="text-slate-500 text-sm mt-1 capitalize">{dataFormatada}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-32 overflow-hidden flex items-center justify-center p-1 border border-slate-100 rounded-lg">
            <img src="/logo.png" alt="Logo CCB" className="h-full w-full object-contain" />
          </div>
          {/* Controles */}
          <button onClick={fetchData} className="btn-secondary btn-sm" title="Atualizar">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => navigate('/')} className="btn-secondary btn-sm" title="Fechar">
            <X size={14} />
          </button>
        </div>
      </header>

      {/* ── Linha divisória azul ────────────────────────────────── */}
      <div className="apresentacao-divider" />

      {/* ── Conteúdo principal ─────────────────────────────────── */}
      <main className="flex-1 px-8 py-6 bg-white">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total de Saídas',    value: formatNumber(Number(kpis?.totalSaidas ?? 0)),     color: '#1a3a6b' },
            { label: 'Itens Novos',         value: formatNumber(Number(kpis?.totalNovos ?? 0)),      color: '#2563eb' },
            { label: 'Itens Seminovos',     value: formatNumber(Number(kpis?.totalSeminovos ?? 0)), color: '#16a34a' },
            { label: '% Novos',             value: formatPercent(kpis ? (kpis.totalSaidas > 0 ? (kpis.totalNovos / kpis.totalSaidas) * 100 : 0) : 0), color: '#2563eb' },
            { label: '% Seminovos',         value: formatPercent(Number(kpis?.percentualSeminovos ?? 0)), color: '#16a34a' },
            { label: 'Economia Estimada',  value: formatCurrency(Number(kpis?.economiaEstimada ?? 0)),   color: '#16a34a' },
            { label: 'Custo Evitado Bruto', value: formatCurrency(Number(kpis?.custoEvitadoBruto ?? 0)), color: '#1a3a6b' },
            { label: 'Média Mensal',        value: formatCurrency(Number(kpis?.mediaMensalEconomia ?? 0)), color: '#1a3a6b' },
            { label: 'Meses com Dados',    value: String(kpis?.mesesComDados ?? 0),                  color: '#64748b' },
          ].map((kpi) => {
            const isCurrency = typeof kpi.value === 'string' && kpi.value.includes('R$');
            const cleanValue = isCurrency 
              ? kpi.value.replace(/R\$\s*|R\$\u00a0/g, '').trim()
              : kpi.value;
            return (
              <div key={kpi.label} className="card text-center py-3 flex flex-col justify-center min-h-[85px] p-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1 break-words min-h-[16px]">{kpi.label}</p>
                {isCurrency ? (
                  <div className="leading-tight mt-1">
                    <span className="text-[9px] font-bold text-slate-400 block leading-none mb-0.5">R$</span>
                    <span className="text-xl font-extrabold tracking-tight block" style={{ color: kpi.color }}>
                      {cleanValue}
                    </span>
                  </div>
                ) : (
                  <p className="text-xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-2 gap-6">
          {/* Gráfico principal */}
          <div className="card">
            <h2 className="text-base font-semibold text-institutional-blue mb-4">
              Evolução Mensal — {ano}
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={serie.map(s => ({
                mes: formatMesResumido(s.mes),
                Novos: s.totalNovos,
                Seminovos: s.totalSeminovos,
                Total: s.totalGeral,
              }))}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Total" stroke="#1a3a6b"
                  fill="none" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                <Area type="monotone" dataKey="Novos" stroke="#2563eb"
                  fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="Seminovos" stroke="#16a34a"
                  fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Barras por setor */}
          <div className="card">
            <h2 className="text-base font-semibold text-institutional-blue mb-4">
              Saídas por Setor
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porSetor.map(s => ({
                setor: s.setorNome.length > 16 ? s.setorNome.slice(0, 16) + '…' : s.setorNome,
                Novos: s.totalNovos,
                Seminovos: s.totalSeminovos,
              }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="setor" width={120} tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Novos" fill="#2563eb" radius={[0, 3, 3, 0]} />
                <Bar dataKey="Seminovos" fill="#16a34a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>

      {/* ── Rodapé institucional ────────────────────────────────── */}
      <footer className="apresentacao-footer">
        <div className="text-white/70 text-sm">
          Sistema de Gestão de Saídas — Novos &amp; Seminovos
        </div>
        <div className="text-white/50 text-xs">
          Gerado em {now.toLocaleDateString('pt-BR')} às {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-white text-sm font-semibold">
          {ano}
        </div>
      </footer>
    </div>
  )
}
