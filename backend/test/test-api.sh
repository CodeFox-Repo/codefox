#!/bin/bash

# CodeFox Backend API Test Script
# This script tests all backend endpoints and cleans up after testing

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
GRAPHQL_URL="${BACKEND_URL}/graphql"
REST_URL="${BACKEND_URL}/api"

# Test data
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="testpass123"
TEST_USERNAME="testuser$(date +%s)"

# Global variables
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""
PROJECT_ID=""
CHAT_ID=""

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

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

# Test functions

test_health() {
    log_info "Testing health check..."
    local response=$(curl -s "${BACKEND_URL}")
    if [ -n "$response" ]; then
        log_info "✓ Health check passed"
    else
        log_error "✗ Health check failed"
        exit 1
    fi
}

test_register() {
    log_info "Testing user registration..."

    local query='mutation RegisterUser($input: RegisterUserInput!) {
        registerUser(input: $input) {
            id
            email
            username
        }
    }'

    local variables="{\"input\": {\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"confirmPassword\": \"$TEST_PASSWORD\", \"username\": \"$TEST_USERNAME\"}}"

    local response=$(graphql_query "$query" "$variables")

    USER_ID=$(echo "$response" | jq -r '.data.registerUser.id')

    if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
        log_info "✓ Registration successful. User ID: $USER_ID"
    else
        log_error "✗ Registration failed: $response"
        exit 1
    fi
}

test_login() {
    log_info "Testing user login..."

    local query='mutation Login($input: LoginUserInput!) {
        login(input: $input) {
            accessToken
            refreshToken
        }
    }'

    local variables="{\"input\": {\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}}"

    local response=$(graphql_query "$query" "$variables")

    ACCESS_TOKEN=$(echo "$response" | jq -r '.data.login.accessToken')
    REFRESH_TOKEN=$(echo "$response" | jq -r '.data.login.refreshToken')

    if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
        log_info "✓ Login successful"
        log_info "  Access Token: ${ACCESS_TOKEN:0:20}..."
    else
        log_error "✗ Login failed: $response"
        exit 1
    fi
}

test_me() {
    log_info "Testing 'me' query..."

    local query='query Me {
        me {
            id
            email
            username
        }
    }'

    local response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")

    local user_email=$(echo "$response" | jq -r '.data.me.email')

    if [ "$user_email" == "$TEST_EMAIL" ]; then
        log_info "✓ Me query successful"
    else
        log_error "✗ Me query failed: $response"
        exit 1
    fi
}

test_refresh_token() {
    log_info "Testing token refresh..."

    local query='mutation RefreshToken($refreshToken: String!) {
        refreshToken(refreshToken: $refreshToken) {
            accessToken
            refreshToken
        }
    }'

    local variables="{\"refreshToken\": \"$REFRESH_TOKEN\"}"

    local response=$(graphql_query "$query" "$variables")

    local new_token=$(echo "$response" | jq -r '.data.refreshToken.accessToken')

    if [ -n "$new_token" ] && [ "$new_token" != "null" ]; then
        ACCESS_TOKEN="$new_token"
        log_info "✓ Token refresh successful"
    else
        log_error "✗ Token refresh failed: $response"
        exit 1
    fi
}

test_create_project() {
    log_info "Testing project creation..."

    local query='mutation CreateProject($createProjectInput: CreateProjectInput!) {
        createProject(createProjectInput: $createProjectInput) {
            id
            project {
                id
                projectName
            }
        }
    }'

    local variables='{
        "createProjectInput": {
            "description": "A simple todo app with React for testing",
            "packages": [
                {"name": "react", "version": "^18.0.0"},
                {"name": "typescript", "version": "^5.0.0"}
            ],
            "model": "claude-sonnet-4.5"
        }
    }'

    local response=$(graphql_query "$query" "$variables" "$ACCESS_TOKEN")

    CHAT_ID=$(echo "$response" | jq -r '.data.createProject.id')
    PROJECT_ID=$(echo "$response" | jq -r '.data.createProject.project.id')

    if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
        log_info "✓ Project creation successful. Project ID: $PROJECT_ID"
        log_info "  Chat ID: $CHAT_ID"
    else
        log_error "✗ Project creation failed: $response"
        exit 1
    fi
}

test_get_user_projects() {
    log_info "Testing get user projects..."

    local query='query GetUserProjects {
        getUserProjects {
            id
            projectName
        }
    }'

    local response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")

    local projects=$(echo "$response" | jq -r '.data.getUserProjects | length')

    if [ "$projects" -ge 1 ]; then
        log_info "✓ Get user projects successful. Found $projects project(s)"
    else
        log_error "✗ Get user projects failed: $response"
        exit 1
    fi
}

