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

// Hook for getting a specific storm's storm surge data
export const useStormSurge = (stormId: string | null) => {
  const [surgeData, setSurgeData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)

  const fetchStormSurge = useCallback(async () => {
    if (!stormId) {
      setSurgeData(null)
      setAvailable(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const nhcApi = new NHCApiService()
      const surge = await nhcApi.getStormSurge(stormId, true)
      
      if (surge) {
        setSurgeData(surge)
        setAvailable(true)
      } else {
        setSurgeData(null)
        setAvailable(false)
      }
    } catch (err) {
      console.error('Error fetching storm surge data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch storm surge data')
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [stormId])

  useEffect(() => {
    fetchStormSurge()
  }, [fetchStormSurge])

  return {
    surgeData,
    loading,
    error,
    available,
    refresh: fetchStormSurge
  }
}

// Hook for getting wind speed probability data (34kt winds)
export const useWindSpeedProbability = (enabled: boolean = false) => {
  const [probabilityData, setProbabilityData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)

  const fetchWindSpeedProbability = useCallback(async () => {
    if (!enabled) {
      setProbabilityData(null)
      setAvailable(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const nhcApi = new NHCApiService()
      const probData = await nhcApi.getWindSpeedProbability()
      
      if (probData && probData.features && probData.features.length > 0) {
        setProbabilityData(probData)
        setAvailable(true)
      } else {
        setProbabilityData(null)
        setAvailable(false)
      }
    } catch (err) {
      console.error('Error fetching wind speed probability data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch wind speed probability data')
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    fetchWindSpeedProbability()
  }, [fetchWindSpeedProbability])

  return {
    probabilityData,
    loading,
    error,
    available,
    refresh: fetchWindSpeedProbability
  }
}

// Hook for getting a specific storm's detailed data
export const useStormDetails = (stormId: string | null) => {
  const [stormDetails, setStormDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!stormId) {
      setStormDetails(null)
      return
    }

    const fetchStormDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        const nhcApi = new NHCApiService()
        // Fetch additional storm data
        const [track, cone] = await Promise.all([
          nhcApi.getStormTrackKmz(stormId),
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
  }, [stormId])

  return {
    stormDetails,
    loading,
    error
  }
}

// Hook for getting spaghetti model ensemble tracks
export const useSpaghettiModels = (enabled: boolean = false, stormId?: string) => {
  const [spaghettiData, setSpaghettiData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)

  const fetchSpaghettiModels = useCallback(async () => {
    if (!enabled) {
      setSpaghettiData(null)
      setAvailable(null)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const nhcApi = new NHCApiService()
      const spaghettiModels = await nhcApi.getSpaghettiModels(stormId)
      
      console.log('Spaghetti models response:', spaghettiModels)
      
      if (spaghettiModels && spaghettiModels.models && spaghettiModels.models.length > 0) {
        // Validate model data before setting
        const validModels = spaghettiModels.models.filter((model: any) => 
          model && model.track && Array.isArray(model.track) && model.track.length > 0
        )
        
        if (validModels.length > 0) {
          setSpaghettiData({ ...spaghettiModels, models: validModels })
          setAvailable(true)
          console.log(`Successfully loaded ${validModels.length} valid spaghetti models`)
        } else {
          setSpaghettiData(null)
          setAvailable(false)
          console.warn('No valid model tracks found')
        }
      } else {
        setSpaghettiData(null)
        setAvailable(false)
      }
    } catch (err) {
      console.error('Error fetching spaghetti model data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch spaghetti models')
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [enabled, stormId])

  useEffect(() => {
    fetchSpaghettiModels()
  }, [fetchSpaghettiModels])

  return {
    spaghettiData,
    loading,
    error,
    available,
    refresh: fetchSpaghettiModels
  }
}
