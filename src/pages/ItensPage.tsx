import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, ToggleLeft, ToggleRight, Filter, X } from 'lucide-react'
import {
  atualizarSetorItem,
  createItem,
  listItensComSetor,
  toggleActive,
  updateItem,
  vincularItemSetor,
} from '@/services/itens.service'
import type { ItemComSetor } from '@/services/itens.service'
import { listSetores } from '@/services/setores.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui'
import type { Setor } from '@/types/database'

interface ColumnFilterProps {
  label: string
  active: boolean
  onClear: () => void
  children: React.ReactNode
}

function ColumnFilter({ label, active, onClear, children }: ColumnFilterProps) {
  return (
    <details className="group normal-case tracking-normal">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <Filter
          size={13}
          className={active ? 'fill-institutional-blue text-institutional-blue' : 'text-slate-400'}
        />
      </summary>
      <div className="mt-2 min-w-[180px] rounded-lg border border-slate-200 bg-white p-2 shadow-md">
        {children}
        {active && (
          <button
            type="button"
            className="mt-2 flex items-center gap-1 text-[11px] font-medium text-alert-red hover:text-red-700"
            onClick={onClear}
          >
            <X size={12} />
            Limpar filtro
          </button>
        )}
      </div>
    </details>
  )
}

function normalizarBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

