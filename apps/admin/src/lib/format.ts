import type { UnknownRecord } from '../types'

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => isRecord(value) ? value[key] : undefined, source)
}

export function firstValue(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = getPath(source, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export function stringValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

export function titleCase(value: unknown, fallback = '—'): string {
  const text = stringValue(value, fallback)
  if (text === fallback) return text
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatDate(value: unknown, includeTime = false): string {
  if (!value) return '—'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return stringValue(value)
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(date)
}

export function formatCurrency(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatNumber(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? new Intl.NumberFormat('en-IN').format(number) : stringValue(value)
}

export function formatRating(value: unknown): string {
  const rating = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(rating) ? `${rating.toFixed(1)} ★` : '—'
}

export function statusTone(value: unknown): 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' {
  const status = String(value ?? '').toLowerCase()
  if (/(approved|active|paid|success|completed|resolved|verified|accepted|confirmed)/.test(status)) return 'green'
  if (/(pending|review|requested|processing|disputed|claimed|due)/.test(status)) return 'amber'
  if (/(reject|fail|cancel|suspend|expired|refunded|fraud|blocked)/.test(status)) return 'red'
  if (/(pro|on.the.way|started|open)/.test(status)) return 'violet'
  if (/(new|info)/.test(status)) return 'blue'
  return 'slate'
}

export function initials(value: unknown): string {
  const words = stringValue(value, '').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'OP'
}

export function displayName(record: unknown): string {
  const value = firstValue(record, [
    'name',
    'businessName',
    'user.name',
    'customer.name',
    'professional.businessName',
    'professional.user.name',
    'professional.name',
    'email',
    'id',
  ])
  return stringValue(value)
}
