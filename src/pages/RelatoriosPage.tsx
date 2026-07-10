import { useState } from 'react'
import { FileSpreadsheet, Download, FileText, RefreshCw } from 'lucide-react'
import { useAlmoxarifados } from '@/hooks/useAlmoxarifados'
import { useSetores } from '@/hooks/useSetores'
import {
  exportarExcel,
  exportarCSV,
  getSaidasPorPeriodo,
  getComparativoNovosSeminovos,
  getEconomiaPorMes,
  getEconomiaPorSetor,
  getEconomiaPorAlmoxarifado,
  getItensSemCusto,
  getHistoricoImportacoes
} from '@/services/relatorios.service'
import { Alert, LoadingSpinner, EmptyState } from '@/components/ui'
import type { Almoxarifado, Setor } from '@/types/database'

const RELATORIOS = [
  { id: 'saidas', label: 'Saídas por Período', desc: 'Lista detalhada de todas as movimentações e seus respectivos custos.', fn: getSaidasPorPeriodo, file: 'saidas_por_periodo' },
  { id: 'comparativo', label: 'Comparativo Novos x Seminovos', desc: 'Comparação de volumes mensais de peças novas e seminovas.', fn: getComparativoNovosSeminovos, file: 'comparativo_novos_seminovos' },
  { id: 'economia_mes', label: 'Economia Estimada por Mês', desc: 'Resumo mensal da economia gerada com o uso de itens seminovos.', fn: getEconomiaPorMes, file: 'economia_por_mes' },
  { id: 'economia_setor', label: 'Economia Estimada por Setor', desc: 'Resumo por setor/classificação da economia gerada.', fn: getEconomiaPorSetor, file: 'economia_por_setor' },
  { id: 'economia_almox', label: 'Economia por Almoxarifado', desc: 'Resumo por unidade operacional da economia gerada.', fn: getEconomiaPorAlmoxarifado, file: 'economia_por_almoxarifado' },
  { id: 'sem_custo', label: 'Itens Sem Custo Cadastrado', desc: 'Lista de competências e itens usando o fallback padrão do sistema.', fn: getItensSemCusto, file: 'itens_sem_custo_especifico' },
  { id: 'importacoes', label: 'Histórico de Importações', desc: 'Registro de planilhas importadas, status e totais.', fn: getHistoricoImportacoes, file: 'historico_de_importacoes' },
]

export default function RelatoriosPage() {
  const { almoxarifados } = useAlmoxarifados()
  const { setores } = useSetores()

  const [selectedRel, setSelectedRel] = useState(RELATORIOS[0].id)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [almoxarifadoId, setAlmoxarifadoId] = useState('')
  const [setorId, setSetorId] = useState('')

  const [loading, setLoading] = useState(false)
  const [dadosPreview, setDadosPreview] = useState<object[]>([])
  const [error, setError] = useState<string | null>(null)
  const [gerado, setGerado] = useState(false)

  const currentRel = RELATORIOS.find(r => r.id === selectedRel)!

  // Gera a visualização
  const handleGerar = async () => {
    setLoading(true)
    setError(null)
    setGerado(false)
    try {
      const filtros: any = {}
      if (dataInicio) filtros.dataInicio = `${dataInicio}-01`
      if (dataFim) filtros.dataFim = `${dataFim}-01`
      if (almoxarifadoId) filtros.almoxarifadoId = almoxarifadoId
      if (setorId) filtros.setorId = setorId

      const res = await currentRel.fn(filtros)
      setDadosPreview(res)
      setGerado(true)
    } catch {
      setError('Erro ao processar dados do relatório.')
    } finally {
      setLoading(false)
    }
  }

  // Exportar Excel
  const handleExportExcel = () => {
    if (dadosPreview.length === 0) return
    exportarExcel(dadosPreview, currentRel.file, currentRel.label)
  }

  // Exportar CSV
  const handleExportCSV = () => {
    if (dadosPreview.length === 0) return
    exportarCSV(dadosPreview, currentRel.file)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios &amp; Exportação</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gere visualizações de dados específicas e exporte para análise em planilhas externas
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Painel de seleção de relatórios e filtros */}
        <div className="card h-fit flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
              1. Selecionar Relatório
            </h2>
            <div className="flex flex-col gap-2">
              {RELATORIOS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedRel === r.id
                      ? 'bg-institutional-blue-light text-institutional-blue font-semibold'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  onClick={() => {
                    setSelectedRel(r.id)
                    setDadosPreview([])
                    setGerado(false)
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-institutional-gray-border pt-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
              2. Aplicar Filtros
            </h2>

            <div className="flex flex-col gap-4">
              <div className="form-group">
                <label className="label text-xs">Mês/Ano Inicial</label>
                <input
                  type="month"
                  className="input"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label text-xs">Mês/Ano Final</label>
                <input
                  type="month"
                  className="input"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              {selectedRel !== 'importacoes' && selectedRel !== 'sem_custo' && (
                <>
                  <div className="form-group">
                    <label className="label text-xs">Almoxarifado</label>
                    <select
                      className="select"
                      value={almoxarifadoId}
                      onChange={(e) => setAlmoxarifadoId(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {almoxarifados.map((a: Almoxarifado) => (
                        <option key={a.id} value={a.id}>{a.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="label text-xs">Setor</label>
                    <select
                      className="select"
                      value={setorId}
                      onChange={(e) => setSetorId(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {setores.map((s: Setor) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button
                type="button"
                className="btn-primary w-full mt-2"
                onClick={handleGerar}
                disabled={loading}
              >
                {loading ? <LoadingSpinner size="sm" /> : <RefreshCw size={15} />}
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>

        {/* Painel de Preview e Exportação */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="card">
            <div className="flex items-center justify-between border-b border-institutional-gray-border pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-institutional-blue">
                  {currentRel.label}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{currentRel.desc}</p>
              </div>

              {dadosPreview.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={handleExportExcel} className="btn-secondary btn-sm">
                    <FileSpreadsheet size={14} className="text-economy-green" />
                    Excel
                  </button>
                  <button onClick={handleExportCSV} className="btn-secondary btn-sm">
                    <Download size={14} className="text-institutional-blue-medium" />
                    CSV
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
              </div>
            ) : !gerado ? (
              <EmptyState
                title="Configure os filtros e gere o relatório"
                description="Os resultados aparecerão aqui para pré-visualização e download."
                icon={<FileText size={48} />}
              />
            ) : dadosPreview.length === 0 ? (
              <EmptyState
                title="Nenhum dado encontrado"
                description="Tente ajustar as datas ou remover filtros para encontrar dados."
              />
            ) : (
              <div className="table-wrapper max-h-[500px] overflow-y-auto">
                <table className="table">
                  <thead>
                    <tr>
                      {Object.keys(dadosPreview[0]).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosPreview.map((row: any, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, idx) => (
                          <td key={idx}>
                            {typeof val === 'number'
                              ? val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                              : String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
