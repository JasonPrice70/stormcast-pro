const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY

export function cartoTileUrl(style: string): string {
  const key = cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : ''
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png${key}`
}