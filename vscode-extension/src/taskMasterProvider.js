const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * TaskMaster Tree Data Provider for VSCode Explorer
 */
class TaskMasterProvider {
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        this.tasksPath = path.join(workspacePath, '.taskmaster', 'tasks', 'tasks.json');
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item for display
     */
    getTreeItem(element) {
        return element;
    }

    /**
     * Get children for tree structure
     */
    getChildren(element) {
        if (!this.pathExists(this.tasksPath)) {
            vscode.window.showInformationMessage('No tasks.json found');
            return Promise.resolve([]);
        }

        if (element) {
            // Return subtasks for a task
            return Promise.resolve(this.getSubtasks(element));
        } else {
            // Return root tasks
            return Promise.resolve(this.getTasks());
        }
    }

    /**
     * Get all root tasks
     */
    getTasks() {
        try {
            const tasksData = JSON.parse(fs.readFileSync(this.tasksPath, 'utf8'));
            if (!tasksData.tasks) {
                return [];
            }

            return tasksData.tasks.map(task => {
                const taskItem = new TaskItem(
                    task.title,
                    task.id,
                    task.status,
                    task.priority,
                    task.subtasks && task.subtasks.length > 0 ? 
                        vscode.TreeItemCollapsibleState.Collapsed : 
                        vscode.TreeItemCollapsibleState.None,
                    'task'
                );

                // Set task file path
                const taskFilePath = path.join(
                    this.workspacePath, 
                    '.taskmaster', 
                    'tasks', 
                    `task_${String(task.id).padStart(3, '0')}.txt`
                );
                
                if (fs.existsSync(taskFilePath)) {
                    taskItem.filePath = taskFilePath;
                    taskItem.command = {
                        command: 'taskmaster.openTask',
                        title: 'Open Task',
                        arguments: [taskItem]
                    };
                }

                // Set icon based on status
                taskItem.iconPath = this.getStatusIcon(task.status);
                
                // Set description
                taskItem.description = `${task.status} | ${task.priority}`;
                
                // Store task data
                taskItem.taskData = task;

                return taskItem;
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading tasks: ${error.message}`);
            return [];
        }
    }

    /**
     * Get subtasks for a task
     */
    getSubtasks(taskElement) {
        if (!taskElement.taskData || !taskElement.taskData.subtasks) {
            return [];
        }

        return taskElement.taskData.subtasks.map(subtask => {
            const subtaskItem = new TaskItem(
                subtask.title,
                `${taskElement.id}.${subtask.id}`,
                subtask.status,
                taskElement.taskData.priority,
                // Check if this subtask has nested subtasks
                subtask.subtasks && subtask.subtasks.length > 0 ? 
                    vscode.TreeItemCollapsibleState.Collapsed : 
                    vscode.TreeItemCollapsibleState.None,
                'subtask'
            );

            // Set icon based on status
            subtaskItem.iconPath = this.getStatusIcon(subtask.status);
            
            // Set description
            subtaskItem.description = subtask.status;
            
            // Store subtask data
            subtaskItem.taskData = subtask;
            subtaskItem.parentId = taskElement.id;

            return subtaskItem;
        });
    }

    /**
     * Get icon based on task status
     */
    getStatusIcon(status) {
        switch (status) {
            case 'done':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            case 'in-progress':
                return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'));
            case 'pending':
                return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.blue'));
            case 'deferred':
                return new vscode.ThemeIcon('dash', new vscode.ThemeColor('charts.gray'));
            case 'cancelled':
                return new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.red'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    /**
     * Check if path exists
     */
    pathExists(p) {
        try {
            fs.accessSync(p);
            return true;
        } catch (err) {
            return false;
        }
    }
}

/**
 * Task Item for tree view
 */
class TaskItem extends vscode.TreeItem {
    constructor(label, id, status, priority, collapsibleState, contextValue) {
        super(label, collapsibleState);
        
        this.id = id;
        this.status = status;
        this.priority = priority;
        this.contextValue = contextValue;
        this.tooltip = `${label} (${status})`;
        
        // Add status indicator to label
        const statusIndicator = this.getStatusIndicator(status);
        this.label = `${statusIndicator} ${label}`;
    }

    /**
     * Get status indicator symbol
     */
    getStatusIndicator(status) {
        switch (status) {
            case 'done':
                return '✅';
            case 'in-progress':
                return '🔄';
            case 'pending':
                return '⏳';
            case 'deferred':
                return '⏸️';
            case 'cancelled':
                return '❌';
            default:
                return '📋';
        }
    }
}

module.exports = TaskMasterProvider;
