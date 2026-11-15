#!/usr/bin/env bash
# Curl matrix for the three endpoints and every rule in the technical test.
# Requires: API running on $BASE (default http://localhost:3000), seeded database, Node, Docker.
# Usage (Git Bash, from the project root): bash scripts/api-curl-matrix.sh
set -u

BASE=${BASE:-http://localhost:3000}
cd "$(dirname "$0")/.." || exit 1

PASS=0
FAIL=0

# Buyers from scripts/seed.ts style ids (any uuid works for the token subject).
MIN_ID=c0000000-0000-0000-0000-000000000001
MAY_ID=c0000000-0000-0000-0000-000000000002
FAB_ID=c0000000-0000-0000-0000-000000000003
MIN=$(npm run -s token -- NIVEL_2_MINORISTA "$MIN_ID" | tail -1)
MAY=$(npm run -s token -- NIVEL_1_MAYORISTA "$MAY_ID" | tail -1)
FAB=$(npm run -s token -- NIVEL_0_FABRICANTE "$FAB_ID" | tail -1)

TOR=00000000-0000-0000-0000-000000000001
TAL=00000000-0000-0000-0000-000000000002
UNKNOWN=00000000-0000-0000-0000-0000000000ff
JSON='Content-Type: application/json'
uuid() { node -e "console.log(require('crypto').randomUUID())"; }

# expect <name> <status> <must-contain|-> <must-NOT-contain|-> <curl args...>
expect() {
  local name=$1 status=$2 must=$3 mustnot=$4
  shift 4
  local tmp got body ok=1
  tmp=$(mktemp)
  got=$(curl -s -o "$tmp" -w '%{http_code}' "$@")
  body=$(cat "$tmp")
  rm -f "$tmp"
  [ "$got" = "$status" ] || ok=0
  if [ "$must" != "-" ] && ! grep -q -F -- "$must" <<<"$body"; then ok=0; fi
  if [ "$mustnot" != "-" ] && grep -q -F -- "$mustnot" <<<"$body"; then ok=0; fi
  if [ $ok = 1 ]; then
    PASS=$((PASS + 1)); echo "PASS  $name [$got]"
  else
    FAIL=$((FAIL + 1)); echo "FAIL  $name: got $got, expected $status"
    echo "      body: $(cut -c1-300 <<<"$body")"
  fi
}

# ---------------------------------------------------------------- disposable lots
LOT=$(uuid)
LOT_CLOSED=$(uuid)
db() { docker compose exec -T db psql -U tmf -d tmf -q -c "$1" >/dev/null; }
db "INSERT INTO group_buy_lots (id, product_id, total_capacity, reserved, status) VALUES ('$LOT','$TOR',100,0,'ACTIVE'), ('$LOT_CLOSED','$TOR',100,0,'CLOSED')"
cleanup() {
  db "DELETE FROM reservations WHERE lot_id IN ('$LOT','$LOT_CLOSED'); DELETE FROM group_buy_lots WHERE id IN ('$LOT','$LOT_CLOSED')"
}
trap cleanup EXIT

echo "== 1. Catalog: guest sees public data only"
expect "C01 guest lists products"                200 '"sku":"TOR-001"' '-' "$BASE/api/catalog/products"
expect "C02 guest sees no stock"                 200 '-' '"stock"'     "$BASE/api/catalog/products"
expect "C03 guest sees no moq"                   200 '-' '"moq"'       "$BASE/api/catalog/products"
expect "C04 guest sees no tiers"                 200 '-' '"tiers"'     "$BASE/api/catalog/products"
expect "C05 guest text search matches sku"       200 '"sku":"TOR-001"' '-' "$BASE/api/catalog/products?text=TOR"
expect "C06 text with no match returns empty"    200 '"items":[]'      '-' "$BASE/api/catalog/products?text=zzzzz"
expect "C07 LIKE wildcard is matched literally"  200 '"items":[]'      '-' "$BASE/api/catalog/products?text=%25"
expect "C08 guest price filter min is rejected"  400 'PRICE_FILTER_NOT_ALLOWED' '-' "$BASE/api/catalog/products?minPrice=5"
expect "C09 guest price filter max is rejected"  400 'PRICE_FILTER_NOT_ALLOWED' '-' "$BASE/api/catalog/products?maxPrice=5"
expect "C10 limit above 100 is rejected"         400 '-' '-'           "$BASE/api/catalog/products?limit=101"
expect "C11 limit 0 is rejected"                 400 '-' '-'           "$BASE/api/catalog/products?limit=0"
expect "C12 negative offset is rejected"         400 '-' '-'           "$BASE/api/catalog/products?offset=-1"
expect "C13 text over 100 chars is rejected"     400 '-' '-'           "$BASE/api/catalog/products?text=$(printf 'a%.0s' {1..101})"
expect "C14 limit and offset paginate"           200 '"items"'         '-' "$BASE/api/catalog/products?limit=1&offset=1"

echo "== 2. Catalog: each level sees only its own prices"
expect "C15 minorista sees its tiers 850 and 720" 200 '"unitPriceCents":850}' '-' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?text=TOR"
expect "C16 minorista sees 720 tier"              200 '"unitPriceCents":720}' '-' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?text=TOR"
expect "C17 minorista does not see mayorista 780" 200 '-' '"unitPriceCents":780}' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?text=TOR"
expect "C18 minorista does not see mayorista 660" 200 '-' '"unitPriceCents":660}' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?text=TOR"
expect "C19 mayorista sees 780 and 660"           200 '"unitPriceCents":780}' '-' -H "Authorization: Bearer $MAY" "$BASE/api/catalog/products?text=TOR"
expect "C20 fabricante sees 600 and 540"          200 '"unitPriceCents":600}' '-' -H "Authorization: Bearer $FAB" "$BASE/api/catalog/products?text=TOR"
expect "C21 fabricante does not see minorista 850" 200 '-' '"unitPriceCents":850}' -H "Authorization: Bearer $FAB" "$BASE/api/catalog/products?text=TOR"
expect "C22 buyer sees stock"                    200 '"stock":5000' '-' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?text=TOR"
expect "C23 range 7-8 USD finds TOR (720 in range)" 200 '"sku":"TOR-001"' '-' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?minPrice=7&maxPrice=8"
expect "C24 range 8-8 USD: mayorista has no tier there" 200 '-' '"sku":"TOR-001"' -H "Authorization: Bearer $MAY" "$BASE/api/catalog/products?minPrice=8&maxPrice=8"
expect "C25 range 6-6 USD: minorista has no 600 tier" 200 '-' '"sku":"TOR-001"' -H "Authorization: Bearer $MIN" "$BASE/api/catalog/products?minPrice=6&maxPrice=6"
expect "C26 range 6-6 USD: fabricante finds TOR"  200 '"sku":"TOR-001"' '-' -H "Authorization: Bearer $FAB" "$BASE/api/catalog/products?minPrice=6&maxPrice=6"

echo "== 3. Authentication: invalid credentials are rejected"
expect "A01 altered signature"          401 'INVALID_TOKEN' '-' -H "Authorization: Bearer ${MIN}x" "$BASE/api/catalog/products"
expect "A02 Basic scheme"               401 'INVALID_TOKEN' '-' -H "Authorization: Basic abc" "$BASE/api/catalog/products"
expect "A03 empty bearer token"         401 'INVALID_TOKEN' '-' -H "Authorization: Bearer " "$BASE/api/catalog/products"
expect "A04 role GUEST inside a token"  401 'INVALID_TOKEN' '-' -H "Authorization: Bearer $(node scripts/forge-token.js guest-role)" "$BASE/api/catalog/products"
expect "A05 expired token"              401 'INVALID_TOKEN' '-' -H "Authorization: Bearer $(node scripts/forge-token.js expired)" "$BASE/api/catalog/products"
expect "A06 sub is not a uuid"          401 'INVALID_TOKEN' '-' -H "Authorization: Bearer $(node scripts/forge-token.js bad-sub)" "$BASE/api/catalog/products"
expect "A07 signed with another secret" 401 'INVALID_TOKEN' '-' -H "Authorization: Bearer $(node scripts/forge-token.js wrong-secret)" "$BASE/api/catalog/products"
expect "A08 alg none (unsigned)"        401 'INVALID_TOKEN' '-' -H "Authorization: Bearer $(node scripts/forge-token.js alg-none)" "$BASE/api/catalog/products"
expect "A09 token of a buyer on quotes works" 200 '"totalCents"' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":10}]}" "$BASE/api/quotes/calculate"

echo "== 4. Quotes: POST /api/quotes/calculate"
Q="$BASE/api/quotes/calculate"
expect "Q01 guest is refused"                       403 'BUYER_REQUIRED' '-' -H "$JSON" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":10}]}" "$Q"
expect "Q02 minorista 60 TOR = 720 x 60"            200 '"totalCents":43200' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":60}]}" "$Q"
expect "Q03 mayorista 60 TOR = 660 x 60"            200 '"totalCents":39600' '-' -H "$JSON" -H "Authorization: Bearer $MAY" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":60}]}" "$Q"
expect "Q04 fabricante 60 TOR = 540 x 60"           200 '"totalCents":32400' '-' -H "$JSON" -H "Authorization: Bearer $FAB" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":60}]}" "$Q"
expect "Q05 minorista 10 units use the 10-49 tier"  200 '"totalCents":8500'  '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":10}]}" "$Q"
expect "Q06 minorista 49 units still the 10-49 tier" 200 '"totalCents":41650' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":49}]}" "$Q"
expect "Q07 minorista 50 units switch to 720"        200 '"totalCents":36000' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":50}]}" "$Q"
expect "Q08 below MOQ (9 of 10) is rejected"         422 'BELOW_MOQ' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":9}]}" "$Q"
expect "Q09 below MOQ (1 of 2) for TAL is rejected"  422 'BELOW_MOQ' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TAL\",\"quantity\":1}]}" "$Q"
expect "Q10 exactly MOQ (2 of 2) for TAL is accepted" 200 '"totalCents":19000' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TAL\",\"quantity\":2}]}" "$Q"
expect "Q11 two products sum: 43200 + 19000"          200 '"totalCents":62200' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":60},{\"productId\":\"$TAL\",\"quantity\":2}]}" "$Q"
expect "Q12 same product twice is rejected"          400 'DUPLICATE_PRODUCT' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":10},{\"productId\":\"$TOR\",\"quantity\":10}]}" "$Q"
expect "Q13 unknown product is 404"                  404 'PRODUCT_NOT_FOUND' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$UNKNOWN\",\"quantity\":10}]}" "$Q"
expect "Q14 malformed productId is 400"              400 'must be a UUID' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d '{"items":[{"productId":"nope","quantity":10}]}' "$Q"
expect "Q15 empty items is 400"                      400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d '{"items":[]}' "$Q"
FIFTY_ONE=$(node -e "console.log(JSON.stringify({items: Array(51).fill({productId: '$TOR', quantity: 10})}))")
expect "Q16 more than 50 lines is 400"               400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "$FIFTY_ONE" "$Q"
expect "Q17 quantity 0 is 400"                       400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":0}]}" "$Q"
expect "Q18 quantity above 100000 is 400"            400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":100001}]}" "$Q"
expect "Q19 quantity as text is 400"                 400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":\"abc\"}]}" "$Q"
expect "Q20 unknown field (price) is 400"            400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d "{\"items\":[{\"productId\":\"$TOR\",\"quantity\":10,\"price\":1}]}" "$Q"
expect "Q21 malformed JSON is 400"                   400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d '{"items":' "$Q"
BIG_BODY=$(mktemp)
head -c 11000 /dev/zero | tr '\0' 'a' > "$BIG_BODY"
expect "Q22 body over 10 kB is 413"                  413 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" --data-binary "@$BIG_BODY" "$Q"
rm -f "$BIG_BODY"

echo "== 5. Group buying: POST /api/group-buying/:lotId/reserve"
R="$BASE/api/group-buying"
K1=$(uuid); K2=$(uuid); K3=$(uuid); K4=$(uuid); K5=$(uuid)
expect "G01 guest is refused"                        403 'BUYER_REQUIRED' '-' -H "$JSON" -H "Idempotency-Key: $K1" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G02 missing Idempotency-Key is 400"          400 'INVALID_IDEMPOTENCY_KEY' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G03 empty Idempotency-Key is 400"            400 'INVALID_IDEMPOTENCY_KEY' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key;" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G04 Idempotency-Key over 128 chars is 400"   400 'INVALID_IDEMPOTENCY_KEY' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $(printf 'k%.0s' {1..129})" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G05 Idempotency-Key with a space is 400"     400 'INVALID_IDEMPOTENCY_KEY' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: has space" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G06 malformed lotId is 400"                  400 'must be a UUID' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K1" -d '{"quantity":10}' "$R/nope/reserve"
expect "G07 unknown lot is 404"                      404 'LOT_NOT_FOUND' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K1" -d '{"quantity":10}' "$R/$UNKNOWN/reserve"
expect "G08 quantity 0 is 400"                       400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K1" -d '{"quantity":0}' "$R/$LOT/reserve"
expect "G09 quantity above 100000 is 400"            400 '-' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K1" -d '{"quantity":100001}' "$R/$LOT/reserve"
expect "G10 first reservation is 201 created"        201 '"replayed":false' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K2" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G11 same key again is 200 replayed"          200 '"replayed":true' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K2" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G12 same key, other quantity is 422"         422 'IDEMPOTENCY_KEY_REUSED' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K2" -d '{"quantity":11}' "$R/$LOT/reserve"
expect "G13 another buyer may reuse the same key"    201 '"replayed":false' '-' -H "$JSON" -H "Authorization: Bearer $MAY" -H "Idempotency-Key: $K2" -d '{"quantity":10}' "$R/$LOT/reserve"
expect "G14 90 more would exceed the cupo (20+90)"   409 'CAPACITY_EXCEEDED' '-' -H "$JSON" -H "Authorization: Bearer $FAB" -H "Idempotency-Key: $K3" -d '{"quantity":90}' "$R/$LOT/reserve"
expect "G15 80 more fills the lot exactly (20+80)"   201 '"replayed":false' '-' -H "$JSON" -H "Authorization: Bearer $FAB" -H "Idempotency-Key: $K4" -d '{"quantity":80}' "$R/$LOT/reserve"
expect "G16 new reservation on a full lot is 409"    409 'CAPACITY_EXCEEDED' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $K5" -d '{"quantity":1}' "$R/$LOT/reserve"
expect "G17 retry of the filling reservation is 200" 200 '"replayed":true' '-' -H "$JSON" -H "Authorization: Bearer $FAB" -H "Idempotency-Key: $K4" -d '{"quantity":80}' "$R/$LOT/reserve"
expect "G18 closed lot is 409"                       409 'LOT_NOT_ACTIVE' '-' -H "$JSON" -H "Authorization: Bearer $MIN" -H "Idempotency-Key: $(uuid)" -d '{"quantity":1}' "$R/$LOT_CLOSED/reserve"
expect "G19 guest on a closed lot is 403, not 409"   403 'BUYER_REQUIRED' '-' -H "$JSON" -H "Idempotency-Key: $(uuid)" -d '{"quantity":1}' "$R/$LOT_CLOSED/reserve"

echo "== 6. General HTTP behavior"
expect "H01 unknown route is 404"                    404 '-' '-' "$BASE/api/no-existe"
HEADERS=$(curl -s -D - -o /dev/null "$BASE/api/catalog/products")
if grep -qi '^x-content-type-options: nosniff' <<<"$HEADERS"; then PASS=$((PASS + 1)); echo "PASS  H02 helmet security headers present"; else FAIL=$((FAIL + 1)); echo "FAIL  H02 helmet header missing"; fi
if grep -qi '^x-powered-by' <<<"$HEADERS"; then FAIL=$((FAIL + 1)); echo "FAIL  H03 X-Powered-By is exposed"; else PASS=$((PASS + 1)); echo "PASS  H03 X-Powered-By hidden"; fi

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
