import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowUpDown, Upload, Warehouse,
  Tag, Package, DollarSign, Users, BarChart3,
  ClipboardList, X
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    to: '/lancamentos',
    label: 'Lançamentos',
    icon: <ArrowUpDown size={18} />,
    roles: ['ADMIN', 'OPERADOR'],
  },
  {
    to: '/importacao',
    label: 'Importação',
    icon: <Upload size={18} />,
    roles: ['ADMIN', 'OPERADOR'],
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    icon: <BarChart3 size={18} />,
  },
]

const ADMIN_ITEMS: NavItem[] = [
  {
    to: '/almoxarifados',
    label: 'Almoxarifados',
    icon: <Warehouse size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/setores',
    label: 'Setores',
    icon: <Tag size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/itens',
    label: 'Itens',
    icon: <Package size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/custos',
    label: 'Custos Mensais',
    icon: <DollarSign size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/usuarios',
    label: 'Usuários',
    icon: <Users size={18} />,
    roles: ['ADMIN'],
  },
  {
    to: '/auditoria',
    label: 'Auditoria',
    icon: <ClipboardList size={18} />,
    roles: ['ADMIN'],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  currentPath: string
  role?: string
}

function NavGroup({
  title,
  items,
  role,
}: {
  title: string
  items: NavItem[]
  role?: string
}) {
  const visibleItems = items.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  )

  if (visibleItems.length === 0) return null

  return (
    <div className="mb-2">
      <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
        {title}
      </div>
      {visibleItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''}`
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

export default function Sidebar({ open, onClose, role }: SidebarProps) {
  return (
    <aside className={`sidebar transition-transform duration-200 ${open ? 'translate-x-0' : ''}`}>
      {/* Cabeçalho do sidebar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-institutional-gray-border">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Navegação
        </span>
        <button
          onClick={onClose}
          className="btn-icon p-1 text-slate-400 hover:text-slate-700 lg:hidden"
        >
          <X size={16} />
        </button>
      </div>

      {/* Links de navegação */}
      <nav className="py-3">
        <NavGroup title="Principal" items={NAV_ITEMS} role={role} />
        <NavGroup title="Administração" items={ADMIN_ITEMS} role={role} />
      </nav>

      {/* Rodapé do sidebar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-institutional-gray-border">
        <p className="text-[10px] text-slate-400 text-center">
          Gestão Novos & Seminovos © {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  )
}
