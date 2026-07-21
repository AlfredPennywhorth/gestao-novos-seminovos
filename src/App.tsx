import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import PrivateRoute from '@/components/layout/PrivateRoute'
import AppLayout from '@/components/layout/AppLayout'
import AuthLayout from '@/components/layout/AuthLayout'

// Páginas principais
import LoginPage from '@/pages/LoginPage'
import CadastroPage from '@/pages/CadastroPage'
import RecuperarSenhaPage from '@/pages/RecuperarSenhaPage'
import ResetarSenhaPage from '@/pages/ResetarSenhaPage'
import DashboardPage from '@/pages/DashboardPage'
import LancamentosPage from '@/pages/LancamentosPage'
import ImportacaoPage from '@/pages/ImportacaoPage'
import ApresentacaoPage from '@/pages/ApresentacaoPage'

// Páginas ADMIN (stubs iniciais — expandidas em etapas seguintes)
import AlmoxarifadosPage from '@/pages/AlmoxarifadosPage'
import SetoresPage from '@/pages/SetoresPage'
import ItensPage from '@/pages/ItensPage'
import CustosPage from '@/pages/CustosPage'
import UsuariosPage from '@/pages/UsuariosPage'
import RelatoriosPage from '@/pages/RelatoriosPage'
import AuditoriaPage from '@/pages/AuditoriaPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rotas públicas */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<CadastroPage />} />
            <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
            <Route path="/resetar-senha" element={<ResetarSenhaPage />} />
          </Route>

          {/* Modo Apresentação — sem sidebar */}
          <Route path="/apresentacao" element={
            <PrivateRoute>
              <ApresentacaoPage />
            </PrivateRoute>
          } />

          {/* Rotas protegidas com AppLayout */}
          <Route element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }>
            <Route path="/" element={<DashboardPage />} />

            {/* ADMIN + OPERADOR */}
            <Route path="/lancamentos" element={
              <PrivateRoute roles={['ADMIN', 'OPERADOR']}>
                <LancamentosPage />
              </PrivateRoute>
            } />
            <Route path="/importacao" element={
              <PrivateRoute roles={['ADMIN', 'OPERADOR']}>
                <ImportacaoPage />
              </PrivateRoute>
            } />

            {/* Apenas ADMIN */}
            <Route path="/almoxarifados" element={
              <PrivateRoute roles={['ADMIN']}>
                <AlmoxarifadosPage />
              </PrivateRoute>
            } />
            <Route path="/setores" element={
              <PrivateRoute roles={['ADMIN']}>
                <SetoresPage />
              </PrivateRoute>
            } />
            <Route path="/itens" element={
              <PrivateRoute roles={['ADMIN']}>
                <ItensPage />
              </PrivateRoute>
            } />
            <Route path="/custos" element={
              <PrivateRoute roles={['ADMIN']}>
                <CustosPage />
              </PrivateRoute>
            } />
            <Route path="/usuarios" element={
              <PrivateRoute roles={['ADMIN']}>
                <UsuariosPage />
              </PrivateRoute>
            } />
            <Route path="/auditoria" element={
              <PrivateRoute roles={['ADMIN']}>
                <AuditoriaPage />
              </PrivateRoute>
            } />

            {/* Todos os perfis autenticados */}
            <Route path="/relatorios" element={<RelatoriosPage />} />

            {/* Rota catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
