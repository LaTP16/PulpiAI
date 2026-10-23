import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'

type MovementType = 'income' | 'expense'
type View = 'dashboard' | 'register' | 'whatsapp' | 'history' | 'assistant' | 'credit'

type Movement = {
  id: string
  type: MovementType
  amount: number
  category: string
  description: string
  date: string
}

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

const incomeCategories = ['Ventas', 'Pedidos', 'Otros ingresos']
const expenseCategories = ['Mercadería', 'Servicios', 'Transporte', 'Alquiler', 'Otros gastos']

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
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(value)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))

const isoDate = (daysAgo = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

const movementKey = (movement: Omit<Movement, 'id'>) =>
  `${movement.type}|${movement.amount.toFixed(2)}|${movement.category}|${movement.description.trim().toLowerCase()}|${movement.date}`

const spanishNumbers: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
}

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function extractAmount(text: string) {
  const normalized = normalizeText(text)
  const digits = normalized.match(/(?:s\/\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*soles?)?/)
  if (digits) return Number(digits[1].replace(',', '.'))
  const tokens = normalized.replace(/[^\w\s]/g, ' ').split(/\s+/)
  let total = 0
  let found = false
  for (const token of tokens) {
    if (token === 'y') continue
    if (spanishNumbers[token] !== undefined) {
      total += spanishNumbers[token]
      found = true
    } else if (found) break
  }
  return found ? total : 0
}

