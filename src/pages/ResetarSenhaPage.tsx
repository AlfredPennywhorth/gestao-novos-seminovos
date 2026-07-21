import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ShieldCheck, ArrowLeft, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/ui'

const resetarSchema = z.object({
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'A confirmação deve ter no mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type ResetarForm = z.infer<typeof resetarSchema>

export default function ResetarSenhaPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const { updatePassword, user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetarForm>({
    resolver: zodResolver(resetarSchema),
  })

  const onSubmit = async (data: ResetarForm) => {
    setError(null)
    const { error: resetError } = await updatePassword(data.password)
    
    if (resetError) {
      setError(resetError)
      return
    }

    setSuccess(true)
    await signOut()
  }

  if (loading) {
    return (
      <div className="animate-fade-in text-center flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-slate-500 text-sm">Verificando sessão de recuperação...</p>
      </div>
    )
  }

  if (!user && !success) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-red-50 text-red-500 p-4 rounded-full">
            <X size={40} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-institutional-blue mb-4">
          Link inválido ou expirado
        </h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Este link de redefinição de senha não é mais válido, já foi utilizado ou expirou. Por favor, solicite um novo link de recuperação.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          Voltar para o login
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full">
            <ShieldCheck size={40} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-institutional-blue mb-4">
          Senha alterada com sucesso!
        </h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Sua senha foi redefinida com êxito. Agora você já pode entrar no sistema utilizando suas novas credenciais.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          Ir para o login
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-institutional-blue mb-2">
          Definir nova senha
        </h1>
        <p className="text-slate-500 text-sm">
          Crie uma senha forte de no mínimo 6 caracteres para a sua conta.
        </p>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="form-group">
          <label className="label label-required" htmlFor="password">
            Nova Senha
          </label>
          <div className="relative">
            <input
              id="password"
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
          <label className="label label-required" htmlFor="confirmPassword">
            Confirmar Nova Senha
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
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

        <button
          type="submit"
          className="btn-primary btn-lg mt-2 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              Alterando senha...
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              Redefinir senha
            </>
          )}
        </button>
      </form>
    </div>
  )
}
