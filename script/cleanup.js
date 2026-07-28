// Clean enriched groups and saved lists from the backend API
// Usage: node cleanup.js [port]
// Default port: 4000
const http = require('http');
const PORT = parseInt(process.argv[2] || '4000', 10);

function del(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:'localhost',port:PORT,path,method:'DELETE'}, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:'localhost',port:PORT,path,method:'GET'}, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  // Delete enriched groups
  try {
    const groups = JSON.parse(await get('/api/enriched-groups'));
    for (const g of (groups.groups || [])) {
      await del('/api/enriched-groups/' + encodeURIComponent(g.listName));
      console.log('Deleted group:', g.listName);
    }
  } catch(e) { console.error('Groups error:', e.message); }

  // Delete saved lists
  try {
    const lists = JSON.parse(await get('/api/saved-lists'));
    for (const l of (lists.lists || [])) {
      await del('/api/saved-lists/' + encodeURIComponent(l.name));
      console.log('Deleted list:', l.name);
    }
  } catch(e) { console.error('Lists error:', e.message); }

  console.log('Cleanup done');
})();
