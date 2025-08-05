import axios from 'axios'
import { NHCActiveStorms, NHCStorm, ProcessedStorm, StormForecastPoint, StormHistoricalPoint } from '../types/nhc'

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov'
const ACTIVE_STORMS_URL = `${NHC_BASE_URL}/CurrentStorms.json`
const GIS_BASE_URL = `${NHC_BASE_URL}/gis`

// CORS proxy alternatives for development (in production, you'd handle this server-side)
const CORS_PROXIES = [
  'https://cors-anywhere.herokuapp.com/', // Primary (requires access but most reliable)
  'https://api.codetabs.com/v1/proxy?quest=', // Simple proxy
  'https://corsproxy.io/?', // Another alternative
  'https://api.allorigins.win/get?url=', // Different format - returns data in .contents field
  // Removed allorigins.win/raw as it has port-specific CORS issues
];

// Development detection
const isDevelopment = () => {
  return typeof window !== 'undefined' && 
         (window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname.includes('local'));
};

// Alternative API endpoints that may work without CORS issues
const ALTERNATIVE_APIS = [
  {
    name: 'OpenWeatherMap Hurricane API',
    url: 'https://api.openweathermap.org/data/2.5/weather',
    requiresKey: true
  },
  {
    name: 'Weather.gov API', 
    url: 'https://api.weather.gov/alerts/active',
    requiresKey: false
  }
];

class NHCApiService {
  private corsProxy: string
  private currentProxyIndex: number = 0

  constructor(useProxy = false) {
    this.corsProxy = useProxy ? CORS_PROXIES[this.currentProxyIndex] : ''
  }

  /**
   * Try next CORS proxy if current one fails
   */
  private tryNextProxy(): boolean {
    this.currentProxyIndex = (this.currentProxyIndex + 1) % CORS_PROXIES.length
    this.corsProxy = CORS_PROXIES[this.currentProxyIndex]
    return this.currentProxyIndex !== 0 // Return false if we've tried all proxies
  }

