import { Menu, LogOut, Moon, Presentation, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '@/types/database'

interface TopbarProps {
  onMenuToggle: () => void
  onSignOut: () => void
  profile: Profile | null
  darkMode: boolean
  onThemeToggle: () => void
}

export default function Topbar({ onMenuToggle, onSignOut, profile, darkMode, onThemeToggle }: TopbarProps) {
  const navigate = useNavigate()

  return (
    <header className="topbar">
      {/* Toggle sidebar mobile */}
      <button
        onClick={onMenuToggle}
        className="btn-icon text-white hover:bg-white/10 lg:hidden"
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      {/* Logo + título */}
      <div className="flex items-center gap-3 flex-1">
        <div className="bg-white p-0.5 rounded flex items-center justify-center h-8 w-16 overflow-hidden">
          <img src="/logo.png" alt="Logo CCB" className="h-full w-full object-contain" />
        </div>
        <span className="text-white font-semibold text-base hidden sm:block">
          Gestão Novos & Seminovos
        </span>
      </div>

      {/* Ações do cabeçalho */}
      <div className="flex items-center gap-2">
        <button
          onClick={onThemeToggle}
          className="btn-icon text-white/80 hover:text-white hover:bg-white/10"
          title={darkMode ? 'Usar tema claro' : 'Usar tema noturno'}
          aria-label={darkMode ? 'Usar tema claro' : 'Usar tema noturno'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {/* Botão Modo Apresentação */}
        <button
          onClick={() => navigate('/apresentacao')}
          className="btn-ghost btn-sm text-white hover:bg-white/10 hidden md:flex"
          title="Modo Apresentação"
        >
          <Presentation size={16} />
          <span>Apresentação</span>
        </button>

        {/* Perfil do usuário */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
            {profile?.nome?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-white text-xs font-medium leading-none">
              {profile?.nome ?? 'Usuário'}
            </div>
            <div className="text-white/60 text-[10px] leading-none mt-0.5">
              {profile?.role}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onSignOut}
          className="btn-icon text-white/70 hover:text-white hover:bg-white/10"
          title="Sair"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
