import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, ToggleLeft, ToggleRight } from 'lucide-react'
import { listItens, createItem, updateItem, toggleActive, vincularItemSetor } from '@/services/itens.service'
import { listSetores } from '@/services/setores.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui'
import type { Item, Setor } from '@/types/database'

export default function ItensPage() {
  const { profile } = useAuth()
  
  // Listas
  const [items, setItems] = useState<Item[]>([])
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

  // Confirmar inativação / toggle status
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [toggling, setToggling] = useState(false)

  // Carrega setores e itens
  const fetchItens = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listItens(false) // ativos e inativos
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

  const handleOpenEdit = (i: Item) => {
    setEditingId(i.id)
    setNomeVal(i.nome)
    setDescVal(i.descricao ?? '')
    setUnidadeVal(i.unidade)
    setAtivoVal(i.ativo)
    setSetorIdVal('')
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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Itens</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerencie o cadastro geral de peças e vincule-as aos setores operacionais
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
          <Plus size={15} />
          Cadastrar Item
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

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhum item cadastrado"
          description="Cadastre itens no catálogo para lançar saídas manuais ou importações."
          action={<button className="btn-primary btn-sm" onClick={handleOpenCreate}>Cadastrar Primeiro</button>}
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nome do Item</th>
                <th>Unidade</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Data de Registro</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={!i.ativo ? 'opacity-60 bg-slate-50' : ''}>
                  <td className="font-medium text-slate-800">{i.nome}</td>
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
                {!editingId && (
                  <div className="form-group">
                    <label className="label">Vincular a um Setor (Opcional)</label>
                    <select
                      className="select"
                      value={setorIdVal}
                      onChange={(e) => setSetorIdVal(e.target.value)}
                    >
                      <option value="">Nenhum setor (vincular depois)</option>
                      {setores.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

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
