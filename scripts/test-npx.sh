#!/bin/bash

# TaskMaster npx Testing Script
# Tests the package as if it were installed via npx

set -e

echo "🧪 Testing TaskMaster npx functionality..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Test 1: Check binary permissions
print_status "Checking binary permissions..."
if [[ -x "bin/task-master.js" ]]; then
    print_success "bin/task-master.js is executable"
else
    print_error "bin/task-master.js is not executable"
    chmod +x bin/task-master.js
    print_warning "Fixed permissions for bin/task-master.js"
fi

if [[ -x "mcp-server/server.js" ]]; then
    print_success "mcp-server/server.js is executable"
else
    print_error "mcp-server/server.js is not executable"
    chmod +x mcp-server/server.js
    print_warning "Fixed permissions for mcp-server/server.js"
fi

# Test 2: Test basic command execution
print_status "Testing basic command execution..."
if node bin/task-master.js --version > /dev/null 2>&1; then
    VERSION=$(node bin/task-master.js --version)
    print_success "Version command works: $VERSION"
else
    print_error "Version command failed"
    exit 1
fi

# Test 3: Test help command
print_status "Testing help command..."
if node bin/task-master.js --help > /dev/null 2>&1; then
    print_success "Help command works"
else
    print_error "Help command failed"
    exit 1
fi

# Test 4: Test package contents
print_status "Checking package contents..."
if npm pack --dry-run > /dev/null 2>&1; then
    print_success "Package contents are valid"
    
    # Check for critical files
    PACK_OUTPUT=$(npm pack --dry-run 2>/dev/null)
    
    CRITICAL_FILES=(
        "bin/task-master.js"
        "mcp-server/server.js"
        "scripts/"
        "package.json"
        "README-task-master.md"
    )
    
    for file in "${CRITICAL_FILES[@]}"; do
        if echo "$PACK_OUTPUT" | grep -q "$file"; then
            print_success "Found critical file: $file"
        else
            print_error "Missing critical file: $file"
        fi
    done
    
    # Check for new feature files
    NEW_FILES=(
        "vscode-extension/"
        "schemas/"
        "VSCODE_INTEGRATION.md"
    )
    
    for file in "${NEW_FILES[@]}"; do
        if echo "$PACK_OUTPUT" | grep -q "$file"; then
            print_success "Found new feature file: $file"
        else
            print_warning "Missing new feature file: $file"
        fi
    done
    
else
    print_error "Package contents check failed"
    exit 1
fi

# Test 5: Create temporary test directory and test initialization
print_status "Testing project initialization..."
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

print_status "Testing in temporary directory: $TEST_DIR"

# Test init command
if node "$PROJECT_ROOT/bin/task-master.js" init --yes --name="Test Project" > /dev/null 2>&1; then
    print_success "Init command works"
    
    # Check if .taskmaster directory was created
    if [[ -d ".taskmaster" ]]; then
        print_success ".taskmaster directory created"
    else
        print_error ".taskmaster directory not created"
    fi
    
    # Check if config.json was created
    if [[ -f ".taskmaster/config.json" ]]; then
        print_success "config.json created"
    else
        print_error "config.json not created"
    fi
    
else
    print_error "Init command failed"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
fi

# Test 6: Test basic task operations
print_status "Testing basic task operations..."

# Add a task
if node "$PROJECT_ROOT/bin/task-master.js" add-task --title="Test Task" --description="Testing task creation" > /dev/null 2>&1; then
    print_success "Add task command works"
else
    print_error "Add task command failed"
fi

# List tasks
if node "$PROJECT_ROOT/bin/task-master.js" list > /dev/null 2>&1; then
    print_success "List tasks command works"
else
    print_error "List tasks command failed"
fi

# Test 7: Test VSCode integration
print_status "Testing VSCode integration..."
if node "$PROJECT_ROOT/bin/task-master.js" vscode --status > /dev/null 2>&1; then
    print_success "VSCode integration command works"
else
    print_warning "VSCode integration command failed (may be expected if not initialized)"
fi

# Test 8: Test migration command
print_status "Testing migration command..."
if node "$PROJECT_ROOT/bin/task-master.js" migrate-enhanced --check > /dev/null 2>&1; then
    print_success "Migration command works"
else
    print_warning "Migration command failed (may be expected for new projects)"
fi

# Test 9: Test MCP server
print_status "Testing MCP server..."
if node "$PROJECT_ROOT/mcp-server/server.js" --help > /dev/null 2>&1; then
    print_success "MCP server binary works"
else
    print_error "MCP server binary failed"
fi

# Cleanup
cd "$PROJECT_ROOT"
rm -rf "$TEST_DIR"
print_success "Cleaned up test directory"

# Test 10: Simulate npx usage (if npm pack works)
print_status "Simulating npx usage..."
PACK_FILE=$(npm pack 2>/dev/null | tail -1)

if [[ -f "$PACK_FILE" ]]; then
    print_success "Package created: $PACK_FILE"
    
    # Extract and test
    EXTRACT_DIR=$(mktemp -d)
    cd "$EXTRACT_DIR"
    tar -xzf "$PROJECT_ROOT/$PACK_FILE"
    
    cd package
    
    # Test the extracted package
    if node bin/task-master.js --version > /dev/null 2>&1; then
        print_success "Extracted package works"
    else
        print_error "Extracted package failed"
    fi
    
    # Cleanup
    cd "$PROJECT_ROOT"
    rm -rf "$EXTRACT_DIR"
    rm -f "$PACK_FILE"
    print_success "Cleaned up package test"
else
    print_error "Failed to create package"
fi

echo ""
echo -e "${GREEN}🎉 All tests completed!${NC}"
echo ""
echo -e "${BLUE}Ready for publishing:${NC}"
echo "1. Run: npm run publish-interactive"
echo "2. Or manually: npm publish"
echo "3. Test with: npx task-master-ai@$(node bin/task-master.js --version)"
echo ""
echo -e "${YELLOW}Note:${NC} Make sure you're logged into npm (npm login) before publishing"