export default function ItensPage() {
  const { profile } = useAuth()
  
  // Listas
  const [items, setItems] = useState<ItemComSetor[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form State para Modal (Cadastro/Edição)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nomeVal, setNomeVal] = useState('')
  const [descVal, setDescVal] = useState('')
  const [unidadeVal, setUnidadeVal] = useState('peça')
  const [ativoVal, setAtivoVal] = useState(true)
  const [setorIdVal, setSetorIdVal] = useState('') // Setor para associar opcionalmente no cadastro

  // Filtros do cabeçalho
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroNome, setFiltroNome] = useState('')
  const [filtroSetor, setFiltroSetor] = useState('')
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroData, setFiltroData] = useState('')

  // Confirmar inativação / toggle status
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ItemComSetor | null>(null)
  const [toggling, setToggling] = useState(false)

  // Carrega setores e itens
  const fetchItens = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listItensComSetor(false) // ativos e inativos
      setItems(data)
    } catch {
      setError('Erro ao carregar catálogo de itens.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItens()
    listSetores(true).then(setSetores).catch(console.error)
  }, [fetchItens])

  const handleOpenCreate = () => {
    setEditingId(null)
    setNomeVal('')
    setDescVal('')
    setUnidadeVal('peça')
    setAtivoVal(true)
    setSetorIdVal('')
    setModalOpen(true)
  }

  const handleOpenEdit = (i: ItemComSetor) => {
    setEditingId(i.id)
    setNomeVal(i.nome)
    setDescVal(i.descricao ?? '')
    setUnidadeVal(i.unidade)
    setAtivoVal(i.ativo)
    setSetorIdVal(i.setor?.id ?? '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeVal.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const dataSave = {
      nome: nomeVal.trim(),
      descricao: descVal.trim() || null,
      unidade: unidadeVal.trim() || 'peça',
      ativo: ativoVal,
    }

    try {
      if (editingId) {
        const { error } = await updateItem(editingId, dataSave)
        if (error) throw new Error(error)
        if (setorIdVal) {
          const { error: setorError } = await atualizarSetorItem(editingId, setorIdVal)
          if (setorError) throw new Error(setorError)
        }
        setSuccess('Item atualizado com sucesso!')
      } else {
        const { data: newItem, error } = await createItem(dataSave)
        if (error) throw new Error(error)

        // Se o usuário escolheu vincular a um setor
        if (newItem && setorIdVal) {
          await vincularItemSetor(newItem.id, setorIdVal)
        }

        setSuccess('Item cadastrado com sucesso!')
      }
      setModalOpen(false)
      fetchItens()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar item.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmToggleActive = async () => {
    if (!selectedItem) return
    setToggling(true)
    try {
      const { error } = await toggleActive(selectedItem.id, !selectedItem.ativo)
      if (error) throw new Error(error)
      setSuccess(`Item ${!selectedItem.ativo ? 'ativado' : 'desativado'} com sucesso!`)
      setConfirmToggleOpen(false)
      setSelectedItem(null)
      fetchItens()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status do item.')
    } finally {
      setToggling(false)
    }
  }

  if (profile?.role !== 'ADMIN') {
    return (
      <div className="card text-center max-w-md mx-auto mt-20">
        <h2 className="text-lg font-bold text-alert-red mb-2">Acesso Restrito</h2>
        <p className="text-slate-500 text-sm">Esta página está disponível apenas para administradores.</p>
      </div>
    )
  }

  const setoresDisponiveis = Array.from(
    new Set(items.map((item) => item.setor?.nome ?? 'Sem setor'))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const unidadesDisponiveis = Array.from(
    new Set(items.map((item) => item.unidade).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const itemsVisiveis = items.filter((item) => {
    const setorNome = item.setor?.nome ?? 'Sem setor'
    const dataRegistro = item.created_at.slice(0, 10)

    return (
      (!filtroCodigo || normalizarBusca(item.codigo ?? '').includes(normalizarBusca(filtroCodigo))) &&
      (!filtroNome || normalizarBusca(item.nome).includes(normalizarBusca(filtroNome))) &&
      (!filtroSetor || setorNome === filtroSetor) &&
      (!filtroUnidade || item.unidade === filtroUnidade) &&
      (!filtroDescricao || normalizarBusca(item.descricao ?? '').includes(normalizarBusca(filtroDescricao))) &&
      (!filtroStatus || (filtroStatus === 'ATIVO' ? item.ativo : !item.ativo)) &&
      (!filtroData || dataRegistro === filtroData)
    )
  })

  const quantidadeFiltrosAtivos = [
    filtroCodigo,
    filtroNome,
    filtroSetor,
    filtroUnidade,
    filtroDescricao,
    filtroStatus,
    filtroData,
  ].filter(Boolean).length

  const limparFiltros = () => {
    setFiltroCodigo('')
    setFiltroNome('')
    setFiltroSetor('')
    setFiltroUnidade('')
    setFiltroDescricao('')
    setFiltroStatus('')
    setFiltroData('')
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Itens</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerencie o cadastro geral de peças e vincule-as aos setores operacionais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={filtroSetor === 'OUTROS' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => setFiltroSetor((valor) => valor === 'OUTROS' ? '' : 'OUTROS')}
          >
            {filtroSetor === 'OUTROS' ? 'Mostrando OUTROS' : 'Filtrar OUTROS'}
          </button>
          {quantidadeFiltrosAtivos > 0 && (
            <button className="btn-secondary btn-sm" onClick={limparFiltros}>
              <X size={14} />
              Limpar filtros ({quantidadeFiltrosAtivos})
            </button>
          )}
          <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
            <Plus size={15} />
            Cadastrar Item
          </button>
        </div>
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

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum item cadastrado"
          description="Cadastre itens no catálogo para lançar saídas manuais ou importações."
          action={<button className="btn-primary btn-sm" onClick={handleOpenCreate}>Cadastrar Primeiro</button>}
        />
      ) : (
        <div>
          <div className="mb-2 text-right text-xs text-slate-500">
            {itemsVisiveis.length} de {items.length} item(ns)
          </div>
          <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <ColumnFilter label="Código" active={Boolean(filtroCodigo)} onClear={() => setFiltroCodigo('')}>
                    <input
                      className="input h-8 text-xs"
                      placeholder="Buscar código..."
                      value={filtroCodigo}
                      onChange={(e) => setFiltroCodigo(e.target.value)}
                    />
                  </ColumnFilter>
                </th>
                <th>
                  <ColumnFilter label="Nome do Item" active={Boolean(filtroNome)} onClear={() => setFiltroNome('')}>
                    <input
                      className="input h-8 text-xs"
                      placeholder="Buscar nome..."
                      value={filtroNome}
                      onChange={(e) => setFiltroNome(e.target.value)}
                    />
                  </ColumnFilter>
                </th>
                <th>
                  <ColumnFilter label="Setor" active={Boolean(filtroSetor)} onClear={() => setFiltroSetor('')}>
                    <select className="select h-8 text-xs" value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
                      <option value="">Todos os setores</option>
                      {setoresDisponiveis.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
                    </select>
                  </ColumnFilter>
                </th>
                <th>
                  <ColumnFilter label="Unidade" active={Boolean(filtroUnidade)} onClear={() => setFiltroUnidade('')}>
                    <select className="select h-8 text-xs" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
                      <option value="">Todas as unidades</option>
                      {unidadesDisponiveis.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
                    </select>
                  </ColumnFilter>
                </th>
                <th>
                  <ColumnFilter label="Descrição" active={Boolean(filtroDescricao)} onClear={() => setFiltroDescricao('')}>
                    <input
                      className="input h-8 text-xs"
                      placeholder="Buscar descrição..."
                      value={filtroDescricao}
                      onChange={(e) => setFiltroDescricao(e.target.value)}
                    />
                  </ColumnFilter>
                </th>
                <th>
                  <ColumnFilter label="Status" active={Boolean(filtroStatus)} onClear={() => setFiltroStatus('')}>
                    <select className="select h-8 text-xs" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
                      <option value="">Todos</option>
                      <option value="ATIVO">Ativos</option>
                      <option value="INATIVO">Inativos</option>
                    </select>
                  </ColumnFilter>
                </th>
                <th>
                  <ColumnFilter label="Data de Registro" active={Boolean(filtroData)} onClear={() => setFiltroData('')}>
                    <input
                      type="date"
                      className="input h-8 text-xs"
                      value={filtroData}
                      onChange={(e) => setFiltroData(e.target.value)}
                    />
                  </ColumnFilter>
                </th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itemsVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-slate-400">
                    Nenhum item corresponde aos filtros selecionados.
                  </td>
                </tr>
              ) : itemsVisiveis.map((i) => (
                <tr key={i.id} className={!i.ativo ? 'opacity-60 bg-slate-50' : ''}>
                  <td className="font-mono text-xs text-slate-600">{i.codigo ?? '—'}</td>
                  <td className="font-medium text-slate-800">{i.nome}</td>
                  <td>
                    <span className={`badge ${i.setor?.nome.toUpperCase() === 'OUTROS' ? 'badge-red' : 'badge-gray'}`}>
                      {i.setor?.nome ?? 'Sem setor'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-gray">{i.unidade}</span>
                  </td>
                  <td className="text-xs text-slate-500 max-w-[300px] truncate">{i.descricao ?? '—'}</td>
                  <td>
                    <span className={`badge ${i.ativo ? 'badge-green' : 'badge-red'}`}>
                      {i.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-400">
                    {new Date(i.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="text-slate-500 hover:text-institutional-blue p-1 rounded-lg"
                        onClick={() => handleOpenEdit(i)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className={`p-1 rounded-lg ${i.ativo ? 'text-alert-red hover:text-red-700' : 'text-economy-green hover:text-green-700'}`}
                        onClick={() => {
                          setSelectedItem(i)
                          setConfirmToggleOpen(true)
                        }}
                      >
                        {i.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSave}>
              <div className="modal-header">
                <h3 className="text-base font-semibold text-institutional-blue">
                  {editingId ? 'Editar Item' : 'Cadastrar Item'}
                </h3>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div className="form-group">
                  <label className="label label-required">Nome do Item</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Body Manga Longa"
                    value={nomeVal}
                    onChange={(e) => setNomeVal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Unidade de Medida</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: peça, par, fardo"
                    value={unidadeVal}
                    onChange={(e) => setUnidadeVal(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Descrição</label>
                  <textarea
                    className="input h-20 resize-none"
                    placeholder="Ex: Tamanho M, algodão sustentável..."
                    value={descVal}
                    onChange={(e) => setDescVal(e.target.value)}
                  />
                </div>

                {/* Associação opcional com Setor (apenas no cadastro) */}
                <div className="form-group">
                  <label className={`label ${editingId ? 'label-required' : ''}`}>Setor</label>
                  <select
                    className="select"
                    value={setorIdVal}
                    onChange={(e) => setSetorIdVal(e.target.value)}
                    required={Boolean(editingId)}
                  >
                    <option value="">Nenhum setor</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                  {editingId && (
                    <p className="text-xs text-slate-400 mt-1">
                      A alteração será usada nas próximas importações deste código.
                    </p>
                  )}
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
                    Item Ativo
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

      {/* Dialog para Toggle Status */}
      <ConfirmDialog
        open={confirmToggleOpen}
        title={selectedItem?.ativo ? 'Inativar Item' : 'Ativar Item'}
        description={`Tem certeza que deseja ${selectedItem?.ativo ? 'inativar' : 'ativar'} o item ${selectedItem?.nome}? Itens inativos não podem ser lançados.`}
        confirmLabel={selectedItem?.ativo ? 'Inativar' : 'Ativar'}
        cancelLabel="Voltar"
        onConfirm={handleConfirmToggleActive}
        onCancel={() => {
          setConfirmToggleOpen(false)
          setSelectedItem(null)
        }}
        loading={toggling}
      />
    </div>
  )
}
