import axios from 'axios'
import { NHCActiveStorms, NHCStorm, ProcessedStorm, StormForecastPoint, StormHistoricalPoint } from '../types/nhc'

// NHC API endpoints
const NHC_BASE_URL = 'https://www.nhc.noaa.gov'
const ACTIVE_STORMS_URL = `${NHC_BASE_URL}/CurrentStorms.json`
const GIS_BASE_URL = `${NHC_BASE_URL}/gis`

// Lambda API endpoint (now configured with API Gateway)
const getLambdaApiUrl = () => {
  // Check if we're in a browser environment with the Lambda API URL configured
  if (typeof window !== 'undefined' && (window as any).REACT_APP_LAMBDA_API_URL) {
    return (window as any).REACT_APP_LAMBDA_API_URL;
  }
  
  // Production API Gateway endpoint
  return 'https://v7z3sx0ee9.execute-api.us-east-1.amazonaws.com/dev';
};

// CORS proxy alternatives for browser environments
const CORS_PROXIES = [
  'https://api.allorigins.win/get?url=', // Most reliable - returns data in .contents field
  'https://api.codetabs.com/v1/proxy?quest=', // Simple and usually available
  'https://cors-anywhere.herokuapp.com/', // Requires access but reliable when enabled
  'https://thingproxy.freeboard.io/fetch/', // Alternative proxy service
  // Removed corsproxy.io as it appears to be down
];

