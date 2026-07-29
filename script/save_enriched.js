// Save enriched leads to an enriched group on the backend
// Usage: docker cp save_enriched.js lead-scraper-backend:/app/
//        docker exec -w /app lead-scraper-backend node save_enriched.js "CityName" "ServiceType" Port
// Examples:
//   node save_enriched.js "Toronto" "HVAC" 4000
//   node save_enriched.js "Vancouver" "Property Management" 4005

const D = require('better-sqlite3');
const db = new D('/app/data/leads.db');
const http = require('http');

const city = process.argv[2] || 'Unknown';
const service = process.argv[3] || 'HVAC';
const port = parseInt(process.argv[4] || '4000', 10);

// Save ALL completed leads — pipeline already cleaned the table
const leads = db.prepare("SELECT id, business_name as businessName, phone, website, address, city, rating, reviews, category, email, enriched_email as enrichedEmail FROM leads WHERE enrichment_status = 'complete'").all();
const d = new Date().toISOString().split('T')[0];
const name = city + ' ' + service + ' - ' + d;

console.log('Saving', leads.length, 'enriched leads for', name);

const payload = JSON.stringify({ listName: name, leads: leads });
const opts = {
  hostname: 'localhost',
  port: port,
  path: '/api/enriched-groups',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};
const req = http.request(opts, (res) => {
  let s = '';
  res.on('data', c => s += c);
  res.on('end', () => console.log('Saved:', s));
});
req.on('error', e => console.error(e));
req.write(payload);
req.end();
