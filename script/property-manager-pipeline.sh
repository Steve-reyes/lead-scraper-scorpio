#!/bin/sh
# Property Manager Lead Pipeline — POSIX sh (runs on Alpine/busybox)
# Usage: sh property-manager-pipeline.sh "Label" "VPS1|VPS3" "Location" "RadiusKm"
#   Label:    Name for the saved group (e.g. "Nanaimo Vancouver")
#   VPS:      VPS1 (local) or VPS3 (remote)
#   Location: "2250 Nanaimo Street, Vancouver, BC" or "Vancouver, Ontario, Canada" (default: "[Label], Ontario, Canada")
#   Radius:   Radius in km (default: empty = city-wide, max 50)
# Example: sh property-manager-pipeline.sh "Toronto" VPS1
# Example: sh property-manager-pipeline.sh "Nanaimo Vancouver" VPS1 "2250 Nanaimo Street, Vancouver, BC" 10

CITY="$1"
VPS="${2:-VPS1}"
LOCATION="${3:-$CITY, Ontario, Canada}"
RADIUS="${4:-}"

if [ -z "$CITY" ]; then
  echo "Usage: sh property-manager-pipeline.sh \"Label\" [VPS1|VPS3] [\"Location\"] [RadiusKm]"
  echo "Example: sh property-manager-pipeline.sh \"Toronto\" VPS1"
  echo "Example: sh property-manager-pipeline.sh \"Nanaimo Vancouver\" VPS1 \"2250 Nanaimo Street, Vancouver, BC\" 10"
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

SERVICE="Property Management"
echo "=== $SERVICE PIPELINE: $CITY ($VPS) ==="
echo ""

# Copy helper scripts into container
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
for js in cleanup.js trigger_enrich.js poll_status.js save_enriched.js; do
  if [ -f "$SCRIPT_DIR/$js" ]; then
    docker cp "$SCRIPT_DIR/$js" $BCK:/app/ 2>/dev/null && echo "  Copied $js"
  fi
done

# --- STEP 1: CLEAN ---
echo "=== 1/7: CLEAN ==="
echo "  leads table..."
docker exec $BCK sh -c "sqlite3 /app/data/leads.db 'DELETE FROM leads;'"
echo "  enriched groups + saved lists..."
docker exec -w /app $BCK node cleanup.js
echo "  Done"

# --- STEP 2: SEARCH ---
echo "=== 2/7: SEARCH 13 KEYWORDS ==="
KW_LIST="property management|property manager|rental property management|residential property management|commercial property management|condo management|HOA management|apartment management|building management|strata management|letting agent|landlord services|tenant management"
OLD_IFS="$IFS"
IFS="|"
for kw in $KW_LIST; do
  echo "  > $kw"
  RADIUS_JSON=""
  if [ -n "$RADIUS" ]; then
    RADIUS_JSON=",\"radius\":$RADIUS"
  fi
  curl -s -X POST "$API/api/search" \
    -H "Content-Type: application/json" \
    -d "{\"keyword\":\"$kw\",\"location\":\"$LOCATION\",\"country\":\"Canada\",\"maxResults\":500$RADIUS_JSON}" -o /dev/null
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
docker exec -w /app $BCK node trigger_enrich.js
sleep 5

echo "  Polling enrichment..."
i=0
while [ $i -lt 100 ]; do
  i=$((i + 1))
  sleep 30
  STATUS=$(docker exec -w /app $BCK node poll_status.js 2>&1)
  echo "  [$(date '+%H:%M')] $STATUS"
  LEFT=$(echo "$STATUS" | grep -o '^[0-9]*')
  if [ "$LEFT" = "0" ]; then
    echo "  Enrichment complete"
    break
  fi
done

# --- STEP 6: SAVE TO ENRICHED GROUPS (city only) ---
echo "=== 6/7: SAVE TO ENRICHED GROUPS ==="
docker exec -w /app $BCK node save_enriched.js "$CITY" "Property Management" $INT_PORT

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

# --- STEP 8: PUSH TO GITHUB ---
echo "=== 8/8: PUSH TO GITHUB ==="
bash /root/property-management-enriched-leads/push_pm_enriched.sh "$CITY" "${VPS#VPS}" 2>&1
echo ""
echo "=== $CITY PIPELINE FULLY DONE ==="
