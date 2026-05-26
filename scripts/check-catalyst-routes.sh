#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CATALYST_BASE_URL:-https://zyba-costumer-app-915232350.development.catalystserverless.com/server/Zoho_api}"
TRIP_ID="${HOTELS_TRIP_ID:-6623116000003137040}"

check_json_contains() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local response

  response="$(curl -sS "$url")"

  if [[ "$response" != *"$expected"* ]]; then
    echo "FAIL: $label"
    echo "URL: $url"
    echo "Expected fragment: $expected"
    echo "Response:"
    echo "$response"
    exit 1
  fi

  echo "OK: $label"
}

echo "Checking Catalyst backend routes"
echo "Base URL: $BASE_URL"
echo

check_json_contains "health route" "$BASE_URL/health" '"ok": true'
check_json_contains "existing CRM route guard" "$BASE_URL/crm/trips" '"error": "Unauthorized"'
check_json_contains "hotels route guard" "$BASE_URL/crm/hotels?tripId=$TRIP_ID" '"error": "Unauthorized"'
check_json_contains "orders route guard" "$BASE_URL/crm/orders" '"error": "Unauthorized"'
check_json_contains "products route guard" "$BASE_URL/crm/products" '"error": "Unauthorized"'

echo
echo "Catalyst route check passed."
