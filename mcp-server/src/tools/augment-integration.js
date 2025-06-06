/**
 * Augment Integration MCP Tool
 * Provides MCP interface for Augment Code integration functionality
 */

import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { withNormalizedProjectRoot } from './utils.js';
import AugmentIntegration from '../../../scripts/modules/augment-integration.js';

// Input validation schemas
const InitializeAugmentSchema = z.object({
    projectRoot: z.string().describe('The project root directory'),
    force: z.boolean().optional().default(false).describe('Force re-initialization even if already configured')
});

const GetAugmentStatusSchema = z.object({
    projectRoot: z.string().describe('The project root directory')
});

/**
 * Create error response
 */
function createErrorResponse(message, code = 'AUGMENT_INTEGRATION_ERROR') {
    return {
        success: false,
        error: {
            code,
            message
        }
    };
}

/**
 * Create success response
 */
function createSuccessResponse(data, message = 'Operation completed successfully') {
    return {
        success: true,
        data,
        message
    };
}

/**
 * Initialize Augment Integration Tool
 */
export const initializeAugmentIntegration = {
    name: 'initialize_augment_integration',
    description: 'Initialize Augment Code integration for TaskMaster project including MCP configuration, context providers, and VSCode settings',
    parameters: InitializeAugmentSchema,
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Initializing Augment Code integration for project: ${args.projectRoot}`);

            const integration = new AugmentIntegration(args.projectRoot);
            
            // Check if already initialized and not forcing
            if (!args.force) {
                const status = integration.getStatus();
                if (status.initialized && status.mcpConfig) {
                    return createSuccessResponse(status, 'Augment Code integration already configured');
                }
            }

            // Initialize the integration
            const success = await integration.initialize();
            
            if (!success) {
                return createErrorResponse('Failed to initialize Augment Code integration');
            }

            const finalStatus = integration.getStatus();
            
            log.info('Augment Code integration initialized successfully');
            return createSuccessResponse({
                ...finalStatus,
                setupInstructions: integration.generateSetupInstructions()
            }, 'Augment Code integration initialized successfully');

        } catch (error) {
            log.error(`Error initializing Augment integration: ${error.message}`);
            return createErrorResponse(`Failed to initialize Augment integration: ${error.message}`);
        }
    })
};

/**
 * Get Augment Integration Status Tool
 */
export const getAugmentStatus = {
    name: 'get_augment_status',
    description: 'Get the current status of Augment Code integration for TaskMaster',
    parameters: GetAugmentStatusSchema,
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Getting Augment integration status for project: ${args.projectRoot}`);

            const integration = new AugmentIntegration(args.projectRoot);
            const status = integration.getStatus();
            
            log.info('Augment integration status retrieved successfully');
            return createSuccessResponse(status, 'Augment integration status retrieved');

        } catch (error) {
            log.error(`Error getting Augment integration status: ${error.message}`);
            return createErrorResponse(`Failed to get Augment integration status: ${error.message}`);
        }
    })
};

/**
 * Generate Augment Setup Instructions Tool
 */
export const generateAugmentInstructions = {
    name: 'generate_augment_instructions',
    description: 'Generate detailed setup instructions for Augment Code integration',
    parameters: z.object({
        projectRoot: z.string().describe('The project root directory'),
        format: z.enum(['markdown', 'text']).optional().default('markdown').describe('Output format for instructions')
    }),
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Generating Augment setup instructions for project: ${args.projectRoot}`);

            const integration = new AugmentIntegration(args.projectRoot);
            const instructions = integration.generateSetupInstructions();
            const status = integration.getStatus();
            
            log.info('Augment setup instructions generated successfully');
            return createSuccessResponse({
                instructions,
                status,
                format: args.format
            }, 'Augment setup instructions generated successfully');

        } catch (error) {
            log.error(`Error generating Augment instructions: ${error.message}`);
            return createErrorResponse(`Failed to generate Augment instructions: ${error.message}`);
        }
    })
};

/**
 * Configure Augment MCP Server Tool
 */
export const configureAugmentMCP = {
    name: 'configure_augment_mcp',
    description: 'Configure TaskMaster as an MCP server for Augment Code with custom settings',
    parameters: z.object({
        projectRoot: z.string().describe('The project root directory'),
        serverName: z.string().optional().default('taskmaster').describe('Name for the MCP server'),
        useGlobalInstall: z.boolean().optional().default(true).describe('Use globally installed task-master-ai command'),
        customCommand: z.string().optional().describe('Custom command to run the MCP server'),
        apiKeys: z.record(z.string()).optional().describe('API keys to include in environment')
    }),
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Configuring Augment MCP server for project: ${args.projectRoot}`);

            const integration = new AugmentIntegration(args.projectRoot);
            
            // Ensure Augment directory exists
            await integration.ensureAugmentDirectory();
            
            // Create custom MCP configuration
            const mcpConfig = {
                mcpServers: {
                    [args.serverName]: {
                        command: args.customCommand || (args.useGlobalInstall ? 'task-master-ai' : 'node'),
                        args: args.useGlobalInstall ? [] : ['./mcp-server/server.js'],
                        env: {
                            NODE_ENV: 'production',
                            ...args.apiKeys
                        }
                    }
                }
            };

            const mcpConfigPath = path.join(args.projectRoot, '.augment', 'mcp-servers.json');
            fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
            
            const status = integration.getStatus();
            
            log.info('Augment MCP server configured successfully');
            return createSuccessResponse({
                ...status,
                mcpConfig,
                serverName: args.serverName
            }, 'Augment MCP server configured successfully');

        } catch (error) {
            log.error(`Error configuring Augment MCP server: ${error.message}`);
            return createErrorResponse(`Failed to configure Augment MCP server: ${error.message}`);
        }
    })
};

/**
 * Test Augment Integration Tool
 */
export const testAugmentIntegration = {
    name: 'test_augment_integration',
    description: 'Test the Augment Code integration by checking configuration and connectivity',
    parameters: z.object({
        projectRoot: z.string().describe('The project root directory')
    }),
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Testing Augment integration for project: ${args.projectRoot}`);

            const integration = new AugmentIntegration(args.projectRoot);
            const status = integration.getStatus();
            
            const tests = {
                augmentDirectory: status.augmentDir,
                mcpConfiguration: status.mcpConfig,
                contextConfiguration: status.contextConfig,
                vscodeSettings: status.vscodeSettings,
                workspaceConfig: status.workspaceConfig
            };

            const passed = Object.values(tests).filter(Boolean).length;
            const total = Object.keys(tests).length;
            const success = passed === total;

            log.info(`Augment integration test completed: ${passed}/${total} checks passed`);
            return createSuccessResponse({
                tests,
                passed,
                total,
                success,
                status
            }, `Augment integration test completed: ${passed}/${total} checks passed`);

        } catch (error) {
            log.error(`Error testing Augment integration: ${error.message}`);
            return createErrorResponse(`Failed to test Augment integration: ${error.message}`);
        }
    })
};

// Export all tools
export const augmentIntegrationTools = [
    initializeAugmentIntegration,
    getAugmentStatus,
    generateAugmentInstructions,
    configureAugmentMCP,
    testAugmentIntegration
];
