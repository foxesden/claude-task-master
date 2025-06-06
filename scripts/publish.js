#!/usr/bin/env node

/**
 * TaskMaster Publishing Script
 * Automates the publishing process with safety checks
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import inquirer from 'inquirer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

/**
 * Execute command and return output
 */
function exec(command, options = {}) {
    try {
        return execSync(command, { 
            encoding: 'utf8', 
            cwd: projectRoot,
            ...options 
        }).trim();
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

/**
 * Check if user is logged into npm
 */
function checkNpmAuth() {
    try {
        const user = exec('npm whoami');
        console.log(chalk.green(`✓ Logged in as: ${user}`));
        return user;
    } catch (error) {
        console.log(chalk.red('✗ Not logged into npm'));
        console.log(chalk.yellow('Please run: npm login'));
        process.exit(1);
    }
}

/**
 * Get current package version
 */
function getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    return packageJson.version;
}

/**
 * Check if version already exists on npm
 */
function checkVersionExists(version) {
    try {
        exec(`npm view task-master-ai@${version} version`);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Run tests
 */
function runTests() {
    console.log(chalk.blue('Running tests...'));
    try {
        exec('npm test');
        console.log(chalk.green('✓ All tests passed'));
    } catch (error) {
        console.log(chalk.red('✗ Tests failed'));
        throw error;
    }
}

/**
 * Check package contents
 */
function checkPackageContents() {
    console.log(chalk.blue('Checking package contents...'));
    try {
        const output = exec('npm pack --dry-run');
        console.log(chalk.green('✓ Package contents verified'));
        
        // Check for important files
        const requiredFiles = [
            'bin/task-master.js',
            'mcp-server/server.js',
            'scripts/',
            'vscode-extension/',
            'schemas/',
            'VSCODE_INTEGRATION.md'
        ];
        
        const missingFiles = requiredFiles.filter(file => !output.includes(file));
        if (missingFiles.length > 0) {
            console.log(chalk.yellow(`Warning: Missing files: ${missingFiles.join(', ')}`));
        }
        
        return output;
    } catch (error) {
        console.log(chalk.red('✗ Package check failed'));
        throw error;
    }
}

/**
 * Verify binary permissions
 */
function checkBinaryPermissions() {
    console.log(chalk.blue('Checking binary permissions...'));
    
    const binaries = [
        'bin/task-master.js',
        'mcp-server/server.js'
    ];
    
    binaries.forEach(binary => {
        const binaryPath = path.join(projectRoot, binary);
        if (fs.existsSync(binaryPath)) {
            const stats = fs.statSync(binaryPath);
            if (!(stats.mode & parseInt('111', 8))) {
                console.log(chalk.yellow(`Making ${binary} executable...`));
                fs.chmodSync(binaryPath, '755');
            }
        }
    });
    
    console.log(chalk.green('✓ Binary permissions verified'));
}

/**
 * Build VSCode extension
 */
function buildVSCodeExtension() {
    console.log(chalk.blue('Building VSCode extension...'));
    
    const extensionDir = path.join(projectRoot, 'vscode-extension');
    if (fs.existsSync(extensionDir)) {
        try {
            // Check if package.json exists in extension directory
            const extensionPackageJson = path.join(extensionDir, 'package.json');
            if (fs.existsSync(extensionPackageJson)) {
                exec('npm install', { cwd: extensionDir });
                console.log(chalk.green('✓ VSCode extension built'));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠ VSCode extension build failed (non-critical)'));
            console.log(error.message);
        }
    }
}

/**
 * Test installation
 */
async function testInstallation() {
    console.log(chalk.blue('Testing installation...'));
    
    try {
        // Test basic command
        const version = exec('node bin/task-master.js --version');
        console.log(chalk.green(`✓ Binary works: ${version}`));
        
        // Test help command
        exec('node bin/task-master.js --help');
        console.log(chalk.green('✓ Help command works'));
        
    } catch (error) {
        console.log(chalk.red('✗ Installation test failed'));
        throw error;
    }
}

/**
 * Publish to npm
 */
async function publishToNpm(options = {}) {
    console.log(chalk.blue('Publishing to npm...'));
    
    try {
        let command = 'npm publish';
        
        if (options.tag) {
            command += ` --tag ${options.tag}`;
        }
        
        if (options.access) {
            command += ` --access ${options.access}`;
        }
        
        exec(command);
        console.log(chalk.green('✓ Published to npm successfully'));
        
        const version = getCurrentVersion();
        console.log(chalk.green(`Package is now available: npx task-master-ai@${version}`));
        
    } catch (error) {
        console.log(chalk.red('✗ Publishing failed'));
        throw error;
    }
}

/**
 * Main publishing workflow
 */
async function main() {
    console.log(chalk.blue.bold('TaskMaster Publishing Script\n'));
    
    try {
        // Pre-flight checks
        console.log(chalk.blue.bold('Pre-flight checks:'));
        checkNpmAuth();
        
        const version = getCurrentVersion();
        console.log(chalk.green(`Current version: ${version}`));
        
        if (checkVersionExists(version)) {
            console.log(chalk.red(`✗ Version ${version} already exists on npm`));
            console.log(chalk.yellow('Please update the version in package.json'));
            process.exit(1);
        }
        
        checkBinaryPermissions();
        buildVSCodeExtension();
        
        // Ask user what they want to do
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: 'Full publish (tests + publish)', value: 'full' },
                    { name: 'Test only (no publish)', value: 'test' },
                    { name: 'Publish only (skip tests)', value: 'publish' },
                    { name: 'Check package contents', value: 'check' },
                    { name: 'Cancel', value: 'cancel' }
                ]
            }
        ]);
        
        if (action === 'cancel') {
            console.log(chalk.yellow('Publishing cancelled'));
            process.exit(0);
        }
        
        // Execute based on choice
        if (action === 'check') {
            checkPackageContents();
            return;
        }
        
        if (action === 'test' || action === 'full') {
            runTests();
            checkPackageContents();
            await testInstallation();
        }
        
        if (action === 'publish' || action === 'full') {
            // Ask for publish options
            const { publishOptions } = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'publishOptions',
                    message: 'Publish options:',
                    choices: [
                        { name: 'Public access (for scoped packages)', value: 'public' },
                        { name: 'Beta tag', value: 'beta' },
                        { name: 'Latest tag (default)', value: 'latest', checked: true }
                    ]
                }
            ]);
            
            const options = {};
            if (publishOptions.includes('public')) {
                options.access = 'public';
            }
            if (publishOptions.includes('beta')) {
                options.tag = 'beta';
            }
            
            // Final confirmation
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Publish task-master-ai@${version} to npm?`,
                    default: false
                }
            ]);
            
            if (confirm) {
                await publishToNpm(options);
                
                console.log(chalk.green.bold('\n🎉 Publishing completed successfully!'));
                console.log(chalk.blue('Next steps:'));
                console.log(chalk.blue('1. Test with: npx task-master-ai@' + version));
                console.log(chalk.blue('2. Create GitHub release'));
                console.log(chalk.blue('3. Update documentation'));
                console.log(chalk.blue('4. Announce the release'));
            } else {
                console.log(chalk.yellow('Publishing cancelled'));
            }
        }
        
    } catch (error) {
        console.log(chalk.red.bold('\n❌ Publishing failed:'));
        console.log(chalk.red(error.message));
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default main;
