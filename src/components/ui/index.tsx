import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'

// =============================================================================
// LoadingSpinner
// =============================================================================
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size]
  return (
    <span
      className={`spinner border-institutional-blue border-2 ${sizeClass} ${className}`}
      role="status"
      aria-label="Carregando"
    />
  )
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4 text-slate-400">
        <LoadingSpinner size="lg" />
        <p className="text-sm">Carregando...</p>
      </div>
    </div>
  )
}

// =============================================================================
// EmptyState
// =============================================================================
interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-state-icon">
        {icon ?? (
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-600 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// =============================================================================
// Alert
// =============================================================================
type AlertVariant = 'info' | 'success' | 'warning' | 'error'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  onClose?: () => void
  className?: string
}

const ALERT_CONFIG: Record<AlertVariant, { className: string; icon: React.ReactNode }> = {
  info:    { className: 'alert-info',    icon: <Info size={16} className="shrink-0 mt-0.5" /> },
  success: { className: 'alert-success', icon: <CheckCircle size={16} className="shrink-0 mt-0.5" /> },
  warning: { className: 'alert-warning', icon: <AlertTriangle size={16} className="shrink-0 mt-0.5" /> },
  error:   { className: 'alert-error',   icon: <AlertCircle size={16} className="shrink-0 mt-0.5" /> },
}

export function Alert({ variant = 'info', title, children, onClose, className = '' }: AlertProps) {
  const { className: variantClass, icon } = ALERT_CONFIG[variant]
  return (
    <div className={`${variantClass} ${className}`} role="alert">
      {icon}
      <div className="flex-1">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">
          <X size={14} />
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Badge
// =============================================================================
type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  blue:   'badge-blue',
  green:  'badge-green',
  red:    'badge-red',
  yellow: 'badge-yellow',
  gray:   'badge-gray',
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`${BADGE_VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}

// =============================================================================
// ConfirmDialog
// =============================================================================
interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-base font-semibold text-institutional-blue">{title}</h3>
        </div>
        <div className="modal-body">
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary" disabled={loading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            disabled={loading}
          >
            {loading && <LoadingSpinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Pagination
// =============================================================================
interface PaginationProps {
  page: number
  totalPages: number
  onPage: (page: number) => void
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <button
        className="btn-secondary btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        Anterior
      </button>
      <span className="text-sm text-slate-500">
        {page} / {totalPages}
      </span>
      <button
        className="btn-secondary btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        Próximo
      </button>
    </div>
  )
}
