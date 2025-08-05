import { useState, useEffect, useCallback } from 'react'
import NHCApiService from '../services/nhcApi'
import { ProcessedStorm } from '../types/nhc'

interface UseNHCDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  useProxy?: boolean
  fetchOnMount?: boolean
  fetchTrackData?: boolean
}

interface UseNHCDataReturn {
  storms: ProcessedStorm[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
  hasActiveStorms: boolean
}

export const useNHCData = (options: UseNHCDataOptions = {}): UseNHCDataReturn => {
  const {
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    useProxy = false,
    fetchOnMount = true,
    fetchTrackData = true
  } = options

  const [storms, setStorms] = useState<ProcessedStorm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStorms = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const nhcApiInstance = new NHCApiService(useProxy, fetchTrackData)
      const activeStorms = await nhcApiInstance.getActiveStorms()
      
      // The storms now already include forecast and historical data
      setStorms(activeStorms)
      setLastUpdated(new Date())
      console.log('Successfully updated storm data');
    } catch (err) {
      console.error('Error fetching NHC data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch storm data'
      
      // Provide user-friendly error messages based on error type
      if (errorMessage.includes('CORS proxy access denied (403)')) {
        setError('🔒 CORS proxy access required. Visit the CORS demo page to request access, then try again.');
      } else if (errorMessage.includes('port mismatch') || errorMessage.includes('localhost:3002')) {
        setError('🔌 CORS proxy port conflict detected. Click "Get CORS Access" below to fix this issue.');
      } else if (errorMessage.includes('CORS restrictions')) {
        setError('🌐 Unable to connect to live hurricane data due to browser security restrictions. This is normal in development. Try requesting proxy access or use demo data.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Connection timeout')) {
        setError('⏱️ Connection timeout - likely needs CORS proxy access. Click the "Get CORS Access" button below and try again.');
      } else if (errorMessage.includes('Network Error') || errorMessage.includes('ERR_NETWORK')) {
        setError('📡 Network connection issue. Try getting CORS proxy access first, then check your internet connection.');
      } else {
        setError(`⚠️ ${errorMessage}`);
      }
      
      // Set empty storms to show "All Clear" state instead of error data
      setStorms([])
    } finally {
      setLoading(false)
    }
  }, [useProxy, fetchTrackData])

  const refresh = useCallback(async () => {
    await fetchStorms()
  }, [fetchStorms])

  // Initial data fetch (only if fetchOnMount is true)
  useEffect(() => {
    if (fetchOnMount) {
      fetchStorms()
    }
  }, [fetchStorms, fetchOnMount])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchStorms()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchStorms])

  return {
    storms,
    loading,
    error,
    lastUpdated,
    refresh,
    hasActiveStorms: storms.length > 0
  }
}

// Hook for getting a specific storm's detailed data
export const useStormDetails = (stormId: string | null) => {
  const [stormDetails, setStormDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nhcApi = new NHCApiService()

  useEffect(() => {
    if (!stormId) {
      setStormDetails(null)
      return
    }

    const fetchStormDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch additional storm data
        const [track, cone] = await Promise.all([
          nhcApi.getStormTrack(stormId),
          nhcApi.getStormCone(stormId)
        ])

        setStormDetails({
          track,
          cone,
          // Add more detailed storm information
        })
      } catch (err) {
        console.error('Error fetching storm details:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch storm details')
      } finally {
        setLoading(false)
      }
    }

    fetchStormDetails()
  }, [stormId, nhcApi])

  return {
    stormDetails,
    loading,
    error
  }
}
