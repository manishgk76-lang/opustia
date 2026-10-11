export type Role = 'ADMIN' | 'CUSTOMER' | 'PROFESSIONAL' | string

export interface AuthUser {
  id: string
  name?: string | null
  email: string
  role: Role
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type UnknownRecord = Record<string, unknown>

export interface DashboardMetric {
  label: string
  value: number | string | null
  change?: number | null
  trend?: 'up' | 'down' | 'neutral'
}

export interface DashboardData extends UnknownRecord {
  metrics?: DashboardMetric[]
  recentBookings?: UnknownRecord[]
  pendingVerificationRequests?: UnknownRecord[]
  openDisputes?: UnknownRecord[]
}

export interface ListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  [key: string]: string | number | boolean | undefined
}

export interface ToastMessage {
  id: number
  tone: 'success' | 'error' | 'info'
  title: string
  detail?: string
}
