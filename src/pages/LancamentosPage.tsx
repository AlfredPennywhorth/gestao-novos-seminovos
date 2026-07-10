import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Calendar, FileText, AlertTriangle } from 'lucide-react'
import { useAlmoxarifados } from '@/hooks/useAlmoxarifados'
import { useSetores } from '@/hooks/useSetores'
import { listItensPorSetor, vincularItemSetor, listItens } from '@/services/itens.service'
import { createSaidasLote } from '@/services/saidas.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/ui'
import type { Almoxarifado, Setor, Item, InsertSaidaItem } from '@/types/database'
import { TipoSaida as TipoSaidaEnum, OrigemSaida } from '@/types/database'

// ─── Validação com Zod ───────────────────────────────────────────────────────
const itemSaidaSchema = z.object({
  itemId: z.string().min(1, 'Selecione o item'),
  quantidadeNovos: z.number().int().nonnegative('Mínimo 0'),
  quantidadeSeminovos: z.number().int().nonnegative('Mínimo 0'),
  observacao: z.string().optional(),
}).refine(data => data.quantidadeNovos > 0 || data.quantidadeSeminovos > 0, {
  message: 'Defina quantidade para Novo ou Seminovo',
  path: ['quantidadeNovos'], // Foca o erro na quantidade
})

const lancamentoSchema = z.object({
  competencia: z.string().min(1, 'Defina a competência'),
  periodoTexto: z.string().optional(),
  almoxarifadoId: z.string().min(1, 'Selecione o almoxarifado'),
  setorId: z.string().min(1, 'Selecione o setor'),
  itens: z.array(itemSaidaSchema).min(1, 'Adicione pelo menos um item'),
})

type LancamentoForm = z.infer<typeof lancamentoSchema>

