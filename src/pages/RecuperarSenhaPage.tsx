import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, ArrowLeft, Mail } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Alert, LoadingSpinner } from '@/components/ui'

const recuperarSchema = z.object({
  email: z.string().email('E-mail inválido'),
})

type RecuperarForm = z.infer<typeof recuperarSchema>

export default function RecuperarSenhaPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const { resetPasswordForEmail } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecuperarForm>({
    resolver: zodResolver(recuperarSchema),
  })

  const onSubmit = async (data: RecuperarForm) => {
    setError(null)
    const { error: resetError } = await resetPasswordForEmail(data.email)
    
    if (resetError) {
      setError(resetError)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="animate-fade-in text-center">
        <div className="mb-6 flex justify-center">
          <div className="bg-blue-50 text-institutional-blue p-4 rounded-full">
            <Mail size={40} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-institutional-blue mb-4">
          Instruções enviadas!
        </h1>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          Enviamos um link de recuperação para o e-mail informado. Por favor, verifique sua caixa de entrada e spam para redefinir sua senha.
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
          Recuperar senha
        </h1>
        <p className="text-slate-500 text-sm">
          Informe seu e-mail cadastrado para enviarmos as instruções de redefinição de senha.
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
            placeholder="seu@email.com"
            className={`input ${errors.email ? 'input-error' : ''}`}
            {...register('email')}
          />
          {errors.email && (
            <span className="error-msg">{errors.email.message}</span>
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
              Enviando...
            </>
          ) : (
            <>
              <KeyRound size={18} />
              Enviar link de recuperação
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Lembrou a senha?{' '}
        <Link to="/login" className="text-institutional-blue hover:underline font-medium">
          Voltar para o login
        </Link>
      </p>
    </div>
  )
}
