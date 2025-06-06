#!/usr/bin/env node

/**
 * Task Master CLI Entry Point
 * Copyright (c) 2025 Eyal Toledano, Ralph Khreish
 *
 * This is the main CLI entry point for task-master-ai command.
 * It provides direct access to Task Master functionality without starting the MCP server.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package information
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = packageJson.version;

// Get path to the dev.js script
const devScriptPath = resolve(__dirname, '../scripts/dev.js');

/**
 * Check if this is being called as an MCP server
 * MCP servers receive JSON-RPC messages on stdin
 */
function isMCPMode() {
    // Check if we're being called with MCP-specific arguments or environment
    const args = process.argv.slice(2);
    
    // If no arguments and stdin is not a TTY, likely MCP mode
    if (args.length === 0 && !process.stdin.isTTY) {
        return true;
    }
    
    // Check for MCP-specific environment variables
    if (process.env.MCP_MODE === 'true') {
        return true;
    }
    
    return false;
}

/**
 * Start MCP server mode
 */
async function startMCPServer() {
    const { default: TaskMasterMCPServer } = await import('../mcp-server/src/index.js');
    const logger = (await import('../mcp-server/src/logger.js')).default;
    
    const server = new TaskMasterMCPServer();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });

    try {
        await server.start();
    } catch (error) {
        logger.error(`Failed to start MCP server: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Run CLI mode
 */
function runCLI() {
    // Get all arguments after the script name
    const args = process.argv.slice(2);
    
    // If no arguments, show help
    if (args.length === 0) {
        args.push('--help');
    }
    
    // Debug output
    if (process.env.DEBUG === '1') {
        console.error('DEBUG - CLI mode, running dev.js with args:', args);
    }
    
    // Run the dev.js script with the provided arguments
    const child = spawn('node', [devScriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    child.on('close', (code) => {
        process.exit(code);
    });

    child.on('error', (error) => {
        console.error(`Failed to start CLI: ${error.message}`);
        process.exit(1);
    });
}

/**
 * Main entry point
 */
async function main() {
    try {
        if (isMCPMode()) {
            // Start MCP server
            await startMCPServer();
        } else {
            // Run CLI
            runCLI();
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        if (process.env.DEBUG === '1') {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Start the application
main();
