import { useState, useEffect, useCallback } from 'react'
import NHCApiService from '../services/nhcApi'
import { InvestArea } from '../types/nhc'

interface UseInvestDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  useProxy?: boolean
  fetchOnMount?: boolean
}

interface UseInvestDataReturn {
  invests: InvestArea[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
  hasActiveInvests: boolean
}

export const useInvestData = (options: UseInvestDataOptions = {}): UseInvestDataReturn => {
  const {
    autoRefresh = true,
    refreshInterval = 15 * 60 * 1000, // 15 minutes (invest data updates less frequently)
    useProxy = false,
    fetchOnMount = true
  } = options

  const [invests, setInvests] = useState<InvestArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchInvests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔍 Starting invest data fetch...')
      const nhcApiInstance = new NHCApiService(useProxy, false) // Don't need track data for invests
      const investAreas = await nhcApiInstance.getInvestAreas()
      
      console.log('📊 Invest areas received:', investAreas)
      console.log('📈 Number of invest areas:', investAreas.length)
      
      if (investAreas.length === 0) {
        console.log('ℹ️ No active invest areas found. This is normal when there is no tropical development expected.')
      }
      
      if (investAreas.length > 0) {
        investAreas.forEach((invest, index) => {
          console.log(`🌀 Invest ${index + 1}:`, {
            id: invest.id,
            name: invest.name,
            basin: invest.basin,
            position: invest.position,
            chance48hr: invest.formationChance48hr,
            chance7day: invest.formationChance7day,
            location: invest.location
          })
        })
      } else {
        console.log('❌ No invest areas found')
      }
      
      setInvests(investAreas)
      setLastUpdated(new Date())
      console.log(`✅ Successfully updated invest data: ${investAreas.length} areas found`)
    } catch (err) {
      console.error('❌ Error fetching invest data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invest data'
      
      // Provide user-friendly error messages
      if (errorMessage.includes('CORS proxy access denied (403)')) {
        setError('🔒 CORS proxy access required to fetch live invest data. If no invests are shown, either there are no active tropical developments OR you need CORS access.')
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Connection timeout')) {
        setError('⏱️ Connection timeout while fetching invest data. This may indicate CORS proxy issues OR no active tropical developments. Try "Get CORS Access" if needed.')
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('ERR_NETWORK')) {
        setError('📡 Network connection issue while fetching invest data. Check your connection or try requesting CORS access.')
      } else {
        setError(`⚠️ Unable to fetch live invest data: ${errorMessage}. If no invests shown, there may be no active tropical developments.`)
      }
      
      // Keep previous data on error instead of clearing
      if (invests.length === 0) {
        setInvests([])
      }
    } finally {
      setLoading(false)
    }
  }, [useProxy, invests.length])

  const refresh = useCallback(async () => {
    await fetchInvests()
  }, [fetchInvests])

  // Initial data fetch
  useEffect(() => {
    if (fetchOnMount) {
      fetchInvests()
    }
  }, [fetchInvests, fetchOnMount])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchInvests()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchInvests])

  return {
    invests,
    loading,
    error,
    lastUpdated,
    refresh,
    hasActiveInvests: invests.length > 0
  }
}
