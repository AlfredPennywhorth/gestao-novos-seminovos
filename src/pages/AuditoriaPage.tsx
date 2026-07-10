import { useState, useEffect, useCallback } from 'react'
import { Filter, RefreshCw, ClipboardList, Info } from 'lucide-react'
import { listAuditoria } from '@/services/auditoria.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner, EmptyState, Pagination } from '@/components/ui'
import type { Auditoria } from '@/types/database'

export default function AuditoriaPage() {
  const { profile } = useAuth()
  
  // Lista de auditoria
  const [logs, setLogs] = useState<Auditoria[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroTabela, setFiltroTabela] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  // Paginação
  const [page, setPage] = useState(1)
  const LIMIT = 20

  // Detalhe de JSON selecionado
  const [activeJson, setActiveJson] = useState<{ label: string; data: Record<string, unknown> | null } | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filtros: any = {}
      if (filtroTabela) filtros.tabela = filtroTabela
      if (dataInicio) filtros.dataInicio = `${dataInicio}T00:00:00Z`
      if (dataFim) filtros.dataFim = `${dataFim}T23:59:59Z`

      const res = await listAuditoria(filtros, page, LIMIT)
      // Ajustar filtro de ação no frontend se não filtrado pelo backend
      let rows = res.data
      if (filtroAcao) {
        rows = rows.filter(r => r.acao === filtroAcao)
      }
      setLogs(rows)
      setCount(res.count)
    } catch {
      setError('Erro ao carregar registros de auditoria do banco.')
    } finally {
      setLoading(false)
    }
  }, [filtroTabela, filtroAcao, dataInicio, dataFim, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPaginas = Math.ceil(count / LIMIT)

  if (profile?.role !== 'ADMIN') {
    return (
      <div className="card text-center max-w-md mx-auto mt-20">
        <h2 className="text-lg font-bold text-alert-red mb-2">Acesso Restrito</h2>
        <p className="text-slate-500 text-sm">Esta página está disponível apenas para administradores.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Logs de Auditoria</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitore as ações executadas pelos usuários no sistema
          </p>
        </div>
        <button className="btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filtros */}
      <div className="filter-bar">
        <div className="flex items-center gap-2 text-slate-500 mr-2">
          <Filter size={16} />
          <span className="text-sm font-medium">Filtrar</span>
        </div>

        <div className="filter-group">
          <label className="label text-xs">Tabela Afetada</label>
          <select
            className="select text-sm py-1.5"
            value={filtroTabela}
            onChange={(e) => {
              setFiltroTabela(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todas</option>
            <option value="saidas_itens">saidas_itens</option>
            <option value="lotes_importacao">lotes_importacao</option>
            <option value="custos_mensais_itens">custos_mensais_itens</option>
            <option value="almoxarifados">almoxarifados</option>
            <option value="setores">setores</option>
            <option value="itens">itens</option>
            <option value="profiles">profiles</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="label text-xs">Ação</label>
          <select
            className="select text-sm py-1.5"
            value={filtroAcao}
            onChange={(e) => {
              setFiltroAcao(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Todas</option>
            <option value="IMPORTACAO">IMPORTACAO</option>
            <option value="DESFAZER_LOTE">DESFAZER_LOTE</option>
            <option value="CRIAR_SAIDA">CRIAR_SAIDA</option>
            <option value="EXCLUIR_SAIDA">EXCLUIR_SAIDA</option>
            <option value="ATUALIZAR_CUSTO">ATUALIZAR_CUSTO</option>
            <option value="ALTERAR_PERFIL">ALTERAR_PERFIL</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="label text-xs">Data de Início</label>
          <input
            type="date"
            className="input py-1.5 text-sm"
            value={dataInicio}
            onChange={(e) => {
              setDataInicio(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="filter-group">
          <label className="label text-xs">Data de Fim</label>
          <input
            type="date"
            className="input py-1.5 text-sm"
            value={dataFim}
            onChange={(e) => {
              setDataFim(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <button
          className="btn-secondary btn-sm self-end"
          onClick={() => {
            setFiltroTabela('')
            setFiltroAcao('')
            setDataInicio('')
            setDataFim('')
            setPage(1)
          }}
        >
          <RefreshCw size={14} />
          Limpar
        </button>
      </div>

      {/* Grid: Lista + Modal Detalhe JSON */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              title="Nenhum log de auditoria encontrado"
              description="Ações relevantes executadas pelos usuários aparecerão nesta tela."
              icon={<ClipboardList size={48} />}
            />
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="table-wrapper border-0 rounded-none shadow-none">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Usuário</th>
                      <th>Ação</th>
                      <th>Tabela</th>
                      <th>Registro</th>
                      <th className="text-center">Dados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const userMail = (log as any).profiles?.email ?? 'Sistema'
                      const hasDetails = log.dados_anteriores || log.dados_novos
                      
                      return (
                        <tr key={log.id}>
                          <td className="whitespace-nowrap text-xs">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="text-xs text-slate-500 font-medium">{userMail}</td>
                          <td>
                            <span className={`badge text-[10px] ${
                              log.acao.startsWith('EXCLUIR') || log.acao === 'DESFAZER_LOTE'
                                ? 'badge-red'
                                : log.acao.startsWith('CRIAR') || log.acao === 'IMPORTACAO'
                                ? 'badge-green'
                                : 'badge-blue'
                            }`}>
                              {log.acao}
                            </span>
                          </td>
                          <td className="text-xs font-mono text-slate-400">{log.tabela_afetada ?? '—'}</td>
                          <td className="text-xs font-mono text-slate-400 max-w-[80px] truncate" title={log.registro_id ?? ''}>
                            {log.registro_id ? log.registro_id.slice(0, 8) + '…' : '—'}
                          </td>
                          <td className="text-center">
                            {hasDetails ? (
                              <button
                                className="btn-secondary btn-sm !py-1 !px-2 text-xs flex items-center gap-1 cursor-pointer mx-auto"
                                onClick={() => setActiveJson({
                                  label: `${log.acao} - ${log.tabela_afetada}`,
                                  data: {
                                    Anteriores: log.dados_anteriores,
                                    Novos: log.dados_novos,
                                    Ip: log.ip_address
                                  }
                                })}
                              >
                                <Info size={12} />
                                Ver
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">Nenhum</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-institutional-gray-border">
                <Pagination page={page} totalPages={totalPaginas} onPage={setPage} />
              </div>
            </div>
          )}
        </div>

        {/* Detalhes de JSON (Coluna direita) */}
        <div>
          <div className="card sticky top-20">
            <h2 className="text-base font-semibold text-institutional-blue mb-4 flex items-center gap-2">
              Detalhes da Ação
            </h2>
            {activeJson ? (
              <div className="animate-fade-in">
                <div className="mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase block tracking-wider">Ação / Tabela</span>
                  <span className="text-sm font-semibold text-institutional-blue">{activeJson.label}</span>
                </div>
                
                <div className="space-y-4">
                  {!!activeJson.data?.Anteriores && (
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Dados Anteriores</span>
                      <pre className="bg-slate-900 text-slate-300 text-[10px] font-mono p-3 rounded-lg overflow-x-auto max-h-[180px]">
                        {JSON.stringify(activeJson.data.Anteriores, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!!activeJson.data?.Novos && (
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Dados Novos</span>
                      <pre className="bg-slate-900 text-emerald-400 text-[10px] font-mono p-3 rounded-lg overflow-x-auto max-h-[180px]">
                        {JSON.stringify(activeJson.data.Novos, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!!activeJson.data?.Ip && (
                    <div>
                      <span className="text-xs text-slate-400">Origem IP: <strong className="font-mono text-slate-600">{String(activeJson.data.Ip)}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">
                Selecione um registro na tabela para visualizar o histórico de alterações detalhado.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
