import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AlterarSenhaModal from './AlterarSenhaModal'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        onSignOut={handleSignOut}
        profile={profile}
        darkMode={darkMode}
        onThemeToggle={() => setDarkMode(value => !value)}
        onChangePassword={() => setChangePasswordOpen(true)}
      />
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={location.pathname}
        role={profile?.role}
      />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="page-content">
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
      <AlterarSenhaModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  )
}
