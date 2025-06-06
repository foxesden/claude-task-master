/**
 * augment-integration.js
 * Augment Code integration setup and configuration
 */

import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

/**
 * Augment Code Integration Manager
 */
class AugmentIntegration {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.augmentDir = path.join(projectRoot, '.augment');
        this.vscodeDir = path.join(projectRoot, '.vscode');
        this.isInitialized = false;
    }

    /**
     * Initialize Augment Code integration
     */
    async initialize() {
        try {
            log('info', 'Setting up Augment Code integration...');

            // Create .augment directory
            await this.ensureAugmentDirectory();

            // Setup Augment MCP configuration
            await this.setupAugmentMCPConfig();

            // Setup VSCode settings for Augment
            await this.setupVSCodeAugmentSettings();

            // Create Augment-specific context files
            await this.createAugmentContextFiles();

            // Setup workspace configuration
            await this.setupAugmentWorkspace();

            this.isInitialized = true;
            log('info', '✅ Augment Code integration configured successfully');
            return true;
        } catch (error) {
            log('error', `Failed to setup Augment integration: ${error.message}`);
            return false;
        }
    }

    /**
     * Ensure .augment directory exists
     */
    async ensureAugmentDirectory() {
        if (!fs.existsSync(this.augmentDir)) {
            fs.mkdirSync(this.augmentDir, { recursive: true });
            log('info', 'Created .augment directory');
        }
    }

    /**
     * Setup Augment MCP configuration
     */
    async setupAugmentMCPConfig() {
        const mcpConfigPath = path.join(this.augmentDir, 'mcp-servers.json');

        // Read API keys from .env file if it exists
        const envPath = path.join(this.projectRoot, '.env');
        let apiKeys = {};

        if (fs.existsSync(envPath)) {
            try {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const envLines = envContent.split('\n');

                envLines.forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes

                        // Only include API keys we care about
                        const apiKeyNames = [
                            'ANTHROPIC_API_KEY',
                            'PERPLEXITY_API_KEY',
                            'OPENAI_API_KEY',
                            'GOOGLE_API_KEY',
                            'XAI_API_KEY',
                            'OPENROUTER_API_KEY',
                            'MISTRAL_API_KEY',
                            'AZURE_OPENAI_API_KEY',
                            'OLLAMA_API_KEY'
                        ];

                        if (apiKeyNames.includes(key.trim()) && value) {
                            apiKeys[key.trim()] = value;
                        }
                    }
                });

                log('info', `Loaded ${Object.keys(apiKeys).length} API keys from .env file`);
            } catch (error) {
                log('warn', `Could not read .env file: ${error.message}`);
            }
        }

        // Fallback to environment variable placeholders if no .env keys found
        if (Object.keys(apiKeys).length === 0) {
            apiKeys = {
                "NODE_ENV": "production",
                "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
                "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
                "OPENAI_API_KEY": "${OPENAI_API_KEY}",
                "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
                "XAI_API_KEY": "${XAI_API_KEY}",
                "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
                "MISTRAL_API_KEY": "${MISTRAL_API_KEY}",
                "AZURE_OPENAI_API_KEY": "${AZURE_OPENAI_API_KEY}",
                "OLLAMA_API_KEY": "${OLLAMA_API_KEY}"
            };
        } else {
            // Add NODE_ENV to actual keys
            apiKeys["NODE_ENV"] = "production";
        }

        const mcpConfig = {
            "mcpServers": {
                "taskmaster": {
                    "command": "task-master-ai",
                    "args": [],
                    "env": apiKeys
                }
            }
        };

        fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        log('info', 'Created Augment MCP configuration with API keys from .env');
    }

    /**
     * Setup VSCode settings for Augment integration
     */
    async setupVSCodeAugmentSettings() {
        const settingsPath = path.join(this.vscodeDir, 'settings.json');
        
        let settings = {};
        if (fs.existsSync(settingsPath)) {
            try {
                settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            } catch (error) {
                log('warn', 'Could not parse existing VSCode settings');
            }
        }

        // Add Augment-specific settings
        const augmentSettings = {
            "augment.mcp.configPath": ".augment/mcp-servers.json",
            "augment.taskmaster.enabled": true,
            "augment.taskmaster.contextProvider": true,
            "augment.taskmaster.autoRefresh": true,
            "augment.taskmaster.showSubtasks": true,
            "augment.taskmaster.projectRoot": "${workspaceFolder}",
            "augment.contextProviders": {
                "taskmaster": {
                    "enabled": true,
                    "priority": "high",
                    "includeSubtasks": true,
                    "includeProgress": true
                }
            }
        };

        // Merge settings
        const mergedSettings = { ...settings, ...augmentSettings };

        // Ensure .vscode directory exists
        if (!fs.existsSync(this.vscodeDir)) {
            fs.mkdirSync(this.vscodeDir, { recursive: true });
        }

        fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
        log('info', 'Updated VSCode settings for Augment integration');
    }

    /**
     * Create Augment-specific context files
     */
    async createAugmentContextFiles() {
        // Create context configuration
        const contextConfigPath = path.join(this.augmentDir, 'context.json');
        
        const contextConfig = {
            "providers": [
                {
                    "name": "taskmaster",
                    "type": "mcp",
                    "description": "TaskMaster project context and task management",
                    "enabled": true,
                    "config": {
                        "includeTaskDetails": true,
                        "includeSubtasks": true,
                        "includeProgress": true,
                        "includeDependencies": true,
                        "maxTasks": 50
                    }
                }
            ],
            "contextRules": [
                {
                    "name": "taskmaster-context",
                    "description": "Provide TaskMaster context for AI assistance",
                    "triggers": ["task", "subtask", "project", "status", "progress"],
                    "actions": ["include-taskmaster-context"]
                }
            ]
        };

        fs.writeFileSync(contextConfigPath, JSON.stringify(contextConfig, null, 2));

        // Create Augment rules file
        const rulesPath = path.join(this.augmentDir, 'rules.md');
        const rulesContent = `# TaskMaster Augment Rules

## Context Awareness
- Always check current TaskMaster project status before suggesting actions
- Include task progress and dependencies in responses
- Suggest next logical steps based on task hierarchy

## Task Management
- Use TaskMaster MCP tools for all task-related operations
- Maintain task hierarchy and dependencies
- Update task status as work progresses

## Project Workflow
- Follow TaskMaster project structure and conventions
- Use nested subtasks for complex task breakdown
- Leverage VSCode integration for seamless development

## Available Commands
- Initialize projects with \`initialize_project_taskmaster-ai\`
- Manage tasks with \`add_task_taskmaster-ai\`, \`get_tasks_taskmaster-ai\`
- Handle subtasks with \`add_subtask_taskmaster-ai\`
- Update status with \`set_task_status_taskmaster-ai\`
- Expand tasks with \`expand_task_taskmaster-ai\`
- Setup VSCode with \`initialize_vscode_integration\`
`;

        fs.writeFileSync(rulesPath, rulesContent);
        log('info', 'Created Augment context files');
    }

    /**
     * Setup Augment workspace configuration
     */
    async setupAugmentWorkspace() {
        const workspacePath = path.join(this.projectRoot, '.augment-workspace.json');
        
        const workspaceConfig = {
            "name": "TaskMaster Project",
            "type": "taskmaster",
            "version": "1.0.0",
            "mcp": {
                "configPath": ".augment/mcp-servers.json",
                "servers": ["taskmaster"]
            },
            "context": {
                "configPath": ".augment/context.json",
                "providers": ["taskmaster"]
            },
            "features": {
                "taskManagement": true,
                "nestedSubtasks": true,
                "vscodeIntegration": true,
                "dependencyTracking": true
            },
            "settings": {
                "autoRefresh": true,
                "showProgress": true,
                "includeSubtasks": true
            }
        };

        fs.writeFileSync(workspacePath, JSON.stringify(workspaceConfig, null, 2));
        log('info', 'Created Augment workspace configuration');
    }

    /**
     * Create Augment extension recommendations
     */
    async updateExtensionRecommendations() {
        const extensionsPath = path.join(this.vscodeDir, 'extensions.json');
        
        let extensions = { recommendations: [] };
        if (fs.existsSync(extensionsPath)) {
            try {
                extensions = JSON.parse(fs.readFileSync(extensionsPath, 'utf8'));
            } catch (error) {
                log('warn', 'Could not parse existing extensions.json');
            }
        }

        // Add Augment extension
        const augmentExtension = 'augmentcode.augment';
        if (!extensions.recommendations.includes(augmentExtension)) {
            extensions.recommendations.push(augmentExtension);
        }

        // Ensure .vscode directory exists
        if (!fs.existsSync(this.vscodeDir)) {
            fs.mkdirSync(this.vscodeDir, { recursive: true });
        }

        fs.writeFileSync(extensionsPath, JSON.stringify(extensions, null, 2));
        log('info', 'Updated extension recommendations for Augment');
    }

    /**
     * Get integration status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            augmentDir: fs.existsSync(this.augmentDir),
            mcpConfig: fs.existsSync(path.join(this.augmentDir, 'mcp-servers.json')),
            contextConfig: fs.existsSync(path.join(this.augmentDir, 'context.json')),
            vscodeSettings: fs.existsSync(path.join(this.vscodeDir, 'settings.json')),
            workspaceConfig: fs.existsSync(path.join(this.projectRoot, '.augment-workspace.json'))
        };
    }

    /**
     * Generate setup instructions
     */
    generateSetupInstructions() {
        return `
# Augment Code Integration Setup

## 1. Install Augment Extension
Install the Augment Code extension in VSCode from the marketplace.

## 2. Configure MCP Server
The MCP server configuration has been created at:
\`.augment/mcp-servers.json\`

API keys are automatically loaded from your \`.env\` file.

## 3. Add API Keys to .env File
Add your API keys to the \`.env\` file in your project root:

\`\`\`bash
# Required for TaskMaster AI features
ANTHROPIC_API_KEY=your-anthropic-key-here

# Optional for research features
PERPLEXITY_API_KEY=your-perplexity-key-here

# Optional for additional AI models
OPENAI_API_KEY=your-openai-key-here
GOOGLE_API_KEY=your-google-key-here
\`\`\`

## 4. Configure Augment
Add the MCP server to Augment using one of these methods:

### Method A: Augment GUI
1. Open Command Palette (Ctrl+Shift+P)
2. Type "Augment: Configure MCP Servers"
3. Add server: name="taskmaster", command="task-master-ai"

### Method B: Copy Configuration
Copy \`.augment/mcp-servers.json\` to Augment's config directory:
- Linux: \`~/.config/Code/User/globalStorage/augmentcode.augment/\`
- macOS: \`~/Library/Application Support/Code/User/globalStorage/augmentcode.augment/\`
- Windows: \`%APPDATA%\\Code\\User\\globalStorage\\augmentcode.augment\\\`

## 5. Restart VSCode
Restart VSCode to load the new configuration.

## 6. Test Integration
Try these commands in Augment:
- "List my current tasks"
- "Add a task to setup the database"
- "Show project status"
- "What's the next task I should work on?"

## 7. Available Tools
TaskMaster provides these MCP tools to Augment:
- initialize_project_taskmaster-ai
- get_tasks_taskmaster-ai
- add_task_taskmaster-ai
- add_subtask_taskmaster-ai
- set_task_status_taskmaster-ai
- expand_task_taskmaster-ai
- initialize_vscode_integration
- initialize_augment_integration
- And many more!
`;
    }
}

export default AugmentIntegration;
