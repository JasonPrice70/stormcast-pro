// Debug invest data fetching
console.log('=== Invest Data Debug ===');

// Import the NHC API service
import('../src/services/nhcApi').then(({ default: NHCApiService }) => {
  const nhcApi = new NHCApiService(true, false);
  
  console.log('Fetching invest areas...');
  
  nhcApi.getInvestAreas().then(invests => {
    console.log('Invest areas received:', invests);
    console.log('Number of invests:', invests.length);
    
    invests.forEach((invest, index) => {
      console.log(`\nInvest ${index + 1}:`);
      console.log(`  ID: ${invest.id}`);
      console.log(`  Name: ${invest.name}`);
      console.log(`  Basin: ${invest.basin}`);
      console.log(`  Position: [${invest.position[0]}, ${invest.position[1]}]`);
      console.log(`  48hr chance: ${invest.formationChance48hr}%`);
      console.log(`  7-day chance: ${invest.formationChance7day}%`);
      console.log(`  Location: ${invest.location}`);
      console.log(`  Description: ${invest.description.substring(0, 100)}...`);
    });
  }).catch(error => {
    console.error('Error fetching invest areas:', error);
  });
  
  // Also test the tropical weather outlook directly
  console.log('\nFetching tropical weather outlook for Atlantic...');
  nhcApi.getTropicalWeatherOutlookForBasin('atlantic').then(outlook => {
    console.log('Atlantic outlook:', outlook);
    if (outlook) {
      console.log('Invest areas in outlook:', outlook.investAreas.length);
      outlook.investAreas.forEach((invest, index) => {
        console.log(`  ${index + 1}. ${invest.name} - ${invest.formationChance7day}% (7-day)`);
      });
    }
  }).catch(error => {
    console.error('Error fetching Atlantic outlook:', error);
  });
});
