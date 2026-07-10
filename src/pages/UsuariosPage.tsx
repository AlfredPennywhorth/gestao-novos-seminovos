import { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, UserCheck, Shield, ToggleLeft, ToggleRight } from 'lucide-react'
import { listProfiles, updateUserRole, toggleUserActive } from '@/services/profiles.service'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner, EmptyState } from '@/components/ui'
import type { Profile } from '@/types/database'
import { UserRole } from '@/types/database'

export default function UsuariosPage() {
  const { profile: currentProfile } = useAuth()
  
  // Lista de usuários
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Controle de edição
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listProfiles()
      setUsers(data)
    } catch {
      setError('Erro ao carregar lista de usuários. Certifique-se de que possui permissão de ADMIN.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Alterar perfil/role
  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await updateUserRole(userId, newRole)
      if (error) throw new Error(error)
      setSuccess('Perfil de acesso alterado com sucesso!')
      fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar perfil de acesso.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Ativar / Inativar usuário
  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    setUpdatingId(userId)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await toggleUserActive(userId, !currentStatus)
      if (error) throw new Error(error)
      setSuccess(`Usuário ${!currentStatus ? 'ativado' : 'inativado'} com sucesso!`)
      fetchUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status do usuário.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (currentProfile?.role !== 'ADMIN') {
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
          <h1 className="page-title">Gestão de Usuários</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Gerencie as permissões de acesso e o status de ativação dos colaboradores
          </p>
        </div>
        <button className="btn-secondary btn-sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw size={14} />
          Atualizar
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

      {/* Caixa Informativa sobre fluxo de criação */}
      <div className="alert alert-info mb-6">
        <UserCheck size={18} className="shrink-0" />
        <div className="text-sm">
          <strong>Cadastro de Novos Usuários:</strong> Os novos usuários devem se registrar
          usando a tela de Login (criando uma conta comum). Ao se cadastrar, eles recebem automaticamente
          o perfil <strong className="font-semibold text-slate-700">VISUALIZADOR (Inativo ou Sem Permissões de Escrita)</strong>.
          Como ADMIN, você pode promovê-los a <strong>OPERADOR</strong> ou <strong>ADMIN</strong> nesta tela.
        </div>
      </div>

      {/* Tabela de Usuários */}
      {loading && users.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="Nenhum usuário cadastrado"
          description="Nenhum perfil de usuário foi encontrado no banco."
          icon={<Users size={48} />}
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil de Acesso</th>
                <th>Status</th>
                <th>Data de Registro</th>
                <th className="text-center">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {users.map((userMail) => {
                const isMe = userMail.id === currentProfile.id
                const isBusy = updatingId === userMail.id

                return (
                  <tr key={userMail.id} className={isMe ? 'bg-blue-50/20' : ''}>
                    <td className="font-medium text-slate-800 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {userMail.nome?.charAt(0)?.toUpperCase()}
                      </div>
                      {userMail.nome} {isMe && <span className="text-[10px] text-institutional-blue-medium font-semibold">(Você)</span>}
                    </td>
                    <td className="text-slate-500 text-sm">{userMail.email}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Shield size={14} className="text-slate-400" />
                        <select
                          className="select text-xs py-1 px-2 pr-6 max-w-[130px]"
                          value={userMail.role}
                          onChange={(e) => handleRoleChange(userMail.id, e.target.value)}
                          disabled={isMe || isBusy}
                        >
                          <option value={UserRole.ADMIN}>ADMIN</option>
                          <option value={UserRole.OPERADOR}>OPERADOR</option>
                          <option value={UserRole.VISUALIZADOR}>VISUALIZADOR</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${userMail.ativo ? 'badge-green' : 'badge-red'}`}>
                        {userMail.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(userMail.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="text-center">
                      <button
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                          isMe
                            ? 'text-slate-300 cursor-not-allowed'
                            : userMail.ativo
                            ? 'text-alert-red hover:text-red-700'
                            : 'text-economy-green hover:text-green-700'
                        }`}
                        onClick={() => handleToggleActive(userMail.id, userMail.ativo)}
                        disabled={isMe || isBusy}
                      >
                        {isBusy ? (
                          <LoadingSpinner size="sm" />
                        ) : userMail.ativo ? (
                          <>
                            <ToggleRight size={18} />
                            Desativar
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={18} />
                            Ativar
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
