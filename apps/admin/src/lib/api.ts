import type { AuthUser, ListQuery, Paginated, UnknownRecord } from '../types'

const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'opustia.admin.access-token'
const USER_KEY = 'opustia.admin.user'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type Envelope<T> = {
  success?: boolean
  data?: T
  message?: string
  error?: { message?: string; code?: string }
  meta?: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // A private browsing setting can disable storage. Authentication still works for this tab.
  }
}

export const authStorage = {
  getToken: () => readStorage(ACCESS_TOKEN_KEY),
  setToken: (token: string | null) => writeStorage(ACCESS_TOKEN_KEY, token),
  getUser: (): AuthUser | null => {
    const raw = readStorage(USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthUser
    } catch {
      return null
    }
  },
  setUser: (user: AuthUser | null) => writeStorage(USER_KEY, user ? JSON.stringify(user) : null),
  clear: () => {
    writeStorage(ACCESS_TOKEN_KEY, null)
    writeStorage(USER_KEY, null)
  },
}

function tokenFrom(payload: unknown): string | null {
  if (!isRecord(payload)) return null
  const direct = payload.accessToken
  if (typeof direct === 'string') return direct
  if (isRecord(payload.tokens) && typeof payload.tokens.accessToken === 'string') return payload.tokens.accessToken
  return null
}

function userFrom(payload: unknown): AuthUser | null {
  if (!isRecord(payload)) return null
  const candidate = isRecord(payload.user) ? payload.user : payload
  if (typeof candidate.id !== 'string' || typeof candidate.email !== 'string' || typeof candidate.role !== 'string') return null
  return {
    id: candidate.id,
    email: candidate.email,
    role: candidate.role,
    name: typeof candidate.name === 'string' ? candidate.name : null,
  }
}

function queryString(query?: ListQuery) {
  if (!query) return ''
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const value = params.toString()
  return value ? `?${value}` : ''
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  const text = await response.text()
  return text ? { message: text } : undefined
}

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        const body = await parseResponse(response)
        const payload = isRecord(body) && isRecord(body.data) ? body.data : body
        if (!response.ok) return null
        const token = tokenFrom(payload)
        if (token) authStorage.setToken(token)
        return token
      } catch {
        return null
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = authStorage.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch {
    throw new ApiError('Unable to reach the API. Check your connection and try again.')
  }

  if (response.status === 401 && retryAfterRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken()
    if (refreshed) return request<T>(path, init, false)
  }

  const body = await parseResponse(response)
  const envelope = isRecord(body) ? (body as Envelope<T>) : undefined
  if (!response.ok || envelope?.success === false) {
    const message = envelope?.error?.message ?? envelope?.message ?? 'The request could not be completed.'
    throw new ApiError(message, response.status, envelope?.error?.code)
  }
  return { data: (envelope && 'data' in envelope ? envelope.data : body) as T, meta: envelope?.meta }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data } = await request<UnknownRecord>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false)
  const token = tokenFrom(data)
  const user = userFrom(data)
  if (!token || !user) throw new ApiError('The API returned an incomplete sign-in response.')
  if (user.role !== 'ADMIN') {
    authStorage.clear()
    throw new ApiError('This account does not have administrator access.', 403)
  }
  authStorage.setToken(token)
  authStorage.setUser(user)
  return user
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await request<AuthUser>('/auth/me')
  if (data.role !== 'ADMIN') throw new ApiError('This account does not have administrator access.', 403)
  authStorage.setUser(data)
  return data
}

export async function signOut(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' }, false)
  } finally {
    authStorage.clear()
  }
}

export function getAdmin<T>(resource: string, query?: ListQuery) {
  return request<T>(`/admin/${resource}${queryString(query)}`).then((result) => result.data)
}

export function createAdmin<T>(resource: string, payload: unknown) {
  return request<T>(`/admin/${resource}`, { method: 'POST', body: JSON.stringify(payload) }).then((result) => result.data)
}

export function updateAdmin<T>(resource: string, id: string, payload: unknown) {
  return request<T>(`/admin/${resource}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }).then((result) => result.data)
}

export function normalizePage<T>(payload: unknown, fallbackPage = 1, fallbackPageSize = 20): Paginated<T> {
  const value = isRecord(payload) ? payload : {}
  const nested = isRecord(value.data) ? value.data : value
  const rawItems = Array.isArray(nested.items)
    ? nested.items
    : Array.isArray(nested.results)
      ? nested.results
      : Array.isArray(payload)
        ? payload
        : []
  const rawMeta = isRecord(value.meta) ? value.meta : isRecord(nested.meta) ? nested.meta : value
  const readNumber = (key: string, fallback: number) => typeof rawMeta[key] === 'number' ? rawMeta[key] as number : fallback
  const total = readNumber('total', rawItems.length)
  const page = readNumber('page', fallbackPage)
  const pageSize = readNumber('pageSize', readNumber('limit', fallbackPageSize))
  return {
    items: rawItems as T[],
    page,
    pageSize,
    total,
    totalPages: readNumber('totalPages', Math.max(1, Math.ceil(total / pageSize))),
  }
}
