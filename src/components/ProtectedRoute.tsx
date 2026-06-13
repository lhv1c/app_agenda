import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { Spinner } from './ui'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-full items-center justify-center text-granada">
      <Spinner className="size-8" />
    </div>
  )
}

/** Requires an authenticated session. */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Requires an authenticated admin. */
export function AdminRoute() {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
