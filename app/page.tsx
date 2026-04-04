import Link from 'next/link'

export default function Home() {
  return (
    <main className="home-page">
      <div className="home-content">
        <div style={{ fontSize: '4rem' }}>☕</div>
        <h1>Café Almacén</h1>
        <p>Sistema de gestión de inventario, procesos y ventas de café.</p>
        <Link href="/login" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
          Ingresar al sistema
        </Link>
      </div>
    </main>
  )
}
