import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { RecoverPasswordPage } from './pages/RecoverPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HomePage } from './pages/HomePage'
import { AgendaLayout } from './components/AgendaLayout'
import { CalendarPage } from './pages/CalendarPage'
import { MyReservationsPage } from './pages/MyReservationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminHomePage } from './pages/admin/AdminHomePage'
import { AdminAgendaLayout } from './components/AdminAgendaLayout'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { RevenueReportPage } from './pages/admin/RevenueReportPage'
import { MembersPage } from './pages/admin/MembersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<SignupPage />} />
      <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/home" element={<HomePage />} />

          <Route path="/agenda" element={<AgendaLayout />}>
            <Route index element={<Navigate to="/agenda/calendario" replace />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="minhas-reservas" element={<MyReservationsPage />} />
          </Route>

          <Route path="/perfil" element={<ProfilePage />} />

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminHomePage />} />

            <Route path="/admin/agenda" element={<AdminAgendaLayout />}>
              <Route index element={<Navigate to="/admin/agenda/secretaria" replace />} />
              <Route path="secretaria" element={<AdminDashboardPage />} />
              <Route path="receita" element={<RevenueReportPage />} />
            </Route>

            <Route path="/admin/membros" element={<MembersPage />} />

            {/* Deep link antigo da receita */}
            <Route path="/admin/receita" element={<Navigate to="/admin/agenda/receita" replace />} />
          </Route>

          {/* Deep links antigos: nao quebrar PWA instalado / favoritos */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/minhas-reservas" element={<Navigate to="/agenda/minhas-reservas" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
