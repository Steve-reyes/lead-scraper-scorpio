#!/bin/sh
# HVAC Lead Pipeline — POSIX sh (runs on Alpine/busybox)
# Usage: sh hvac-pipeline.sh "City" "VPS1|VPS3" "Province, Canada"
#   City:     "Halifax"
#   VPS:      VPS1 (local) or VPS3 (remote)
#   Location: "Halifax, Nova Scotia, Canada" (default: "[City], Ontario, Canada")
# Example: sh hvac-pipeline.sh "Brampton" VPS1
# Example: sh hvac-pipeline.sh "Saskatoon" VPS3 "Saskatoon, Saskatchewan, Canada"

CITY="$1"
VPS="${2:-VPS1}"
LOCATION="${3:-$CITY, Ontario, Canada}"

if [ -z "$CITY" ]; then
  echo "Usage: sh hvac-pipeline.sh \"City\" [VPS1|VPS3] [\"Location\"]"
  echo "Example: sh hvac-pipeline.sh \"Brampton\" VPS1"
  echo "Example: sh hvac-pipeline.sh \"Saskatoon\" VPS3 \"Saskatoon, Saskatchewan, Canada\""
  exit 1
fi

# VPS-specific settings
if [ "$VPS" = "VPS3" ]; then
  API="http://127.0.0.1:4005"
  BCK="lead-scraper-v3-backend"
  INT_PORT=4000
else
  API="http://172.18.0.3:4000"
  BCK="lead-scraper-backend"
  INT_PORT=4000
fi

SERVICE="HVAC"
echo "=== $SERVICE PIPELINE: $CITY ($VPS) ==="
echo ""

# --- STEP 1: CLEAN ---
echo "=== 1/7: CLEAN ==="
echo "  leads table..."
docker exec $BCK sh -c "sqlite3 /app/data/leads.db 'DELETE FROM leads;'"
echo "  enriched groups..."
docker exec $BCK sh -c "node -e \"const http=require('http');const opts={hostname:'localhost',port:$INT_PORT,path:'/api/enriched-groups',method:'GET'};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{(JSON.parse(d).groups||[]).forEach(g=>{http.request({hostname:'localhost',port:$INT_PORT,path:'/api/enriched-groups/'+encodeURIComponent(g.listName),method:'DELETE'}).end()})})});req.end()\\\""
echo "  saved lists..."
docker exec $BCK sh -c "node -e \"const http=require('http');const opts={hostname:'localhost',port:$INT_PORT,path:'/api/saved-lists',method:'GET'};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{(JSON.parse(d).lists||[]).forEach(l=>{http.request({hostname:'localhost',port:$INT_PORT,path:'/api/saved-lists/'+encodeURIComponent(l.name),method:'DELETE'}).end()})})});req.end()\\\""
echo "  Done"

# --- STEP 2: SEARCH ---
echo "=== 2/7: SEARCH 13 KEYWORDS ==="
KW_LIST="HVAC|HVAC contractor|heating and cooling|furnace repair|AC repair|air conditioning repair|duct cleaning|furnace installation|heat pump|boiler repair|mechanical contractor|ventilation|commercial HVAC"
OLD_IFS="$IFS"
IFS="|"
for kw in $KW_LIST; do
  echo "  > $kw"
  curl -s -X POST "$API/api/search" \
    -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"location\":\"$LOCATION\",\"country\":\"Canada\",\"maxResults\":500}" -o /dev/null
  sleep 30
done
IFS="$OLD_IFS"
echo "  Waiting 120s for last searches to finish..."
sleep 120
echo "  Done"

# --- STEP 3: DEDUP ---
echo "=== 3/7: DEDUP ==="
docker exec $BCK sh -c "sqlite3 /app/data/leads.db 'DELETE FROM leads WHERE id NOT IN (SELECT MIN(id) FROM leads GROUP BY business_name);'"
COUNT=$(docker exec $BCK sh -c "sqlite3 /app/data/leads.db 'SELECT COUNT(*) FROM leads;'")
echo "  Leads: $COUNT"

