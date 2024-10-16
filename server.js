const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Function to fetch and extract data from a single car info page
async function fetchCarInsuranceDetails(carNumber, retries = 3) {
  const url = `https://www.carinfo.app/car-insurance/${carNumber}`;

  try {
    const response = await axios.get(url);
    const html = response.data;

    // Load the HTML into cheerio
    const $ = cheerio.load(html);

    // Extract details like expiry date and insurance company name
    const expiryDate = $('p.css-1led9nl').first().text();  // First occurrence for expiry date
    const insuranceCompany = $('p.css-1led9nl').eq(1).text();  // Second occurrence for insurance company

    // Return the extracted details
    return {
      carNumber: carNumber,
      expiryDate: expiryDate,
      insuranceCompany: insuranceCompany
    };
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying for ${carNumber}... (${3 - retries + 1} attempt)`);
      // Wait for 2 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      return fetchCarInsuranceDetails(carNumber, retries - 1);
    } else {
      console.error(`Error fetching details for ${carNumber}:`, error.message);

      // Log failed car number to a file
      fs.appendFileSync('failed-car-numbers-data.txt', `${carNumber}\n`);

      return null;
    }
  }
}

// Function to add delay between requests
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to iterate over multiple car numbers with batching
async function fetchDetailsInBatches(carNumbers, batchSize = 100, delayBetweenBatches = 5000) {
  let results = [];

  for (let i = 0; i < carNumbers.length; i += batchSize) {
    const batch = carNumbers.slice(i, i + batchSize);

    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(carNumbers.length / batchSize)}`);

    const batchResults = await fetchDetailsForMultipleCars(batch);

    results = results.concat(batchResults);

    // Delay between batches to avoid overwhelming the server
    await delay(delayBetweenBatches);
  }

  return results;
}

// Function to iterate over multiple car numbers with a delay
async function fetchDetailsForMultipleCars(carNumbers) {
  const results = [];

  // Loop over car numbers and fetch details for each one with delay
  for (let i = 0; i < carNumbers.length; i++) {
    const details = await fetchCarInsuranceDetails(carNumbers[i]);

    if (details) {
      results.push(details);
    }

    // Add a delay of 1 second between requests to avoid overwhelming the server
    await delay(1000);
  }

  return results;
}

// Function to save results to a JSON file
function saveResultsToFile(results) {
  fs.writeFileSync('car-insurance-data.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Data exported to car_insurance_data.json');
}

// Read car numbers from the file
fs.readFile('car-number-data.txt', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  // Split the file content by new lines to get an array of car numbers
  const carNumbers = data.split('\n').map(carNumber => carNumber.trim()).filter(Boolean);

  // Fetch details for all car numbers in batches
  fetchDetailsInBatches(carNumbers, 100, 5000).then(results => {
    saveResultsToFile(results);
    // Optionally, you can also handle the failed requests here if needed
  });
});
