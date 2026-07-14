import { useState, useEffect } from 'react'
import { Upload, AlertTriangle, Trash2, Calendar, CalendarCheck, FileSpreadsheet } from 'lucide-react'
import { parseExcel, gerarPreview, confirmarImportacao, verificarDuplicidade, desfazerLote } from '@/services/importacao.service'
import type { LinhaExcel, ResultadoImportacao } from '@/services/importacao.service'
import { useAlmoxarifados } from '@/hooks/useAlmoxarifados'
import { useAuth } from '@/hooks/useAuth'
import { formatCompetencia, formatCurrency, formatNumber } from '@/utils/formatters'
import { Alert, LoadingSpinner, ConfirmDialog } from '@/components/ui'
import type { Almoxarifado } from '@/types/database'
import { supabase } from '@/services/supabase'

export default function ImportacaoPage() {
  const { user, profile } = useAuth()
  const { almoxarifados, loading: loadingAlmoxs } = useAlmoxarifados()

  // Estado do formulário e upload
  const [selectedAlmoxId, setSelectedAlmoxId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<LinhaExcel[]>([])

  // Status de processamento
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Prévia
  const [preview, setPreview] = useState<ResultadoImportacao | null>(null)
  const [duplicados, setDuplicados] = useState<unknown[]>([])

  // Histórico de Lotes
  const [lotes, setLotes] = useState<unknown[]>([])
  const [loadingLotes, setLoadingLotes] = useState(false)

  // Dialog para desfazer lote
  const [loteParaDesfazer, setLoteParaDesfazer] = useState<string | null>(null)
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)

  // Seleciona o almoxarifado "Geral" como padrão assim que carregado
  useEffect(() => {
    if (almoxarifados.length > 0) {
      const geral = almoxarifados.find((a: Almoxarifado) => a.nome.toLowerCase() === 'geral')
      if (geral) {
        setSelectedAlmoxId(geral.id)
      } else {
        setSelectedAlmoxId(almoxarifados[0].id)
      }
    }
  }, [almoxarifados])

  // Carrega histórico de lotes
  const fetchLotes = async () => {
    setLoadingLotes(true)
    try {
      const { data, error } = await supabase
        .from('lotes_importacao')
        .select(`
          *,
          almoxarifados(nome),
          profiles(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setLotes(data ?? [])
    } catch (e: unknown) {
      console.error('Erro ao buscar lotes:', e)
    } finally {
      setLoadingLotes(false)
    }
  }

  useEffect(() => {
    fetchLotes()
  }, [])

  // Handler de seleção do arquivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const uploadedFile = files[0]
    setFile(uploadedFile)
    setError(null)
    setSuccess(null)
    setPreview(null)
    setDuplicados([])

    setLoading(true)
    try {
      // 1. Parser do Excel
      const parsedData = await parseExcel(uploadedFile)
      setLinhas(parsedData)

      // 2. Verifica possíveis lotes com mesmo nome no almoxarifado
      if (selectedAlmoxId) {
        const dups = await verificarDuplicidade(uploadedFile.name, selectedAlmoxId)
        setDuplicados(dups)
      }

      // 3. Gera prévia
      if (selectedAlmoxId) {
        const previewRes = await gerarPreview(parsedData, selectedAlmoxId)
        setPreview(previewRes)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao processar planilha.')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  // Atualiza prévia quando muda almoxarifado
  const handleAlmoxChange = async (almoxId: string) => {
    setSelectedAlmoxId(almoxId)
    if (!file || linhas.length === 0) return

    setLoading(true)
    try {
      const dups = await verificarDuplicidade(file.name, almoxId)
      setDuplicados(dups)

      const previewRes = await gerarPreview(linhas, almoxId)
      setPreview(previewRes)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar prévia.')
    } finally {
      setLoading(false)
    }
  }

  // Salva importação no Supabase
  const handleConfirmar = async () => {
    if (!file || linhas.length === 0 || !selectedAlmoxId || !user) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await confirmarImportacao(
        linhas,
        selectedAlmoxId,
        user.id,
        file.name
      )

      if (result.error) {
        throw new Error(result.error)
      }

      setSuccess(`Lote importado com sucesso! Código do Lote: ${result.loteId}`)
      setFile(null)
      setLinhas([])
      setPreview(null)
      setDuplicados([])
      fetchLotes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar os dados no banco.')
    } finally {
      setLoading(false)
    }
  }

  // Ação de Desfazer Importação (ADMIN apenas)
  const handleDesfazerLote = async () => {
    if (!loteParaDesfazer || !user) return

    setUndoing(true)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await desfazerLote(loteParaDesfazer)
      if (error) throw new Error(error)

      setSuccess('O lote de importação foi desfeito e todos os lançamentos vinculados foram removidos.')
      setConfirmUndoOpen(false)
      setLoteParaDesfazer(null)
      fetchLotes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao desfazer lote.')
      setConfirmUndoOpen(false)
      setLoteParaDesfazer(null)
    } finally {
      setUndoing(false)
    }
  }

  const isAdmin = profile?.role === 'ADMIN'

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Importação de Planilha</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Importe saídas a partir do relatório comparativo ou da aba tblSeminovos
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-6" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Upload (Esquerda) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="card">
            <h2 className="text-base font-semibold text-institutional-blue mb-4">
              1. Configuração e Upload
            </h2>

            <div className="form-group mb-6">
              <label className="label label-required">Almoxarifado de Destino</label>
              <p className="text-xs text-slate-400 mb-2">
                Usado para os itens novos. Os seminovos do relatório comparativo são direcionados automaticamente pelas colunas VP, SPB e VG.
              </p>
              {loadingAlmoxs ? (
                <div className="text-sm text-slate-400">Carregando almoxarifados...</div>
              ) : (
                <select
                  className="select"
                  value={selectedAlmoxId}
                  onChange={(e) => handleAlmoxChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Selecione o almoxarifado...</option>
                  {almoxarifados.map((a: Almoxarifado) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} {!a.aceita_novos ? '(Apenas Seminovos)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedAlmoxId && (
              <div className="upload-zone">
                <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                  <Upload size={36} className="text-slate-400 mb-3" />
                  <span className="text-sm font-semibold text-slate-600">
                    Clique para selecionar a planilha
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Formatos aceitos: .xlsx, .xls
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    disabled={loading || !selectedAlmoxId}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Prévia dos Dados */}
          {preview && (
            <div className="card animate-fade-in">
              <div className="flex items-center justify-between border-b border-institutional-gray-border pb-4 mb-4">
                <h2 className="text-base font-semibold text-institutional-blue flex items-center gap-2">
                  <FileSpreadsheet size={18} />
                  2. Prévia da Importação
                </h2>
                {duplicados.length > 0 && (
                  <span className="badge badge-yellow flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Nome de arquivo já importado
                  </span>
                )}
              </div>

              <div className={`mb-6 rounded-xl border p-4 flex items-start gap-3 ${
                preview.competenciasDetectadas.length === 1
                  ? 'bg-green-50 border-green-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <CalendarCheck
                  size={24}
                  className={preview.competenciasDetectadas.length === 1 ? 'text-economy-green shrink-0' : 'text-amber-600 shrink-0'}
                />
                <div>
                  <span className={`text-xs font-semibold uppercase tracking-wider block ${
                    preview.competenciasDetectadas.length === 1 ? 'text-economy-green' : 'text-amber-700'
                  }`}>
                    {preview.competenciasDetectadas.length === 1 ? 'Competência confirmada' : 'Competências detectadas'}
                  </span>
                  <strong className="text-xl text-institutional-blue block mt-0.5">
                    {preview.competenciasDetectadas.map(formatCompetencia).join(', ')}
                  </strong>
                  <p className="text-xs text-slate-500 mt-1">
                    Confira o mês e o ano antes de confirmar a gravação no banco.
                  </p>
                </div>
              </div>

              {/* Grid de totais da prévia */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 block font-medium">Linhas lidas</span>
                  <span className="text-lg font-bold text-slate-700">{formatNumber(preview.totalLinhas)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 block font-medium">Lançamentos Novos</span>
                  <span className="text-lg font-bold text-slate-700">{formatNumber(preview.totalNovo)}</span>
                  <span className="text-[10px] text-slate-400 block">Qtd: {formatNumber(preview.totalQtdNovo)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 block font-medium">Lançamentos Seminovos</span>
                  <span className="text-lg font-bold text-slate-700">{formatNumber(preview.totalSeminovo)}</span>
                  <span className="text-[10px] text-slate-400 block">Qtd: {formatNumber(preview.totalQtdSeminovo)}</span>
                </div>
                <div className="p-3 bg-economy-green-light rounded-xl border border-green-200">
                  <span className="text-xs text-economy-green block font-medium">Economia Líquida Estimada</span>
                  <span className="text-lg font-bold text-economy-green">{formatCurrency(preview.economiaEstimada)}</span>
                  <span className="text-[10px] text-economy-green/80 block">Base: R$ 36,00/un</span>
                </div>
              </div>

              {/* Setores, itens e almoxarifados */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Setores Novos Encontrados ({preview.setoresNovos.length})
                  </h3>
                  {preview.setoresNovos.length === 0 ? (
                    <span className="text-xs text-slate-400">Nenhum setor novo</span>
                  ) : (
                    <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                      {preview.setoresNovos.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Itens Novos Encontrados ({preview.itensNovos.length})
                  </h3>
                  {preview.itensNovos.length === 0 ? (
                    <span className="text-xs text-slate-400">Nenhum item novo</span>
                  ) : (
                    <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                      {preview.itensNovos.map((it, i) => <li key={i}>{it}</li>)}
                    </ul>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Almoxarifados no Arquivo ({preview.almoxarifadosEncontrados.length})
                  </h3>
                  {preview.almoxarifadosEncontrados.length === 0 ? (
                    <span className="text-xs text-slate-400">Sem colunas de almoxarifado no arquivo</span>
                  ) : (
                    <ul className="list-disc pl-4 text-xs text-slate-600 space-y-1">
                      {preview.almoxarifadosEncontrados.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                </div>
              </div>

              {/* Inconsistências */}
              {preview.inconsistencias.length > 0 && (
                <div className="alert alert-warning mb-6">
                  <AlertTriangle size={18} className="shrink-0" />
                  <div>
                    <span className="font-semibold block">Inconsistências identificadas na planilha:</span>
                    <ul className="list-disc pl-4 text-xs mt-1 space-y-0.5">
                      {preview.inconsistencias.map((inc, i) => <li key={i}>{inc}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {/* Ação de gravação */}
              {preview.avisos.length > 0 && (
                <div className="alert alert-warning mb-6">
                  <AlertTriangle size={18} className="shrink-0" />
                  <div>
                    <span className="font-semibold block">Importação permitida com ajustes posteriores:</span>
                    <ul className="list-disc pl-4 text-xs mt-1 space-y-0.5">
                      {preview.avisos.map((aviso, i) => <li key={i}>{aviso}</li>)}
                    </ul>
                    <p className="text-xs mt-2">
                      Códigos em OUTROS: {preview.codigosNaoClassificados.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-institutional-gray-border">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                    setLinhas([])
                    setDuplicados([])
                  }}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  onClick={handleConfirmar}
                  disabled={loading || preview.inconsistencias.length > 0}
                >
                  {loading && <LoadingSpinner size="sm" />}
                  Confirmar e Gravar no Banco
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Histórico de Lotes (Direita) */}
        <div className="card flex flex-col h-fit">
          <h2 className="text-base font-semibold text-institutional-blue mb-4">
            Histórico Recente de Lotes
          </h2>

          {loadingLotes ? (
            <div className="text-center py-6 text-slate-400 text-sm">Carregando histórico...</div>
          ) : lotes.length === 0 ? (
            <span className="text-slate-400 text-sm">Nenhum lote importado ainda.</span>
          ) : (
            <div className="space-y-3">
              {(lotes as Record<string, unknown>[]).map((lote) => {
                const status = String(lote.status)
                const isDesfeito = status === 'DESFEITO'

                return (
                  <div
                    key={String(lote.id)}
                    className={`p-3 rounded-lg border text-sm transition-all ${
                      isDesfeito ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-slate-700 truncate max-w-[150px] block" title={String(lote.nome_arquivo)}>
                        {String(lote.nome_arquivo)}
                      </span>
                      <span className={`badge text-[10px] ${
                        status === 'CONCLUIDO' ? 'badge-green' : isDesfeito ? 'badge-gray' : 'badge-red'
                      }`}>
                        {status}
                      </span>
                    </div>

                    <div className="text-slate-500 text-xs mt-1.5 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(String(lote.created_at)).toLocaleString('pt-BR')}
                      </div>
                      <div>
                        Almoxarifado: <span className="font-medium text-slate-600">{(lote.almoxarifados as Record<string, unknown>)?.nome as string ?? 'Geral'}</span>
                      </div>
                      <div>
                        Novos: <span className="font-medium text-slate-600">{formatNumber(Number(lote.total_qtd_novo))}</span> |
                        Seminovos: <span className="font-medium text-slate-600">{formatNumber(Number(lote.total_qtd_seminovo))}</span>
                      </div>
                    </div>

                    {isAdmin && !isDesfeito && (
                      <div className="flex items-center justify-end mt-2 pt-2 border-t border-slate-100">
                        <button
                          className="text-alert-red hover:text-red-700 font-medium text-xs flex items-center gap-1 cursor-pointer"
                          onClick={() => {
                            setLoteParaDesfazer(String(lote.id))
                            setConfirmUndoOpen(true)
                          }}
                        >
                          <Trash2 size={12} />
                          Desfazer lote
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmUndoOpen}
        title="Desfazer Lote de Importação"
        description="Esta ação é irreversível. Todos os lançamentos de saídas associados a este lote serão permanentemente excluídos do banco de dados e a economia recalculada. Deseja continuar?"
        confirmLabel={undoing ? 'Desfazendo...' : 'Sim, Desfazer'}
        cancelLabel="Voltar"
        onConfirm={handleDesfazerLote}
        onCancel={() => {
          setConfirmUndoOpen(false)
          setLoteParaDesfazer(null)
        }}
        loading={undoing}
      />
    </div>
  )
}