# --- STEP 4: EXPORT ---
echo "=== 4/7: EXPORT ==="
docker exec $BCK sh -c "sqlite3 -json /app/data/leads.db \"SELECT id, business_name as businessName, phone, website, address, city, rating, reviews, category FROM leads WHERE enrichment_status='pending' ORDER BY id;\" > /tmp/pending_leads.json"
echo "  Exported"

# --- STEP 5: ENRICH ---
echo "=== 5/7: ENRICH ==="
docker exec $BCK sh -c "node -e \"const fs=require('fs');const http=require('http');const leads=JSON.parse(fs.readFileSync('/tmp/pending_leads.json','utf8'));console.log('  Enriching',leads.length,'leads');const payload=JSON.stringify({leads:leads});const opts={hostname:'localhost',port:$INT_PORT,path:'/api/enrich/batch',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}};const req=http.request(opts,(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log('  Response:',d))});req.on('error',e=>console.error(e));req.write(payload);req.end()\\\""

echo "  Polling enrichment..."
docker exec $BCK sh -c "cat > /tmp/check_status.js << 'SCRIPT'
const D=require('better-sqlite3');
const db=new D('/app/data/leads.db');
const r=db.prepare('SELECT enrichment_status, COUNT(*) as cnt FROM leads GROUP BY enrichment_status').all();
const left=r.reduce((a,x)=>a+(x.enrichment_status!='complete'&&x.enrichment_status!='failed'?x.cnt:0),0);
const e=db.prepare(\"SELECT COUNT(*) as total, SUM(CASE WHEN email!='' OR enriched_email!='' THEN 1 ELSE 0 END) as emails FROM leads\").all();
console.log(left+' remaining | '+e[0].emails+'/'+e[0].total+' emails');
SCRIPT"

for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  sleep 30
  STATUS=$(docker exec -w /app $BCK node /tmp/check_status.js 2>&1)
  echo "  [$(date '+%H:%M')] $STATUS"
  LEFT=$(echo "$STATUS" | grep -o '^[0-9]*')
  if [ "$LEFT" = "0" ]; then
    echo "  Enrichment complete"
    break
  fi
done

# --- STEP 6: SAVE TO ENRICHED GROUPS (city only) ---
echo "=== 6/7: SAVE TO ENRICHED GROUPS ==="
docker exec $BCK sh -c "node -e \"const D=require('better-sqlite3');const db=new D('/app/data/leads.db');const leads=db.prepare('SELECT id,business_name as businessName,phone,website,address,city,rating,reviews,category,email,enriched_email as enrichedEmail FROM leads WHERE city=?').all('$CITY');const d=new Date().toISOString().split('T')[0];const name='$CITY $SERVICE - '+d;const http=require('http');const payload=JSON.stringify({listName:name,leads:leads});const opts={hostname:'localhost',port:$INT_PORT,path:'/api/enriched-groups',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}};const req=http.request(opts,(res)=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>console.log('  Saved:',s))});req.on('error',e=>console.error(e));req.write(payload);req.end()\\\""

# --- STEP 7: REPORT ---
echo "=== 7/7: REPORT ==="
docker exec -w /app $BCK node -e "
const D=require('better-sqlite3');
const db=new D('/app/data/leads.db');
const city='$CITY';
const t=db.prepare('SELECT COUNT(*) as cnt FROM leads WHERE city=?').get(city);
const e=db.prepare(\"SELECT COUNT(*) as cnt FROM leads WHERE city=? AND (email!='' OR enriched_email!='')\").get(city);
const w=db.prepare(\"SELECT COUNT(*) as cnt FROM leads WHERE city=? AND website!=''\").get(city);
console.log('$CITY - TOTAL:'+t.cnt+'|EMAILS:'+e.cnt+'|WEBSITES:'+w.cnt);
"
echo ""
echo "=== $CITY PIPELINE DONE ==="