// Development detection
const isDevelopment = () => {
  if (typeof window === 'undefined') return false; // Server-side rendering
  
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Check for local development environments
  const isLocalhost = hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname.includes('local') ||
                     hostname.includes('192.168.') ||
                     hostname.includes('10.0.');
                     
  // Check for development ports
  const isDevPort = port === '3000' || 
                   port === '3001' || 
                   port === '3002' || 
                   port === '5173' || 
                   port === '5174';
  
  // AWS Amplify domains are production
  const isAmplifyDomain = hostname.includes('.amplifyapp.com');
  
  // Netlify domains are production  
  const isNetlifyDomain = hostname.includes('.netlify.app') || hostname.includes('.netlify.com');
  
  // Vercel domains are production
  const isVercelDomain = hostname.includes('.vercel.app');
  
  // If it's a known production domain, it's not development
  if (isAmplifyDomain || isNetlifyDomain || isVercelDomain) {
    return false;
  }
  
  // Otherwise, check for local development indicators
  return isLocalhost || isDevPort;
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
  private fetchTrackData: boolean

  constructor(useProxy = false, fetchTrackData = true) {
    this.corsProxy = useProxy ? CORS_PROXIES[this.currentProxyIndex] : ''
    this.fetchTrackData = fetchTrackData
  }

  /**
   * Fetch GEFS-like ensemble tracks from NHC ATCF A-deck for a stormId.
   * Returns { filename, modelsPresent, tracks: [{ modelId, points: [{tau,lat,lon,vmax}]}] }
   */
  async getGEFSAdeckTracks(stormId: string): Promise<{
    filename: string;
    modelsPresent: string[];
    tracks: Array<{ modelId: string; points: Array<{ tau: number; lat: number; lon: number; vmax: number | null }> }>;
  } | null> {
    if (!stormId) return null;
    const data = await this.fetchWithLambdaFallback('gefs-adeck', { stormId });
    if (data && (data.tracks || data.modelsPresent)) return data;
    return null;
  }

  /**
   * Fetch latest GEFS PDS availability (date, cycle, members, resolutions)
   */
  async getGEFSPDSAvailability(): Promise<{ date: string|null; cycle: string|null; members: string[]; resolutions: string[] } | null> {
    const data = await this.fetchWithLambdaFallback('gefs-pds-latest');
    if (data && (data.date || data.members)) return data;
    return null;
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
   * Try to fetch data using Lambda function first, then fall back to CORS proxies
   */
  private async fetchWithLambdaFallback(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const lambdaUrl = getLambdaApiUrl();
    
    // First, try Lambda function if URL is configured and not null
    if (lambdaUrl && !lambdaUrl.includes('your-api-gateway-url')) {
      try {
        console.log(`Attempting to fetch via Lambda: ${endpoint}`);
        
        const queryParams = new URLSearchParams(params).toString();
        const url = `${lambdaUrl}/${endpoint}${queryParams ? `?${queryParams}` : ''}`;
        
        const response = await axios.get(url, {
          timeout: 20000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (response.data && response.data.success) {
          console.log(`Lambda request successful for ${endpoint}`);
          return response.data.data;
        } else {
          throw new Error('Lambda response indicates failure');
        }
      } catch (error) {
        console.warn(`Lambda request failed for ${endpoint}:`, error);
        console.log('Falling back to CORS proxies...');
      }
    } else {
      console.log('Lambda API not configured, using CORS proxies directly');
    }

    // Fall back to CORS proxies - return null to indicate caller should handle CORS proxy fallback
    return null;
  }

  /**
   * Fetch active storms from NHC with proxy server first, then fallback proxies
   */
  async getActiveStorms(): Promise<ProcessedStorm[]> {
    let lastError: any;
    let attempts = 0;
    const isDevMode = isDevelopment();
    
    console.log(`Starting NHC data fetch (${isDevMode ? 'Development' : 'Production'} mode)...`);
    console.log(`Current hostname: ${typeof window !== 'undefined' ? window.location.hostname : 'server'}`);

    // First, try our proxy server (Lambda or local development server)
    try {
      const proxyData = await this.fetchWithLambdaFallback('active-storms');
      if (proxyData) {
        console.log('Successfully fetched data via proxy server');
        
        // Handle the data based on format
        let stormData = proxyData;
        if (stormData.activeStorms) {
          return await this.processStormData(stormData.activeStorms);
        } else if (Array.isArray(stormData)) {
          return await this.processStormData(stormData);
        } else if (stormData && Object.keys(stormData).length === 0) {
          console.log('No active storms currently');
          return [];
        }
      }
    } catch (error) {
      console.warn('Proxy server failed, falling back to CORS proxies:', error);
    }

    // Fall back to CORS proxies for browser environments
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      const proxy = CORS_PROXIES[i];
      
      try {
        console.log(`Attempting to fetch storms with proxy ${i + 1}/${CORS_PROXIES.length}: ${proxy}`);
        
        const proxyUrl = `${proxy}${ACTIVE_STORMS_URL}`;
        console.log(`Full proxy URL: ${proxyUrl}`);
        
        const response = await axios.get(proxyUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 15000 // Increased timeout for slower proxies
        })

        console.log(`Proxy ${i + 1} succeeded:`, {
          status: response.status,
          statusText: response.statusText,
          dataType: typeof response.data,
          hasData: !!response.data
        });
        
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
        console.warn(`Proxy ${i + 1} (${proxy}) failed:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code,
          name: error.name,
          url: `${proxy}${ACTIVE_STORMS_URL}`
        });
        
        // Log specific error types for better debugging
        if (error.code === 'ERR_NETWORK') {
          console.warn(`Network error for proxy ${i + 1}: This proxy may be down or blocked`);
        } else if (error.code === 'ECONNABORTED') {
          console.warn(`Timeout error for proxy ${i + 1}: Proxy is too slow`);
        } else if (error.response?.status === 403) {
          console.warn(`Access denied for proxy ${i + 1}: May require special access`);
        } else if (error.response?.status === 429) {
          console.warn(`Rate limited for proxy ${i + 1}: Too many requests`);
        }
        
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
      const envMessage = isDevMode ? 
        'Development environment detected: NHC API blocks localhost requests due to CORS policy. This is normal - use CORS proxies or demo data.' : 
        'Production environment: Browser-based apps cannot directly access NHC API due to CORS restrictions. Using CORS proxy services.';
      throw new Error(`${envMessage} Try requesting access to CORS proxy services or use demo data.`);
    } else if (lastError?.code === 'ECONNABORTED') {
      throw new Error('Connection timeout while fetching hurricane data. Try getting CORS proxy access first.');
    } else {
      const envNote = isDevMode ? ' (Development environment - consider using demo data)' : ' (Production environment - CORS proxy access may be needed)';
      throw new Error(`Unable to fetch live hurricane data: ${lastError?.message || 'Unknown error'}${envNote}. Try CORS proxy access or use demo data.`);
    }
  }

  /**
   * Get forecast track data for a specific storm
   */
  async getStormTrack(stormId: string): Promise<StormForecastPoint[]> {
    try {
      // First, try Lambda/proxy server approach
      const currentYear = new Date().getFullYear();
      const proxyData = await this.fetchWithLambdaFallback('track-kmz', { stormId, year: currentYear.toString() });
      if (proxyData) {
        console.log(`Successfully fetched track data via proxy server for ${stormId}`);
        return proxyData; // This is already parsed GeoJSON from the Lambda function
      }

      // Fall back to CORS proxies
      console.log(`Falling back to CORS proxies for forecast track: ${stormId}`);
      const year = new Date().getFullYear()
      const baseUrl = `${NHC_BASE_URL}/gis/forecast/archive/${year}/${stormId.toUpperCase()}_5day_latest.geojson`
      
      const proxiesToTry = this.corsProxy ? [this.corsProxy] : CORS_PROXIES.slice(0, 3)
      
      for (const proxy of proxiesToTry) {
        try {
          const forecastUrl = `${proxy}${baseUrl}`
          console.log('Fetching forecast track from:', forecastUrl)
          
          const response = await axios.get(forecastUrl, {
            timeout: 8000,
            headers: { 
              'Accept': 'application/json'
            }
          })

          const result = this.parseForecastGeoJSON(response.data)
          if (result.length > 0) {
            console.log(`Successfully fetched ${result.length} forecast points for ${stormId}`)
            return result
          }
        } catch (error) {
          const err = error as any
          if (err.response?.status === 404) {
            console.log(`Forecast track file not found for ${stormId} (this is normal if no forecast is available)`)
            return []
          }
          console.warn(`Forecast track fetch failed with proxy ${proxy}:`, err.message)
          continue
        }
      }
      
      console.log(`No forecast track data available for storm ${stormId}`)
      return []
    } catch (error) {
      console.warn('Failed to fetch forecast track for', stormId, ':', error)
      return []
    }
  }

  /**
   * Get track data from KMZ file for a specific storm
   */
  async getStormTrackKmz(stormId: string): Promise<any> {
    try {
      // Use Lambda proxy to fetch and parse KMZ track data
      const currentYear = new Date().getFullYear();
      const proxyData = await this.fetchWithLambdaFallback('track-kmz', { stormId, year: currentYear.toString() });
      if (proxyData) {
        console.log(`Successfully fetched KMZ track data via proxy server for ${stormId}`);
        return proxyData; // This is already parsed GeoJSON from the Lambda function
      }

      console.log(`No KMZ track data available for storm ${stormId}`)
      return null;
    } catch (error) {
      console.warn('Failed to fetch KMZ track for', stormId, ':', error)
      return null;
    }
  }

  /**
   * Get forecast track data from KMZ file for a specific storm
   */
  async getStormForecastTrackKmz(stormId: string): Promise<any> {
    try {
      // Use Lambda proxy to fetch and parse forecast track KMZ data
      const proxyData = await this.fetchWithLambdaFallback('forecast-track-kmz', { stormId });
      if (proxyData) {
        console.log(`Successfully fetched forecast track KMZ data via proxy server for ${stormId}`);
        return proxyData; // This is already parsed GeoJSON from the Lambda function
      }

      console.log(`No forecast track KMZ data available for storm ${stormId}`)
      return null;
    } catch (error) {
      console.warn('Failed to fetch forecast track KMZ for', stormId, ':', error)
      return null;
    }
  }

  /**
   * Get storm forecast cone data
   */
  async getStormCone(stormId: string, coneUrl?: string): Promise<any> {
    try {
      console.log(`Fetching cone data for storm: ${stormId}`, coneUrl ? `using specific URL: ${coneUrl}` : 'using constructed URL');
      
      // If we have a specific cone URL, try to fetch it directly via Lambda
      if (coneUrl && coneUrl.includes('CONE')) {
        console.log(`Using specific cone URL: ${coneUrl}`);
        try {
          // For now, we'll still use the old Lambda endpoint but with the storm ID
          // In the future, we could enhance the Lambda to accept direct URLs
          const currentYear = new Date().getFullYear();
          const proxyData = await this.fetchWithLambdaFallback('forecast-cone', { stormId, year: currentYear.toString() });
          if (proxyData) {
            console.log(`Successfully fetched forecast cone via proxy server for ${stormId}:`, proxyData);
            return proxyData; // Lambda already parses KMZ to GeoJSON
          }
        } catch (urlError) {
          console.warn(`Failed to fetch cone from specific URL, falling back to constructed URL:`, urlError);
        }
      }
      
      // Fall back to constructed URL approach
      const currentYear = new Date().getFullYear();
      console.log(`Calling Lambda with stormId: ${stormId}, year: ${currentYear}`);
      
      const proxyData = await this.fetchWithLambdaFallback('forecast-cone', { stormId, year: currentYear.toString() });
      if (proxyData) {
        console.log(`Successfully fetched forecast cone via proxy server for ${stormId}:`, proxyData);
        return proxyData; // Lambda already parses KMZ to GeoJSON
      }

      // If Lambda fails, try direct access (this likely won't work due to CORS)
      console.log(`Lambda failed, trying direct access for forecast cone: ${stormId}`);
      const directUrl = `https://www.nhc.noaa.gov/storm_graphics/api/${stormId.toUpperCase()}_CONE_latest.kmz`
      
      try {
        const response = await axios.get(directUrl, {
          timeout: 8000,
          responseType: 'arraybuffer',
          headers: { 
            'Accept': 'application/vnd.google-earth.kmz'
          }
        })
        
        // This will likely fail due to CORS, but we'll try anyway
        console.log(`Direct cone access succeeded for ${stormId}`)
        return null; // We can't parse KMZ on client side without additional libraries
      } catch (directError) {
        console.log(`Direct cone access failed for ${stormId} (expected due to CORS):`, (directError as Error).message)
      }
      
      console.log(`No forecast cone data available for storm ${stormId}`)
      return null
    } catch (error) {
      console.warn('Failed to fetch forecast cone for', stormId, ':', error)
      return null
    }
  }

  /**
   * Parse cone GeoJSON data from NHC
   */
  private parseConeGeoJSON(geoJsonData: any): any {
    try {
      // Handle proxy-wrapped responses
      let data = geoJsonData
      if (data && data.contents && typeof data.contents === 'string') {
        try {
          data = JSON.parse(data.contents)
        } catch (parseError) {
          console.warn('Failed to parse proxy-wrapped GeoJSON:', parseError)
          return null
        }
      }

      if (!data || !data.features) {
        console.warn('Invalid GeoJSON data for cone - no features found')
        return null
      }

      // Find the cone polygon (usually the first feature)
      const coneFeature = data.features.find((feature: any) => 
        feature.geometry && 
        (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')
      )

      if (!coneFeature) {
        console.warn('No polygon found in cone GeoJSON')
        return null
      }

      const coords = coneFeature.geometry.coordinates
      const props = coneFeature.properties || {}

      return {
        type: coneFeature.geometry.type,
        coordinates: coords,
        properties: {
          stormName: props.STORMNAME || props.NAME,
          advisoryNumber: props.ADVISNUM || props.ADVNUM,
          stormType: props.STORMTYPE || props.TYPE,
          validTime: props.VALIDTIME || props.DTG,
          basin: props.BASIN
        }
      }
    } catch (error) {
      console.error('Error parsing cone GeoJSON:', error)
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
            coneUrl: (storm as any).trackCone?.kmzFile || ''
          };

          // Fetch forecast, historical, and cone data (but don't fail if they're unavailable)
          if (this.fetchTrackData) {
            try {
              console.log(`Attempting to fetch track data for storm: ${storm.name} (${storm.id || storm.binNumber})`)
              
              const [trackData, coneData, forecastTrackData] = await Promise.allSettled([
                this.getStormTrackKmz(storm.id || storm.binNumber || ''),
                this.getStormCone(storm.id || storm.binNumber || '', (storm as any).trackCone?.kmzFile),
                this.getStormForecastTrackKmz(storm.id || storm.binNumber || '')
              ]);
              
              // Handle track data (from KMZ)
              if (trackData.status === 'fulfilled') {
                processedStorm.track = trackData.value;
              } else {
                console.warn(`Track data failed for ${storm.name}:`, trackData.reason?.message);
                processedStorm.track = null;
              }
              
              // Handle cone data
              if (coneData.status === 'fulfilled') {
                console.log(`Cone data fetched successfully for ${storm.name} (${storm.id}):`, coneData.value);
                processedStorm.cone = coneData.value;
              } else {
                console.warn(`Cone data failed for ${storm.name} (${storm.id}):`, coneData.reason?.message);
                processedStorm.cone = null;
              }
              
              // Handle forecast track data (from KMZ)
              if (forecastTrackData.status === 'fulfilled') {
                processedStorm.forecastTrack = forecastTrackData.value;
              } else {
                console.warn(`Forecast track data failed for ${storm.name}:`, forecastTrackData.reason?.message);
                processedStorm.forecastTrack = null;
              }
              
              console.log(`Storm ${storm.name}: ${processedStorm.forecast.length} forecast points, ${processedStorm.historical.length} historical points, cone: ${processedStorm.cone ? 'available' : 'not available'}, forecastTrack: ${processedStorm.forecastTrack ? 'available' : 'not available'}`);
            } catch (error) {
              console.warn(`Failed to fetch any track data for ${storm.name}:`, error);
              // Set defaults
              processedStorm.forecast = [];
              processedStorm.historical = [];
              processedStorm.cone = null;
              processedStorm.forecastTrack = null;
            }
          } else {
            console.log(`Skipping track data fetch for ${storm.name} (track data fetching disabled)`);
            // Set defaults when track data fetching is disabled
            processedStorm.forecast = [];
            processedStorm.historical = [];
            processedStorm.cone = null;
            processedStorm.forecastTrack = null;
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
      // Handle proxy-wrapped responses
      let data = geoJsonData
      if (data && data.contents && typeof data.contents === 'string') {
        try {
          data = JSON.parse(data.contents)
        } catch (parseError) {
          console.warn('Failed to parse proxy-wrapped GeoJSON:', parseError)
          return []
        }
      }

      if (!data || !data.features) {
        console.warn('Invalid GeoJSON data for forecast - no features found')
        return []
      }

      const forecastPoints: StormForecastPoint[] = []

      data.features.forEach((feature: any) => {
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
      // Handle proxy-wrapped responses
      let data = geoJsonData
      if (data && data.contents && typeof data.contents === 'string') {
        try {
          data = JSON.parse(data.contents)
        } catch (parseError) {
          console.warn('Failed to parse proxy-wrapped GeoJSON:', parseError)
          return []
        }
      }

      if (!data || !data.features) {
        console.warn('Invalid GeoJSON data for historical track - no features found')
        return []
      }

      const historicalPoints: StormHistoricalPoint[] = []

      data.features.forEach((feature: any) => {
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
  }  /**
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
   * Fetch storm surge data from NHC API (KMZ/GeoJSON)
   * Storm surge data is primarily available for Atlantic storms that threaten populated areas
   */
  async getStormSurge(stormId: string, useProxy = true): Promise<any | null> {
    // Storm surge is primarily available for Atlantic storms (AL prefix)
    if (!stormId.toUpperCase().startsWith('AL')) {
      console.log('Storm surge data is typically only available for Atlantic storms (AL prefix)')
      return null
    }

    try {
      console.log(`Fetching storm surge for ${stormId} using Lambda API...`)
      
      // Use Lambda function to fetch storm surge data
      const proxyData = await this.fetchWithLambdaFallback('storm-surge', { stormId })
      
      if (proxyData) {
        console.log('Successfully fetched storm surge data via Lambda:', proxyData)
        return proxyData
      } else {
        console.log('No storm surge data returned from Lambda for storm:', stormId)
        return null
      }
    } catch (error: any) {
      console.log('Storm surge data not available for storm:', stormId, error.message)
      if (error.response?.status === 404) {
        console.log('Storm surge KMZ file not found - this is normal for storms that don\'t threaten populated coastlines')
      }
      return null
    }
  }

  /**
   * Fetch wind speed probability data from NHC API (KMZ/GeoJSON)
   * This shows the probability of experiencing winds of specified speed over the next 120 hours
   * @param windSpeed - Wind speed threshold: '34kt', '50kt', or '64kt'
   */
  async getWindSpeedProbability(windSpeed: '34kt' | '50kt' | '64kt' = '34kt'): Promise<any | null> {
    try {
      console.log(`Fetching ${windSpeed} wind speed probability data using Lambda API...`)
      
      // Determine the endpoint based on wind speed
      let endpoint = 'wind-speed-probability';
      if (windSpeed === '50kt') {
        endpoint = 'wind-speed-probability-50kt';
      } else if (windSpeed === '64kt') {
        endpoint = 'wind-speed-probability-64kt';
      }
      
      // Use Lambda function to fetch wind speed probability data
      const proxyData = await this.fetchWithLambdaFallback(endpoint, {})
      
      if (proxyData) {
        console.log(`Successfully fetched ${windSpeed} wind speed probability data via Lambda:`, proxyData)
        return proxyData
      } else {
        console.log(`No ${windSpeed} wind speed probability data returned from Lambda`)
        return null
      }
    } catch (error: any) {
      console.log(`${windSpeed} wind speed probability data not available:`, error.message)
      if (error.response?.status === 404) {
        console.log(`${windSpeed} wind speed probability KMZ file not found`)
      }
      return null
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
   * Fetch spaghetti model tracks from NOAA NOMADS
   * This fetches real ensemble forecast data from multiple models
   */
  /**
   * Simulate NOAA model track based on real meteorological patterns
   * In production, this would parse actual GRIB2 data from NOMADS
   */
  /**
   * Get latest model file for NOMADS query
   */
  private getLatestModelFile(modelName: string): string {
    const now = new Date()
    const hour = Math.floor(now.getUTCHours() / 6) * 6 // Round to nearest 6-hour cycle
    const hourStr = hour.toString().padStart(2, '0')
    
    switch (modelName) {
      case 'GFS':
        return `gfs.t${hourStr}z.pgrb2.0p25.f000`
      case 'NAM':
        return `nam.t${hourStr}z.awphys.grb2.tm00`
      case 'HWRF':
        return `hwrf.t${hourStr}z.storm.grb2`
      default:
        return `gfs.t${hourStr}z.pgrb2.0p25.f000`
    }
  }

  /**
   * Get model directory for NOMADS
   */
  private getModelDirectory(modelName: string): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const hour = Math.floor(new Date().getUTCHours() / 6) * 6
    const hourStr = hour.toString().padStart(2, '0')
    
    switch (modelName) {
      case 'GFS':
        return `/gfs.${today}/${hourStr}/atmos`
      case 'NAM':
        return `/nam.${today}`
      case 'HWRF':
        return `/hwrf.${today}`
      default:
        return `/gfs.${today}/${hourStr}/atmos`
    }
  }

  /**
   * Generate a synthetic model track with variations
   */
  private generateModelTrack(storm: any, modelName: string, variation: number, seed?: number) {
    const basePosition = storm.position
    
    console.log(`Generating ${modelName} track for storm:`, { 
      id: storm.id, 
      name: storm.name, 
      position: basePosition,
      forecast: storm.forecast?.length || 0,
      movement: storm.movement 
    })
    
    // Validate base position
    if (!basePosition || !Array.isArray(basePosition) || basePosition.length < 2) {
      console.warn(`Invalid base position for storm ${storm.name} in ${modelName}:`, basePosition)
      return []
    }
    
    // Validate coordinates
    const lat = parseFloat(basePosition[0])
    const lon = parseFloat(basePosition[1])
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.warn(`Invalid coordinates for ${storm.name} ${modelName}: lat=${lat}, lon=${lon}`)
      return []
    }
    
    const forecastHours = [0, 12, 24, 36, 48, 72, 96, 120] // Added 0 hour for current position
    
    // Try to derive movement from storm's actual forecast data if available
    let baseLatMovement = 1.0  // Default northward movement
    let baseLonMovement = -1.5 // Default westward movement
    
    if (storm.forecast && storm.forecast.length > 1) {
      // Calculate movement from actual forecast data
      const firstForecast = storm.forecast[0]
      const secondForecast = storm.forecast[1]
      
      if (firstForecast && secondForecast && 
          firstForecast.position && secondForecast.position &&
          Array.isArray(firstForecast.position) && Array.isArray(secondForecast.position)) {
        
        const lat1 = parseFloat(firstForecast.position[0])
        const lon1 = parseFloat(firstForecast.position[1])
        const lat2 = parseFloat(secondForecast.position[0])
        const lon2 = parseFloat(secondForecast.position[1])
        
        if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
          baseLatMovement = (lat2 - lat1) * 2 // Scale up for 12-hour intervals
          baseLonMovement = (lon2 - lon1) * 2
          console.log(`Using actual forecast movement for ${storm.name}: lat=${baseLatMovement.toFixed(2)}, lon=${baseLonMovement.toFixed(2)}`)
        }
      }
    } else if (storm.movement) {
      // Use movement data if available
      if (storm.movement.direction && storm.movement.speed) {
        const direction = parseFloat(storm.movement.direction) // degrees
        const speed = parseFloat(storm.movement.speed) // mph or knots
        
        if (!isNaN(direction) && !isNaN(speed)) {
          // Convert direction and speed to lat/lon movement per 12 hours
          const radians = (direction * Math.PI) / 180
          const movementPerHour = speed * 0.014483 // Rough conversion from mph to degrees per hour
          const movement12h = movementPerHour * 12
          
          baseLatMovement = Math.cos(radians) * movement12h
          baseLonMovement = Math.sin(radians) * movement12h
          console.log(`Using movement vector for ${storm.name}: ${direction}° at ${speed} mph`)
        }
      }
    }
    
    // Storm-specific position adjustments based on location
    if (lat > 30) { // Northern storms tend to curve more
      baseLatMovement *= 0.8
      baseLonMovement *= 1.2
    } else if (lat < 15) { // Southern storms move more west
      baseLatMovement *= 1.2
      baseLonMovement *= 0.8
    }
    
    // Model-specific biases and variations (improved for more realistic spread)
    const modelVariations: Record<string, { latBias: number, lonBias: number, speedBias: number }> = {
      'GFS': { latBias: 0.2, lonBias: -0.3, speedBias: 1.1 },
      'ECMWF': { latBias: -0.2, lonBias: 0.2, speedBias: 0.9 },
      'HWRF': { latBias: 0.3, lonBias: -0.1, speedBias: 1.0 },
      'NAM': { latBias: -0.3, lonBias: 0.4, speedBias: 1.2 },
      'CMC': { latBias: 0.1, lonBias: -0.4, speedBias: 0.8 },
      'UKMET': { latBias: 0.0, lonBias: 0.1, speedBias: 0.95 },
      'NOGAPS': { latBias: -0.1, lonBias: -0.2, speedBias: 1.05 }
    }

    const modelVar = modelVariations[modelName] || { latBias: 0, lonBias: 0, speedBias: 1.0 }
    
    const track = forecastHours.map((hour, index) => {
      // For current position (hour 0), use exact storm position
      if (hour === 0) {
        return {
          lat: parseFloat(lat.toFixed(4)),
          lon: parseFloat(lon.toFixed(4)),
          forecastHour: hour,
          intensity: storm.maxWinds,
          dateTime: new Date().toISOString(),
          stormId: storm.id,
          stormName: storm.name
        }
      }
      
      // Use storm-specific movement calculated above
      const timeMultiplier = hour / 12 // Number of 12-hour periods
      const latMovement = baseLatMovement * timeMultiplier * modelVar.speedBias
      const lonMovement = baseLonMovement * timeMultiplier * modelVar.speedBias
      
      // Add model bias and some randomness for realistic uncertainty
      const randomFactor = 0.4 // Reduced to keep tracks closer to realistic paths
      // Use deterministic "randomness" based on seed if provided
      const seedOffset = seed ? (seed * (index + 1) * 1000) % 1 : Math.random()
      const seedOffset2 = seed ? (seed * (index + 2) * 1000) % 1 : Math.random()
      const modelLatBias = modelVar.latBias + (seedOffset - 0.5) * randomFactor
      const modelLonBias = modelVar.lonBias + (seedOffset2 - 0.5) * randomFactor
      
      // Add some curvature for realistic tracks (storms often curve)
      const curvature = Math.sin((index - 1) * 0.3) * 0.3 // Reduced for more realistic curves
      
      const finalLat = lat + latMovement + modelLatBias + curvature
      const finalLon = lon + lonMovement + modelLonBias
      
      // Ensure coordinates stay within valid bounds
      const validLat = Math.max(-90, Math.min(90, finalLat))
      const validLon = Math.max(-180, Math.min(180, finalLon))
      
      return {
        lat: parseFloat(validLat.toFixed(4)),
        lon: parseFloat(validLon.toFixed(4)),
        forecastHour: hour,
        intensity: Math.max(30, storm.maxWinds + (Math.random() - 0.5) * 20), // Vary intensity
        dateTime: new Date(Date.now() + hour * 60 * 60 * 1000).toISOString()
      }
    })

    return track
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

  /**
   * Get wind arrival data for a specific storm
   */
  async getWindArrival(stormId: string, arrivalType: 'most-likely' | 'earliest' = 'most-likely', useProxy = true): Promise<any | null> {
    try {
      // Use Lambda proxy to fetch wind arrival KMZ data
      const endpoint = arrivalType === 'most-likely' ? 'wind-arrival-most-likely' : 'wind-arrival-earliest';
      return await this.fetchWithLambdaFallback(endpoint, { stormId });

    } catch (error) {
      console.error(`Error fetching wind arrival data for storm ${stormId}:`, error);
      return null;
    }
  }

  /**
   * Simple hash function for creating deterministic seeds from strings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483648; // Normalize to 0-1 range
  }
}

export default NHCApiService
