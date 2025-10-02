#!/bin/bash

# Quick smoke test for critical endpoints
# Tests only the essential flow without creating projects

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
GRAPHQL_URL="${BACKEND_URL}/graphql"

TEST_EMAIL="quicktest-$(date +%s)@example.com"
TEST_PASSWORD="testpass123"
TEST_USERNAME="quicktest$(date +%s)"

ACCESS_TOKEN=""
USER_ID=""

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

graphql_query() {
    local query="$1"
    local variables="$2"
    local token="$3"

    if [ -n "$token" ]; then
        curl -s -X POST "$GRAPHQL_URL" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${token}" \
            -d "$(jq -n --arg q "$query" --argjson v "$variables" '{query: $q, variables: $v}')"
    else
        curl -s -X POST "$GRAPHQL_URL" \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg q "$query" --argjson v "$variables" '{query: $q, variables: $v}')"
    fi
}

log_info "Quick Smoke Test Starting..."
echo ""

# Test 1: Health Check
log_info "1. Health check..."
response=$(curl -s "${BACKEND_URL}")
[ -n "$response" ] && log_info "✓ Backend is running" || { log_error "✗ Backend not responding"; exit 1; }

# Test 2: Register
log_info "2. User registration..."
query='mutation RegisterUser($input: RegisterUserInput!) {
    registerUser(input: $input) { id email username }
}'
variables="{\"input\": {\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"confirmPassword\": \"$TEST_PASSWORD\", \"username\": \"$TEST_USERNAME\"}}"
response=$(graphql_query "$query" "$variables")
USER_ID=$(echo "$response" | jq -r '.data.registerUser.id')
[ -n "$USER_ID" ] && [ "$USER_ID" != "null" ] && log_info "✓ Registration OK (ID: $USER_ID)" || { log_error "✗ Registration failed: $response"; exit 1; }

# Test 3: Login
log_info "3. User login..."
query='mutation Login($input: LoginUserInput!) {
    login(input: $input) { accessToken refreshToken }
}'
variables="{\"input\": {\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}}"
response=$(graphql_query "$query" "$variables")
ACCESS_TOKEN=$(echo "$response" | jq -r '.data.login.accessToken')
[ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ] && log_info "✓ Login OK" || { log_error "✗ Login failed: $response"; exit 1; }

# Test 4: Me Query
log_info "4. Get current user..."
query='query Me { me { id email username } }'
response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")
email=$(echo "$response" | jq -r '.data.me.email')
[ "$email" == "$TEST_EMAIL" ] && log_info "✓ Me query OK" || { log_error "✗ Me query failed: $response"; exit 1; }

# Test 5: Available Models
log_info "5. Get available models..."
query='query GetAvailableModelTags { getAvailableModelTags }'
response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")
models=$(echo "$response" | jq -r '.data.getAvailableModelTags | length')
[ "$models" -ge 1 ] && log_info "✓ Models query OK (found $models)" || { log_error "✗ Models query failed: $response"; exit 1; }

# Cleanup
log_info "6. Cleanup test user..."
query='query Logout { logout }'
graphql_query "$query" "{}" "$ACCESS_TOKEN" > /dev/null
delete_response=$(curl -s -X DELETE "${BACKEND_URL}/api/test/user/${TEST_EMAIL}")
success=$(echo "$delete_response" | jq -r '.success')
[ "$success" == "true" ] && log_info "✓ Cleanup OK" || log_info "⚠ Cleanup warning (manual cleanup may be needed)"

echo ""
log_info "✅ All smoke tests passed!"
