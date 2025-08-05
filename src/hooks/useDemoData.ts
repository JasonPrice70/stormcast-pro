import { useState, useCallback } from 'react'

interface UseDemoDataReturn {
  storms: any[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
  hasActiveStorms: boolean
}

export const useDemoData = (): UseDemoDataReturn => {
  const [storms] = useState<any[]>([])
  const [loading] = useState(false)
  const [error] = useState<string | null>('Demo mode - using sample data')
  const [lastUpdated] = useState<Date | null>(new Date())

  const refresh = useCallback(async () => {
    console.log('Demo mode - refresh called')
  }, [])

  return {
    storms,
    loading,
    error,
    lastUpdated,
    refresh,
    hasActiveStorms: false
  }
}
