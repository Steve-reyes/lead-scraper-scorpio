---
name: property-manager-lead-pipeline
description: Property manager lead pipeline - search, enrich, save
trigger: "run the property manager pipeline in [city]"
---

# Property Manager Lead Pipeline

## Keywords
- property management
- property manager
- rental property management
- residential property management
- commercial property management
- condo management
- HOA management
- apartment management
- building management
- strata management
- letting agent
- landlord services
- tenant management

## 1. Clean — leads table + enriched groups + saved lists

Wipe **everything** so old city data doesn't mix with the new search.

```
# 1a. Clear leads table
docker exec lead-scraper-backend sh -c "sqlite3 /app/data/leads.db 'DELETE FROM leads;'"

# 1b. Clear enriched groups
docker exec lead-scraper-backend sh -c "node -e \"const http=require('http');const opts={hostname:'localhost',port:4000,path:'/api/enriched-groups',method:'GET'};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const g=JSON.parse(d).groups||[];g.forEach(gr=>{const del=http.request({hostname:'localhost',port:4000,path:'/api/enriched-groups/'+encodeURIComponent(gr.listName),method:'DELETE'},()=>{});del.end()})})});req.on('error',e=>console.error(e));req.end()\""

# 1c. Clear saved lists
docker exec lead-scraper-backend sh -c "node -e \"const http=require('http');const opts={hostname:'localhost',port:4000,path:'/api/saved-lists',method:'GET'};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const l=JSON.parse(d).lists||[];l.forEach(lst=>{const del=http.request({hostname:'localhost',port:4000,path:'/api/saved-lists/'+encodeURIComponent(lst.name),method:'DELETE'},()=>{});del.end()})})});req.on('error',e=>console.error(e));req.end()\""
```

## 2. Search
For each keyword POST to the backend API. Use `http://172.18.0.3:4000/api/search` from host, `http://localhost:4000/api/search` from inside container.

```json
{"keyword":"[KEYWORD]","location":"[CITY], [PROVINCE], Canada","country":"Canada","maxResults":500}
```

30s sleep between each keyword. 120s final wait.

## 3. Dedup
```
docker exec lead-scraper-backend sh -c "sqlite3 /app/data/leads.db 'DELETE FROM leads WHERE id NOT IN (SELECT MIN(id) FROM leads GROUP BY business_name);'"
```

## 4. Export pending
```
docker exec lead-scraper-backend sh -c "sqlite3 -json /app/data/leads.db 'SELECT id, business_name as businessName, phone, website, address, city, rating, reviews, category FROM leads WHERE enrichment_status='\"'\"'pending'\"'\"' ORDER BY id;' > /tmp/pending_leads.json"
```

## 5. Enrich
```
docker exec lead-scraper-backend sh -c "node -e \"const fs=require('fs');const http=require('http');const leads=JSON.parse(fs.readFileSync('/tmp/pending_leads.json','utf8'));const payload=JSON.stringify({leads:leads});const opts={hostname:'localhost',port:4000,path:'/api/enrich/batch',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(d))});req.on('error',e=>console.error(e));req.write(payload);req.end()\""
```

## 6. Save to enriched groups (city only)
Name format: `[City] Property Management - [Date]`.

```
docker exec lead-scraper-backend sh -c "node -e \"const D=require('better-sqlite3');const db=new D('/app/data/leads.db');const city='[CITY]';const leads=db.prepare('SELECT id,business_name as businessName,phone,website,address,city,rating,reviews,category,email,enriched_email as enrichedEmail FROM leads WHERE city=?').all(city);const d=new Date().toISOString().split('T')[0];const name=city+' Property Management - '+d;const http=require('http');const payload=JSON.stringify({listName:name,leads:leads});const opts={hostname:'localhost',port:4000,path:'/api/enriched-groups',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}};const req=http.request(opts,(res)=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>console.log('Saved:',s))});req.on('error',e=>console.error(e));req.write(payload);req.end()\""
```

## 7. Report
```
docker exec lead-scraper-backend sh -c "sqlite3 -header -column /app/data/leads.db \"SELECT COUNT(*) as total, SUM(CASE WHEN email!='' OR enriched_email!='' THEN 1 ELSE 0 END) as has_email, SUM(CASE WHEN website!='' THEN 1 ELSE 0 END) as has_website FROM leads;\""
```

## 8. Push to GitHub
Export to CSV and push to `Steve-reyes/hvac-enriched-leads`. Use `script/push_enriched.sh`.

## Script
Use `script/property-manager-pipeline.sh` — usage: `sh script/property-manager-pipeline.sh "City" VPS1 "City, Province, Canada"`

## Pitfalls
Same as HVAC pipeline - Alpine shell vs bash, port mapping, quote escaping, browserless dependency, slow enrichment. See `skill/hvac-lead-pipeline/SKILL.md` for full details.
