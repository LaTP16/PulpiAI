import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { api, Movement, MovementType, TransactionSummary, User, OCRParseResult, VoiceParseResult } from './services/api'

type View = 'dashboard' | 'register' | 'whatsapp' | 'history' | 'assistant' | 'credit'
type FormState = Omit<Movement, 'id'>

type SpeechRecognitionEventLike = { results: { [index: number]: { [index: number]: { transcript: string } } } }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: (event: SpeechRecognitionEventLike) => void
  onerror: () => void
  onend: () => void
  start: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const incomeCategories = ['Ventas', 'Pedidos', 'Sueldo', 'Trabajos independientes', 'Otros ingresos']
const expenseCategories = ['Mercadería', 'Alimentación', 'Transporte', 'Servicios', 'Compras', 'Entretenimiento', 'Alquiler', 'Otros gastos']

const iconPaths: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  sparkle: <><path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2zM5 14l-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8zM18 14l-.8 2.2L15 17l2.2.8L18 20l.8-2.2L21 17l-2.2-.8z"/></>,
  credit: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></>,
  arrowUp: <><path d="m6 15 6-6 6 6"/></>,
  arrowDown: <><path d="m6 9 6 6 6-6"/></>,
  wallet: <><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10H5a3 3 0 0 1-3-3V7"/><path d="M16 15h.01"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
  filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
  send: <><path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/></>,
  camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z"/><circle cx="12" cy="13" r="3"/></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></>,
  bulb: <><path d="M9 18h6M10 22h4M8.5 15.5a7 7 0 1 1 7 0c-.8.6-1.2 1.4-1.2 2.5h-4.6c0-1.1-.4-1.9-1.2-2.5z"/></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  alert: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(value)

const formatDate = (date: string) => {
  if (!date) return ''
  try {
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
  } catch {
    return date
  }
}

