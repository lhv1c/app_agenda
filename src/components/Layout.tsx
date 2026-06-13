import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { TabBar } from './TabBar'

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-6">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
