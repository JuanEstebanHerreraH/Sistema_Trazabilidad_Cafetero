import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '../../components/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user info and role
  const { data: usr } = await supabase
    .from('usuario')
    .select('nombre, email, rol:idrol(nombre)')
    .eq('auth_uid', user.id)
    .maybeSingle()

  const rolNombre = (usr as any)?.rol?.nombre ?? ''
  if (rolNombre && rolNombre !== 'Administrador') redirect('/portal')

  return (
    <div className="dash-layout">
      <AdminSidebar userName={(usr as any)?.nombre ?? ''} userEmail={(usr as any)?.email ?? ''} />
      <main className="dash-main">
        <div className="dash-content">{children}</div>
      </main>
    </div>
  )
}