const isoDate = (daysAgo = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Inicio', icon: 'dashboard' },
  { id: 'register', label: 'Registrar', icon: 'plus' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
  { id: 'history', label: 'Historial', icon: 'history' },
  { id: 'assistant', label: 'Asistente IA', icon: 'sparkle' },
  { id: 'credit', label: 'Mi crédito', icon: 'credit' },
]

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo">
      <div className="logo-mark"><span>P</span></div>
      {!compact && <div><strong>Pulpi<span>AI</span></strong><small>Tu negocio, más claro</small></div>}
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('pulpiai-auth') === 'true' || localStorage.getItem('kipuai-auth') === 'true'
  )
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('pulpiai-user') || localStorage.getItem('kipuai-user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [view, setView] = useState<View>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const reloadData = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setApiError(null)
    try {
      const [txList, sum] = await Promise.all([
        api.getTransactions(),
        api.getSummary()
      ])
      setMovements(txList)
      setSummary(sum)
    } catch (err: any) {
      console.error('Error fetching data:', err)
      setApiError('No se pudo sincronizar con el servidor backend. Comprueba que el backend esté activo.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      reloadData()
    }
  }, [isAuthenticated, reloadData])

  const navigate = (next: View) => {
    setView(next)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totals = useMemo(() => {
    if (summary) {
      return {
        income: summary.income,
        expense: summary.expense,
        balance: summary.balance,
        weekly: summary.weekly
      }
    }
    const income = movements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0)
    const expense = movements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0)
    return { income, expense, balance: income - expense, weekly: [] }
  }, [summary, movements])

  const handleSaveMovement = async (movementData: FormState, idToUpdate?: string | null) => {
    try {
      if (idToUpdate) {
        await api.updateTransaction(idToUpdate, movementData)
      } else {
        await api.createTransaction(movementData)
      }
      await reloadData()
      setEditingMovement(null)
    } catch (err: any) {
      alert(err.message || 'Error al guardar movimiento')
    }
  }

  const handleDeleteMovement = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este movimiento?')) return
    try {
      await api.deleteTransaction(id)
      await reloadData()
    } catch (err: any) {
      alert(err.message || 'Error al eliminar movimiento')
    }
  }

  const handleBatchAddMovements = async (items: Omit<Movement, 'id'>[]) => {
    for (const item of items) {
      await api.createTransaction(item)
    }
    await reloadData()
  }

  const startEditing = (movement: Movement) => {
    setEditingMovement(movement)
    navigate('register')
  }

  const handleLoginSuccess = (loggedInUser: User) => {
    localStorage.setItem('pulpiai-auth', 'true')
    localStorage.setItem('pulpiai-user', JSON.stringify(loggedInUser))
    setUser(loggedInUser)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('pulpiai-auth')
    localStorage.removeItem('pulpiai-user')
    localStorage.removeItem('kipuai-auth')
    localStorage.removeItem('kipuai-user')
    setUser(null)
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLoginSuccess} />
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><Icon name="close" /></button>
        </div>
        <nav className="main-nav" aria-label="Navegación principal">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {view === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <div className="tip-icon"><Icon name="bulb" size={18} /></div>
          <strong>Consejo del día</strong>
          <p>Registra tus movimientos a diario para conocer mejor tu negocio.</p>
        </div>
        <div className="profile">
          <div className="avatar">MR</div>
          <div>
            <strong>{user?.name || 'María Rodríguez'}</strong>
            <span>{user?.business_name || 'Bodega Mi Esquina'}</span>
          </div>
          <button className="profile-menu" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="more" size={18} /></button>
        </div>
      </aside>

      {sidebarOpen && <button className="backdrop" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Icon name="menu" /></button>
          <Logo compact />
          <div className="avatar small">MR</div>
        </header>

        {apiError && (
          <div className="warning-notice" style={{ margin: '16px 20px 0' }}>
            <Icon name="alert" size={18} />
            <div>
              <strong>Aviso de conexión:</strong> {apiError}
              <button onClick={reloadData} style={{ marginLeft: 10, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Reintentar</button>
            </div>
          </div>
        )}

        {view === 'dashboard' && <Dashboard movements={movements} totals={totals} summaryWeekly={summary?.weekly} navigate={navigate} />}
        {view === 'register' && (
          <Register
            movements={movements}
            onSave={handleSaveMovement}
            onDelete={handleDeleteMovement}
            requestedEdit={editingMovement}
            clearRequestedEdit={() => setEditingMovement(null)}
          />
        )}
        {view === 'whatsapp' && <WhatsAppSimulator onConfirm={handleBatchAddMovements} navigate={navigate} />}
        {view === 'history' && <History movements={movements} onEdit={startEditing} onDelete={handleDeleteMovement} onFilter={reloadData} />}
        {view === 'assistant' && <Assistant totals={totals} movements={movements} />}
        {view === 'credit' && <Credit totals={totals} movements={movements} />}
      </main>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        {navItems.slice(0, 5).map(item => (
          <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} size={19} />
            <span>{item.label === 'Asistente IA' ? 'Asistente' : item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  // Requirement 1: Pre-fill test credentials by default so tester can log in with 1 click!
  const [identifier, setIdentifier] = useState('maria@gmail.com')
  const [password, setPassword] = useState('comerciante123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await api.login(identifier, password)
      if (response.success && response.user) {
        onLogin(response.user)
      } else {
        setError('No se pudo verificar la cuenta de demostración.')
      }
    } catch (err: any) {
      console.warn('Backend login fallback:', err)
      // Fallback if backend offline: verify default demo credentials locally
      if ((identifier.trim().toLowerCase() === 'maria@gmail.com' || identifier.trim() === '976345234') && password === 'comerciante123') {
        onLogin({
          id: 'demo-user-maria-001',
          name: 'María Rodríguez',
          email: 'maria@gmail.com',
          phone: '976345234',
          business_name: 'Bodega Mi Esquina',
          is_demo: true,
        })
      } else {
        setError(err.message || 'Revisa tu correo, celular o contraseña.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Logo />
        <div className="login-copy">
          <span className="eyebrow">Entorno de Pruebas & Demostración</span>
          <h1>Acceso de prueba PulpiAI</h1>
          <p>Las credenciales de prueba ya están precargadas. Solo haz clic en «Ingresar» para acceder al sistema.</p>
        </div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <label className="form-field">
            <span>Correo o celular</span>
            <input
              autoComplete="username"
              value={identifier}
              onChange={e => { setIdentifier(e.target.value); setError('') }}
              placeholder="maria@gmail.com"
              required
            />
          </label>
          <label className="form-field">
            <span>Contraseña</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Tu contraseña"
              required
            />
          </label>
          <button className="primary-button login-button" disabled={loading} type="submit">
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
        <div className="demo-credentials">
          <strong>✓ Cuenta de demostración precargada</strong>
          <span>Usuario: <code>maria@gmail.com</code> (o <code>976345234</code>)</span>
          <span>Contraseña: <code>comerciante123</code></span>
          <small style={{ color: '#666', marginTop: 4, display: 'block' }}>Solo haz clic en el botón «Ingresar» arriba.</small>
        </div>
      </section>
      <aside className="login-panel">
        <div>
          <span className="eyebrow">Bodega Mi Esquina</span>
          <h2>Tus números claros.<br />Tus decisiones seguras.</h2>
          <p>PulpiAI reúne todos tus movimientos en un solo lugar con inteligencia artificial para voz y reconocimiento OCR de comprobantes.</p>
          <div className="login-feature">
            <Icon name="check" />
            <span><strong>Datos de ejemplo listos</strong><small>Explora el saldo, ingresos, gastos y reportes sin registrar todo a mano.</small></span>
          </div>
          <div className="login-feature">
            <Icon name="sparkle" />
            <span><strong>Reconocimiento de voz & OCR corregidos</strong><small>Extracción de montos precisos y clasificación automática de comprobantes.</small></span>
          </div>
        </div>
      </aside>
    </main>
  )
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  )
}

function Dashboard({
  movements,
  totals,
  summaryWeekly,
  navigate
}: {
  movements: Movement[]
  totals: { income: number; expense: number; balance: number }
  summaryWeekly?: { label: string; date: string; income: number; expense: number }[]
  navigate: (v: View) => void
}) {
  const weekly = useMemo(() => {
    if (summaryWeekly && summaryWeekly.length > 0) return summaryWeekly

    return Array.from({ length: 7 }, (_, index) => {
      const date = isoDate(6 - index)
      const dayMovements = movements.filter(m => m.date === date)
      return {
        label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).slice(0, 2),
        date,
        income: dayMovements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0),
        expense: dayMovements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0),
      }
    })
  }, [summaryWeekly, movements])

  const max = Math.max(...weekly.flatMap(day => [day.income, day.expense]), 1)
  const today = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <div className="page">
      <PageHeader
        eyebrow={today}
        title="Hola, María"
        description="Así está tu bodega hoy con datos de demostración coherentes."
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="demo-pill">Demostración</span>
            <button className="primary-button" onClick={() => navigate('register')}>
              <Icon name="plus" size={18} />Registrar movimiento
            </button>
          </div>
        }
      />
      <section className="stats-grid">
        <div className="stat-card balance-card">
          <div className="stat-top">
            <span className="stat-icon"><Icon name="wallet" /></span>
            <span className="status-pill">Calculado en tiempo real</span>
          </div>
          <span className="stat-label">Saldo disponible</span>
          <strong>{formatMoney(totals.balance)}</strong>
          <small>{movements.length} movimientos · Ingresos ({formatMoney(totals.income)}) − Gastos ({formatMoney(totals.expense)})</small>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-icon income"><Icon name="arrowUp" /></span><span className="trend positive">Este mes</span></div>
          <span className="stat-label">Ingresos</span>
          <strong>{formatMoney(totals.income)}</strong>
          <small>{movements.filter(m => m.type === 'income').length} movimientos registrados</small>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-icon expense"><Icon name="arrowDown" /></span><span className="trend">Este mes</span></div>
          <span className="stat-label">Gastos</span>
          <strong>{formatMoney(totals.expense)}</strong>
          <small>{movements.filter(m => m.type === 'expense').length} movimientos registrados</small>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-heading">
            <div><h2>Movimiento semanal</h2><p>Ingresos y gastos de los últimos 7 días</p></div>
            <div className="legend"><span><i className="income-dot" />Ingresos</span><span><i className="expense-dot" />Gastos</span></div>
          </div>
          <div className="chart">
            <div className="chart-lines"><i/><i/><i/><i/></div>
            {weekly.map(day => (
              <div className="bar-group" key={day.date || day.label}>
                <div className="bars">
                  <span className="bar income-bar" style={{ height: `${Math.max((day.income / max) * 100, day.income ? 8 : 0)}%` }} title={`Ingreso: ${formatMoney(day.income)}`} />
                  <span className="bar expense-bar" style={{ height: `${Math.max((day.expense / max) * 100, day.expense ? 8 : 0)}%` }} title={`Gasto: ${formatMoney(day.expense)}`} />
                </div>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="card health-card">
          <div className="card-heading"><div><h2>Salud del negocio</h2><p>Basado en tus registros actuales</p></div></div>
          <div className="health-score">
            <div className="score-ring"><strong>{totals.income ? Math.min(95, Math.round((totals.balance / totals.income) * 100 + 40)) : 0}</strong><span>/100</span></div>
            <div>
              <strong>{movements.length ? (totals.balance >= 0 ? 'Buen progreso financiero' : 'Revisa tus gastos') : 'Empieza tu registro'}</strong>
              <p>{movements.length ? (totals.balance >= 0 ? 'Tus ingresos son mayores que tus gastos. Tienes liquidez disponible.' : 'Tus gastos superan los ingresos registrados.') : 'Aún no tienes movimientos guardados.'}</p>
            </div>
          </div>
          <div className="progress-row">
            <span>Margen disponible</span>
            <strong>{totals.income ? Math.max(0, Math.round((totals.balance / totals.income) * 100)) : 0}%</strong>
          </div>
          <div className="progress"><span style={{ width: `${totals.income ? Math.max(0, Math.min(100, (totals.balance / totals.income) * 100)) : 0}%` }} /></div>
          <button className="text-button" onClick={() => navigate('credit')}>Ver preparación para crédito <Icon name="chevron" size={16} /></button>
        </div>
      </section>

      <section className="card recent-card">
        <div className="card-heading">
          <div><h2>Últimos movimientos</h2><p>Tu actividad más reciente (datos de ejemplo)</p></div>
          <button className="text-button" onClick={() => navigate('history')}>Ver todo ({movements.length}) <Icon name="chevron" size={16} /></button>
        </div>
        <MovementList movements={movements.slice(0, 5)} />
      </section>
    </div>
  )
}

function MovementList({ movements, actions }: { movements: Movement[]; actions?: (movement: Movement) => ReactNode }) {
  if (!movements.length) return <div className="empty-state"><Icon name="history" /><strong>No hay movimientos</strong><p>Registra tu primera venta o gasto para verlo aquí.</p></div>
  return (
    <div className="movement-list">
      {movements.map(movement => (
        <div className="movement-row" key={movement.id}>
          <span className={`movement-icon ${movement.type}`}><Icon name={movement.type === 'income' ? 'arrowUp' : 'arrowDown'} size={18} /></span>
          <div className="movement-info">
            <strong>
              {movement.description}
              {movement.is_demo && <span className="demo-pill" style={{ marginLeft: 6, display: 'inline-block', fontSize: 8, padding: '1px 5px' }}>Demo</span>}
            </strong>
            <span>{movement.category} · {formatDate(movement.date)} {movement.source && `· vía ${movement.source}`}</span>
          </div>
          <strong className={`movement-amount ${movement.type}`}>{movement.type === 'income' ? '+' : '−'} {formatMoney(movement.amount)}</strong>
          {actions?.(movement)}
        </div>
      ))}
    </div>
  )
}

function Register({
  movements,
  onSave,
  onDelete,
  requestedEdit,
  clearRequestedEdit
}: {
  movements: Movement[]
  onSave: (m: FormState, idToUpdate?: string | null) => Promise<void>
  onDelete: (id: string) => Promise<void>
  requestedEdit: Movement | null
  clearRequestedEdit: () => void
}) {
  const blankForm: FormState = { type: 'income', amount: 0, category: 'Ventas', description: '', date: isoDate() }
  const [form, setForm] = useState<FormState>(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [captureNotice, setCaptureNotice] = useState('')
  const [warningNotice, setWarningNotice] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const [ocrDetails, setOcrDetails] = useState<OCRParseResult | null>(null)
  const [showRawOcr, setShowRawOcr] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!requestedEdit) return
    setEditingId(requestedEdit.id)
    setForm({
      type: requestedEdit.type,
      amount: requestedEdit.amount,
      category: requestedEdit.category,
      description: requestedEdit.description,
      date: requestedEdit.date
    })
  }, [requestedEdit])

  const setType = (type: MovementType) => {
    setForm(current => ({
      ...current,
      type,
      category: type === 'income' ? 'Ventas' : 'Mercadería'
    }))
  }

  const edit = (movement: Movement) => {
    setEditingId(movement.id)
    setForm({
      type: movement.type,
      amount: movement.amount,
      category: movement.category,
      description: movement.description,
      date: movement.date
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.amount || !form.description.trim()) {
      alert('Ingresa un monto válido mayor a 0 y una descripción.')
      return
    }
    await onSave({ ...form, amount: Number(form.amount) }, editingId)
    setNotice(editingId ? 'Movimiento actualizado correctamente en la base de datos.' : 'Movimiento guardado exitosamente.')
    setEditingId(null)
    setForm(blankForm)
    setOcrDetails(null)
    setCaptureNotice('')
    setWarningNotice('')
    clearRequestedEdit()
    window.setTimeout(() => setNotice(''), 3500)
  }

  // Requirement 3: Corregir reconocimiento de voz conectando con backend Python
  const startVoiceRegistration = async () => {
    setCaptureNotice('')
    setWarningNotice('')
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    // If Web Speech API is not available, provide quick audio simulator prompt
    if (!Recognition) {
      const simulatedText = window.prompt(
        'El navegador no soporta Web Speech API directa. Escribe lo que dirías por voz (ejemplo: «Gasté 25 soles en almuerzo» o «Recibí 1500 soles de sueldo»):',
        'Gasté 25 soles en almuerzo'
      )
      if (simulatedText) {
        processVoiceText(simulatedText)
      }
      return
    }

    try {
      const recognition = new Recognition()
      recognition.lang = 'es-PE'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onresult = async event => {
        const transcript = event.results[0][0].transcript
        await processVoiceText(transcript)
      }

      recognition.onerror = () => {
        setCaptureNotice('No se pudo captar el audio con claridad. Puedes probar escribir la frase o rellenar el formulario.')
        setIsListening(false)
      }
      recognition.onend = () => setIsListening(false)

      setIsListening(true)
      setCaptureNotice('Escuchando… Di por ejemplo: «Gasté 25 soles en almuerzo» o «Recibí 1500 soles de sueldo».')
      recognition.start()
    } catch {
      setCaptureNotice('No se pudo acceder al micrófono. Verifica permisos o usa el formulario manual.')
      setIsListening(false)
    }
  }

  const processVoiceText = async (transcript: string) => {
    setCaptureNotice(`Procesando audio: “${transcript}”…`)
    try {
      const parsed: VoiceParseResult = await api.parseVoice(transcript)
      setForm({
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        date: parsed.date,
      })

      if (parsed.needs_confirmation || parsed.amount <= 0) {
        setWarningNotice(`Escuché: “${transcript}”. ${parsed.explanation || 'Por favor verifica el monto y la categoría antes de confirmar.'}`)
      } else {
        setCaptureNotice(`✓ Reconocido por voz: ${parsed.type === 'income' ? 'Ingreso' : 'Gasto'} por S/ ${parsed.amount.toFixed(2)} (${parsed.category}). Revisa los datos y confirma con «Registrar movimiento».`)
      }
    } catch (err: any) {
      setCaptureNotice(`Escuché: “${transcript}”. Hubo un problema al procesar con el backend. Completa los datos en el formulario.`)
    }
  }

  // Requirement 4: Corregir reconocimiento de imágenes mediante OCR conectado con backend Python
  const readReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReadingPhoto(true)
    setCaptureNotice('Enviando imagen al servidor OCR de PulpiAI para preprocesamiento y clasificación…')
    setWarningNotice('')
    setOcrDetails(null)

    try {
      const ocrResult: OCRParseResult = await api.analyzeReceiptImage(file)
      setOcrDetails(ocrResult)

      // 4.4 / 4.5: Non-financial image -> Do NOT register as expense!
      if (!ocrResult.is_financial) {
        setWarningNotice(`⚠️ ${ocrResult.status_message}`)
        setCaptureNotice('')
        return
      }

      // Financial image -> fill form with correctly extracted amount and type
      setForm({
        type: ocrResult.operation_type === 'income' ? 'income' : 'expense',
        amount: ocrResult.amount,
        category: ocrResult.category,
        description: ocrResult.description,
        date: ocrResult.date,
      })

      if (ocrResult.needs_confirmation) {
        setWarningNotice(`⚠️ ${ocrResult.status_message}`)
      } else {
        setCaptureNotice(`✓ Comprobante analizado con éxito: ${ocrResult.document_type_label} por S/ ${ocrResult.amount.toFixed(2)} (${ocrResult.operation_type === 'income' ? 'Ingreso' : 'Gasto'}). Revisa la vista previa antes de guardar.`)
      }
    } catch (err: any) {
      setWarningNotice(`Error al procesar la imagen con OCR: ${err.message || 'No se pudo leer el archivo'}. Puedes ingresar los datos manualmente.`)
    } finally {
      setIsReadingPhoto(false)
      event.target.value = ''
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={editingId ? 'Editar movimiento' : 'Registrar movimiento'}
        description="Anota tus ventas, compras, sueldos y gastos. Conectado con IA por voz y OCR."
      />
      <div className="register-layout">
        <form className="card movement-form" onSubmit={submit}>
          {notice && <div className="success-notice"><Icon name="check" size={18} />{notice}</div>}
          {warningNotice && <div className="warning-notice"><Icon name="alert" size={18} /><span>{warningNotice}</span></div>}
          {captureNotice && <div className="capture-notice"><Icon name={isListening ? 'mic' : isReadingPhoto ? 'camera' : 'bulb'} size={18} /><span>{captureNotice}</span></div>}

          {/* OCR Result Detailed Preview Card */}
          {ocrDetails && ocrDetails.is_financial && (
            <div className="ocr-details-card">
              <h4>
                <span>Vista previa de comprobante OCR</span>
                <span className={`ocr-tag ${ocrDetails.operation_type}`}>{ocrDetails.operation_type === 'income' ? 'Ingreso detectado' : 'Gasto detectado'}</span>
              </h4>
              <p><strong>Tipo de documento:</strong> {ocrDetails.document_type_label}</p>
              {ocrDetails.entity_name && <p><strong>Comercio / Entidad:</strong> {ocrDetails.entity_name}</p>}
              <p><strong>Monto detectado:</strong> {ocrDetails.currency} {ocrDetails.amount.toFixed(2)}</p>

              {ocrDetails.candidate_amounts.length > 1 && (
                <div className="ocr-amounts-select">
                  <span><strong>Otros importes encontrados en el documento:</strong></span>
                  <select
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                    style={{ height: 32, fontSize: 11 }}
                  >
                    {ocrDetails.candidate_amounts.map((c, idx) => (
                      <option key={idx} value={c.amount}>
                        S/ {c.amount.toFixed(2)} — {c.label} (confianza: {Math.round(c.confidence_score * 100)}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button type="button" className="ocr-raw-toggle" onClick={() => setShowRawOcr(!showRawOcr)}>
                {showRawOcr ? 'Ocultar texto OCR extraído' : 'Ver texto completo reconocido por OCR'}
              </button>
              {showRawOcr && <div className="ocr-raw-box">{ocrDetails.raw_text}</div>}
            </div>
          )}

          <label className="field-label">Tipo de movimiento</label>
          <div className="type-switch">
            <button type="button" className={form.type === 'income' ? 'active income-choice' : ''} onClick={() => setType('income')}><Icon name="arrowUp" />Ingreso</button>
            <button type="button" className={form.type === 'expense' ? 'active expense-choice' : ''} onClick={() => setType('expense')}><Icon name="arrowDown" />Gasto</button>
          </div>
          <label className="form-field amount-field">
            <span>Monto</span>
            <div><b>S/</b><input required min="0.01" step="0.01" type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0.00" /></div>
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Categoría</span>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {(form.type === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Fecha</span>
              <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </label>
          </div>
          <label className="form-field">
            <span>Descripción</span>
            <input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={form.type === 'income' ? 'Ej. Venta de productos del día' : 'Ej. Compra de mercadería'} />
          </label>
          <div className="form-actions">
            {editingId && <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setForm(blankForm); clearRequestedEdit() }}>Cancelar</button>}
            <button className="primary-button" type="submit"><Icon name="check" size={18} />{editingId ? 'Guardar cambios' : 'Registrar movimiento'}</button>
          </div>
        </form>

        <aside className="register-side">
          <div className="card demo-tools">
            <span className="eyebrow">Captura Asistida con IA</span>
            <h2>Voz & OCR Inteligente</h2>
            <p>El backend de Python procesa tu voz o imagen, extrae el monto exacto y clasifica la operación.</p>
            <button type="button" disabled={isListening} onClick={startVoiceRegistration}>
              <span className={isListening ? 'tool-active' : ''}><Icon name="mic" /></span>
              <div>
                <strong>{isListening ? 'Escuchando…' : 'Registrar por voz'}</strong>
                <small>Ej: «Gasté 25 soles en almuerzo» o «Recibí 1500 soles de sueldo»</small>
              </div>
              <Icon name="chevron" size={17} />
            </button>
            <button type="button" disabled={isReadingPhoto} onClick={() => photoInput.current?.click()}>
              <span className={isReadingPhoto ? 'tool-active' : ''}><Icon name="camera" /></span>
              <div>
                <strong>{isReadingPhoto ? 'Analizando con OCR…' : 'Foto de comprobante (OCR)'}</strong>
                <small>Boletas, facturas, vouchers Yape/BCP o transferencias</small>
              </div>
              <Icon name="chevron" size={17} />
            </button>
            <input ref={photoInput} className="hidden-file-input" type="file" accept="image/*" onChange={readReceipt} />
          </div>

          <div className="card compact-list">
            <div className="card-heading"><div><h2>Registros guardados</h2><p>Edita o elimina directamente</p></div></div>
            <MovementList
              movements={movements.slice(0, 4)}
              actions={m => (
                <div className="row-actions">
                  <button onClick={() => edit(m)} title="Editar" aria-label="Editar"><Icon name="edit" size={17} /></button>
                  <button onClick={() => onDelete(m.id)} title="Eliminar" aria-label="Eliminar"><Icon name="trash" size={17} /></button>
                </div>
              )}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function WhatsAppSimulator({ onConfirm, navigate }: { onConfirm: (items: Omit<Movement, 'id'>[]) => Promise<void>; navigate: (v: View) => void }) {
  const [message, setMessage] = useState('Hoy vendí 350 soles y gasté 120 soles en mercadería')
  const [sent, setSent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [parsed, setParsed] = useState<Omit<Movement, 'id'>[]>([])

  const parse = async () => {
    if (!message.trim()) return
    setSent(true)
    setConfirmed(false)

    // Parse clauses
    const matches = [...message.matchAll(/(vend[ií]|ingres[ée]|recib[ií]|cobr[ée]|gast[ée]|compr[ée]|pagu[ée])\D{0,12}(?:s\/\s*)?(\d+(?:[.,]\d{1,2})?)/gi)]
    if (matches.length > 0) {
      const items: Omit<Movement, 'id'>[] = matches.map(match => ({
        type: /(gast|compr|pagu)/i.test(match[1]) ? 'expense' : 'income',
        amount: Number(match[2].replace(',', '.')),
        category: /(gast|compr|pagu)/i.test(match[1]) ? 'Mercadería' : 'Ventas',
        description: /(gast|compr|pagu)/i.test(match[1]) ? 'Compra según mensaje WhatsApp' : 'Ventas del día WhatsApp',
        date: isoDate(),
        source: 'whatsapp',
      }))
      setParsed(items)
    } else {
      try {
        const v = await api.parseVoice(message)
        if (v.amount > 0) {
          setParsed([{
            type: v.type,
            amount: v.amount,
            category: v.category,
            description: v.description,
            date: v.date,
            source: 'whatsapp'
          }])
        } else {
          setParsed([])
        }
      } catch {
        setParsed([])
      }
    }
  }

  const confirm = async () => {
    if (!parsed.length) return
    await onConfirm(parsed)
    setConfirmed(true)
  }

  return (
    <div className="page">
      <PageHeader title="Simulador de WhatsApp" description="Prueba cómo PulpiAI interpreta mensajes de texto con ventas y gastos." />
      <div className="simulation-banner"><Icon name="chat" size={18} /><div><strong>Simulación integrada</strong><span>Los mensajes se procesan e impactan directamente en tu saldo e historial tras confirmar.</span></div></div>
      <div className="phone-wrap">
        <div className="phone">
          <div className="phone-header"><div className="bot-avatar">P</div><div><strong>PulpiAI</strong><span>Asistente de tu negocio</span></div><Icon name="more" /></div>
          <div className="chat-area">
            <div className="chat-date">HOY</div>
            <div className="message incoming">Hola, María. Cuéntame qué vendiste o gastaste hoy y yo lo ordeno por ti.<time>9:30</time></div>
            {sent && <>
              <div className="message outgoing">{message}<time>9:32 <Icon name="check" size={12} /></time></div>
              {parsed.length ? <div className="message incoming wide">
                <p>Encontré {parsed.length} movimientos:</p>
                <div className="preview-items">
                  {parsed.map((item, idx) => (
                    <div key={idx}>
                      <span className={`movement-icon ${item.type}`}><Icon name={item.type === 'income' ? 'arrowUp' : 'arrowDown'} size={15} /></span>
                      <div><strong>{item.type === 'income' ? 'Ingreso' : 'Gasto'} · {item.category}</strong><small>{item.description}</small></div>
                      <b>{formatMoney(item.amount)}</b>
                    </div>
                  ))}
                </div>
                {!confirmed ? (
                  <button className="confirm-chat" onClick={confirm}><Icon name="check" size={17} />Confirmar y guardar en base de datos</button>
                ) : (
                  <div className="chat-success"><Icon name="check" size={17} />¡Listo! Se guardaron en el backend.<button onClick={() => navigate('dashboard')}>Ver inicio</button></div>
                )}
                <time>9:32</time>
              </div> : <div className="message incoming">No pude identificar un monto claro. Prueba escribiendo: “Hoy vendí 350 soles y gasté 120 soles”.<time>9:32</time></div>}
            </>}
          </div>
          <div className="chat-input">
            <button aria-label="Adjuntar demostración"><Icon name="plus" /></button>
            <textarea value={message} onChange={e => { setMessage(e.target.value); setSent(false) }} rows={1} aria-label="Mensaje" />
            <button className="send-button" onClick={parse} aria-label="Enviar"><Icon name="send" size={18} /></button>
          </div>
        </div>
        <div className="sim-help">
          <span className="eyebrow">Pruébalo</span>
          <h2>Escribe como hablas</h2>
          <p>PulpiAI analiza tus mensajes y los convierte en registros financieros precisos.</p>
          <div className="example"><span>Ejemplo</span><p>“Hoy vendí 350 soles y gasté 120 soles en mercadería”</p></div>
          <ul><li><Icon name="check" size={16} />Identifica ingresos y gastos simultáneamente</li><li><Icon name="check" size={16} />Te muestra una vista previa</li><li><Icon name="check" size={16} />Solo guarda cuando confirmas</li></ul>
        </div>
      </div>
    </div>
  )
}

function History({ movements, onEdit, onDelete, onFilter }: { movements: Movement[]; onEdit: (m: Movement) => void; onDelete: (id: string) => void; onFilter: () => void }) {
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = movements.filter(m => (type === 'all' || m.type === type) && (category === 'all' || m.category === category) && (!from || m.date >= from) && (!to || m.date <= to))
  const categories = [...new Set(movements.map(m => m.category))]

  return (
    <div className="page">
      <PageHeader title="Historial de movimientos" description="Revisa todo lo que has registrado en tu cuenta de demostración." />
      <div className="card filters">
        <div className="filter-title"><Icon name="filter" size={18} /><strong>Filtrar</strong></div>
        <label><span>Tipo</span><select value={type} onChange={e => setType(e.target.value)}><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Gastos</option></select></label>
        <label><span>Categoría</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label><span>Desde</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label><span>Hasta</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button className="clear-button" onClick={() => { setType('all'); setCategory('all'); setFrom(''); setTo('') }}>Limpiar</button>
      </div>
      <div className="card history-card">
        <div className="card-heading"><div><h2>{filtered.length} movimientos</h2><p>Ordenados del más reciente al más antiguo</p></div></div>
        <MovementList
          movements={filtered}
          actions={m => (
            <div className="row-actions">
              <button onClick={() => onEdit(m)} title="Editar" aria-label="Editar"><Icon name="edit" size={17} /></button>
              <button onClick={() => onDelete(m.id)} title="Eliminar" aria-label="Eliminar"><Icon name="trash" size={17} /></button>
            </div>
          )}
        />
      </div>
    </div>
  )
}

function Assistant({ totals, movements }: { totals: { income: number; expense: number; balance: number }; movements: Movement[] }) {
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string }[]>([
    { from: 'bot', text: 'Hola, María. Soy PulpiAI, tu asistente financiero con IA. Puedo responder preguntas sobre tus movimientos, analizar tus gastos y orientarte para acceder a crédito.' },
  ])
  const [input, setInput] = useState('')
  const [isAsking, setIsAsking] = useState(false)

  const ask = async (question: string) => {
    if (isAsking) return
    setMessages(current => [...current, { from: 'user', text: question }])
    setInput('')
    setIsAsking(true)

    try {
      const response = await api.askAssistant(question)
      setMessages(current => [...current, { from: 'bot', text: response.answer }])
    } catch {
      const lower = question.toLowerCase()
      let answer = `Tu saldo disponible es ${formatMoney(totals.balance)}. Tienes ${movements.length} movimientos guardados.`
      if (lower.includes('gast')) answer = `Tus gastos registrados suman ${formatMoney(totals.expense)}. La categoría más frecuente de gasto es Mercadería.`
      if (lower.includes('ingres') || lower.includes('vend')) answer = `Tus ingresos registrados suman ${formatMoney(totals.income)}. Tu saldo neto es ${formatMoney(totals.balance)}.`
      if (lower.includes('crédito') || lower.includes('credito')) answer = `Tu saldo disponible de ${formatMoney(totals.balance)} y la constancia de tus registros respaldan un buen perfil para solicitar crédito.`
      setMessages(current => [...current, { from: 'bot', text: answer }])
    } finally {
      setIsAsking(false)
    }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim()) ask(input.trim()) }

  return (
    <div className="page assistant-page">
      <PageHeader title="Asistente financiero" description="Haz preguntas sobre los números de tu negocio con Inteligencia Artificial." />
      <div className="assistant-layout">
        <div className="card assistant-chat">
          <div className="assistant-head"><div className="bot-avatar"><Icon name="sparkle" size={19} /></div><div><strong>PulpiAI</strong><span><i /> Conectado con IA y tus movimientos</span></div></div>
          <div className="assistant-messages">
            {messages.map((message, index) => <div key={index} className={`assistant-message ${message.from}`}>{message.from === 'bot' && <div className="mini-bot">P</div>}<p>{message.text}</p></div>)}
            {isAsking && <div className="assistant-message bot"><div className="mini-bot">P</div><p>Analizando tus finanzas con IA…</p></div>}
          </div>
          <div className="suggestions">
            {['¿Cuánto gasté?', '¿Cómo van mis ingresos?', '¿Estoy listo para un crédito?'].map(q => <button key={q} disabled={isAsking} onClick={() => ask(q)}>{q}</button>)}
          </div>
          <form className="assistant-input" onSubmit={submit}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe tu pregunta..." disabled={isAsking} /><button className="send-button" disabled={isAsking} aria-label="Enviar"><Icon name="send" size={18} /></button></form>
        </div>
        <aside className="card context-card">
          <span className="eyebrow">Tu resumen actual</span><h2>Datos reales</h2>
          <div><span>Ingresos</span><strong className="positive-text">{formatMoney(totals.income)}</strong></div>
          <div><span>Gastos</span><strong className="negative-text">{formatMoney(totals.expense)}</strong></div>
          <div><span>Balance</span><strong>{formatMoney(totals.balance)}</strong></div>
          <p><Icon name="bulb" size={17} />Los cálculos se actualizan inmediatamente al registrar o editar transacciones.</p>
        </aside>
      </div>
    </div>
  )
}

function Credit({ totals, movements }: { totals: { income: number; expense: number; balance: number }; movements: Movement[] }) {
  const recordDays = new Set(movements.map(m => m.date)).size
  const score = Math.min(92, 35 + recordDays * 6 + (totals.balance > 0 ? 25 : 0))

  return (
    <div className="page">
      <PageHeader title="Preparación para crédito" description="Ordena tus números y construye un historial claro para financiamiento." />
      <div className="credit-hero">
        <div className="credit-score">
          <div className="score-large" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{score}</strong><span>de 100</span></div>
          </div>
          <div>
            <span className="eyebrow">Diagnóstico</span>
            <h2>Perfil crediticio en buen estado</h2>
            <p>Mantienes un saldo positivo de {formatMoney(totals.balance)} con movimientos continuos a lo largo de {recordDays} días distintos.</p>
          </div>
        </div>
        <div className="credit-summary">
          <div><span>Ingresos registrados</span><strong>{formatMoney(totals.income)}</strong></div>
          <div><span>Gastos registrados</span><strong>{formatMoney(totals.expense)}</strong></div>
          <div className="highlight"><span>Saldo disponible</span><strong>{formatMoney(totals.balance)}</strong></div>
        </div>
      </div>
      <div className="credit-grid">
        <section className="card checklist">
          <div className="card-heading"><div><h2>Tu avance financiero</h2><p>Pasos completados para presentar tu negocio</p></div></div>
          <div className="check-item done"><span><Icon name="check" /></span><div><strong>Registrar ingresos y gastos</strong><p>Tienes {movements.length} movimientos guardados.</p></div><b>Listo</b></div>
          <div className={recordDays >= 7 ? 'check-item done' : 'check-item'}><span>{recordDays >= 7 ? <Icon name="check" /> : recordDays}</span><div><strong>Mantener constancia semanal</strong><p>Registraste movimientos en {recordDays} días diferentes.</p></div><b>{recordDays >= 7 ? 'Listo' : 'En progreso'}</b></div>
          <div className="check-item done"><span><Icon name="check" /></span><div><strong>Saldo neto positivo</strong><p>Tu balance actual es de {formatMoney(totals.balance)}.</p></div><b>Listo</b></div>
        </section>
        <section className="card recommendations">
          <div className="card-heading"><div><h2>Recomendaciones</h2><p>Acciones para ordenar tus finanzas</p></div></div>
          <article><span><Icon name="history" /></span><div><strong>Registra todos los días</strong><p>Dedica 2 minutos al cierre para registrar compras y ventas.</p></div></article>
          <article><span><Icon name="wallet" /></span><div><strong>Cuida tu margen</strong><p>Procura que tus gastos no superen el 70% de tus ingresos.</p></div></article>
          <article><span><Icon name="document" /></span><div><strong>Guarda tus comprobantes</strong><p>Usa la cámara OCR para digitalizar boletas y vouchers.</p></div></article>
        </section>
      </div>
      <div className="disclaimer"><Icon name="bulb" size={19} /><p><strong>Nota:</strong> Este diagnóstico es referencial y ayuda a ordenar tu negocio. No garantiza la aprobación formal de un crédito por entidades bancarias.</p></div>
    </div>
  )
}

export default App
