// Export pending leads and trigger enrichment batch
const D = require('better-sqlite3');
const db = new D('/app/data/leads.db');
const fs = require('fs');
const http = require('http');

const leads = db.prepare("SELECT id, business_name as businessName, phone, website, address, city, rating, reviews, category FROM leads WHERE enrichment_status='pending' ORDER BY id").all();
console.log('Pending leads:', leads.length);

fs.writeFileSync('/tmp/pending_leads.json', JSON.stringify(leads));

const payload = JSON.stringify({leads: leads});
const opts = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/enrich/batch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};
const req = http.request(opts, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('Response:', d));
});
req.on('error', e => console.error('Error:', e.message));
req.write(payload);
req.end();
