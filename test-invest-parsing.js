// Test file to demonstrate invest area parsing
import NHCApiService from '../src/services/nhcApi'

// Sample tropical weather outlook text with invest areas
const sampleOutlookText = `
Tropical Weather Outlook
NWS National Hurricane Center Miami FL
800 PM EDT Thu Sep 4 2025

For the North Atlantic...Caribbean Sea and the Gulf of Mexico:

1. Tropical Atlantic (AL91):
A broad area of low pressure, associated with a tropical wave, is producing a concentrated but still disorganized area of showers and thunderstorms over the eastern tropical Atlantic near 12.5N 45.2W. Environmental conditions are favorable for development of this system, and a tropical depression is likely to form by this weekend as it moves slowly westward at 5 to 10 mph across the central tropical Atlantic.
* Formation chance through 48 hours...medium...60 percent.
* Formation chance through 7 days...high...90 percent.

2. Eastern Atlantic:
A tropical wave located over the far eastern Atlantic near 8.0N 25.5W is producing limited shower activity. Development of this system is not expected during the next several days as it moves westward across the Atlantic.
* Formation chance through 48 hours...low...10 percent.
* Formation chance through 7 days...low...20 percent.

Forecaster Berg
`

// Test the parsing function
console.log('Testing Invest Area Parsing:')
console.log('==========================')

const nhcApi = new NHCApiService()
const outlook = nhcApi.parseTropicalWeatherOutlook(sampleOutlookText, 'atlantic')

console.log('Parsed Outlook:', outlook)
console.log('Number of Invest Areas:', outlook.investAreas.length)

outlook.investAreas.forEach((invest, index) => {
  console.log(`\nInvest ${index + 1}:`)
  console.log(`  ID: ${invest.id}`)
  console.log(`  Name: ${invest.name}`)
  console.log(`  Location: ${invest.location}`)
  console.log(`  Position: ${invest.position}`)
  console.log(`  48hr chance: ${invest.formationChance48hr}%`)
  console.log(`  7-day chance: ${invest.formationChance7day}%`)
  console.log(`  Description: ${invest.description.substring(0, 100)}...`)
})
