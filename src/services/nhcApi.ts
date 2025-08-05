import axios from 'axios'
import { NHCActiveStorms, NHCStorm, ProcessedStorm } from '../types/nhc'

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
          return this.processStormData(response.data.activeStorms);
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
            return this.processStormData(stormData.activeStorms);
          } 
          // Direct array format
          else if (Array.isArray(stormData)) {
            return this.processStormData(stormData);
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
  async getStormTrack(stormId: string): Promise<[number, number][]> {
    try {
      // NHC provides GeoJSON track data
      const trackUrl = `${this.corsProxy}${GIS_BASE_URL}/forecast/archive/${new Date().getFullYear()}/${stormId}_5day_latest.kml`
      
      // For now, return processed coordinates
      // In a real implementation, you'd parse the KML/GeoJSON data
      return this.parseTrackData(trackUrl)
    } catch (error) {
      console.error('Error fetching storm track:', error)
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
  private processStormData(storms: NHCStorm[]): ProcessedStorm[] {
    console.log('Processing storm data:', storms);
    
    if (!Array.isArray(storms)) {
      console.warn('Expected array of storms, got:', typeof storms, storms);
      return [];
    }

    try {
      return storms.map((storm, index) => {
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
          forecast: [], // Will be populated by getStormTrack
          advisoryUrl: storm.publicAdvisory?.url || '',
          trackUrl: storm.track?.url || '',
          coneUrl: storm.cone?.url || ''
        };

        console.log(`Processed storm:`, processedStorm);
        return processedStorm;
      });
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
   * Parse track data from KML/GeoJSON
   */
  private async parseTrackData(trackUrl: string): Promise<[number, number][]> {
    try {
      // In a real implementation, you'd parse KML or fetch GeoJSON
      // For now, returning sample coordinates
      console.log('Parsing track data from:', trackUrl)
      
      // This would involve parsing XML/KML or fetching GeoJSON
      // and extracting coordinate pairs
      
      return [
        [25.5, -80.0],
        [26.2, -81.1],
        [27.0, -82.5],
        [28.1, -84.0],
        [29.5, -85.8]
      ]
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
          [25.5, -80.0],
          [26.2, -81.1],
          [27.0, -82.5],
          [28.1, -84.0],
          [29.5, -85.8]
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
