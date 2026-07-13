import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface PrivateRouteProps {
  children?: React.ReactNode
  roles?: string[]
}

export default function PrivateRoute({ children, roles }: PrivateRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner w-8 h-8 border-institutional-blue border-[3px]" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // An authenticated session without an active profile is never authorized.
  if (!profile || !profile.ativo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="card text-center max-w-md">
          <h2 className="text-lg font-bold text-alert-red mb-2">Acesso indisponível</h2>
          <p className="text-slate-500 text-sm">
            Seu perfil está inativo ou não pôde ser carregado. Contate o administrador.
          </p>
        </div>
      </div>
    )
  }

  if (roles && !roles.includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="card text-center max-w-md">
          <h2 className="text-lg font-bold text-alert-red mb-2">Acesso negado</h2>
          <p className="text-slate-500 text-sm">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    )
  }

  // Se children foi passado, renderiza children; caso contrário, usa Outlet (route nesting)
  return children ? <>{children}</> : <Outlet />
}
