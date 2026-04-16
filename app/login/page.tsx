'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/client'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const supabase = createClient()

  const handleLogin = async () => {
    if (!email || !password) { setError('Completa todos los campos.'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      window.location.href = '/admin'
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* ── Header ── */}
        <div className="login-header">
          <div className="login-icon">☕</div>
          <h1>Café Almacén</h1>
          <p>Sistema de trazabilidad cafetera</p>
        </div>

        {/* ── Tabs de autenticación ── */}
        <div className="auth-tabs">
          <span className="auth-tab active">Iniciar sesión</span>
          <Link href="/register" className="auth-tab">Registrarse</Link>
        </div>

        {error && (
          <div className="alert alert-error">⚠ {error}</div>
        )}

        <div className="form-group">
          <label className="form-label">Correo electrónico</label>
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Contraseña</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Ingresando…' : 'Ingresar al sistema'}
        </button>

        <p className="auth-switch-text">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="auth-switch-link">Regístrate aquí</Link>
        </p>
      </div>
    </div>
  )
}
