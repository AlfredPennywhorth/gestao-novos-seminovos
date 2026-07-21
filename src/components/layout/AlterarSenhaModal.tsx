import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/ui'

interface AlterarSenhaModalProps {
  open: boolean
  onClose: () => void
}

const alterarSenhaSchema = z.object({
  password: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'A confirmação deve ter no mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type AlterarSenhaForm = z.infer<typeof alterarSenhaSchema>

export default function AlterarSenhaModal({ open, onClose }: AlterarSenhaModalProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const { updatePassword } = useAuth()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AlterarSenhaForm>({
    resolver: zodResolver(alterarSenhaSchema),
  })

  const onSubmit = async (data: AlterarSenhaForm) => {
    setError(null)
    const { error: updateError } = await updatePassword(data.password)
    
    if (updateError) {
      setError(updateError)
      return
    }

    setSuccess(true)
  }

  const handleClose = () => {
    reset()
    setError(null)
    setSuccess(false)
    setShowPassword(false)
    setShowConfirmPassword(false)
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal max-w-md w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header flex justify-between items-center pb-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-institutional-blue">
            Alterar Minha Senha
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="modal-body py-4 flex flex-col gap-4">
            {success ? (
              <div className="text-center py-4 flex flex-col items-center gap-3">
                <div className="bg-emerald-50 text-emerald-500 p-3 rounded-full">
                  <ShieldCheck size={32} />
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  Sua senha foi atualizada com sucesso!
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                  Digite sua nova senha de acesso abaixo. O sistema atualizará suas credenciais de segurança imediatamente.
                </p>

                {error && (
                  <Alert variant="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <div className="form-group">
                  <label className="label label-required" htmlFor="modal-password">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      id="modal-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="error-msg">{errors.password.message}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="label label-required" htmlFor="modal-confirmPassword">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      id="modal-confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`input pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <span className="error-msg">{errors.confirmPassword.message}</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer pt-3 border-t border-slate-100 flex justify-end gap-2">
            {success ? (
              <button type="button" onClick={handleClose} className="btn-primary">
                Entendido
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Salvar Senha
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
