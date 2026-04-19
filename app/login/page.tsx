'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleLogin = async () => {
    if (!email || !password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(
        err.message.includes('Email not confirmed') ? 'Confirma tu correo antes de ingresar.' :
        err.message.includes('Invalid login credentials') ? 'Correo o contraseña incorrectos.' :
        err.message
      )
      setLoading(false)
      return
    }
    try {
      const { data: usr } = await supabase
        .from('usuario')
        .select('rol:idrol(nombre)')
        .eq('auth_uid', data.user?.id)
        .maybeSingle()
      const rol = (usr as any)?.rol?.nombre ?? ''
      if (rol === 'Administrador') window.location.href = '/admin'
      else if (rol === 'Vendedor') window.location.href = '/vendedor'
      else if (rol === 'Operador') window.location.href = '/operador'
      else window.location.href = '/portal'
    } catch {
      window.location.href = '/portal'
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">☕</div>
          <h1>CaféTrace</h1>
          <p>Sistema de trazabilidad cafetera</p>
        </div>

        <div className="auth-tabs">
          <span className="auth-tab active">Iniciar sesión</span>
          <Link href="/register" className="auth-tab">Registrarse</Link>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠ {error}</div>}

        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Correo electrónico</label>
          <input className="form-input" type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com" autoComplete="email" />
        </div>

        <div className="form-group" style={{ marginBottom: '1.2rem' }}>
          <label className="form-label">Contraseña</label>
          <input className="form-input" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete="current-password"
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '0.65rem' }}
          onClick={handleLogin} disabled={loading}>
          {loading ? '⏳ Ingresando…' : 'Ingresar al sistema'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '1.1rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          ¿No tienes cuenta?{' '}
          <Link href="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Regístrate aquí</Link>
        </p>
      </div>
    </div>
  )
}
