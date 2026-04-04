import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}
