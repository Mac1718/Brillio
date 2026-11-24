import { useCallback, useEffect, useState } from 'react'

export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        try {
          if (resolved == null) localStorage.removeItem(key)
          else localStorage.setItem(key, JSON.stringify(resolved))
        } catch (error) {
          console.warn(`Could not persist ${key}`, error)
        }
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}

export function useTheme(theme, setTheme) {
  useEffect(() => {
    const root = document.documentElement
    const resolved =
      theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    root.classList.toggle('dark', resolved === 'dark')
    root.dataset.theme = resolved
  }, [theme])

  return theme
}
