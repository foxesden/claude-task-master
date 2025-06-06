/**
 * vscode-integration.js
 * Core VSCode integration functionality for TaskMaster
 */

import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

/**
 * VSCode Integration Manager
 */
class VSCodeIntegration {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.vscodeDir = path.join(projectRoot, '.vscode');
        this.extensionDir = path.join(projectRoot, 'vscode-extension');
        this.isInitialized = false;
    }

    /**
     * Initialize VSCode integration
     */
    async initialize() {
        try {
            log('info', 'Initializing VSCode integration...');

            // Ensure .vscode directory exists
            await this.ensureVSCodeDirectory();

            // Setup VSCode settings
            await this.setupVSCodeSettings();

            // Setup extension recommendations
            await this.setupExtensionRecommendations();

            // Setup tasks and launch configurations
            await this.setupVSCodeTasks();
            await this.setupLaunchConfiguration();

            // Setup workspace settings for TaskMaster
            await this.setupWorkspaceSettings();

            this.isInitialized = true;
            log('info', 'VSCode integration initialized successfully');
            return true;
        } catch (error) {
            log('error', `Failed to initialize VSCode integration: ${error.message}`);
            return false;
        }
    }

    /**
     * Ensure .vscode directory exists
     */
    async ensureVSCodeDirectory() {
        if (!fs.existsSync(this.vscodeDir)) {
            fs.mkdirSync(this.vscodeDir, { recursive: true });
            log('info', 'Created .vscode directory');
        }
    }

    /**
     * Setup VSCode settings
     */
    async setupVSCodeSettings() {
        const settingsPath = path.join(this.vscodeDir, 'settings.json');
        
        const defaultSettings = {
            "taskmaster.autoRefresh": true,
            "taskmaster.showSubtasks": true,
            "taskmaster.defaultPriority": "medium",
            "taskmaster.enableAugmentIntegration": true,
            "taskmaster.mcpServerPath": "./mcp-server/server.js",
            "taskmaster.tasksPath": ".taskmaster/tasks/tasks.json",
            "taskmaster.configPath": ".taskmaster/config.json",
            "files.associations": {
                "*.taskmaster": "json",
                "tasks.json": "json"
            },
            "json.schemas": [
                {
                    "fileMatch": ["**/tasks.json"],
                    "url": "./schemas/tasks-schema.json"
                }
            ],
            "augment.taskmaster.enabled": true,
            "augment.taskmaster.contextProvider": true
        };

        let existingSettings = {};
        if (fs.existsSync(settingsPath)) {
            try {
                existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            } catch (error) {
                log('warn', 'Could not parse existing settings.json, creating new one');
            }
        }

        // Merge settings, preserving existing ones
        const mergedSettings = { ...existingSettings, ...defaultSettings };

        fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
        log('info', 'VSCode settings configured');
    }

    /**
     * Setup extension recommendations
     */
    async setupExtensionRecommendations() {
        const extensionsPath = path.join(this.vscodeDir, 'extensions.json');
        
        const recommendations = [
            "esbenp.prettier-vscode",
            "augmentcode.augment"
        ];

        let existingExtensions = { recommendations: [] };
        if (fs.existsSync(extensionsPath)) {
            try {
                existingExtensions = JSON.parse(fs.readFileSync(extensionsPath, 'utf8'));
            } catch (error) {
                log('warn', 'Could not parse existing extensions.json, creating new one');
            }
        }

        // Merge recommendations, avoiding duplicates
        const mergedRecommendations = [
            ...new Set([
                ...(existingExtensions.recommendations || []),
                ...recommendations
            ])
        ];

        const extensionsConfig = {
            ...existingExtensions,
            recommendations: mergedRecommendations
        };

        fs.writeFileSync(extensionsPath, JSON.stringify(extensionsConfig, null, 2));
        log('info', 'Extension recommendations configured');
    }

    /**
     * Setup VSCode tasks
     */
    async setupVSCodeTasks() {
        const tasksPath = path.join(this.vscodeDir, 'tasks.json');
        
        const tasksConfig = {
            "version": "2.0.0",
            "tasks": [
                {
                    "label": "TaskMaster: Initialize",
                    "type": "shell",
                    "command": "npx",
                    "args": ["task-master-ai", "init"],
                    "group": "build",
                    "presentation": {
                        "echo": true,
                        "reveal": "always",
                        "focus": false,
                        "panel": "shared"
                    },
                    "problemMatcher": []
                },
                {
                    "label": "TaskMaster: List Tasks",
                    "type": "shell",
                    "command": "npx",
                    "args": ["task-master-ai", "list", "--with-subtasks"],
                    "group": "build",
                    "presentation": {
                        "echo": true,
                        "reveal": "always",
                        "focus": false,
                        "panel": "shared"
                    },
                    "problemMatcher": []
                },
                {
                    "label": "TaskMaster: Next Task",
                    "type": "shell",
                    "command": "npx",
                    "args": ["task-master-ai", "next"],
                    "group": "build",
                    "presentation": {
                        "echo": true,
                        "reveal": "always",
                        "focus": false,
                        "panel": "shared"
                    },
                    "problemMatcher": []
                },
                {
                    "label": "TaskMaster: Generate Files",
                    "type": "shell",
                    "command": "npx",
                    "args": ["task-master-ai", "generate"],
                    "group": "build",
                    "presentation": {
                        "echo": true,
                        "reveal": "always",
                        "focus": false,
                        "panel": "shared"
                    },
                    "problemMatcher": []
                },
                {
                    "label": "TaskMaster: Start MCP Server",
                    "type": "shell",
                    "command": "npx",
                    "args": ["task-master-ai"],
                    "group": "build",
                    "presentation": {
                        "echo": true,
                        "reveal": "always",
                        "focus": false,
                        "panel": "dedicated"
                    },
                    "isBackground": true,
                    "problemMatcher": []
                }
            ]
        };

        fs.writeFileSync(tasksPath, JSON.stringify(tasksConfig, null, 2));
        log('info', 'VSCode tasks configured');
    }

    /**
     * Setup launch configuration for debugging
     */
    async setupLaunchConfiguration() {
        const launchPath = path.join(this.vscodeDir, 'launch.json');
        
        const launchConfig = {
            "version": "0.2.0",
            "configurations": [
                {
                    "name": "Debug TaskMaster CLI",
                    "type": "node",
                    "request": "launch",
                    "program": "${workspaceFolder}/scripts/dev.js",
                    "args": ["list"],
                    "console": "integratedTerminal",
                    "env": {
                        "NODE_ENV": "development"
                    }
                },
                {
                    "name": "Debug TaskMaster MCP Server",
                    "type": "node",
                    "request": "launch",
                    "program": "${workspaceFolder}/mcp-server/server.js",
                    "console": "integratedTerminal",
                    "env": {
                        "NODE_ENV": "development"
                    }
                }
            ]
        };

        fs.writeFileSync(launchPath, JSON.stringify(launchConfig, null, 2));
        log('info', 'VSCode launch configuration created');
    }

    /**
     * Setup workspace-specific settings
     */
    async setupWorkspaceSettings() {
        const workspacePath = path.join(this.projectRoot, `${path.basename(this.projectRoot)}.code-workspace`);
        
        const workspaceConfig = {
            "folders": [
                {
                    "path": "."
                }
            ],
            "settings": {
                "taskmaster.enabled": true,
                "taskmaster.projectRoot": "${workspaceFolder}",
                "files.watcherExclude": {
                    "**/node_modules/**": true,
                    "**/.git/**": true,
                    "**/dist/**": true,
                    "**/build/**": true
                }
            },
            "extensions": {
                "recommendations": [
                    "augmentcode.augment",
                    "esbenp.prettier-vscode"
                ]
            }
        };

        fs.writeFileSync(workspacePath, JSON.stringify(workspaceConfig, null, 2));
        log('info', 'VSCode workspace configuration created');
    }

    /**
     * Create Augment-specific configuration
     */
    async setupAugmentConfiguration() {
        const augmentDir = path.join(this.projectRoot, '.augment');
        if (!fs.existsSync(augmentDir)) {
            fs.mkdirSync(augmentDir, { recursive: true });
        }

        const augmentConfig = {
            "contextProviders": [
                {
                    "name": "taskmaster",
                    "enabled": true,
                    "config": {
                        "tasksPath": ".taskmaster/tasks/tasks.json",
                        "configPath": ".taskmaster/config.json",
                        "includeSubtasks": true,
                        "includeProgress": true
                    }
                }
            ],
            "commands": [
                {
                    "name": "Get Current Task",
                    "command": "taskmaster.getCurrentTask",
                    "description": "Get the current task being worked on"
                },
                {
                    "name": "Get Next Task",
                    "command": "taskmaster.getNextTask",
                    "description": "Find the next task to work on"
                }
            ]
        };

        const augmentConfigPath = path.join(augmentDir, 'config.json');
        fs.writeFileSync(augmentConfigPath, JSON.stringify(augmentConfig, null, 2));
        log('info', 'Augment configuration created');
    }

    /**
     * Get VSCode integration status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            vscodeDir: fs.existsSync(this.vscodeDir),
            settingsConfigured: fs.existsSync(path.join(this.vscodeDir, 'settings.json')),
            tasksConfigured: fs.existsSync(path.join(this.vscodeDir, 'tasks.json')),
            launchConfigured: fs.existsSync(path.join(this.vscodeDir, 'launch.json')),
            extensionsConfigured: fs.existsSync(path.join(this.vscodeDir, 'extensions.json'))
        };
    }

    /**
     * Update VSCode settings
     */
    async updateSettings(newSettings) {
        const settingsPath = path.join(this.vscodeDir, 'settings.json');
        
        let existingSettings = {};
        if (fs.existsSync(settingsPath)) {
            existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }

        const mergedSettings = { ...existingSettings, ...newSettings };
        fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
        
        log('info', 'VSCode settings updated');
        return true;
    }
}

export default VSCodeIntegration;
