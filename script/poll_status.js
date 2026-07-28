const D = require('better-sqlite3');
const db = new D('/app/data/leads.db');
const r = db.prepare('SELECT enrichment_status, COUNT(*) as cnt FROM leads GROUP BY enrichment_status').all();
const left = r.reduce((a,x) => a + (x.enrichment_status!='complete' && x.enrichment_status!='failed' ? x.cnt : 0), 0);
const e = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN email!='' OR enriched_email!='' THEN 1 ELSE 0 END) as emails FROM leads").all();
console.log(left + ' remaining | ' + e[0].emails + '/' + e[0].total + ' emails');
