import { useState, useCallback } from 'react'
import NHCApiService from '../services/nhcApi'

export interface HWRFWindField {
  center: [number, number]
  radius: number
  maxWinds: number
  model?: string
  cycle?: string
  forecastHour?: string
  validTime?: string
  windField: Array<{
    lat: number
    lon: number
    windSpeed: number
    pressure: number
    time: string
  }>
  contours?: Array<{
    windSpeed: number
    color: string
    polygon: Array<[number, number]>
  }>
}

export interface HWRFData {
  windFields: HWRFWindField[]
}

export const useHWRFData = () => {
  const [hwrfData, setHWRFData] = useState<HWRFData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHWRFData = useCallback(async (stormId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('Fetching HWRF data for storm:', stormId)
      const nhcApi = new NHCApiService()
      const data = await nhcApi.fetchHWRFWindFields(stormId)
      
      if (data) {
        setHWRFData(data)
        console.log('HWRF data fetched successfully:', data.windFields.length, 'wind fields')
      } else {
        setHWRFData(null)
        console.log('No HWRF data available for storm:', stormId)
      }
    } catch (err) {
      console.error('Error fetching HWRF data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch HWRF data')
      setHWRFData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setHWRFData(null)
    setError(null)
  }, [])

  return {
    hwrfData,
    isLoading,
    error,
    fetchHWRFData,
    clearData
  }
}

export const useHMONData = () => {
  const [hmonData, setHMONData] = useState<HWRFData | null>(null) // Reusing HWRFData interface as structure is the same
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHMONData = useCallback(async (stormId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('Fetching HMON data for storm:', stormId)
      const nhcApi = new NHCApiService()
      const data = await nhcApi.fetchHMONWindFields(stormId)
      
      if (data) {
        setHMONData(data)
        console.log('HMON data fetched successfully:', data.windFields.length, 'wind fields')
      } else {
        setHMONData(null)
        console.log('No HMON data available for storm:', stormId)
      }
    } catch (err) {
      console.error('Error fetching HMON data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch HMON data')
      setHMONData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearData = useCallback(() => {
    setHMONData(null)
    setError(null)
  }, [])

  return {
    hmonData,
    isLoading,
    error,
    fetchHMONData,
    clearData
  }
}