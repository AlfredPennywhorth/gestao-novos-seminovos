import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, DollarSign, Edit, RefreshCw, Filter } from 'lucide-react'
import { listCustos, createCusto, updateCusto, deleteCusto } from '@/services/custos.service'
import { useAlmoxarifados } from '@/hooks/useAlmoxarifados'
import { listItens } from '@/services/itens.service'
import { formatCurrency, formatCompetencia } from '@/utils/formatters'
import { Alert, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui'
import type { CustoMensalItem, Almoxarifado, Item } from '@/types/database'
import { useAuth } from '@/hooks/useAuth'

export default function CustosPage() {
  const { user } = useAuth()
  const { almoxarifados } = useAlmoxarifados()
  const [itens, setItens] = useState<Item[]>([])

  // Lista de custos
  const [custos, setCustos] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filtros
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('')
  const [filtroAlmoxarifado, setFiltroAlmoxarifado] = useState<string>('')
  const [filtroItem, setFiltroItem] = useState<string>('')

  // Form State para Modal (Cadastro/Edição)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [compVal, setCompVal] = useState<string>('')
  const [almoxVal, setAlmoxVal] = useState<string>('')
  const [itemVal, setItemVal] = useState<string>('')
  const [valorNovo, setValorNovo] = useState<number>(40)
  const [valorSeminovo, setValorSeminovo] = useState<number>(4)
  const [obsVal, setObsVal] = useState<string>('')
  const [ativoVal, setAtivoVal] = useState<boolean>(true)

  // Confirmar exclusão
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [custoParaDeletar, setCustoParaDeletar] = useState<string | null>(null)
  const [deletando, setDeletando] = useState(false)

  // Carrega itens ativos
  useEffect(() => {
    listItens(true).then(setItens).catch(console.error)
  }, [])

  // Carrega custos cadastrados
  const fetchCustos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filtros: Record<string, string | undefined> = {}
      if (filtroCompetencia) filtros.competencia = `${filtroCompetencia}-01`
      if (filtroAlmoxarifado) filtros.almoxarifadoId = filtroAlmoxarifado
      if (filtroItem) filtros.itemId = filtroItem

      const res = await listCustos(filtros)
      setCustos(res)
    } catch {
      setError('Erro ao carregar custos do banco.')
    } finally {
      setLoading(false)
    }
  }, [filtroCompetencia, filtroAlmoxarifado, filtroItem])

  useEffect(() => {
    fetchCustos()
  }, [fetchCustos])

  // Abre modal de criação
  const handleOpenCreate = () => {
    setEditingId(null)
    setCompVal(new Date().toISOString().slice(0, 7)) // YYYY-MM
    setAlmoxVal('')
    setItemVal('')
    setValorNovo(40)
    setValorSeminovo(4)
    setObsVal('')
    setAtivoVal(true)
    setModalOpen(true)
  }

  // Abre modal de edição
  const handleOpenEdit = (c: CustoMensalItem) => {
    setEditingId(c.id)
    setCompVal(c.competencia.slice(0, 7))
    setAlmoxVal(c.almoxarifado_id ?? '')
    setItemVal(c.item_id ?? '')
    setValorNovo(c.valor_medio_novo)
    setValorSeminovo(c.valor_medio_seminovo)
    setObsVal(c.observacao ?? '')
    setAtivoVal(c.ativo)
    setModalOpen(true)
  }

  // Salvar cadastro/edição
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!compVal) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const dataSave = {
      competencia: `${compVal}-01`,
      item_id: itemVal || null,
      almoxarifado_id: almoxVal || null,
      valor_medio_novo: valorNovo,
      valor_medio_seminovo: valorSeminovo,
      observacao: obsVal || null,
      ativo: ativoVal,
      created_by: user?.id || null,
    }

    try {
      if (editingId) {
        const { error } = await updateCusto(editingId, dataSave)
        if (error) throw new Error(error)
        setSuccess('Custo mensal atualizado com sucesso!')
      } else {
        const { error } = await createCusto(dataSave)
        if (error) throw new Error(error)
        setSuccess('Custo mensal cadastrado com sucesso!')
      }
      setModalOpen(false)
      fetchCustos()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar custo.')
    } finally {
      setLoading(false)
    }
  }

  // Deletar custo
  const handleDelete = async () => {
    if (!custoParaDeletar) return
    setDeletando(true)
    try {
      const { error } = await deleteCusto(custoParaDeletar)
      if (error) throw new Error(error)
      setSuccess('Custo excluído com sucesso!')
      setConfirmDeleteOpen(false)
      setCustoParaDeletar(null)
      fetchCustos()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir custo.')
    } finally {
      setDeletando(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Custos Médios Mensais</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerencie os custos médios mensais de novos e seminovos por competência
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
          <Plus size={15} />
          Cadastrar Custo
        </button>
      </div>

      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="mb-4" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Painel informativo do Fallback padrão */}
      <div className="alert alert-info mb-6">
        <DollarSign size={18} className="shrink-0" />
        <div className="text-sm">
          <strong>Valores Padrão do Sistema:</strong> Quando não houver custo específico
          cadastrado para uma competência ou item, o dashboard utiliza automaticamente os valores médios padrão:
          <span className="font-semibold text-slate-700 ml-1">Novo: R$ 40,00</span> |
          <span className="font-semibold text-slate-700 ml-1">Seminovo: R$ 4,00</span>
          (Economia estimada: <span className="text-economy-green font-semibold">R$ 36,00/un</span>).
        </div>
      </div>

      {/* Filtros de Busca */}
      <div className="filter-bar">
        <div className="flex items-center gap-2 text-slate-500 mr-2">
          <Filter size={16} />
          <span className="text-sm font-medium">Filtrar</span>
        </div>

        <div className="filter-group">
          <label className="label text-xs">Competência</label>
          <input
            type="month"
            className="input py-1.5 text-sm"
            value={filtroCompetencia}
            onChange={(e) => setFiltroCompetencia(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="label text-xs">Almoxarifado</label>
          <select
            className="select text-sm py-1.5"
            value={filtroAlmoxarifado}
            onChange={(e) => setFiltroAlmoxarifado(e.target.value)}
          >
            <option value="">Todos</option>
            {almoxarifados.map((a: Almoxarifado) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="label text-xs">Item</label>
          <select
            className="select text-sm py-1.5"
            value={filtroItem}
            onChange={(e) => setFiltroItem(e.target.value)}
          >
            <option value="">Todos</option>
            {itens.map((i: Item) => (
              <option key={i.id} value={i.id}>{i.nome}</option>
            ))}
          </select>
        </div>

        <button
          className="btn-secondary btn-sm self-end"
          onClick={() => {
            setFiltroCompetencia('')
            setFiltroAlmoxarifado('')
            setFiltroItem('')
          }}
        >
          <RefreshCw size={14} />
          Limpar
        </button>
      </div>

      {/* Tabela de Custos */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : custos.length === 0 ? (
        <EmptyState
          title="Nenhum custo cadastrado"
          description="Você está utilizando o custo padrão global do sistema."
          action={
            <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
              Cadastrar Primeiro Custo
            </button>
          }
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Almoxarifado</th>
                <th>Item</th>
                <th className="text-right">Valor Novo</th>
                <th className="text-right">Valor Seminovo</th>
                <th>Status</th>
                <th>Observação</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(custos as any[]).map((custo) => {
                const c = custo as CustoMensalItem
                const almoxNome = (c as unknown as { almoxarifados?: { nome: string } }).almoxarifados?.nome ?? 'Geral (Todos)'
                const itemNome = (c as unknown as { itens?: { nome: string } }).itens?.nome ?? 'Geral (Todos)'

                return (
                  <tr key={c.id}>
                    <td className="font-medium">{formatCompetencia(c.competencia)}</td>
                    <td>{almoxNome}</td>
                    <td>{itemNome}</td>
                    <td className="text-right font-semibold text-slate-700">
                      {formatCurrency(c.valor_medio_novo)}
                    </td>
                    <td className="text-right font-semibold text-slate-700">
                      {formatCurrency(c.valor_medio_seminovo)}
                    </td>
                    <td>
                      <span className={`badge ${c.ativo ? 'badge-green' : 'badge-red'}`}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-slate-400" title={c.observacao ?? ''}>
                      {c.observacao ?? '—'}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="text-slate-500 hover:text-institutional-blue p-1 rounded-lg"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="text-slate-400 hover:text-alert-red p-1 rounded-lg"
                          onClick={() => {
                            setCustoParaDeletar(c.id)
                            setConfirmDeleteOpen(true)
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSave}>
              <div className="modal-header">
                <h3 className="text-base font-semibold text-institutional-blue">
                  {editingId ? 'Editar Custo Mensal' : 'Cadastrar Custo Mensal'}
                </h3>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div className="form-group">
                  <label className="label label-required">Mês/Ano de Competência</label>
                  <input
                    type="month"
                    className="input"
                    value={compVal}
                    onChange={(e) => setCompVal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Almoxarifado</label>
                  <select
                    className="select"
                    value={almoxVal}
                    onChange={(e) => setAlmoxVal(e.target.value)}
                  >
                    <option value="">Geral (Aplica a todos os almoxarifados)</option>
                    {almoxarifados.map((a: Almoxarifado) => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Item</label>
                  <select
                    className="select"
                    value={itemVal}
                    onChange={(e) => setItemVal(e.target.value)}
                  >
                    <option value="">Geral (Aplica a todos os itens)</option>
                    {itens.map((i: Item) => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label label-required">Valor Médio Novo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={valorNovo}
                      onChange={(e) => setValorNovo(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label label-required">Valor Médio Seminovo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={valorSeminovo}
                      onChange={(e) => setValorSeminovo(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Observação</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Novo lote de compras da competência"
                    value={obsVal}
                    onChange={(e) => setObsVal(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="ativo"
                    checked={ativoVal}
                    onChange={(e) => setAtivoVal(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label htmlFor="ativo" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Custo Ativo
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {loading && <LoadingSpinner size="sm" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar Exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Excluir Custo Cadastrado"
        description="Tem certeza que deseja excluir esta regra de custo? Isso fará com que o sistema volte a utilizar os valores padrão ou outras regras genéricas vigentes para esta competência."
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false)
          setCustoParaDeletar(null)
        }}
        loading={deletando}
      />
    </div>
  )
}
