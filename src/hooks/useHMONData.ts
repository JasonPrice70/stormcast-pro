import { useState, useCallback } from 'react'
import NHCApiService from '../services/nhcApi'

export interface HMONWindField {
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

export interface HMONData {
  windFields: HMONWindField[]
}

export const useHMONData = () => {
  const [hmonData, setHMONData] = useState<HMONData | null>(null)
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
        console.log('HMON model info:', data.windFields[0]?.model, 'cycle:', data.windFields[0]?.cycle)
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

  const clearHMONData = useCallback(() => {
    setHMONData(null)
    setError(null)
  }, [])

  // Get the latest wind field data
  const getLatestWindField = useCallback((): HMONWindField | null => {
    if (!hmonData || !hmonData.windFields.length) return null
    
    // Return the most recent wind field (they should be sorted by time)
    return hmonData.windFields[0]
  }, [hmonData])

  // Get wind field statistics
  const getWindFieldStats = useCallback(() => {
    const windField = getLatestWindField()
    if (!windField) return null

    const winds = windField.windField.map(point => point.windSpeed)
    const pressures = windField.windField.map(point => point.pressure)

    return {
      maxWind: Math.max(...winds),
      minWind: Math.min(...winds),
      avgWind: winds.reduce((a, b) => a + b, 0) / winds.length,
      maxPressure: Math.max(...pressures),
      minPressure: Math.min(...pressures),
      avgPressure: pressures.reduce((a, b) => a + b, 0) / pressures.length,
      pointCount: winds.length,
      model: windField.model || 'HMON',
      cycle: windField.cycle || 'unknown',
      forecastHour: windField.forecastHour || '00'
    }
  }, [getLatestWindField])

  return {
    hmonData,
    isLoading,
    error,
    fetchHMONData,
    clearHMONData,
    getLatestWindField,
    getWindFieldStats
  }
}
