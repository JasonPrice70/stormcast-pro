// Types for NHC API responses
export interface NHCStorm {
  id: string
  binNumber: string
  name: string
  classification: string
  intensity: string
  pressure: string
  latitude: string
  longitude: string
  latitudeNumeric: number
  longitudeNumeric: number
  movementDir: number
  movementSpeed: number
  lastUpdate: string
  publicAdvisory: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  forecastAdvisory: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  windSpeedProbabilities: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  track: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  windWatchWarning: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  cone: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  initialWindExtent: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  forecastWindRadii: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
  bestTrack: {
    advNum: string
    issuance: string
    fileUpdateTime: string
    url: string
  }
}

export interface NHCActiveStorms {
  activeStorms: NHCStorm[]
}

export interface StormForecastPoint {
  latitude: number
  longitude: number
  dateTime: string
  maxWinds: number
  gusts: number
  pressure: number
  movement: {
    direction: number
    speed: number
  }
  forecastHour: number
}

export interface StormHistoricalPoint {
  latitude: number
  longitude: number
  dateTime: string
  maxWinds: number
  pressure: number
  category: number
  classification: string
}

export interface ProcessedStorm {
  id: string
  name: string
  classification: string
  category: number
  position: [number, number]
  maxWinds: number
  pressure: number
  movement: string
  lastUpdate: Date
  forecast: StormForecastPoint[]
  historical: StormHistoricalPoint[]
  advisoryUrl: string
  trackUrl: string
  coneUrl: string
}
