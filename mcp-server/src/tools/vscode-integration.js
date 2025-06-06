/**
 * VSCode Integration MCP Tool
 * Provides MCP interface for VSCode integration functionality
 */

import { z } from 'zod';
import { withNormalizedProjectRoot } from './utils.js';
import VSCodeIntegration from '../../../scripts/modules/vscode-integration.js';

// Input validation schemas
const InitializeVSCodeSchema = z.object({
    projectRoot: z.string().describe('The project root directory'),
    force: z.boolean().optional().default(false).describe('Force re-initialization even if already configured')
});

const UpdateVSCodeSettingsSchema = z.object({
    projectRoot: z.string().describe('The project root directory'),
    settings: z.record(z.any()).describe('Settings to update in VSCode configuration')
});

const GetVSCodeStatusSchema = z.object({
    projectRoot: z.string().describe('The project root directory')
});

/**
 * Create error response
 */
function createErrorResponse(message, code = 'VSCODE_INTEGRATION_ERROR') {
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
 * Initialize VSCode Integration Tool
 */
export const initializeVSCodeIntegration = {
    name: 'initialize_vscode_integration',
    description: 'Initialize VSCode integration for TaskMaster project including settings, tasks, and Augment configuration',
    inputSchema: InitializeVSCodeSchema,
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Initializing VSCode integration for project: ${args.projectRoot}`);

            const integration = new VSCodeIntegration(args.projectRoot);
            
            // Check if already initialized and not forcing
            if (!args.force) {
                const status = integration.getStatus();
                if (status.initialized && status.settingsConfigured) {
                    return createSuccessResponse(status, 'VSCode integration already configured');
                }
            }

            // Initialize the integration
            const success = await integration.initialize();
            
            if (!success) {
                return createErrorResponse('Failed to initialize VSCode integration');
            }

            // Setup Augment-specific configuration
            await integration.setupAugmentConfiguration();

            const finalStatus = integration.getStatus();
            
            log.info('VSCode integration initialized successfully');
            return createSuccessResponse(finalStatus, 'VSCode integration initialized successfully');

        } catch (error) {
            log.error(`Error initializing VSCode integration: ${error.message}`);
            return createErrorResponse(`Failed to initialize VSCode integration: ${error.message}`);
        }
    })
};

/**
 * Update VSCode Settings Tool
 */
export const updateVSCodeSettings = {
    name: 'update_vscode_settings',
    description: 'Update VSCode settings for TaskMaster integration',
    inputSchema: UpdateVSCodeSettingsSchema,
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Updating VSCode settings for project: ${args.projectRoot}`);

            const integration = new VSCodeIntegration(args.projectRoot);
            
            // Update the settings
            const success = await integration.updateSettings(args.settings);
            
            if (!success) {
                return createErrorResponse('Failed to update VSCode settings');
            }

            const status = integration.getStatus();
            
            log.info('VSCode settings updated successfully');
            return createSuccessResponse(status, 'VSCode settings updated successfully');

        } catch (error) {
            log.error(`Error updating VSCode settings: ${error.message}`);
            return createErrorResponse(`Failed to update VSCode settings: ${error.message}`);
        }
    })
};

/**
 * Get VSCode Integration Status Tool
 */
export const getVSCodeStatus = {
    name: 'get_vscode_status',
    description: 'Get the current status of VSCode integration for TaskMaster',
    inputSchema: GetVSCodeStatusSchema,
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Getting VSCode integration status for project: ${args.projectRoot}`);

            const integration = new VSCodeIntegration(args.projectRoot);
            const status = integration.getStatus();
            
            log.info('VSCode integration status retrieved successfully');
            return createSuccessResponse(status, 'VSCode integration status retrieved');

        } catch (error) {
            log.error(`Error getting VSCode integration status: ${error.message}`);
            return createErrorResponse(`Failed to get VSCode integration status: ${error.message}`);
        }
    })
};

/**
 * Setup Augment Context Provider Tool
 */
export const setupAugmentContextProvider = {
    name: 'setup_augment_context_provider',
    description: 'Setup TaskMaster as a context provider for Augment Code extension',
    inputSchema: z.object({
        projectRoot: z.string().describe('The project root directory'),
        enabled: z.boolean().optional().default(true).describe('Enable or disable the context provider')
    }),
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Setting up Augment context provider for project: ${args.projectRoot}`);

            const integration = new VSCodeIntegration(args.projectRoot);
            
            // Setup Augment configuration
            await integration.setupAugmentConfiguration();

            // Update VSCode settings for Augment integration
            const augmentSettings = {
                'augment.taskmaster.enabled': args.enabled,
                'augment.taskmaster.contextProvider': args.enabled,
                'taskmaster.enableAugmentIntegration': args.enabled
            };

            await integration.updateSettings(augmentSettings);

            const status = integration.getStatus();
            
            log.info('Augment context provider setup completed');
            return createSuccessResponse(
                { ...status, augmentEnabled: args.enabled }, 
                'Augment context provider configured successfully'
            );

        } catch (error) {
            log.error(`Error setting up Augment context provider: ${error.message}`);
            return createErrorResponse(`Failed to setup Augment context provider: ${error.message}`);
        }
    })
};

/**
 * Generate VSCode Workspace Tool
 */
export const generateVSCodeWorkspace = {
    name: 'generate_vscode_workspace',
    description: 'Generate a VSCode workspace file optimized for TaskMaster development',
    inputSchema: z.object({
        projectRoot: z.string().describe('The project root directory'),
        workspaceName: z.string().optional().describe('Custom name for the workspace file')
    }),
    execute: withNormalizedProjectRoot(async (args, { log, session }) => {
        try {
            log.info(`Generating VSCode workspace for project: ${args.projectRoot}`);

            const integration = new VSCodeIntegration(args.projectRoot);
            
            // Setup workspace configuration
            await integration.setupWorkspaceSettings();

            const status = integration.getStatus();
            
            log.info('VSCode workspace generated successfully');
            return createSuccessResponse(status, 'VSCode workspace file generated successfully');

        } catch (error) {
            log.error(`Error generating VSCode workspace: ${error.message}`);
            return createErrorResponse(`Failed to generate VSCode workspace: ${error.message}`);
        }
    })
};

// Export all tools
export const vscodeIntegrationTools = [
    initializeVSCodeIntegration,
    updateVSCodeSettings,
    getVSCodeStatus,
    setupAugmentContextProvider,
    generateVSCodeWorkspace
];