function movementFromSpeech(transcript: string): FormState | null {
  const normalized = normalizeText(transcript)
  const type: MovementType | null = /(gaste|compre|pague|salio|egreso)/.test(normalized) ? 'expense' : /(vendi|cobre|recibi|ingreso)/.test(normalized) ? 'income' : null
  const amount = extractAmount(normalized)
  if (!type || !amount) return null
  return {
    type,
    amount,
    category: type === 'income' ? 'Ventas' : 'Mercadería',
    description: transcript.trim(),
    date: isoDate(),
  }
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
      {!compact && <div><strong>Kipu<span>AI</span></strong><small>Tu negocio, más claro</small></div>}
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('kipuai-auth') === 'true')
  const [view, setView] = useState<View>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [movements, setMovements] = useState<Movement[]>(() => {
    try {
      const saved = localStorage.getItem('kipuai-movements-v1')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('kipuai-movements-v1', JSON.stringify(movements))
  }, [movements])

  const navigate = (next: View) => {
    setView(next)
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const totals = useMemo(() => {
    const income = movements.filter(m => m.type === 'income').reduce((sum, m) => sum + m.amount, 0)
    const expense = movements.filter(m => m.type === 'expense').reduce((sum, m) => sum + m.amount, 0)
    return { income, expense, balance: income - expense }
  }, [movements])

  const saveMovement = (movement: Movement) => {
    setMovements(current => {
      const exists = current.some(item => item.id === movement.id)
      if (exists) return current.map(item => item.id === movement.id ? movement : item)
      if (current.some(item => movementKey(item) === movementKey(movement))) return current
      return [movement, ...current]
    })
    setEditingMovement(null)
  }

  const addMovements = (items: Movement[]) => {
    setMovements(current => {
      const known = new Set(current.map(movementKey))
      const unique = items.filter(item => {
        const key = movementKey(item)
        if (known.has(key)) return false
        known.add(key)
        return true
      })
      return [...unique, ...current]
    })
  }

  const startEditing = (movement: Movement) => {
    setEditingMovement(movement)
    navigate('register')
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => { localStorage.setItem('kipuai-auth', 'true'); setIsAuthenticated(true) }} />
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
          <div><strong>María Rodríguez</strong><span>Bodega Mi Esquina</span></div>
          <button className="profile-menu" onClick={() => { localStorage.removeItem('kipuai-auth'); setIsAuthenticated(false) }} aria-label="Cerrar sesión"><Icon name="more" size={18} /></button>
        </div>
      </aside>

      {sidebarOpen && <button className="backdrop" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Icon name="menu" /></button>
          <Logo compact />
          <div className="avatar small">MR</div>
        </header>
        {view === 'dashboard' && <Dashboard movements={movements} totals={totals} navigate={navigate} />}
        {view === 'register' && <Register movements={movements} saveMovement={saveMovement} onDelete={id => setMovements(m => m.filter(item => item.id !== id))} requestedEdit={editingMovement} clearRequestedEdit={() => setEditingMovement(null)} />}
        {view === 'whatsapp' && <WhatsAppSimulator onConfirm={addMovements} navigate={navigate} />}
        {view === 'history' && <History movements={movements} onEdit={startEditing} onDelete={id => setMovements(m => m.filter(item => item.id !== id))} />}
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

function Login({ onLogin }: { onLogin: () => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validUser = identifier.trim().toLowerCase() === 'maria@gmail.com' || identifier.trim() === '976345234'
    if (validUser && password === 'comerciante123') {
      onLogin()
      return
    }
    setError('Revisa tu correo, celular o contraseña.')
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Logo />
        <div className="login-copy"><span className="eyebrow">Bienvenida de nuevo</span><h1>Ordena tu negocio, paso a paso</h1><p>Ingresa para revisar tus ventas, gastos y el avance de tu bodega.</p></div>
        <form onSubmit={submit}>
          {error && <div className="login-error">{error}</div>}
          <label className="form-field"><span>Correo o celular</span><input autoComplete="username" value={identifier} onChange={e => { setIdentifier(e.target.value); setError('') }} placeholder="maria@gmail.com" required /></label>
          <label className="form-field"><span>Contraseña</span><input autoComplete="current-password" type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="Tu contraseña" required /></label>
          <button className="primary-button login-button">Ingresar a KipuAI</button>
        </form>
        <div className="demo-credentials"><strong>Acceso de demostración</strong><span>maria@gmail.com o 976345234</span><span>Contraseña: comerciante123</span></div>
      </section>
      <aside className="login-panel"><div><span className="eyebrow">Bodega Mi Esquina</span><h2>Tus números claros.<br />Tus decisiones seguras.</h2><p>KipuAI reúne todos tus movimientos en un solo lugar para ayudarte a entender cómo avanza tu negocio.</p><div className="login-feature"><Icon name="check" /><span><strong>Información sincronizada</strong><small>Registra una vez y consulta en cualquier pantalla.</small></span></div><div className="login-feature"><Icon name="sparkle" /><span><strong>Asistencia sencilla</strong><small>Respuestas basadas en tus movimientos reales.</small></span></div></div></aside>
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

function Dashboard({ movements, totals, navigate }: { movements: Movement[]; totals: { income: number; expense: number; balance: number }; navigate: (v: View) => void }) {
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = isoDate(6 - index)
    const dayMovements = movements.filter(m => m.date === date)
    return {
      label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).slice(0, 2),
      income: dayMovements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0),
      expense: dayMovements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0),
    }
  })
  const max = Math.max(...weekly.flatMap(day => [day.income, day.expense]), 1)
  const today = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <div className="page">
      <PageHeader
        eyebrow={today}
        title="Hola, María"
        description="Así está tu bodega hoy. Vas por buen camino."
        action={<button className="primary-button" onClick={() => navigate('register')}><Icon name="plus" size={18} />Registrar movimiento</button>}
      />
      <section className="stats-grid">
        <div className="stat-card balance-card">
          <div className="stat-top"><span className="stat-icon"><Icon name="wallet" /></span><span className="status-pill">Actualizado</span></div>
          <span className="stat-label">Saldo disponible</span>
          <strong>{formatMoney(totals.balance)}</strong>
          <small>{movements.length} movimientos · ingresos menos gastos</small>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-icon income"><Icon name="arrowUp" /></span><span className="trend positive">Este mes</span></div>
          <span className="stat-label">Ingresos</span>
          <strong>{formatMoney(totals.income)}</strong>
          <small>{movements.filter(m => m.type === 'income').length} movimientos</small>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span className="stat-icon expense"><Icon name="arrowDown" /></span><span className="trend">Este mes</span></div>
          <span className="stat-label">Gastos</span>
          <strong>{formatMoney(totals.expense)}</strong>
          <small>{movements.filter(m => m.type === 'expense').length} movimientos</small>
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
              <div className="bar-group" key={day.label}>
                <div className="bars">
                  <span className="bar income-bar" style={{ height: `${Math.max((day.income / max) * 100, day.income ? 6 : 0)}%` }} title={formatMoney(day.income)} />
                  <span className="bar expense-bar" style={{ height: `${Math.max((day.expense / max) * 100, day.expense ? 6 : 0)}%` }} title={formatMoney(day.expense)} />
                </div>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="card health-card">
          <div className="card-heading"><div><h2>Salud del negocio</h2><p>Basado en tus registros</p></div></div>
          <div className="health-score">
            <div className="score-ring"><strong>{totals.income ? Math.min(92, Math.round((totals.balance / totals.income) * 100 + 50)) : 0}</strong><span>/100</span></div>
            <div><strong>{movements.length ? (totals.balance >= 0 ? 'Buen progreso' : 'Revisa tus gastos') : 'Empieza tu registro'}</strong><p>{movements.length ? (totals.balance >= 0 ? 'Tus ingresos son mayores que tus gastos.' : 'Tus gastos superan los ingresos registrados.') : 'Aún no tienes movimientos guardados.'}</p></div>
          </div>
          <div className="progress-row"><span>Margen disponible</span><strong>{totals.income ? Math.max(0, Math.round((totals.balance / totals.income) * 100)) : 0}%</strong></div>
          <div className="progress"><span style={{ width: `${totals.income ? Math.max(0, (totals.balance / totals.income) * 100) : 0}%` }} /></div>
          <button className="text-button" onClick={() => navigate('credit')}>Ver preparación para crédito <Icon name="chevron" size={16} /></button>
        </div>
      </section>

      <section className="card recent-card">
        <div className="card-heading">
          <div><h2>Últimos movimientos</h2><p>Tu actividad más reciente</p></div>
          <button className="text-button" onClick={() => navigate('history')}>Ver todo <Icon name="chevron" size={16} /></button>
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
          <div className="movement-info"><strong>{movement.description}</strong><span>{movement.category} · {formatDate(movement.date)}</span></div>
          <strong className={`movement-amount ${movement.type}`}>{movement.type === 'income' ? '+' : '−'} {formatMoney(movement.amount)}</strong>
          {actions?.(movement)}
        </div>
      ))}
    </div>
  )
}

