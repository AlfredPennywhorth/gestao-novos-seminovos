import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/ui'

const cadastroSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'A confirmação deve ter no mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type CadastroForm = z.infer<typeof cadastroSchema>

export default function CadastroPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  })

  const onSubmit = async (data: CadastroForm) => {
    setError(null)
    const { error: signUpError } = await signUp(data.email, data.password, data.nome)
    
    if (signUpError) {
      setError(signUpError)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full">
            <UserPlus size={40} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-institutional-blue mb-4">
          Conta criada com sucesso!
        </h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Seu cadastro foi realizado. Dependendo das configurações do sistema, você pode precisar confirmar seu e-mail ou solicitar a ativação do seu usuário pelo administrador antes de realizar o primeiro login.
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

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-institutional-blue mb-2">
          Criar uma conta
        </h1>
        <p className="text-slate-500 text-sm">
          Preencha os campos abaixo para cadastrar-se no sistema.
        </p>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="form-group">
          <label className="label label-required" htmlFor="nome">
            Nome Completo
          </label>
          <input
            id="nome"
            type="text"
            placeholder="Ex: João Silva"
            className={`input ${errors.nome ? 'input-error' : ''}`}
            {...register('nome')}
          />
          {errors.nome && (
            <span className="error-msg">{errors.nome.message}</span>
          )}
        </div>

        <div className="form-group">
          <label className="label label-required" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
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
            Confirmar Senha
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
              Cadastrando...
            </>
          ) : (
            <>
              <UserPlus size={18} />
              Criar Conta
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Já tem uma conta?{' '}
        <Link to="/login" className="text-institutional-blue hover:underline font-medium">
          Entre aqui
        </Link>
      </p>
    </div>
  )
}
