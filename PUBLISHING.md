# TaskMaster Publishing Guide

This guide explains how to make TaskMaster available via `npx` and distribute it through various channels.

## Current Status

TaskMaster is already configured for npm publishing with:
- ✅ **Package Name**: `task-master-ai`
- ✅ **Version**: `0.17.0` (includes VSCode integration and nested subtasks)
- ✅ **Binary Commands**: `task-master`, `task-master-mcp`, `task-master-ai`
- ✅ **Entry Points**: Properly configured in `bin/` directory
- ✅ **File Inclusion**: All necessary files included in package

## Publishing to npm

### 1. Prerequisites

```bash
# Ensure you have npm account and are logged in
npm login

# Verify your identity
npm whoami

# Check if package name is available (if publishing for first time)
npm view task-master-ai
```

### 2. Pre-Publishing Checklist

```bash
# Run tests to ensure everything works
npm test

# Check package contents
npm pack --dry-run

# Verify binary permissions
chmod +x bin/task-master.js mcp-server/server.js

# Build/prepare if needed
npm run prepare
```

### 3. Publishing Process

#### Option A: Direct Publishing
```bash
# Publish to npm registry
npm publish

# For scoped packages (if needed)
npm publish --access public
```

#### Option B: Using Changesets (Recommended)
```bash
# Create a changeset
npm run changeset

# Version the package
npm run changeset version

# Publish with changeset
npm run release
```

### 4. Verify Publication

```bash
# Test installation globally
npm install -g task-master-ai

# Test npx usage
npx task-master-ai --version
npx task-master-ai --help

# Test in a new directory
mkdir test-project
cd test-project
npx task-master-ai init
```

## Usage via npx

Once published, users can use TaskMaster without installation:

### Basic Usage
```bash
# Initialize a new project
npx task-master-ai init

# Add a task
npx task-master-ai add-task --title="Setup Database" --description="Configure PostgreSQL"

# List tasks
npx task-master-ai list

# Add nested subtask
npx task-master-ai add-subtask --id=1 --title="Install PostgreSQL"

# Setup VSCode integration
npx task-master-ai vscode --init

# Run migration for existing projects
npx task-master-ai migrate-enhanced
```

### Advanced Usage
```bash
# Parse PRD and generate tasks
npx task-master-ai parse-prd --input=./requirements.md --num-tasks=10

# Expand task into subtasks
npx task-master-ai expand --id=5 --num=8

# Start MCP server
npx task-master-ai

# Generate task files
npx task-master-ai generate
```

## Alternative Distribution Methods

### 1. GitHub Releases

Create releases with pre-built binaries:

```bash
# Tag the release
git tag v0.17.0
git push origin v0.17.0

# Create GitHub release with assets
# Include:
# - Source code (automatic)
# - VSCode extension (.vsix file)
# - Documentation
```

### 2. VSCode Extension Marketplace

Publish the VSCode extension separately:

```bash
# Install vsce (Visual Studio Code Extension manager)
npm install -g vsce

# Package the extension
cd vscode-extension
vsce package

# Publish to marketplace
vsce publish
```

### 3. Docker Distribution

Create Docker image for containerized usage:

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN chmod +x bin/task-master.js mcp-server/server.js

ENTRYPOINT ["node", "bin/task-master.js"]
```

```bash
# Build and publish Docker image
docker build -t task-master-ai:0.17.0 .
docker tag task-master-ai:0.17.0 your-registry/task-master-ai:latest
docker push your-registry/task-master-ai:latest
```

### 4. Homebrew Formula (macOS/Linux)

Create Homebrew formula for easy installation:

```ruby
# Formula/task-master-ai.rb
class TaskMasterAi < Formula
  desc "AI-powered task management with VSCode integration"
  homepage "https://github.com/your-username/claude-task-master"
  url "https://registry.npmjs.org/task-master-ai/-/task-master-ai-0.17.0.tgz"
  sha256 "..." # Calculate with: shasum -a 256 task-master-ai-0.17.0.tgz
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/task-master", "--version"
  end
end
```

## Distribution Checklist

### Before Publishing
- [ ] Update version in package.json
- [ ] Update CHANGELOG.md with new features
- [ ] Run full test suite
- [ ] Test binary execution
- [ ] Verify all files are included
- [ ] Check dependencies are up to date
- [ ] Test VSCode extension functionality
- [ ] Verify MCP server works

### After Publishing
- [ ] Test `npx task-master-ai` installation
- [ ] Update documentation
- [ ] Create GitHub release
- [ ] Announce on relevant platforms
- [ ] Update examples and tutorials
- [ ] Monitor for issues

## Troubleshooting

### Common Issues

1. **Binary not executable**
   ```bash
   chmod +x bin/task-master.js mcp-server/server.js
   npm run prepare
   ```

2. **Missing files in package**
   ```bash
   # Check what will be included
   npm pack --dry-run
   
   # Update files array in package.json if needed
   ```

3. **Permission denied on npm publish**
   ```bash
   npm login
   npm whoami
   # Ensure you have publish rights to the package
   ```

4. **VSCode extension not working**
   ```bash
   cd vscode-extension
   npm install
   code --install-extension .
   ```

### Testing Installation

Create a test script to verify everything works:

```bash
#!/bin/bash
# test-installation.sh

echo "Testing TaskMaster installation..."

# Test npx usage
echo "1. Testing npx command..."
npx task-master-ai --version

# Test project initialization
echo "2. Testing project initialization..."
mkdir test-taskmaster
cd test-taskmaster
npx task-master-ai init --yes

# Test basic functionality
echo "3. Testing basic functionality..."
npx task-master-ai add-task --title="Test Task" --description="Testing"
npx task-master-ai list

# Test VSCode integration
echo "4. Testing VSCode integration..."
npx task-master-ai vscode --init

# Test migration
echo "5. Testing migration..."
npx task-master-ai migrate-enhanced --check

echo "All tests completed!"
cd ..
rm -rf test-taskmaster
```

## Monitoring and Maintenance

### Analytics
- Monitor npm download statistics
- Track GitHub stars and issues
- Monitor VSCode extension usage
- Collect user feedback

### Updates
- Regular dependency updates
- Security patches
- Feature enhancements based on feedback
- Documentation improvements

### Support
- Respond to GitHub issues
- Maintain documentation
- Provide examples and tutorials
- Community engagement

## Marketing and Promotion

### Channels
- GitHub README with clear examples
- npm package description
- VSCode extension marketplace
- Developer communities (Reddit, Discord, etc.)
- Blog posts and tutorials
- Social media announcements

### Key Selling Points
- **Zero Installation**: Works with `npx`
- **VSCode Integration**: Native editor support
- **AI-Powered**: Intelligent task generation
- **Nested Subtasks**: Unlimited depth organization
- **Augment Compatible**: Works with Augment Code
- **MCP Protocol**: Extensible architecture
- **Open Source**: MIT licensed with Commons Clause

## Version Management

Use semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.17.0): New features (current - VSCode + nested subtasks)
- **Patch** (0.17.1): Bug fixes

Example release cycle:
```bash
# Feature release
npm run changeset
# Select "minor" for new features
npm run changeset version
npm run release

# Bug fix release  
npm run changeset
# Select "patch" for bug fixes
npm run changeset version
npm run release
```
