// src/App.jsx — Router principal
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

import Home         from './pages/public/Home'
import Login        from './pages/Login'
import Sidebar      from './components/Sidebar'

import Dashboard    from './pages/admin/Dashboard'
import Almacenes    from './pages/admin/Almacenes'
import Productores  from './pages/admin/Productores'
import Clientes     from './pages/admin/Clientes'
import Fincas       from './pages/admin/Fincas'
import LotesCafe    from './pages/admin/LotesCafe'
import Procesos     from './pages/admin/Procesos'
import Registros    from './pages/admin/Registros'
import Ventas       from './pages/admin/Ventas'
import Movimientos  from './pages/admin/Movimientos'
import Roles        from './pages/admin/Roles'
import Usuarios     from './pages/admin/Usuarios'

// Guarda de ruta privada
function PrivateRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return (
    <div className="loading-center" style={{ height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
  return session ? children : <Navigate to="/login" replace />
}

// Layout del panel admin
function AdminLayout({ children }) {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/"      element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Admin (protegidas) */}
        <Route path="/admin" element={
          <PrivateRoute>
            <AdminLayout><Dashboard /></AdminLayout>
          </PrivateRoute>
        } />
        <Route path="/admin/almacenes"   element={<PrivateRoute><AdminLayout><Almacenes /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/productores" element={<PrivateRoute><AdminLayout><Productores /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/clientes"    element={<PrivateRoute><AdminLayout><Clientes /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/fincas"      element={<PrivateRoute><AdminLayout><Fincas /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/lotes"       element={<PrivateRoute><AdminLayout><LotesCafe /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/procesos"    element={<PrivateRoute><AdminLayout><Procesos /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/registros"   element={<PrivateRoute><AdminLayout><Registros /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/ventas"      element={<PrivateRoute><AdminLayout><Ventas /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/movimientos" element={<PrivateRoute><AdminLayout><Movimientos /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/roles"       element={<PrivateRoute><AdminLayout><Roles /></AdminLayout></PrivateRoute>} />
        <Route path="/admin/usuarios"    element={<PrivateRoute><AdminLayout><Usuarios /></AdminLayout></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}