test_get_project() {
    log_info "Testing get specific project..."

    local query='query GetProject($projectId: String!) {
        getProject(projectId: $projectId) {
            id
            projectName
        }
    }'

    local variables="{\"projectId\": \"$PROJECT_ID\"}"

    local response=$(graphql_query "$query" "$variables" "$ACCESS_TOKEN")

    local project_id=$(echo "$response" | jq -r '.data.getProject.id')

    if [ "$project_id" == "$PROJECT_ID" ]; then
        log_info "✓ Get project successful"
    else
        log_error "✗ Get project failed: $response"
        exit 1
    fi
}

test_chat_rest_api() {
    log_info "Testing REST chat API (non-streaming)..."

    local response=$(curl -s -X POST "${REST_URL}/chat" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"chatId\": \"$CHAT_ID\", \"message\": \"Hello, test message\", \"model\": \"claude-sonnet-4.5\", \"stream\": false}")

    local content=$(echo "$response" | jq -r '.content')

    if [ -n "$content" ] && [ "$content" != "null" ]; then
        log_info "✓ REST chat API successful"
    else
        log_error "✗ REST chat API failed: $response"
        exit 1
    fi
}

test_get_chats() {
    log_info "Testing get user chats..."

    local query='query GetUserChats {
        getUserChats {
            id
            project {
                id
                projectName
            }
        }
    }'

    local response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")

    local chats=$(echo "$response" | jq -r '.data.getUserChats | length')

    if [ "$chats" -ge 1 ]; then
        log_info "✓ Get user chats successful. Found $chats chat(s)"
    else
        log_error "✗ Get user chats failed: $response"
        exit 1
    fi
}

test_available_models() {
    log_info "Testing available models query..."

    local query='query GetAvailableModelTags {
        getAvailableModelTags
    }'

    local response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")

    local models=$(echo "$response" | jq -r '.data.getAvailableModelTags | length')

    if [ "$models" -ge 1 ]; then
        log_info "✓ Available models query successful. Found $models model(s)"
    else
        log_error "✗ Available models query failed: $response"
        exit 1
    fi
}

# Cleanup functions

cleanup_project() {
    if [ -n "$PROJECT_ID" ]; then
        log_info "Deleting test project..."

        local query='mutation DeleteProject($projectId: String!) {
            deleteProject(projectId: $projectId)
        }'

        local variables="{\"projectId\": \"$PROJECT_ID\"}"

        local response=$(graphql_query "$query" "$variables" "$ACCESS_TOKEN")

        local deleted=$(echo "$response" | jq -r '.data.deleteProject')

        if [ "$deleted" == "true" ]; then
            log_info "✓ Project deleted"
        else
            log_warning "⚠ Project deletion failed: $response"
        fi
    fi
}

cleanup_user() {
    if [ -n "$USER_ID" ]; then
        log_info "Logging out and cleaning up user session..."

        local query='query Logout {
            logout
        }'

        local response=$(graphql_query "$query" "{}" "$ACCESS_TOKEN")

        log_info "✓ User session cleaned up"

        # Delete test user via REST API
        log_info "Deleting test user account..."

        local delete_response=$(curl -s -X DELETE "${REST_URL}/test/user/${TEST_EMAIL}")
        local success=$(echo "$delete_response" | jq -r '.success')

        if [ "$success" == "true" ]; then
            log_info "✓ Test user account deleted successfully"
        else
            log_warning "⚠ User account deletion failed: $delete_response"
            log_warning "  Test user: $TEST_EMAIL (ID: $USER_ID)"
        fi
    fi
}

# Main test execution

main() {
    log_info "Starting CodeFox Backend API Tests"
    log_info "Backend URL: $BACKEND_URL"
    log_info "Test Email: $TEST_EMAIL"
    echo ""

    # Health check
    test_health
    echo ""

    # Authentication flow
    test_register
    test_login
    test_me
    test_refresh_token
    echo ""

    # Project operations
    test_create_project
    test_get_user_projects
    test_get_project
    echo ""

    # Chat operations
    test_chat_rest_api
    test_get_chats
    echo ""

    # Model operations
    test_available_models
    echo ""

    # Cleanup
    log_info "Starting cleanup..."
    cleanup_project
    cleanup_user
    echo ""

    log_info "✅ All tests completed successfully!"
}

# Trap to ensure cleanup on script exit
trap 'log_error "Script interrupted. Running cleanup..."; cleanup_project; cleanup_user; exit 1' INT TERM

# Run main
main
