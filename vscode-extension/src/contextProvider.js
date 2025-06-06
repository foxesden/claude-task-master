const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Context Provider for Augment Code integration
 * Provides TaskMaster context to Augment for better AI assistance
 */
class ContextProvider {
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        this.tasksPath = path.join(workspacePath, '.taskmaster', 'tasks', 'tasks.json');
        this.configPath = path.join(workspacePath, '.taskmaster', 'config.json');
    }

    /**
     * Get comprehensive TaskMaster context for Augment
     */
    async getContext() {
        try {
            const context = {
                type: 'taskmaster',
                timestamp: new Date().toISOString(),
                workspace: this.workspacePath,
                project: await this.getProjectInfo(),
                tasks: await this.getTasksContext(),
                currentWork: await this.getCurrentWorkContext(),
                suggestions: await this.getContextualSuggestions()
            };

            return context;
        } catch (error) {
            console.error('Error generating TaskMaster context:', error);
            return {
                type: 'taskmaster',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get project information
     */
    async getProjectInfo() {
        try {
            if (!fs.existsSync(this.configPath)) {
                return { status: 'not_configured' };
            }

            const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            const tasksData = this.getTasksData();

            return {
                name: config.global?.projectName || 'Unknown Project',
                version: '1.0.0', // Could be read from package.json
                status: 'active',
                totalTasks: tasksData?.tasks?.length || 0,
                completedTasks: tasksData?.tasks?.filter(t => t.status === 'done').length || 0,
                configuration: {
                    models: config.models,
                    defaultPriority: config.global?.defaultPriority || 'medium',
                    defaultSubtasks: config.global?.defaultSubtasks || 5
                }
            };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Get tasks context
     */
    async getTasksContext() {
        try {
            const tasksData = this.getTasksData();
            if (!tasksData || !tasksData.tasks) {
                return { status: 'no_tasks' };
            }

            const tasks = tasksData.tasks;
            const tasksByStatus = this.groupTasksByStatus(tasks);
            const tasksByPriority = this.groupTasksByPriority(tasks);

            return {
                total: tasks.length,
                byStatus: tasksByStatus,
                byPriority: tasksByPriority,
                recentlyCompleted: this.getRecentlyCompletedTasks(tasks),
                upcomingTasks: this.getUpcomingTasks(tasks),
                blockedTasks: this.getBlockedTasks(tasks),
                dependencies: this.analyzeDependencies(tasks)
            };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Get current work context
     */
    async getCurrentWorkContext() {
        try {
            const tasksData = this.getTasksData();
            if (!tasksData || !tasksData.tasks) {
                return { status: 'no_current_work' };
            }

            const currentTask = this.findCurrentTask(tasksData.tasks);
            const nextTask = this.findNextTask(tasksData.tasks);
            const activeSubtasks = this.getActiveSubtasks(tasksData.tasks);

            return {
                currentTask: currentTask ? this.formatTaskForContext(currentTask) : null,
                nextTask: nextTask ? this.formatTaskForContext(nextTask) : null,
                activeSubtasks: activeSubtasks.map(st => this.formatSubtaskForContext(st)),
                workflowSuggestions: this.generateWorkflowSuggestions(currentTask, nextTask)
            };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Get contextual suggestions for Augment
     */
    async getContextualSuggestions() {
        try {
            const tasksData = this.getTasksData();
            if (!tasksData || !tasksData.tasks) {
                return [];
            }

            const suggestions = [];
            const tasks = tasksData.tasks;

            // Suggest next actions based on current state
            const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
            const pendingTasks = tasks.filter(t => t.status === 'pending');

            if (inProgressTasks.length === 0 && pendingTasks.length > 0) {
                suggestions.push({
                    type: 'action',
                    priority: 'high',
                    message: 'No tasks currently in progress. Consider starting the next available task.',
                    command: 'taskmaster.nextTask'
                });
            }

            if (inProgressTasks.length > 3) {
                suggestions.push({
                    type: 'warning',
                    priority: 'medium',
                    message: 'Multiple tasks in progress. Consider focusing on completing current tasks.',
                    command: 'taskmaster.refreshTasks'
                });
            }

            // Suggest task expansion for tasks without subtasks
            const tasksWithoutSubtasks = tasks.filter(t => 
                t.status === 'pending' && (!t.subtasks || t.subtasks.length === 0)
            );

            if (tasksWithoutSubtasks.length > 0) {
                suggestions.push({
                    type: 'suggestion',
                    priority: 'low',
                    message: `${tasksWithoutSubtasks.length} tasks could benefit from being expanded into subtasks.`,
                    command: 'taskmaster.expandTask'
                });
            }

            return suggestions;
        } catch (error) {
            return [{
                type: 'error',
                priority: 'high',
                message: `Error generating suggestions: ${error.message}`
            }];
        }
    }

    /**
     * Helper methods
     */
    getTasksData() {
        if (!fs.existsSync(this.tasksPath)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(this.tasksPath, 'utf8'));
    }

    groupTasksByStatus(tasks) {
        return tasks.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
        }, {});
    }

    groupTasksByPriority(tasks) {
        return tasks.reduce((acc, task) => {
            acc[task.priority] = (acc[task.priority] || 0) + 1;
            return acc;
        }, {});
    }

    getRecentlyCompletedTasks(tasks) {
        return tasks
            .filter(t => t.status === 'done')
            .slice(-3)
            .map(t => this.formatTaskForContext(t));
    }

    getUpcomingTasks(tasks) {
        return tasks
            .filter(t => t.status === 'pending')
            .filter(t => !this.hasIncompleteDependencies(t, tasks))
            .slice(0, 3)
            .map(t => this.formatTaskForContext(t));
    }

    getBlockedTasks(tasks) {
        return tasks
            .filter(t => t.status === 'pending')
            .filter(t => this.hasIncompleteDependencies(t, tasks))
            .map(t => this.formatTaskForContext(t));
    }

    analyzeDependencies(tasks) {
        const totalDependencies = tasks.reduce((acc, task) => acc + (task.dependencies?.length || 0), 0);
        const circularDeps = this.findCircularDependencies(tasks);
        
        return {
            total: totalDependencies,
            circular: circularDeps.length,
            averagePerTask: tasks.length > 0 ? (totalDependencies / tasks.length).toFixed(2) : 0
        };
    }

    findCurrentTask(tasks) {
        return tasks.find(t => t.status === 'in-progress') || null;
    }

    findNextTask(tasks) {
        return tasks.find(t => 
            t.status === 'pending' && !this.hasIncompleteDependencies(t, tasks)
        ) || null;
    }

    getActiveSubtasks(tasks) {
        const activeSubtasks = [];
        tasks.forEach(task => {
            if (task.subtasks) {
                task.subtasks.forEach(subtask => {
                    if (subtask.status === 'in-progress' || subtask.status === 'pending') {
                        activeSubtasks.push({
                            ...subtask,
                            parentId: task.id,
                            parentTitle: task.title
                        });
                    }
                });
            }
        });
        return activeSubtasks;
    }

    hasIncompleteDependencies(task, tasks) {
        if (!task.dependencies || task.dependencies.length === 0) {
            return false;
        }

        return task.dependencies.some(depId => {
            const depTask = tasks.find(t => t.id === depId);
            return depTask && depTask.status !== 'done';
        });
    }

    findCircularDependencies(tasks) {
        // Simple circular dependency detection
        const visited = new Set();
        const recursionStack = new Set();
        const circular = [];

        const dfs = (taskId) => {
            if (recursionStack.has(taskId)) {
                circular.push(taskId);
                return true;
            }
            if (visited.has(taskId)) {
                return false;
            }

            visited.add(taskId);
            recursionStack.add(taskId);

            const task = tasks.find(t => t.id === taskId);
            if (task && task.dependencies) {
                for (const depId of task.dependencies) {
                    if (dfs(depId)) {
                        return true;
                    }
                }
            }

            recursionStack.delete(taskId);
            return false;
        };

        tasks.forEach(task => {
            if (!visited.has(task.id)) {
                dfs(task.id);
            }
        });

        return circular;
    }

    formatTaskForContext(task) {
        return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dependencies: task.dependencies || [],
            subtaskCount: task.subtasks ? task.subtasks.length : 0,
            hasDetails: !!(task.details && task.details.trim()),
            hasTestStrategy: !!(task.testStrategy && task.testStrategy.trim())
        };
    }

    formatSubtaskForContext(subtask) {
        return {
            id: subtask.id,
            title: subtask.title,
            status: subtask.status,
            parentId: subtask.parentId,
            parentTitle: subtask.parentTitle
        };
    }

    generateWorkflowSuggestions(currentTask, nextTask) {
        const suggestions = [];

        if (currentTask) {
            suggestions.push(`Continue working on: ${currentTask.title}`);
            if (currentTask.subtaskCount > 0) {
                suggestions.push('Consider breaking down current task into smaller steps');
            }
        }

        if (nextTask) {
            suggestions.push(`Next task ready: ${nextTask.title}`);
        }

        if (!currentTask && !nextTask) {
            suggestions.push('All tasks completed or blocked by dependencies');
        }

        return suggestions;
    }
}

module.exports = ContextProvider;
