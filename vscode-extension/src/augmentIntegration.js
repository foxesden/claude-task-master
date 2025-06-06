const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Integration with Augment Code extension
 */
class AugmentIntegration {
    constructor(context) {
        this.context = context;
        this.augmentExtension = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Augment integration
     */
    async initialize() {
        try {
            // Check if Augment extension is installed and active
            this.augmentExtension = vscode.extensions.getExtension('augmentcode.augment');
            
            if (!this.augmentExtension) {
                console.log('Augment Code extension not found');
                return false;
            }

            if (!this.augmentExtension.isActive) {
                await this.augmentExtension.activate();
            }

            // Register TaskMaster as a context provider for Augment
            await this.registerContextProvider();
            
            // Register TaskMaster commands with Augment
            await this.registerAugmentCommands();

            this.isInitialized = true;
            console.log('TaskMaster-Augment integration initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Augment integration:', error);
            return false;
        }
    }

    /**
     * Register TaskMaster as a context provider for Augment
     */
    async registerContextProvider() {
        try {
            // Get the Augment API if available
            const augmentApi = this.augmentExtension?.exports;
            
            if (augmentApi && augmentApi.registerContextProvider) {
                await augmentApi.registerContextProvider({
                    id: 'taskmaster',
                    name: 'TaskMaster Context',
                    description: 'Provides current task context and project status',
                    getContext: this.getTaskMasterContext.bind(this)
                });
                
                console.log('TaskMaster context provider registered with Augment');
            }
        } catch (error) {
            console.error('Failed to register context provider:', error);
        }
    }

    /**
     * Register TaskMaster commands with Augment
     */
    async registerAugmentCommands() {
        try {
            const augmentApi = this.augmentExtension?.exports;
            
            if (augmentApi && augmentApi.registerCommands) {
                const commands = [
                    {
                        id: 'taskmaster.getCurrentTask',
                        title: 'Get Current Task',
                        description: 'Get the current task being worked on',
                        handler: this.getCurrentTask.bind(this)
                    },
                    {
                        id: 'taskmaster.getNextTask',
                        title: 'Get Next Task',
                        description: 'Find the next task to work on',
                        handler: this.getNextTask.bind(this)
                    },
                    {
                        id: 'taskmaster.getTaskContext',
                        title: 'Get Task Context',
                        description: 'Get context for a specific task',
                        handler: this.getTaskContext.bind(this)
                    },
                    {
                        id: 'taskmaster.updateTaskProgress',
                        title: 'Update Task Progress',
                        description: 'Update progress on current task',
                        handler: this.updateTaskProgress.bind(this)
                    }
                ];

                await augmentApi.registerCommands(commands);
                console.log('TaskMaster commands registered with Augment');
            }
        } catch (error) {
            console.error('Failed to register Augment commands:', error);
        }
    }

    /**
     * Get TaskMaster context for Augment
     */
    async getTaskMasterContext() {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return null;
            }

            const tasksPath = path.join(workspaceFolder.uri.fsPath, '.taskmaster', 'tasks', 'tasks.json');
            
            if (!fs.existsSync(tasksPath)) {
                return {
                    type: 'taskmaster',
                    status: 'not_initialized',
                    message: 'TaskMaster not initialized in this workspace'
                };
            }

            const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
            const currentTask = await this.findCurrentTask(tasksData);
            const nextTask = await this.findNextTask(tasksData);
            
            return {
                type: 'taskmaster',
                status: 'active',
                projectName: tasksData.meta?.projectName || 'Unknown Project',
                totalTasks: tasksData.tasks?.length || 0,
                completedTasks: tasksData.tasks?.filter(t => t.status === 'done').length || 0,
                currentTask: currentTask,
                nextTask: nextTask,
                recentTasks: this.getRecentTasks(tasksData),
                context: this.generateProjectContext(tasksData)
            };
        } catch (error) {
            console.error('Error getting TaskMaster context:', error);
            return {
                type: 'taskmaster',
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Find the current task being worked on
     */
    async findCurrentTask(tasksData) {
        // Look for tasks with 'in-progress' status
        const inProgressTasks = tasksData.tasks?.filter(t => t.status === 'in-progress') || [];
        
        if (inProgressTasks.length > 0) {
            return inProgressTasks[0];
        }

        // If no in-progress tasks, return the next available task
        return this.findNextTask(tasksData);
    }

    /**
     * Find the next task to work on
     */
    async findNextTask(tasksData) {
        if (!tasksData.tasks) return null;

        // Find tasks that are pending and have no incomplete dependencies
        const pendingTasks = tasksData.tasks.filter(t => t.status === 'pending');
        
        for (const task of pendingTasks) {
            const hasIncompleteDependencies = task.dependencies?.some(depId => {
                const depTask = tasksData.tasks.find(t => t.id === depId);
                return depTask && depTask.status !== 'done';
            });

            if (!hasIncompleteDependencies) {
                return task;
            }
        }

        return null;
    }

    /**
     * Get recent tasks (completed or modified recently)
     */
    getRecentTasks(tasksData) {
        if (!tasksData.tasks) return [];

        return tasksData.tasks
            .filter(t => t.status === 'done' || t.status === 'in-progress')
            .slice(-5); // Get last 5 tasks
    }

    /**
     * Generate project context summary
     */
    generateProjectContext(tasksData) {
        const tasks = tasksData.tasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;

        return {
            summary: `Project has ${totalTasks} total tasks: ${completedTasks} completed, ${inProgressTasks} in progress, ${pendingTasks} pending`,
            progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            phase: this.determineProjectPhase(tasks)
        };
    }

    /**
     * Determine current project phase based on task completion
     */
    determineProjectPhase(tasks) {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const progress = totalTasks > 0 ? (completedTasks / totalTasks) : 0;

        if (progress < 0.25) return 'initialization';
        if (progress < 0.5) return 'development';
        if (progress < 0.75) return 'implementation';
        if (progress < 1.0) return 'finalization';
        return 'completed';
    }

    /**
     * Command handlers for Augment integration
     */
    async getCurrentTask() {
        const context = await this.getTaskMasterContext();
        return context?.currentTask || null;
    }

    async getNextTask() {
        const context = await this.getTaskMasterContext();
        return context?.nextTask || null;
    }

    async getTaskContext(taskId) {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return null;

            const tasksPath = path.join(workspaceFolder.uri.fsPath, '.taskmaster', 'tasks', 'tasks.json');
            const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
            
            const task = tasksData.tasks?.find(t => t.id === taskId);
            if (!task) return null;

            return {
                task: task,
                dependencies: this.getTaskDependencies(task, tasksData),
                subtasks: task.subtasks || [],
                relatedTasks: this.getRelatedTasks(task, tasksData)
            };
        } catch (error) {
            console.error('Error getting task context:', error);
            return null;
        }
    }

    async updateTaskProgress(taskId, progress) {
        // This would integrate with TaskMaster's update functionality
        // For now, we'll use the terminal approach
        const terminal = vscode.window.createTerminal('TaskMaster Update');
        terminal.sendText(`npx task-master-ai update-task --id="${taskId}" --prompt="${progress}"`);
        return true;
    }

    /**
     * Get task dependencies
     */
    getTaskDependencies(task, tasksData) {
        if (!task.dependencies) return [];
        
        return task.dependencies.map(depId => {
            return tasksData.tasks?.find(t => t.id === depId);
        }).filter(Boolean);
    }

    /**
     * Get related tasks (tasks that depend on this one)
     */
    getRelatedTasks(task, tasksData) {
        if (!tasksData.tasks) return [];
        
        return tasksData.tasks.filter(t => 
            t.dependencies?.includes(task.id)
        );
    }

    /**
     * Dispose resources
     */
    dispose() {
        // Clean up any resources
        this.isInitialized = false;
    }
}

module.exports = AugmentIntegration;
