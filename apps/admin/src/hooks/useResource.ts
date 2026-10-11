import { useCallback, useEffect, useState } from 'react'

export interface ResourceState<T> {
  data: T | null
  error: Error | null
  loading: boolean
  reload: () => Promise<void>
}

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []): ResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loader()
      setData(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Unable to load this data.'))
    } finally {
      setLoading(false)
    }
    // Dependency values are intentionally controlled by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const next = await loader()
        if (active) setData(next)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause : new Error('Unable to load this data.'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
    // The caller supplies dependencies because loaders are often inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return { data, error, loading, reload }
}
