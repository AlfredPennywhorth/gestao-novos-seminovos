import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, ToggleLeft, ToggleRight, Check, X } from 'lucide-react'
import { listAlmoxarifados, createAlmoxarifado, updateAlmoxarifado, toggleActive } from '@/services/almoxarifados.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui'
import type { Almoxarifado } from '@/types/database'

export default function AlmoxarifadosPage() {
  const { profile } = useAuth()
  
  // Lista de almoxarifados
  const [items, setItems] = useState<Almoxarifado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form State para Modal (Cadastro/Edição)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nomeVal, setNomeVal] = useState('')
  const [codigoVal, setCodigoVal] = useState('')
  const [descVal, setDescVal] = useState('')
  const [aceitaNovos, setAceitaNovos] = useState(true)
  const [aceitaSeminovos, setAceitaSeminovos] = useState(true)
  const [ativoVal, setAtivoVal] = useState(true)

  // Confirmar inativação / toggle status
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false)
  const [selectedAlmox, setSelectedAlmox] = useState<Almoxarifado | null>(null)
  const [toggling, setToggling] = useState(false)

  const fetchAlmoxs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAlmoxarifados(false) // traz ativos e inativos
      setItems(data)
    } catch {
      setError('Erro ao carregar almoxarifados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlmoxs()
  }, [fetchAlmoxs])

  const handleOpenCreate = () => {
    setEditingId(null)
    setNomeVal('')
    setCodigoVal('')
    setDescVal('')
    setAceitaNovos(true)
    setAceitaSeminovos(true)
    setAtivoVal(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (a: Almoxarifado) => {
    setEditingId(a.id)
    setNomeVal(a.nome)
    setCodigoVal(a.codigo ?? '')
    setDescVal(a.descricao ?? '')
    setAceitaNovos(a.aceita_novos)
    setAceitaSeminovos(a.aceita_seminovos)
    setAtivoVal(a.ativo)
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
      codigo: codigoVal.trim() || null,
      descricao: descVal.trim() || null,
      aceita_novos: aceitaNovos,
      aceita_seminovos: aceitaSeminovos,
      ativo: ativoVal,
    }

    try {
      if (editingId) {
        const { error } = await updateAlmoxarifado(editingId, dataSave)
        if (error) throw new Error(error)
        setSuccess('Almoxarifado atualizado com sucesso!')
      } else {
        const { error } = await createAlmoxarifado(dataSave)
        if (error) throw new Error(error)
        setSuccess('Almoxarifado cadastrado com sucesso!')
      }
      setModalOpen(false)
      fetchAlmoxs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar almoxarifado.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmToggleActive = async () => {
    if (!selectedAlmox) return
    setToggling(true)
    try {
      const { error } = await toggleActive(selectedAlmox.id, !selectedAlmox.ativo)
      if (error) throw new Error(error)
      setSuccess(`Almoxarifado ${!selectedAlmox.ativo ? 'ativado' : 'desativado'} com sucesso!`)
      setConfirmToggleOpen(false)
      setSelectedAlmox(null)
      fetchAlmoxs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status do almoxarifado.')
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
          <h1 className="page-title">Almoxarifados</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerencie os almoxarifados e as permissões de distribuição de itens Novos e Seminovos
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleOpenCreate}>
          <Plus size={15} />
          Cadastrar Almoxarifado
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
          title="Nenhum almoxarifado cadastrado"
          description="Cadastre almoxarifados para organizar as saídas de itens."
          action={<button className="btn-primary btn-sm" onClick={handleOpenCreate}>Cadastrar Primeiro</button>}
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Descrição</th>
                <th className="text-center">Aceita Novos</th>
                <th className="text-center">Aceita Seminovos</th>
                <th>Status</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className={!a.ativo ? 'opacity-60 bg-slate-50' : ''}>
                  <td className="font-mono text-xs font-semibold">{a.codigo ?? '—'}</td>
                  <td className="font-medium text-slate-800">{a.nome}</td>
                  <td className="text-xs text-slate-500 max-w-[200px] truncate">{a.descricao ?? '—'}</td>
                  <td className="text-center">
                    {a.aceita_novos ? (
                      <span className="badge badge-blue inline-flex items-center gap-1"><Check size={12} />Sim</span>
                    ) : (
                      <span className="badge badge-red inline-flex items-center gap-1"><X size={12} />Não</span>
                    )}
                  </td>
                  <td className="text-center">
                    {a.aceita_seminovos ? (
                      <span className="badge badge-green inline-flex items-center gap-1"><Check size={12} />Sim</span>
                    ) : (
                      <span className="badge badge-red inline-flex items-center gap-1"><X size={12} />Não</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${a.ativo ? 'badge-green' : 'badge-red'}`}>
                      {a.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="text-slate-500 hover:text-institutional-blue p-1 rounded-lg"
                        onClick={() => handleOpenEdit(a)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className={`p-1 rounded-lg ${a.ativo ? 'text-alert-red hover:text-red-700' : 'text-economy-green hover:text-green-700'}`}
                        onClick={() => {
                          setSelectedAlmox(a)
                          setConfirmToggleOpen(true)
                        }}
                      >
                        {a.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
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
                  {editingId ? 'Editar Almoxarifado' : 'Cadastrar Almoxarifado'}
                </h3>
              </div>
              <div className="modal-body flex flex-col gap-4">
                <div className="form-group">
                  <label className="label label-required">Nome do Almoxarifado</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: Vila Prudente"
                    value={nomeVal}
                    onChange={(e) => setNomeVal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="label">Código (Sigla)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: VPR"
                    value={codigoVal}
                    onChange={(e) => setCodigoVal(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="label">Descrição / Observações</label>
                  <textarea
                    className="input h-20 resize-none"
                    placeholder="Ex: Almoxarifado principal do setor sul..."
                    value={descVal}
                    onChange={(e) => setDescVal(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="aceitaNovos"
                      checked={aceitaNovos}
                      onChange={(e) => setAceitaNovos(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <label htmlFor="aceitaNovos" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Aceita itens Novos
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="aceitaSeminovos"
                      checked={aceitaSeminovos}
                      onChange={(e) => setAceitaSeminovos(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <label htmlFor="aceitaSeminovos" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Aceita itens Seminovos
                    </label>
                  </div>
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
                    Almoxarifado Ativo
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
        title={selectedAlmox?.ativo ? 'Inativar Almoxarifado' : 'Ativar Almoxarifado'}
        description={`Tem certeza que deseja ${selectedAlmox?.ativo ? 'inativar' : 'ativar'} o almoxarifado ${selectedAlmox?.nome}? Almoxarifados inativos não podem ser selecionados em lançamentos manuais ou importações.`}
        confirmLabel={selectedAlmox?.ativo ? 'Inativar' : 'Ativar'}
        cancelLabel="Voltar"
        onConfirm={handleConfirmToggleActive}
        onCancel={() => {
          setConfirmToggleOpen(false)
          setSelectedAlmox(null)
        }}
        loading={toggling}
      />
    </div>
  )
}