export default function LancamentosPage() {
  const { user } = useAuth()
  const { almoxarifados, loading: loadingAlmoxs } = useAlmoxarifados()
  const { setores, loading: loadingSetores } = useSetores()

  // Lista de itens filtrados pelo setor selecionado
  const [itensSetor, setItensSetor] = useState<Item[]>([])
  const [loadingItens, setLoadingItens] = useState(false)

  // Status de gravação
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Regras de validação do Almoxarifado selecionado
  const [selectedAlmox, setSelectedAlmox] = useState<Almoxarifado | null>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<LancamentoForm>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      competencia: new Date().toISOString().slice(0, 7), // YYYY-MM
      periodoTexto: '',
      almoxarifadoId: '',
      setorId: '',
      itens: [{ itemId: '', quantidadeNovos: 0, quantidadeSeminovos: 0, observacao: '' }],
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'itens'
  })

  const wAlmoxId = watch('almoxarifadoId')
  const wSetorId = watch('setorId')

  // Monitora mudança no almoxarifado para atualizar as validações de tipos
  useEffect(() => {
    if (wAlmoxId && almoxarifados.length > 0) {
      const almox = almoxarifados.find((a: Almoxarifado) => a.id === wAlmoxId)
      setSelectedAlmox(almox ?? null)
    } else {
      setSelectedAlmox(null)
    }
  }, [wAlmoxId, almoxarifados])

  // Busca itens quando muda o setor
  useEffect(() => {
    const fetchItens = async () => {
      if (!wSetorId) {
        setItensSetor([])
        return
      }
      setLoadingItens(true)
      try {
        // Busca itens vinculados ao setor
        const list = await listItensPorSetor(wSetorId)
        if (list.length === 0) {
          // Se não há vinculo, traz todos os itens ativos para o usuário escolher
          const todos = await listItens(true)
          setItensSetor(todos)
        } else {
          setItensSetor(list)
        }
      } catch (e: unknown) {
        console.error(e)
      } finally {
        setLoadingItens(false)
      }
    }
    fetchItens()
  }, [wSetorId])

  // Envio dos dados para gravação
  const onSubmit = async (data: LancamentoForm) => {
    if (!user) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    // Validação de tipo por almoxarifado
    if (selectedAlmox) {
      const temNovos = data.itens.some(i => i.quantidadeNovos > 0)
      const temSeminovos = data.itens.some(i => i.quantidadeSeminovos > 0)

      if (temNovos && !selectedAlmox.aceita_novos) {
        setError(`O almoxarifado ${selectedAlmox.nome} não aceita saídas do tipo NOVO.`)
        setLoading(false)
        return
      }
      if (temSeminovos && !selectedAlmox.aceita_seminovos) {
        setError(`O almoxarifado ${selectedAlmox.nome} não aceita saídas do tipo SEMINOVO.`)
        setLoading(false)
        return
      }
    }

    try {
      const saidasParaGravar: InsertSaidaItem[] = []
      // Formata a competência (YYYY-MM) para YYYY-MM-01
      const competenciaFormatada = `${data.competencia}-01`

      for (const formItem of data.itens) {
        // Assegura vínculo do item ao setor no Supabase
        await vincularItemSetor(formItem.itemId, data.setorId)

        // Se lançou novos > 0, cria registro tipo NOVO
        if (formItem.quantidadeNovos > 0) {
          saidasParaGravar.push({
            competencia: competenciaFormatada,
            periodo_texto: data.periodoTexto || null,
            almoxarifado_id: data.almoxarifadoId,
            setor_id: data.setorId,
            item_id: formItem.itemId,
            tipo: TipoSaidaEnum.NOVO,
            quantidade: formItem.quantidadeNovos,
            observacao: formItem.observacao || null,
            origem: OrigemSaida.MANUAL,
            lote_importacao_id: null,
            created_by: user.id,
          })
        }

        // Se lançou seminovos > 0, cria registro tipo SEMINOVO
        if (formItem.quantidadeSeminovos > 0) {
          saidasParaGravar.push({
            competencia: competenciaFormatada,
            periodo_texto: data.periodoTexto || null,
            almoxarifado_id: data.almoxarifadoId,
            setor_id: data.setorId,
            item_id: formItem.itemId,
            tipo: TipoSaidaEnum.SEMINOVO,
            quantidade: formItem.quantidadeSeminovos,
            observacao: formItem.observacao || null,
            origem: OrigemSaida.MANUAL,
            lote_importacao_id: null,
            created_by: user.id,
          })
        }
      }

      const res = await createSaidasLote(saidasParaGravar)
      if (res.error) throw new Error(res.error)

      setSuccess(`Lançamento manual registrado com sucesso! (${res.total} registros gerados)`)
      
      // Reseta mantendo a competência e almoxarifado para facilitar novos lançamentos
      reset({
        competencia: data.competencia,
        periodoTexto: data.periodoTexto,
        almoxarifadoId: data.almoxarifadoId,
        setorId: '',
        itens: [{ itemId: '', quantidadeNovos: 0, quantidadeSeminovos: 0, observacao: '' }],
      })
      setItensSetor([])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao gravar os lançamentos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Registrar Saídas</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Lançamento manual de movimentações no almoxarifado
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

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
        {/* Informações Gerais (Competência, Almoxarifado, Setor) */}
        <div className="card">
          <h2 className="text-base font-semibold text-institutional-blue mb-4 flex items-center gap-2">
            <Calendar size={18} />
            1. Dados de Referência
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label label-required">Mês/Ano de Competência</label>
              <input
                type="month"
                className={`input ${errors.competencia ? 'input-error' : ''}`}
                {...register('competencia')}
                disabled={loading}
              />
              {errors.competencia && <span className="error-msg">{errors.competencia.message}</span>}
            </div>

            <div className="form-group">
              <label className="label">Período de Referência (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: 13/12/23 a 13/01/24"
                className="input"
                {...register('periodoTexto')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="label label-required">Almoxarifado</label>
              {loadingAlmoxs ? (
                <div className="text-sm text-slate-400">Carregando almoxarifados...</div>
              ) : (
                <select
                  className={`select ${errors.almoxarifadoId ? 'input-error' : ''}`}
                  {...register('almoxarifadoId')}
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
              {errors.almoxarifadoId && <span className="error-msg">{errors.almoxarifadoId.message}</span>}
            </div>

            <div className="form-group">
              <label className="label label-required">Setor</label>
              {loadingSetores ? (
                <div className="text-sm text-slate-400">Carregando setores...</div>
              ) : (
                <select
                  className={`select ${errors.setorId ? 'input-error' : ''}`}
                  {...register('setorId')}
                  disabled={loading}
                >
                  <option value="">Selecione o setor...</option>
                  {setores.map((s: Setor) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              )}
              {errors.setorId && <span className="error-msg">{errors.setorId.message}</span>}
            </div>
          </div>

          {selectedAlmox && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <AlertTriangle size={14} className="text-alert-yellow" />
              <span>
                Regra operacional: Este almoxarifado aceita saídas de itens{' '}
                <strong>
                  {selectedAlmox.aceita_novos ? 'Novos' : ''}
                  {selectedAlmox.aceita_novos && selectedAlmox.aceita_seminovos ? ' e ' : ''}
                  {selectedAlmox.aceita_seminovos ? 'Seminovos' : ''}
                </strong>
                .
              </span>
            </div>
          )}
        </div>

        {/* Lançamentos de Itens (Side-by-side) */}
        {wSetorId && (
          <div className="card animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-institutional-blue flex items-center gap-2">
                <FileText size={18} />
                2. Lançamento de Peças por Item
              </h2>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => append({ itemId: '', quantidadeNovos: 0, quantidadeSeminovos: 0, observacao: '' })}
                disabled={loading}
              >
                <Plus size={14} />
                Adicionar Item
              </button>
            </div>

            {loadingItens ? (
              <div className="py-6 text-center text-slate-400 text-sm">Carregando itens do setor...</div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-4 relative animate-fade-in"
                  >
                    {/* Botão de remoção */}
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className="absolute top-2 right-2 text-slate-400 hover:text-alert-red p-1 rounded-lg"
                        onClick={() => remove(index)}
                        disabled={loading}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-5 form-group">
                        <label className="label label-required text-xs">Item</label>
                        <select
                          className="select text-sm py-1.5"
                          {...register(`itens.${index}.itemId`)}
                          disabled={loading}
                        >
                          <option value="">Selecione o item...</option>
                          {itensSetor.map((i: Item) => (
                            <option key={i.id} value={i.id}>{i.nome}</option>
                          ))}
                        </select>
                        {errors.itens?.[index]?.itemId && (
                          <span className="error-msg">{errors.itens[index]?.itemId?.message}</span>
                        )}
                      </div>

                      <div className="md:col-span-3 form-group">
                        <label className="label text-xs">Novos (Qtd)</label>
                        <input
                          type="number"
                          className="input py-1.5"
                          placeholder="0"
                          disabled={loading || (selectedAlmox ? !selectedAlmox.aceita_novos : false)}
                          {...register(`itens.${index}.quantidadeNovos`, { valueAsNumber: true })}
                        />
                      </div>

                      <div className="md:col-span-3 form-group">
                        <label className="label text-xs">Seminovos (Qtd)</label>
                        <input
                          type="number"
                          className="input py-1.5"
                          placeholder="0"
                          disabled={loading || (selectedAlmox ? !selectedAlmox.aceita_seminovos : false)}
                          {...register(`itens.${index}.quantidadeSeminovos`, { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="label text-xs">Observação / Nota Fiscal</label>
                      <input
                        type="text"
                        placeholder="Ex: Saída emergencial, NF 1234"
                        className="input text-xs py-1.5"
                        {...register(`itens.${index}.observacao`)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-institutional-gray-border">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || itensSetor.length === 0}
              >
                {loading && <LoadingSpinner size="sm" />}
                Registrar Saídas
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}