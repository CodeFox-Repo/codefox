# Backend API Tests

This directory contains automated tests for the CodeFox backend API.

## Test Scripts

### Quick Smoke Test (Recommended for CI/CD)
```bash
./quick-test.sh
```
- Fast execution (< 10 seconds)
- Tests core authentication flow
- No AI API calls required
- Auto cleanup

### Full API Test
```bash
./test-api.sh
```
- Complete API coverage
- Includes project creation (requires OPENROUTER_API_KEY)
- Tests all endpoints
- Auto cleanup

## Documentation

See [TEST_API_DOCS.md](./TEST_API_DOCS.md) for complete API documentation and test details.

## Usage

```bash
# Navigate to test directory
cd test

# Run quick test
./quick-test.sh

# Run full test
./test-api.sh

# Use custom backend URL
BACKEND_URL=http://localhost:3000 ./quick-test.sh
```

## Requirements

- Backend server running
- `jq` installed (for JSON parsing)
- `curl` installed
- PostgreSQL database configured

## Test Coverage

### Quick Test
- ✅ Health check
- ✅ User registration
- ✅ User login
- ✅ Get current user
- ✅ Available models
- ✅ Auto cleanup

### Full Test
All of the above plus:
- ✅ Token refresh
- ✅ Create project (with AI)
- ✅ Get user projects
- ✅ Get specific project
- ✅ REST chat API
- ✅ Get user chats
- ✅ Delete project
- ✅ Delete user account
