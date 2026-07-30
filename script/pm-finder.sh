#!/bin/sh
# PM Finder — Standalone script version of pm-finder skill
# Usage: sh pm-finder.sh "Business Name or Address" "City"
# Example: sh pm-finder.sh "1370 Nanaimo St Vancouver" "Vancouver"
# Example: sh pm-finder.sh "Renzullo Food Market Plaza" "Vancouver"

ADDRESS="$1"
CITY="${2:-Vancouver}"
LABEL="$(echo "$ADDRESS" | tr ' ' '_' | tr -cd 'a-zA-Z0-9_-')"
API="http://172.18.0.3:4000"
BCK="lead-scraper-backend"

echo "=== PM FINDER: $ADDRESS ==="
echo ""

# --- STEP 1: CLEAN ---
echo "=== 1/6: CLEAN DB ==="
docker exec $BCK sh -c 'sqlite3 /app/data/leads.db "DELETE FROM leads;"'
docker exec -w /app $BCK node cleanup.js 2>/dev/null
echo "  Done"

# --- STEP 2: SEARCH GOOGLE MAPS ---
echo "=== 2/6: SEARCH ADDRESS ON GOOGLE MAPS ==="

# Search 1: exact address
echo "  > Searching: \"$ADDRESS\""
curl -s -X POST "$API/api/search" \
  -H "Content-Type: application/json" \
  -d "{\"keyword\":\"$ADDRESS\",\"location\":\"$CITY\",\"country\":\"Canada\",\"maxResults\":20}" -o /dev/null
echo "  Waiting 35s..."
sleep 35

# Search 2: address + property management
echo "  > Searching: \"$ADDRESS property management\""
curl -s -X POST "$API/api/search" \
  -H "Content-Type: application/json" \
  -d "{\"keyword\":\"$ADDRESS property management\",\"location\":\"$CITY\",\"country\":\"Canada\",\"maxResults\":20}" -o /dev/null
echo "  Waiting 35s..."
sleep 35

echo "  Done"

# --- STEP 3: CHECK RESULTS ---
echo "=== 3/6: CHECK RESULTS ==="
COUNT=$(docker exec $BCK sh -c 'sqlite3 /app/data/leads.db "SELECT COUNT(*) FROM leads;"')
echo "  Leads found: $COUNT"
docker exec $BCK sh -c "sqlite3 -json /app/data/leads.db \"SELECT id, business_name, address, city, rating, category FROM leads ORDER BY id;\"" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for r in data:
        addr = (r.get('address') or '')[:60]
        print(f\"  {r['id']:>5} | {r['business_name'][:40]:40s} | {r.get('city',''):12s}\")
        if addr: print(f'         → {addr}')
except: pass
" 2>/dev/null

# --- STEP 4: ENRICH ---
echo "=== 4/6: ENRICH ==="
docker exec -w /app $BCK node trigger_enrich.js 2>&1 | tail -1

echo "  Polling enrichment..."
i=0
while [ $i -lt 30 ]; do
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

# --- STEP 5: EXPORT ENRICHED DATA ---
echo "=== 5/6: EXPORT CSV ==="

# Export enriched data
docker exec $BCK sh -c "sqlite3 -json /app/data/leads.db \"SELECT id, business_name, address, email, enriched_email, phone, website, city, rating, category FROM leads ORDER BY id;\"" 2>/dev/null > /tmp/pm_raw.json

# Generate CSV with analysis
python3 -c "
import sys, json

with open('/tmp/pm_raw.json') as f:
    data = json.load(f)

target_addr = '$ADDRESS'.lower()
target_words = set(target_addr.replace(',', ' ').split())

rows = []
for r in data:
    name = r.get('business_name', '')
    email = r.get('enriched_email', '') or r.get('email', '') or ''
    phone = r.get('phone', '') or ''
    website = r.get('website', '') or ''
    addr = r.get('address', '') or ''
    city = r.get('city', '') or ''
    rating = r.get('rating', '') or ''
    category = r.get('category', '') or ''

    # Clean phone — ignore junk
    clean_phone = phone.strip()
    digits = ''.join(filter(str.isdigit, clean_phone))
    if len(digits) > 15 or len(digits) < 7:
        clean_phone = ''

    # Determine proximity
    addr_lower = addr.lower()
    proximity = 'NEARBY'

    # Check if address matches target
    if any(w in addr_lower for w in ['1370', 'renzullo'] if len(w) > 3):
        proximity = 'TARGET'
    elif any(w in addr_lower for w in ['1269', 'darell', 'barry'] if len(w) > 3):
        proximity = 'ADJACENT'
    else:
        # Check if on same street
        for w in target_words:
            if w in addr_lower and len(w) > 4:
                proximity = 'SAME STREET'
                break

    # Score: valid phone = real contact
    has_real_phone = '✓' if clean_phone else ''

    rows.append({
        'business_name': name,
        'email': email,
        'phone': clean_phone,
        'website': website,
        'address': addr[:100],
        'city': city,
        'rating': rating,
        'category': category,
        'proximity_notes': proximity,
        'comments': f'Phone: {has_real_phone}'
    })

# Sort: target first, then adjacent, then rest
priority = {'TARGET': 0, 'ADJACENT': 1, 'SAME STREET': 2, 'NEARBY': 3}
rows.sort(key=lambda x: priority.get(x['proximity_notes'], 99))

# Write CSV
import csv
with open('/tmp/pm_finder_output.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['business_name','email','phone','website','address','city','rating','category','proximity_notes','comments'])
    for r in rows:
        w.writerow([r['business_name'], r['email'], r['phone'], r['website'],
                    r['address'], r['city'], r['rating'], r['category'],
                    r['proximity_notes'], r['comments']])

print(f'  CSV: /tmp/pm_finder_output.csv ({len(rows)} rows)')
for r in rows[:5]:
    marker = '→' if r['proximity_notes'] in ('TARGET','ADJACENT') else ' '
    print(f'  {marker} [{r[\"proximity_notes\"]:12s}] {r[\"business_name\"][:40]}')
"

echo "  Done"

# --- STEP 6: PUSH TO PM REPO ---
echo "=== 6/6: PUSH TO PM REPO ==="
PM_DIR="/root/property-management-enriched-leads"

cp /tmp/pm_finder_output.csv "$PM_DIR/${LABEL}_pm_research.csv"

cd "$PM_DIR"
git add -A 2>/dev/null
git commit -m "pm research - $ADDRESS" 2>/dev/null
git push origin main 2>&1 | tail -1

echo ""
echo "=== PM FINDER DONE: $ADDRESS ==="
echo "CSV: $PM_DIR/${LABEL}_pm_research.csv"
