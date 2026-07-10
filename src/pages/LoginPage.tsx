import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/ui'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setError(null)
    const { error: signInError } = await signIn(data.email, data.password)
    if (signInError) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.')
      return
    }
    navigate('/')
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-institutional-blue mb-2">
          Entrar no sistema
        </h1>
        <p className="text-slate-500 text-sm">
          Use seu e-mail e senha cadastrados pelo administrador.
        </p>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="form-group">
          <label className="label label-required" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            className={`input ${errors.email ? 'input-error' : ''}`}
            {...register('email')}
          />
          {errors.email && (
            <span className="error-msg">{errors.email.message}</span>
          )}
        </div>

        <div className="form-group">
          <label className="label label-required" htmlFor="password">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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

        <button
          type="submit"
          className="btn-primary btn-lg mt-2 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              Entrando...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Entrar
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400 mt-8">
        Primeiro acesso? Solicite ao administrador do sistema.
      </p>
    </div>
  )
}