function Register({ movements, saveMovement, onDelete, requestedEdit, clearRequestedEdit }: { movements: Movement[]; saveMovement: (m: Movement) => void; onDelete: (id: string) => void; requestedEdit: Movement | null; clearRequestedEdit: () => void }) {
  const blankForm: FormState = { type: 'income', amount: 0, category: 'Ventas', description: '', date: isoDate() }
  const [form, setForm] = useState<FormState>(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [captureNotice, setCaptureNotice] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isReadingPhoto, setIsReadingPhoto] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!requestedEdit) return
    setEditingId(requestedEdit.id)
    setForm({ type: requestedEdit.type, amount: requestedEdit.amount, category: requestedEdit.category, description: requestedEdit.description, date: requestedEdit.date })
  }, [requestedEdit])

  const setType = (type: MovementType) => setForm(current => ({ ...current, type, category: type === 'income' ? 'Ventas' : 'Mercadería' }))
  const edit = (movement: Movement) => {
    setEditingId(movement.id)
    setForm({ type: movement.type, amount: movement.amount, category: movement.category, description: movement.description, date: movement.date })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.amount || !form.description.trim()) return
    saveMovement({ ...form, id: editingId || crypto.randomUUID(), amount: Number(form.amount) })
    setNotice(editingId ? 'Movimiento actualizado correctamente.' : 'Movimiento registrado correctamente.')
    setEditingId(null)
    setForm(blankForm)
    window.setTimeout(() => setNotice(''), 3000)
  }

  const startVoiceRegistration = async () => {
    setCaptureNotice('')
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      setCaptureNotice('Tu navegador no permite reconocimiento de voz. Puedes completar el formulario manualmente.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      const recognition = new Recognition()
      recognition.lang = 'es-PE'
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = event => {
        const transcript = event.results[0][0].transcript
        const parsed = movementFromSpeech(transcript)
        if (parsed) {
          setForm(parsed)
          setCaptureNotice(`Escuché: “${transcript}”. Revisa los datos y confirma con “Registrar movimiento”.`)
        } else {
          setForm(current => ({ ...current, description: transcript }))
          setCaptureNotice(`Escuché: “${transcript}”, pero no identifiqué tipo y monto. Completa esos datos manualmente.`)
        }
      }
      recognition.onerror = () => {
        setCaptureNotice('No pude reconocer el audio. Inténtalo de nuevo o usa el formulario manual.')
        setIsListening(false)
      }
      recognition.onend = () => setIsListening(false)
      setIsListening(true)
      setCaptureNotice('Escuchando… Di, por ejemplo: “Vendí 350 soles en productos”.')
      recognition.start()
    } catch {
      setCaptureNotice('No se pudo acceder al micrófono. Revisa el permiso del navegador o registra el movimiento manualmente.')
      setIsListening(false)
    }
  }

  const readReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsReadingPhoto(true)
    setCaptureNotice('Leyendo el comprobante. Esto puede tardar unos segundos…')
    try {
      const { recognize } = await import('tesseract.js')
      const result = await recognize(file, 'spa', {
        logger: progress => {
          if (progress.status === 'recognizing text') {
            setCaptureNotice(`Leyendo el comprobante… ${Math.round(progress.progress * 100)}%`)
          }
        },
      })
      const text = result.data.text
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
      const totalLine = lines.find(line => /\b(total|importe|pagar)\b/i.test(line) && /\d/.test(line))
      const decimalAmounts = [...text.matchAll(/(?:s\/\.?\s*)?(\d+[.,]\d{2})/gi)].map(match => Number(match[1].replace(',', '.'))).filter(value => value > 0 && value < 100000)
      const amount = totalLine ? extractAmount(totalLine.replace(/.*?(total|importe|pagar)/i, '')) : (decimalAmounts.length ? decimalAmounts.at(-1) || 0 : 0)
      const dateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/)
      const year = dateMatch ? (dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3]) : ''
      const date = dateMatch ? `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : isoDate()
      const descriptionLine = lines.find(line => line.length > 4 && !/(ruc|boleta|factura|fecha|total|importe|pagar|\d{2}[/-]\d{2})/i.test(line))
      setForm({
        type: 'expense',
        amount,
        category: 'Mercadería',
        description: descriptionLine ? `Comprobante: ${descriptionLine.slice(0, 70)}` : 'Compra según comprobante',
        date,
      })
      setCaptureNotice(amount
        ? 'Lectura completada. Revisa el monto, fecha y descripción antes de confirmar.'
        : 'Pude leer parte del comprobante, pero no encontré un monto claro. Complétalo manualmente antes de guardar.')
    } catch {
      setCaptureNotice('No se pudo leer esta imagen. Puedes completar los datos manualmente en el formulario.')
    } finally {
      setIsReadingPhoto(false)
      event.target.value = ''
    }
  }

  return (
    <div className="page">
      <PageHeader title={editingId ? 'Editar movimiento' : 'Registrar movimiento'} description="Anota lo que vendes y gastas. Te tomará menos de un minuto." />
      <div className="register-layout">
        <form className="card movement-form" onSubmit={submit}>
          {notice && <div className="success-notice"><Icon name="check" size={18} />{notice}</div>}
          {captureNotice && <div className="capture-notice"><Icon name={isListening ? 'mic' : isReadingPhoto ? 'camera' : 'bulb'} size={18} /><span>{captureNotice}</span></div>}
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
            <label className="form-field"><span>Categoría</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{(form.type === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="form-field"><span>Fecha</span><input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          </div>
          <label className="form-field"><span>Descripción</span><input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={form.type === 'income' ? 'Ej. Venta de productos del día' : 'Ej. Compra de mercadería'} /></label>
          <div className="form-actions">
            {editingId && <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setForm(blankForm); clearRequestedEdit() }}>Cancelar</button>}
            <button className="primary-button" type="submit"><Icon name="check" size={18} />{editingId ? 'Guardar cambios' : 'Registrar movimiento'}</button>
          </div>
        </form>
        <aside className="register-side">
          <div className="card demo-tools">
            <span className="eyebrow">Captura asistida</span><h2>Registro más rápido</h2><p>KipuAI completa el formulario y siempre te pide revisar antes de guardar.</p>
            <button type="button" disabled={isListening} onClick={startVoiceRegistration}><span className={isListening ? 'tool-active' : ''}><Icon name="mic" /></span><div><strong>{isListening ? 'Escuchando…' : 'Registrar por voz'}</strong><small>Reconocimiento en español</small></div><Icon name="chevron" size={17} /></button>
            <button type="button" disabled={isReadingPhoto} onClick={() => photoInput.current?.click()}><span className={isReadingPhoto ? 'tool-active' : ''}><Icon name="camera" /></span><div><strong>{isReadingPhoto ? 'Leyendo imagen…' : 'Foto de comprobante'}</strong><small>Toma o sube una boleta o factura</small></div><Icon name="chevron" size={17} /></button>
            <input ref={photoInput} className="hidden-file-input" type="file" accept="image/*" capture="environment" onChange={readReceipt} />
          </div>
          <div className="card compact-list">
            <div className="card-heading"><div><h2>Registros recientes</h2><p>Edita o elimina un movimiento</p></div></div>
            <MovementList movements={movements.slice(0, 4)} actions={m => <div className="row-actions"><button onClick={() => edit(m)} aria-label="Editar"><Icon name="edit" size={17} /></button><button onClick={() => onDelete(m.id)} aria-label="Eliminar"><Icon name="trash" size={17} /></button></div>} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function WhatsAppSimulator({ onConfirm, navigate }: { onConfirm: (items: Movement[]) => void; navigate: (v: View) => void }) {
  const [message, setMessage] = useState('Hoy vendí 350 soles y gasté 120 soles en mercadería')
  const [sent, setSent] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const parse = () => {
    if (!message.trim()) return
    setSent(true)
    setConfirmed(false)
  }
  const matches = [...message.matchAll(/(vend[ií]|ingres[ée]|gast[ée])\D{0,12}(?:s\/\s*)?(\d+(?:[.,]\d{1,2})?)/gi)]
  const parsed: Movement[] = matches.map((match, index) => ({
    id: crypto.randomUUID(),
    type: /gast/i.test(match[1]) ? 'expense' : 'income',
    amount: Number(match[2].replace(',', '.')),
    category: /gast/i.test(match[1]) ? 'Mercadería' : 'Ventas',
    description: /gast/i.test(match[1]) ? 'Compra de mercadería' : 'Ventas del día',
    date: isoDate(),
  }))

  const confirm = () => {
    if (!parsed.length) return
    onConfirm(parsed)
    setConfirmed(true)
  }

  return (
    <div className="page">
      <PageHeader title="Simulador de WhatsApp" description="Prueba cómo KipuAI entendería un mensaje sobre tu negocio." />
      <div className="simulation-banner"><Icon name="chat" size={18} /><div><strong>Esto es una simulación</strong><span>No existe una conexión real con WhatsApp. Los mensajes solo funcionan dentro de este prototipo.</span></div></div>
      <div className="phone-wrap">
        <div className="phone">
          <div className="phone-header"><div className="bot-avatar">K</div><div><strong>KipuAI</strong><span>Asistente de tu negocio</span></div><Icon name="more" /></div>
          <div className="chat-area">
            <div className="chat-date">HOY</div>
            <div className="message incoming">Hola, María. Cuéntame qué vendiste o gastaste hoy y yo lo ordeno por ti.<time>9:30</time></div>
            {sent && <>
              <div className="message outgoing">{message}<time>9:32 <Icon name="check" size={12} /></time></div>
              {parsed.length ? <div className="message incoming wide">
                <p>Encontré {parsed.length} movimientos:</p>
                <div className="preview-items">
                  {parsed.map(item => <div key={item.id}><span className={`movement-icon ${item.type}`}><Icon name={item.type === 'income' ? 'arrowUp' : 'arrowDown'} size={15} /></span><div><strong>{item.type === 'income' ? 'Ingreso' : 'Gasto'} · {item.category}</strong><small>{item.description}</small></div><b>{formatMoney(item.amount)}</b></div>)}
                </div>
                {!confirmed ? <button className="confirm-chat" onClick={confirm}><Icon name="check" size={17} />Confirmar y guardar</button> : <div className="chat-success"><Icon name="check" size={17} />¡Listo! Ya actualicé tus finanzas.<button onClick={() => navigate('dashboard')}>Ver inicio</button></div>}
                <time>9:32</time>
              </div> : <div className="message incoming">No pude identificar un monto. Prueba escribiendo: “Hoy vendí 350 soles y gasté 120 soles”.<time>9:32</time></div>}
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
          <p>KipuAI busca montos de ventas y gastos en tu mensaje y los convierte en registros.</p>
          <div className="example"><span>Ejemplo</span><p>“Hoy vendí 350 soles y gasté 120 soles en mercadería”</p></div>
          <ul><li><Icon name="check" size={16} />Identifica ingresos y gastos</li><li><Icon name="check" size={16} />Te muestra una vista previa</li><li><Icon name="check" size={16} />Solo guarda cuando confirmas</li></ul>
        </div>
      </div>
    </div>
  )
}

function History({ movements, onEdit, onDelete }: { movements: Movement[]; onEdit: (m: Movement) => void; onDelete: (id: string) => void }) {
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filtered = movements.filter(m => (type === 'all' || m.type === type) && (category === 'all' || m.category === category) && (!from || m.date >= from) && (!to || m.date <= to))
  const categories = [...new Set(movements.map(m => m.category))]

  return (
    <div className="page">
      <PageHeader title="Historial de movimientos" description="Encuentra y revisa todo lo que has registrado." />
      <div className="card filters">
        <div className="filter-title"><Icon name="filter" size={18} /><strong>Filtrar movimientos</strong></div>
        <label><span>Tipo</span><select value={type} onChange={e => setType(e.target.value)}><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Gastos</option></select></label>
        <label><span>Categoría</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Todas</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label><span>Desde</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label><span>Hasta</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button className="clear-button" onClick={() => { setType('all'); setCategory('all'); setFrom(''); setTo('') }}>Limpiar</button>
      </div>
      <div className="card history-card">
        <div className="card-heading"><div><h2>{filtered.length} movimientos</h2><p>Ordenados del más reciente al más antiguo</p></div></div>
        <MovementList movements={filtered} actions={m => <div className="row-actions"><button onClick={() => onEdit(m)} aria-label="Editar"><Icon name="edit" size={17} /></button><button onClick={() => onDelete(m.id)} aria-label="Eliminar"><Icon name="trash" size={17} /></button></div>} />
      </div>
    </div>
  )
}

function Assistant({ totals, movements }: { totals: { income: number; expense: number; balance: number }; movements: Movement[] }) {
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string }[]>([
    { from: 'bot', text: 'Hola, María. Soy tu asistente financiero. Puedo ayudarte a entender las finanzas de tu bodega usando tus movimientos registrados.' },
  ])
  const [input, setInput] = useState('')
  const ask = (question: string) => {
    const lower = question.toLowerCase()
    let answer = `Tu saldo actual es ${formatMoney(totals.balance)}. Has registrado ${movements.length} movimientos en total.`
    if (lower.includes('gast')) answer = `Has gastado ${formatMoney(totals.expense)}. La categoría con más registros de gasto es Mercadería. Te recomiendo separar las compras grandes de los gastos pequeños.`
    if (lower.includes('ingres') || lower.includes('vend')) answer = `Tus ingresos registrados suman ${formatMoney(totals.income)}. Eso es ${formatMoney(Math.max(0, totals.income - totals.expense))} más que tus gastos.`
    if (lower.includes('crédito') || lower.includes('credito')) answer = `Tener registros diarios y un balance positivo te ayuda a ordenar tu solicitud. Hoy tu balance es ${formatMoney(totals.balance)}. Recuerda que el reporte de KipuAI no garantiza la aprobación.`
    setMessages(current => [...current, { from: 'user', text: question }, { from: 'bot', text: answer }])
    setInput('')
  }
  const submit = (e: FormEvent) => { e.preventDefault(); if (input.trim()) ask(input.trim()) }

  return (
    <div className="page assistant-page">
      <PageHeader title="Asistente financiero" description="Pregunta en palabras simples. Las respuestas usan tus movimientos registrados." />
      <div className="assistant-layout">
        <div className="card assistant-chat">
          <div className="assistant-head"><div className="bot-avatar"><Icon name="sparkle" size={19} /></div><div><strong>KipuAI</strong><span><i /> Listo para ayudarte</span></div></div>
          <div className="assistant-messages">
            {messages.map((message, index) => <div key={index} className={`assistant-message ${message.from}`} >{message.from === 'bot' && <div className="mini-bot">K</div>}<p>{message.text}</p></div>)}
          </div>
          <div className="suggestions">
            {['¿Cuánto gasté?', '¿Cómo van mis ingresos?', '¿Estoy listo para un crédito?'].map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}
          </div>
          <form className="assistant-input" onSubmit={submit}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribe tu pregunta..." /><button className="send-button" aria-label="Enviar"><Icon name="send" size={18} /></button></form>
        </div>
        <aside className="card context-card">
          <span className="eyebrow">Tu resumen</span><h2>Lo que KipuAI sabe</h2>
          <div><span>Ingresos</span><strong className="positive-text">{formatMoney(totals.income)}</strong></div>
          <div><span>Gastos</span><strong className="negative-text">{formatMoney(totals.expense)}</strong></div>
          <div><span>Balance</span><strong>{formatMoney(totals.balance)}</strong></div>
          <p><Icon name="bulb" size={17} />Mientras más movimientos registres, más útiles serán las respuestas.</p>
        </aside>
      </div>
    </div>
  )
}

function Credit({ totals, movements }: { totals: { income: number; expense: number; balance: number }; movements: Movement[] }) {
  const recordDays = new Set(movements.map(m => m.date)).size
  const score = Math.min(90, 35 + recordDays * 5 + (totals.balance > 0 ? 20 : 0))
  return (
    <div className="page">
      <PageHeader title="Preparación para crédito" description="Ordena tus números y construye un historial más claro de tu negocio." action={<button className="secondary-button"><Icon name="document" size={18} />Vista de reporte</button>} />
      <div className="credit-hero">
        <div className="credit-score"><div className="score-large" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}><div><strong>{score}</strong><span>de 100</span></div></div><div><span className="eyebrow">Nivel actual</span><h2>Vas por buen camino</h2><p>Ya tienes un balance positivo. Sigue registrando cada día para construir un historial más sólido.</p></div></div>
        <div className="credit-summary">
          <div><span>Ingresos registrados</span><strong>{formatMoney(totals.income)}</strong></div>
          <div><span>Gastos registrados</span><strong>{formatMoney(totals.expense)}</strong></div>
          <div className="highlight"><span>Balance del negocio</span><strong>{formatMoney(totals.balance)}</strong></div>
        </div>
      </div>
      <div className="credit-grid">
        <section className="card checklist">
          <div className="card-heading"><div><h2>Tu avance financiero</h2><p>Pasos que te ayudan a presentar mejor tu negocio</p></div></div>
          <div className="check-item done"><span><Icon name="check" /></span><div><strong>Registrar ingresos y gastos</strong><p>Ya tienes {movements.length} movimientos guardados.</p></div><b>Listo</b></div>
          <div className={recordDays >= 7 ? 'check-item done' : 'check-item'}><span>{recordDays >= 7 ? <Icon name="check" /> : recordDays}</span><div><strong>Mantener constancia</strong><p>Registra al menos 7 días distintos. Llevas {recordDays}.</p></div><b>{recordDays >= 7 ? 'Listo' : 'En progreso'}</b></div>
          <div className="check-item"><span>3</span><div><strong>Separar dinero personal y del negocio</strong><p>Evita mezclar compras de casa con gastos de la bodega.</p></div><b>Recomendado</b></div>
        </section>
        <section className="card recommendations">
          <div className="card-heading"><div><h2>Recomendaciones</h2><p>Acciones simples para ordenar tus finanzas</p></div></div>
          <article><span><Icon name="history" /></span><div><strong>Registra todos los días</strong><p>Dedica 2 minutos al cierre para anotar ventas y compras.</p></div></article>
          <article><span><Icon name="wallet" /></span><div><strong>Cuida tu margen</strong><p>Procura que tus gastos no superen el 70% de tus ingresos.</p></div></article>
          <article><span><Icon name="document" /></span><div><strong>Guarda tus comprobantes</strong><p>Organízalos por mes para respaldar tus movimientos.</p></div></article>
        </section>
      </div>
      <div className="disclaimer"><Icon name="bulb" size={19} /><p><strong>Importante:</strong> Este resumen es referencial y busca ayudarte a organizar tu información. No es una evaluación crediticia y no garantiza la aprobación de un crédito por ninguna entidad financiera.</p></div>
    </div>
  )
}

export default App