  /**
   * Test if a proxy works with a simple request
   */
  private async testProxy(proxyUrl: string): Promise<boolean> {
    try {
      const testUrl = `${proxyUrl}https://httpbin.org/status/200`;
      await axios.get(testUrl, { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn(`Proxy test failed for ${proxyUrl}:`, error);
      return false;
    }
  }

  /**
   * Get browser/environment info for better error messages
   */
  private getBrowserInfo(): string {
    if (typeof window === 'undefined') return 'Node.js';
    const userAgent = window.navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  }

  /**
   * Fetch active storms from NHC with fallback proxies
   */
  async getActiveStorms(): Promise<ProcessedStorm[]> {
    let lastError: any;
    let attempts = 0;
    const isDevMode = isDevelopment();
    const maxAttempts = isDevMode ? CORS_PROXIES.length : CORS_PROXIES.length + 1; // Skip direct in dev

    console.log(`Starting NHC data fetch (${isDevMode ? 'Development' : 'Production'} mode) with ${maxAttempts} attempts...`);

    // Only try direct connection in production (not localhost)
    if (!isDevMode && attempts === 0) {
      try {
        console.log('Attempting direct connection to NHC API...');
        const response = await axios.get<NHCActiveStorms>(ACTIVE_STORMS_URL, {
          timeout: 8000,
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        console.log('Successfully fetched storm data directly');
        
        // Validate response data
        if (response.data && response.data.activeStorms) {
          return await this.processStormData(response.data.activeStorms);
        } else {
          throw new Error('Invalid response format from NHC API');
        }
      } catch (error: any) {
        console.warn('Direct connection failed:', error.message);
        lastError = error;
        attempts++;
      }
    }

    // Start with proxies immediately in development mode
    const startIndex = isDevMode ? 0 : (attempts > 0 ? attempts - 1 : 0);
    
    // Try CORS proxies
    for (let i = startIndex; i < CORS_PROXIES.length; i++) {
      const proxy = CORS_PROXIES[i];
      
      try {
        console.log(`Attempting to fetch storms with proxy ${i + 1}/${CORS_PROXIES.length}: ${proxy}`);
        
        const response = await axios.get(
          `${proxy}${ACTIVE_STORMS_URL}`,
          {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 12000
          }
        )

        console.log('Successfully fetched storm data via proxy');
        console.log('Response status:', response.status);
        console.log('Response data type:', typeof response.data);
        
        // Validate response data and handle different proxy formats
        if (response.data && typeof response.data === 'object') {
          let stormData = response.data;
          
          // Handle allorigins format (data in .contents field)
          if (stormData.contents && typeof stormData.contents === 'string') {
            try {
              stormData = JSON.parse(stormData.contents);
            } catch (parseError) {
              console.warn('Failed to parse allorigins response:', parseError);
              throw new Error('Failed to parse proxy response');
            }
          }
          
          // Standard NHC format
          if (stormData.activeStorms) {
            return await this.processStormData(stormData.activeStorms);
          } 
          // Direct array format
          else if (Array.isArray(stormData)) {
            return await this.processStormData(stormData);
          } 
          // Empty storms (no active storms)
          else if (stormData && Object.keys(stormData).length === 0) {
            console.log('No active storms currently');
            return [];
          } 
          else {
            console.warn('Unexpected response format:', stormData);
            throw new Error('Unexpected response format from proxy');
          }
        } else {
          throw new Error('Invalid response data from proxy');
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Proxy attempt ${i + 1} failed:`, error.message);
        console.warn('Error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code,
          message: error.message
        });
        
        // Continue to next proxy for any error
        continue;
      }
    }
    
    console.error('All proxy attempts failed.', lastError);
    
    // Provide more specific error messages and guidance
    if (lastError?.response?.status === 403) {
      throw new Error('CORS proxy access denied (403). Visit https://cors-anywhere.herokuapp.com/corsdemo to request access, then try again.');
    } else if (lastError?.message?.includes('Access-Control-Allow-Origin') || lastError?.message?.includes('localhost:3002')) {
      throw new Error('CORS proxy port mismatch detected. The proxy is configured for a different localhost port. Try requesting access to CORS-anywhere.');
    } else if (lastError?.message?.includes('CORS') || lastError?.code === 'ERR_NETWORK') {
      const devMessage = isDevMode ? 
        'Development environment detected: NHC API blocks localhost requests due to CORS policy. This is normal - use CORS proxies or demo data.' : 
        'Unable to connect to hurricane data feed due to CORS restrictions.';
      throw new Error(`${devMessage} Try requesting access to CORS proxy services.`);
    } else if (lastError?.code === 'ECONNABORTED') {
      throw new Error('Connection timeout while fetching hurricane data. Try getting CORS proxy access first.');
    } else {
      const envNote = isDevMode ? ' (Development environment - consider using demo data)' : '';
      throw new Error(`Unable to fetch live hurricane data: ${lastError?.message || 'Unknown error'}${envNote}. Try CORS proxy access or use demo data.`);
    }
  }

  /**
   * Get forecast track data for a specific storm
   */
  async getStormTrack(stormId: string): Promise<StormForecastPoint[]> {
    try {
      // NHC provides GeoJSON forecast track data
      const year = new Date().getFullYear()
      const forecastUrl = `${this.corsProxy}${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId.toUpperCase()}_5day_latest.geojson`
      
      console.log('Fetching forecast track from:', forecastUrl)
      
      const response = await axios.get(forecastUrl, {
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      })

      return this.parseForecastGeoJSON(response.data)
    } catch (error) {
      console.warn('Failed to fetch forecast track for', stormId, ':', error)
      // Return empty array if forecast data is not available
      return []
    }
  }

  /**
   * Get historical track data for a specific storm
   */
  async getStormHistoricalTrack(stormId: string): Promise<StormHistoricalPoint[]> {
    try {
      // NHC provides best track data
      const year = new Date().getFullYear()
      const trackUrl = `${this.corsProxy}${NHC_BASE_URL}/gis/best_track/archive/${year}/${stormId.toUpperCase()}_best_track.geojson`
      
      console.log('Fetching historical track from:', trackUrl)
      
      const response = await axios.get(trackUrl, {
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      })

      return this.parseHistoricalGeoJSON(response.data)
    } catch (error) {
      console.warn('Failed to fetch historical track for', stormId, ':', error)
      // Return empty array if historical data is not available
      return []
    }
  }

  /**
   * Get storm forecast cone data
   */
  async getStormCone(stormId: string): Promise<any> {
    try {
      const coneUrl = `${this.corsProxy}${GIS_BASE_URL}/forecast/archive/${new Date().getFullYear()}/${stormId}_latest_CONE.kmz`
      
      // Return cone coordinates for map visualization
      return this.parseConeData(coneUrl)
    } catch (error) {
      console.error('Error fetching storm cone:', error)
      return null
    }
  }

  /**
   * Process raw NHC storm data into our format
   */
  private async processStormData(storms: NHCStorm[]): Promise<ProcessedStorm[]> {
    console.log('Processing storm data:', storms);
    
    if (!Array.isArray(storms)) {
      console.warn('Expected array of storms, got:', typeof storms, storms);
      return [];
    }

    try {
      const processedStorms = await Promise.all(
        storms.map(async (storm, index) => {
          console.log(`Processing storm ${index + 1}:`, storm);
          
          // Provide defaults for missing fields
          const processedStorm: ProcessedStorm = {
            id: storm.id || `unknown-${index}`,
            name: storm.name || 'Unknown Storm',
            classification: storm.classification || 'Unknown',
            category: this.getStormCategory(storm.intensity || '0'),
            position: [
              typeof storm.latitudeNumeric === 'number' ? storm.latitudeNumeric : parseFloat(storm.latitude || '0'),
              typeof storm.longitudeNumeric === 'number' ? storm.longitudeNumeric : parseFloat(storm.longitude || '0')
            ] as [number, number],
            maxWinds: parseInt(storm.intensity || '0') || 0,
            pressure: parseInt(storm.pressure || '0') || 0,
            movement: this.formatMovement(
              typeof storm.movementDir === 'number' ? storm.movementDir : parseFloat(storm.movementDir || '0'),
              typeof storm.movementSpeed === 'number' ? storm.movementSpeed : parseFloat(storm.movementSpeed || '0')
            ),
            lastUpdate: storm.lastUpdate ? new Date(storm.lastUpdate) : new Date(),
            forecast: [],
            historical: [],
            advisoryUrl: storm.publicAdvisory?.url || '',
            trackUrl: storm.track?.url || '',
            coneUrl: storm.cone?.url || ''
          };

          // Fetch forecast and historical data
          try {
            const [forecastData, historicalData] = await Promise.all([
              this.getStormTrack(storm.id || storm.binNumber || ''),
              this.getStormHistoricalTrack(storm.id || storm.binNumber || '')
            ]);
            
            processedStorm.forecast = forecastData;
            processedStorm.historical = historicalData;
            
            console.log(`Storm ${storm.name}: ${forecastData.length} forecast points, ${historicalData.length} historical points`);
          } catch (error) {
            console.warn(`Failed to fetch track data for ${storm.name}:`, error);
          }

          console.log(`Processed storm:`, processedStorm);
          return processedStorm;
        })
      );

      return processedStorms;
    } catch (error) {
      console.error('Error processing storm data:', error);
      console.error('Raw storm data:', storms);
      return [];
    }
  }

  /**
   * Convert wind speed to Saffir-Simpson category
   */
  private getStormCategory(intensity: string): number {
    const windSpeed = parseInt(intensity) || 0
    
    if (windSpeed >= 157) return 5
    if (windSpeed >= 130) return 4
    if (windSpeed >= 111) return 3
    if (windSpeed >= 96) return 2
    if (windSpeed >= 74) return 1
    return 0 // Tropical Storm or Depression
  }

  /**
   * Format movement direction and speed
   */
  private formatMovement(direction: number, speed: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    const dirIndex = Math.round(direction / 22.5) % 16
    const dirText = directions[dirIndex]
    
    return `${dirText} at ${speed} mph`
  }

  /**
   * Parse forecast GeoJSON data from NHC
   */
  private parseForecastGeoJSON(geoJsonData: any): StormForecastPoint[] {
    try {
      if (!geoJsonData || !geoJsonData.features) {
        console.warn('Invalid GeoJSON data for forecast')
        return []
      }

      const forecastPoints: StormForecastPoint[] = []

      geoJsonData.features.forEach((feature: any) => {
        if (feature.geometry && feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates
          const props = feature.properties || {}

          // Extract forecast hour from properties
          const forecastHour = this.extractForecastHour(props)
          if (forecastHour === null) return

          forecastPoints.push({
            latitude: coords[1],
            longitude: coords[0],
            dateTime: props.VALIDTIME || props.DTG || new Date().toISOString(),
            maxWinds: parseInt(props.MAXWIND) || parseInt(props.INTENSITY) || 0,
            gusts: parseInt(props.GUST) || 0,
            pressure: parseInt(props.MSLP) || parseInt(props.PRESSURE) || 0,
            movement: {
              direction: parseInt(props.SPEED) || 0,
              speed: parseInt(props.DIRECTION) || 0
            },
            forecastHour: forecastHour
          })
        }
      })

      // Sort by forecast hour
      return forecastPoints.sort((a, b) => a.forecastHour - b.forecastHour)
    } catch (error) {
      console.error('Error parsing forecast GeoJSON:', error)
      return []
    }
  }

  /**
   * Parse historical GeoJSON data from NHC
   */
  private parseHistoricalGeoJSON(geoJsonData: any): StormHistoricalPoint[] {
    try {
      if (!geoJsonData || !geoJsonData.features) {
        console.warn('Invalid GeoJSON data for historical track')
        return []
      }

      const historicalPoints: StormHistoricalPoint[] = []

      geoJsonData.features.forEach((feature: any) => {
        if (feature.geometry && feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates
          const props = feature.properties || {}

          historicalPoints.push({
            latitude: coords[1],
            longitude: coords[0],
            dateTime: props.ISO_TIME || props.DTG || props.SYNOPTIME || new Date().toISOString(),
            maxWinds: parseInt(props.USA_WIND) || parseInt(props.INTENSITY) || 0,
            pressure: parseInt(props.USA_PRES) || parseInt(props.PRESSURE) || 0,
            category: this.getStormCategory((parseInt(props.USA_WIND) || 0).toString()),
            classification: props.USA_STATUS || props.STATUS || 'Unknown'
          })
        }
      })

      // Sort by date
      return historicalPoints.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    } catch (error) {
      console.error('Error parsing historical GeoJSON:', error)
      return []
    }
  }

  /**
   * Extract forecast hour from properties
   */
  private extractForecastHour(props: any): number | null {
    // Try different property names that NHC uses
    if (props.FHOUR !== undefined) return parseInt(props.FHOUR)
    if (props.FCST_HR !== undefined) return parseInt(props.FCST_HR)
    if (props.TAU !== undefined) return parseInt(props.TAU)
    
    // Try to extract from time strings
    if (props.VALIDTIME) {
      const baseTime = new Date(props.SYNOPTIME || props.DTG)
      const validTime = new Date(props.VALIDTIME)
      if (!isNaN(baseTime.getTime()) && !isNaN(validTime.getTime())) {
        return Math.round((validTime.getTime() - baseTime.getTime()) / (1000 * 60 * 60))
      }
    }

    return null
  }

  /**
   * Parse track data from KML/GeoJSON
   */
  private async parseTrackData(trackUrl: string): Promise<StormForecastPoint[]> {
    try {
      // This method is deprecated in favor of parseForecastGeoJSON
      console.log('parseTrackData is deprecated, use parseForecastGeoJSON instead')
      return []
    } catch (error) {
      console.error('Error parsing track data:', error)
      return []
    }
  }

  /**
   * Parse cone data from KMZ
   */
  private async parseConeData(coneUrl: string): Promise<any> {
    try {
      // Parse KMZ file to extract cone boundary coordinates
      // This would require a KMZ/KML parser
      console.log('Parsing cone data from:', coneUrl)
      return null
    } catch (error) {
      console.error('Error parsing cone data:', error)
      return null
    }
  }

  /**
   * Fallback mock data when API is unavailable
   */
  private getMockStorms(): ProcessedStorm[] {
    return [
      {
        id: 'al012025',
        name: 'Hurricane Example',
        classification: 'Hurricane',
        category: 3,
        position: [25.5, -80.0],
        maxWinds: 115,
        pressure: 960,
        movement: 'NNW at 12 mph',
        lastUpdate: new Date(),
        forecast: [
          {
            latitude: 25.5,
            longitude: -80.0,
            dateTime: '2025-08-05T06:00:00Z',
            maxWinds: 115,
            gusts: 140,
            pressure: 960,
            movement: { direction: 330, speed: 12 },
            forecastHour: 12
          },
          {
            latitude: 26.2,
            longitude: -81.1,
            dateTime: '2025-08-05T18:00:00Z',
            maxWinds: 120,
            gusts: 145,
            pressure: 955,
            movement: { direction: 330, speed: 12 },
            forecastHour: 24
          }
        ],
        historical: [
          {
            latitude: 24.0,
            longitude: -78.5,
            dateTime: '2025-08-04T06:00:00Z',
            maxWinds: 100,
            pressure: 970,
            category: 2,
            classification: 'Hurricane'
          }
        ],
        advisoryUrl: '',
        trackUrl: '',
        coneUrl: ''
      }
    ]
  }

  /**
   * Get RSS feed for storm advisories
   */
  async getStormAdvisories(): Promise<any[]> {
    try {
      const rssUrl = `${this.corsProxy}${NHC_BASE_URL}/index-at.xml`
      
      // Parse RSS feed for latest advisories
      // This would require an RSS parser
      console.log('Fetching advisories from:', rssUrl)
      
      return []
    } catch (error) {
      console.error('Error fetching advisories:', error)
      return []
    }
  }

  /**
   * Check if storms are currently active
   */
  async hasActiveStorms(): Promise<boolean> {
    try {
      const storms = await this.getActiveStorms()
      return storms.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Test function to debug API connectivity
   */
  async testConnectivity(): Promise<string> {
    console.log('Testing connectivity...');
    
    // Test direct connection
    try {
      const response = await axios.get(ACTIVE_STORMS_URL, { timeout: 5000 });
      return `Direct connection: SUCCESS (${response.status})`;
    } catch (error: any) {
      console.log('Direct connection failed:', error.message);
    }

    // Test each proxy
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      const proxy = CORS_PROXIES[i];
      try {
        const response = await axios.get(`${proxy}${ACTIVE_STORMS_URL}`, { timeout: 5000 });
        return `Proxy ${i + 1} (${proxy}): SUCCESS (${response.status})`;
      } catch (error: any) {
        console.log(`Proxy ${i + 1} failed:`, error.message);
      }
    }

    return 'All connection attempts failed';
  }
}

export default NHCApiService
