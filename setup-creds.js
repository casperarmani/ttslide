// Script to help set Google Application Default Credentials
const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine where the ADC file should be stored
const credentialsPath = path.resolve(process.cwd(), 'credentials.json');
console.log(`Looking for credentials file at: ${credentialsPath}`);

if (!fs.existsSync(credentialsPath)) {
  console.error('Error: credentials.json file not found in the project root.');
  console.error('Please create a service account key file named credentials.json in the project root.');
  process.exit(1);
}

// Set the environment variable
process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

console.log(`GOOGLE_APPLICATION_CREDENTIALS has been set to: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
console.log('You can now start your application, and it will use these credentials.');

// Add this to your package.json scripts:
// "dev-with-creds": "node setup-creds.js && next dev --turbopack"