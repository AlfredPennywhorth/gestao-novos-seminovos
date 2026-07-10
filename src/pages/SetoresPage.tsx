import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, ToggleLeft, ToggleRight } from 'lucide-react'
import { listSetores, createSetor, updateSetor, toggleActive } from '@/services/setores.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui'
import type { Setor } from '@/types/database'

export default function SetoresPage() {
  const { profile } = useAuth()

  // Lista de setores
  const [items, setItems] = useState<Setor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form State para Modal (Cadastro/Edição)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nomeVal, setNomeVal] = useState('')
  const [descVal, setDescVal] = useState('')
  const [ativoVal, setAtivoVal] = useState(true)

  // Confirmar inativação / toggle status
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false)
  const [selectedSetor, setSelectedSetor] = useState<Setor | null>(null)
  const [toggling, setToggling] = useState(false)

  const fetchSetores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listSetores(false) // traz ativos e inativos
      setItems(data)
    } catch {
      setError('Erro ao carregar setores.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSetores()
  }, [fetchSetores])

  const handleOpenCreate = () => {
    setEditingId(null)
    setNomeVal('')
    setDescVal('')
    setAtivoVal(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (s: Setor) => {
    setEditingId(s.id)
    setNomeVal(s.nome)
    setDescVal(s.descricao ?? '')
    setAtivoVal(s.ativo)
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
      ativo: ativoVal,
    }

    try {
      if (editingId) {
        const { error } = await updateSetor(editingId, dataSave)
        if (error) throw new Error(error)
        setSuccess('Setor atualizado com sucesso!')
      } else {
        const { error } = await createSetor(dataSave)
        if (error) throw new Error(error)
        setSuccess('Setor cadastrado com sucesso!')
      }
      setModalOpen(false)
      fetchSetores()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar setor.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmToggleActive = async () => {
    if (!selectedSetor) return
    setToggling(true)
    try {
      const { error } = await toggleActive(selectedSetor.id, !selectedSetor.ativo)
      if (error) throw new Error(error)
      setSuccess(`Setor ${!selectedSetor.ativo ? 'ativado' : 'desativado'} com sucesso!`)
      setConfirmToggleOpen(false)
      setSelectedSetor(null)
      fetchSetores()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status do setor.')
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
          <h1 className="page-title">Setores</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerencie os setores de roupas (classificações contidas na planilha)
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
          <Plus size={15} />
          Cadastrar Setor
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
          title="Nenhum setor cadastrado"
          description="Cadastre setores para agrupar e lançar saídas de peças."
          action={<button className="btn-primary btn-sm" onClick={handleOpenCreate}>Cadastrar Primeiro</button>}
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nome do Setor</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Data de Registro</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className={!s.ativo ? 'opacity-60 bg-slate-50' : ''}>
                  <td className="font-medium text-slate-800">{s.nome}</td>
                  <td className="text-xs text-slate-500 max-w-[300px] truncate">{s.descricao ?? '—'}</td>
                  <td>
                    <span className={`badge ${s.ativo ? 'badge-green' : 'badge-red'}`}>
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="text-slate-500 hover:text-institutional-blue p-1 rounded-lg"
                        onClick={() => handleOpenEdit(s)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className={`p-1 rounded-lg ${s.ativo ? 'text-alert-red hover:text-red-700' : 'text-economy-green hover:text-green-700'}`}
                        onClick={() => {
                          setSelectedSetor(s)
                          setConfirmToggleOpen(true)
                        }}
                      >
                        {s.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
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
                  {editingId ? 'Editar Setor' : 'Cadastrar Setor'}
                </h3>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div className="form-group">
                  <label className="label label-required">Nome do Setor</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: FEMININO ADULTO"
                    value={nomeVal}
                    onChange={(e) => setNomeVal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Descrição</label>
                  <textarea
                    className="input h-20 resize-none"
                    placeholder="Ex: Roupas adultas destinadas ao público feminino..."
                    value={descVal}
                    onChange={(e) => setDescVal(e.target.value)}
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
                    Setor Ativo
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
        title={selectedSetor?.ativo ? 'Inativar Setor' : 'Ativar Setor'}
        description={`Tem certeza que deseja ${selectedSetor?.ativo ? 'inativar' : 'ativar'} o setor ${selectedSetor?.nome}? Setores inativos não aparecem nos lançamentos.`}
        confirmLabel={selectedSetor?.ativo ? 'Inativar' : 'Ativar'}
        cancelLabel="Voltar"
        onConfirm={handleConfirmToggleActive}
        onCancel={() => {
          setConfirmToggleOpen(false)
          setSelectedSetor(null)
        }}
        loading={toggling}
      />
    </div>
  )
}
