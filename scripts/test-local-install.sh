#!/bin/bash

# Test TaskMaster local installation across multiple projects
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[TEST]${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Get TaskMaster project root
TASKMASTER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "TaskMaster root: $TASKMASTER_ROOT"

# Test different installation methods
test_global_install() {
    print_status "Testing global installation..."
    
    cd "$TASKMASTER_ROOT"
    
    # Install globally
    if npm install -g . > /dev/null 2>&1; then
        print_success "Global installation successful"
        
        # Test if command works
        if task-master --version > /dev/null 2>&1; then
            VERSION=$(task-master --version)
            print_success "Global command works: $VERSION"
            return 0
        else
            print_error "Global command failed"
            return 1
        fi
    else
        print_error "Global installation failed"
        return 1
    fi
}

test_npm_link() {
    print_status "Testing npm link..."
    
    cd "$TASKMASTER_ROOT"
    
    # Create link
    if npm link > /dev/null 2>&1; then
        print_success "npm link successful"
        
        # Test if command works
        if task-master --version > /dev/null 2>&1; then
            VERSION=$(task-master --version)
            print_success "Linked command works: $VERSION"
            return 0
        else
            print_error "Linked command failed"
            return 1
        fi
    else
        print_error "npm link failed"
        return 1
    fi
}

test_in_multiple_projects() {
    print_status "Testing in multiple project directories..."
    
    # Create test projects
    TEST_BASE=$(mktemp -d)
    
    for i in {1..3}; do
        PROJECT_DIR="$TEST_BASE/test-project-$i"
        mkdir -p "$PROJECT_DIR"
        cd "$PROJECT_DIR"
        
        print_status "Testing in project $i: $PROJECT_DIR"
        
        # Test basic commands
        if task-master --version > /dev/null 2>&1; then
            print_success "Version command works in project $i"
        else
            print_error "Version command failed in project $i"
            continue
        fi
        
        # Test initialization
        if task-master init --yes --name="Test Project $i" > /dev/null 2>&1; then
            print_success "Init works in project $i"
            
            # Check if files were created
            if [[ -d ".taskmaster" ]]; then
                print_success ".taskmaster directory created in project $i"
            else
                print_error ".taskmaster directory not created in project $i"
            fi
        else
            print_error "Init failed in project $i"
        fi
        
        # Test adding a task
        if task-master add-task --title="Test Task $i" --description="Testing in project $i" > /dev/null 2>&1; then
            print_success "Add task works in project $i"
        else
            print_warning "Add task failed in project $i (may be expected)"
        fi
        
        # Test listing tasks
        if task-master list > /dev/null 2>&1; then
            print_success "List tasks works in project $i"
        else
            print_warning "List tasks failed in project $i"
        fi
        
        # Test VSCode integration
        if task-master vscode --status > /dev/null 2>&1; then
            print_success "VSCode integration works in project $i"
        else
            print_warning "VSCode integration failed in project $i (expected for new projects)"
        fi
    done
    
    # Cleanup
    rm -rf "$TEST_BASE"
    print_success "Cleaned up test projects"
}

test_different_node_versions() {
    print_status "Testing Node.js compatibility..."
    
    NODE_VERSION=$(node --version)
    print_status "Current Node.js version: $NODE_VERSION"
    
    # Check minimum version requirement
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [[ $MAJOR_VERSION -ge 18 ]]; then
        print_success "Node.js version meets requirements (>=18)"
    else
        print_error "Node.js version too old. Requires >=18, found $NODE_VERSION"
        return 1
    fi
}

test_binary_permissions() {
    print_status "Testing binary permissions..."
    
    BINARIES=(
        "$TASKMASTER_ROOT/bin/task-master.js"
        "$TASKMASTER_ROOT/mcp-server/server.js"
    )
    
    for binary in "${BINARIES[@]}"; do
        if [[ -x "$binary" ]]; then
            print_success "$(basename $binary) is executable"
        else
            print_error "$(basename $binary) is not executable"
            chmod +x "$binary"
            print_warning "Fixed permissions for $(basename $binary)"
        fi
    done
}

test_package_integrity() {
    print_status "Testing package integrity..."
    
    cd "$TASKMASTER_ROOT"
    
    # Check package.json
    if [[ -f "package.json" ]]; then
        if node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" > /dev/null 2>&1; then
            print_success "package.json is valid"
        else
            print_error "package.json is invalid"
            return 1
        fi
    else
        print_error "package.json not found"
        return 1
    fi
    
    # Check main entry points
    if [[ -f "bin/task-master.js" ]]; then
        print_success "Main binary exists"
    else
        print_error "Main binary missing"
        return 1
    fi
    
    if [[ -f "mcp-server/server.js" ]]; then
        print_success "MCP server exists"
    else
        print_error "MCP server missing"
        return 1
    fi
}

cleanup_installations() {
    print_status "Cleaning up test installations..."
    
    # Uninstall global package
    if npm list -g task-master-ai > /dev/null 2>&1; then
        npm uninstall -g task-master-ai > /dev/null 2>&1
        print_success "Removed global installation"
    fi
    
    # Unlink if linked
    if npm list -g task-master-ai > /dev/null 2>&1; then
        npm unlink -g task-master-ai > /dev/null 2>&1
        print_success "Removed npm link"
    fi
}

# Main test execution
main() {
    echo -e "${BLUE}🧪 Testing TaskMaster Local Installation${NC}\n"
    
    # Pre-flight checks
    test_package_integrity
    test_binary_permissions
    test_different_node_versions
    
    echo ""
    print_status "Choose installation method to test:"
    echo "1. Global install (npm install -g .)"
    echo "2. npm link"
    echo "3. Both methods"
    echo "4. Skip installation tests"
    
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            test_global_install && test_in_multiple_projects
            ;;
        2)
            test_npm_link && test_in_multiple_projects
            ;;
        3)
            test_global_install && test_in_multiple_projects
            cleanup_installations
            test_npm_link && test_in_multiple_projects
            ;;
        4)
            print_warning "Skipping installation tests"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}🎉 Local installation testing completed!${NC}"
    echo ""
    echo -e "${BLUE}Manual testing commands:${NC}"
    echo "task-master --version"
    echo "task-master init"
    echo "task-master add-task --title='Test Task'"
    echo "task-master list"
    echo "task-master vscode --init"
    echo ""
    echo -e "${YELLOW}To cleanup:${NC}"
    echo "npm uninstall -g task-master-ai"
    echo "# or"
    echo "npm unlink -g task-master-ai"
}

# Cleanup on exit
trap cleanup_installations EXIT

# Run main function
main "$@"
