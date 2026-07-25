---
name: hvac-lead-pipeline
description: HVAC lead pipeline - search, enrich, save
trigger: "run the hvac pipeline in [city]"
---

# HVAC Lead Pipeline

## Keywords
- HVAC
- HVAC contractor
- heating and cooling
- furnace repair
- AC repair
- air conditioning repair
- duct cleaning
- furnace installation
- heat pump
- boiler repair
- mechanical contractor
- ventilation
- commercial HVAC

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

Search page, scrape page, and enriched businesses page are all clean before the new city run.

## 2. Search
For each keyword POST to the backend API. **From the host** (bash script): use `http://172.18.0.3:4000/api/search`. **From inside the container**: use `http://localhost:4000/api/search`.

```json
{"keyword":"[KEYWORD]","location":"[CITY], [PROVINCE], Canada","country":"Canada","maxResults":500}
```

Run one at a time with 30s sleep between each. Wait 120s after the last keyword for async searches to finish.

## Province by city
- Ontario cities (Brampton, Hamilton, Mississauga, Toronto, Ottawa, London, Windsor, Kitchener): `[CITY], Ontario, Canada`
- Quebec cities (Quebec City, Montreal, Laval, Gatineau): `[CITY], Quebec, Canada`
- British Columbia (Surrey, Vancouver, Burnaby, Richmond): `[CITY], British Columbia, Canada`

## 3. Dedup

```
docker exec lead-scraper-backend sh -c "sqlite3 /app/data/leads.db 'DELETE FROM leads WHERE id NOT IN (SELECT MIN(id) FROM leads GROUP BY business_name);'"
```

Keeps the first occurrence of each business name, deletes the rest.

## 4. Export pending
```
docker exec lead-scraper-backend sh -c "sqlite3 -json /app/data/leads.db 'SELECT id, business_name as businessName, phone, website, address, city, rating, reviews, category FROM leads WHERE enrichment_status='\"'\"'pending'\"'\"' ORDER BY id;' > /tmp/pending_leads.json"
```

## 5. Enrich
```
docker exec lead-scraper-backend sh -c "node -e \"const fs=require('fs');const http=require('http');const leads=JSON.parse(fs.readFileSync('/tmp/pending_leads.json','utf8'));const payload=JSON.stringify({leads:leads});const opts={hostname:'localhost',port:4000,path:'/api/enrich/batch',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(d))});req.on('error',e=>console.error(e));req.write(payload);req.end()\""
```

## 6. Save to enriched-groups — target city only

POST only the **current city's** enriched leads to `/api/enriched-groups`. Name format: `[City] HVAC - [Date]`.

```
docker exec lead-scraper-backend sh -c "node -e \"const D=require('better-sqlite3');const db=new D('/app/data/leads.db');const city='[CITY]';const leads=db.prepare('SELECT id,business_name as businessName,phone,website,address,city,rating,reviews,category,email,enriched_email as enrichedEmail FROM leads WHERE city=?').all(city);const d=new Date().toISOString().split('T')[0];const name=city+' HVAC - '+d;const http=require('http');const payload=JSON.stringify({listName:name,leads:leads});const opts={hostname:'localhost',port:4000,path:'/api/enriched-groups',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}};const req=http.request(opts,(res)=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>console.log('Saved:',s))});req.on('error',e=>console.error(e));req.write(payload);req.end()\""
```

## 7. Report
```
docker exec lead-scraper-backend sh -c "sqlite3 -header -column /app/data/leads.db \"SELECT COUNT(*) as total, SUM(CASE WHEN email!='' OR enriched_email!='' THEN 1 ELSE 0 END) as has_email, SUM(CASE WHEN website!='' THEN 1 ELSE 0 END) as has_website FROM leads;\""
```

## 8. Push to GitHub repo

After every pipeline run, export enriched leads to CSV and push to `Steve-reyes/hvac-enriched-leads`. Use `script/push_enriched.sh`.

## Pitfalls
- Alpine containers have no bash — use `sh` not `bash`, no arrays, use `IFS` with delimiter
- Port mismatch: inside container use port 4000, from host use 4000 (VPS1) or 4005 (VPS3)
- Use `docker cp` + `.js` files for complex node queries to avoid quote nesting hell
- Search is async — POST returns immediately, check `docker logs` for `[GMaps] Done`
- Browserless must be running on VPS3 — `docker compose up -d browserless`
- Concurrency=4 is safe. Concurrency=6 caused issues on VPS3.
- Enrichment is slow (~5-10 leads/min on VPS1)
