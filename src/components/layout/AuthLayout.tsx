import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-institutional-gray flex">
      {/* Painel esquerdo — identidade visual */}
      <div className="hidden lg:flex flex-col w-1/2 bg-institutional-blue text-white p-12 relative overflow-hidden">
        {/* Decoração geométrica */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />

        <div className="relative z-10 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <div className="bg-white p-1 rounded-lg flex items-center justify-center h-14 w-28 overflow-hidden">
                <img src="/logo.png" alt="Logo CCB" className="h-full w-full object-contain" />
              </div>
              <span className="text-lg font-semibold">Gestão Novos & Seminovos</span>
            </div>

            <h1 className="text-4xl font-bold leading-tight mb-6">
              Controle completo de saídas de itens
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              Registre, acompanhe e analise as saídas de itens novos e seminovos.
              Calcule a economia gerada e tome decisões baseadas em dados.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Novos', icon: '📦' },
              { label: 'Seminovos', icon: '♻️' },
              { label: 'Economia', icon: '💰' },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-sm font-medium text-white/80">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="bg-white border border-slate-200 p-1 rounded-lg flex items-center justify-center h-12 w-24 overflow-hidden">
              <img src="/logo.png" alt="Logo CCB" className="h-full w-full object-contain" />
            </div>
            <span className="text-institutional-blue font-semibold">Gestão Novos & Seminovos</span>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  )
}
