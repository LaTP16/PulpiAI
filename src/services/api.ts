const rawApiBase = (import.meta.env.VITE_API_BASE_URL || 'https://pulpiai.onrender.com/api').trim().replace(/\/+$/, '')
const API_BASE = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase}/api`

export type MovementType = 'income' | 'expense'

export type Movement = {
  id: string
  user_id?: string
  type: MovementType
  amount: number
  category: string
  description: string
  date: string
  currency?: string
  source?: string
  is_demo?: boolean
}

export type WeeklyDay = {
  label: string
  date: string
  income: number
  expense: number
}

export type CategoryTotal = {
  category: string
  total: number
  type: MovementType
}

export type TransactionSummary = {
  income: number
  expense: number
  balance: number
  total_count: number
  weekly: WeeklyDay[]
  categories: CategoryTotal[]
}

export type User = {
  id: string
  name: string
  email: string
  phone?: string
  business_name?: string
  is_demo?: boolean
}

export type VoiceParseResult = {
  type: MovementType
  amount: number
  currency: string
  description: string
  category: string
  date: string
  confidence: number
  needs_confirmation: boolean
  explanation?: string
}

export type CandidateAmount = {
  label: string
  amount: number
  confidence_score: number
}

export type OCRParseResult = {
  is_financial: boolean
  document_type: string
  document_type_label: string
  operation_type: 'income' | 'expense' | 'none'
  amount: number
  currency: string
  description: string
  category: string
  date: string
  entity_name?: string
  candidate_amounts: CandidateAmount[]
  raw_text: string
  confidence: number
  needs_confirmation: boolean
  status_message: string
}

export type AssistantChatResponse = {
  answer: string
  provider: string
  model: string
}

export const api = {
  // Auth
  async getDemoCredentials() {
    const res = await fetch(`${API_BASE}/auth/demo-credentials`)
    if (!res.ok) throw new Error('Error al obtener credenciales de prueba')
    return res.json()
  },

  async login(identifier: string, password: string): Promise<{ success: boolean; user: User; token: string }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Credenciales inválidas' }))
        throw new Error(err.detail || 'Error al iniciar sesión')
      }
      const data = await res.json()
      if (!data || !data.success) {
        throw new Error('Credenciales inválidas')
      }
      return data
    } catch (err: any) {
      clearTimeout(timeoutId)
      throw err
    }
  },

  // Transactions
  async getTransactions(params?: { type?: string; category?: string; from_date?: string; to_date?: string }): Promise<Movement[]> {
    const search = new URLSearchParams()
    if (params?.type && params.type !== 'all') search.set('type', params.type)
    if (params?.category && params.category !== 'all') search.set('category', params.category)
    if (params?.from_date) search.set('from_date', params.from_date)
    if (params?.to_date) search.set('to_date', params.to_date)

    const url = `${API_BASE}/transactions${search.toString() ? '?' + search.toString() : ''}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Error al cargar movimientos')
    return res.json()
  },

  async getSummary(): Promise<TransactionSummary> {
    const res = await fetch(`${API_BASE}/transactions/summary`)
    if (!res.ok) throw new Error('Error al cargar resumen financiero')
    return res.json()
  },

  async createTransaction(movement: Omit<Movement, 'id'>): Promise<Movement> {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movement),
    })
    if (!res.ok) throw new Error('Error al registrar movimiento')
    return res.json()
  },

  async updateTransaction(id: string, movement: Partial<Movement>): Promise<Movement> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movement),
    })
    if (!res.ok) throw new Error('Error al actualizar movimiento')
    return res.json()
  },

  async deleteTransaction(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Error al eliminar movimiento')
  },

  // Voice
  async parseVoice(text: string): Promise<VoiceParseResult> {
    const res = await fetch(`${API_BASE}/voice/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error('Error en el servicio de voz')
    return res.json()
  },

  // OCR
  async analyzeReceiptImage(file: File): Promise<OCRParseResult> {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE}/ocr/analyze-image`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al procesar la imagen' }))
      throw new Error(err.detail || 'Error al procesar comprobante')
    }
    return res.json()
  },

  // AI Assistant
  async askAssistant(question: string): Promise<AssistantChatResponse> {
    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    if (!res.ok) throw new Error('Error al consultar al asistente IA')
    return res.json()
  },
}
