const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const TaskMasterProvider = require('./taskMasterProvider');
const AugmentIntegration = require('./augmentIntegration');
const ContextProvider = require('./contextProvider');

/**
 * Main extension activation function
 * @param {vscode.ExtensionContext} context 
 */
async function activate(context) {
    console.log('TaskMaster VSCode extension is now active!');

    // Check if we're in a TaskMaster project
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    const taskmasterPath = path.join(workspaceFolder.uri.fsPath, '.taskmaster');
    const isTaskMasterProject = fs.existsSync(taskmasterPath);

    // Set context for when clauses
    vscode.commands.executeCommand('setContext', 'taskmaster.enabled', isTaskMasterProject);

    if (!isTaskMasterProject) {
        // Show option to initialize TaskMaster
        const result = await vscode.window.showInformationMessage(
            'This workspace is not a TaskMaster project. Would you like to initialize it?',
            'Initialize',
            'Not now'
        );
        
        if (result === 'Initialize') {
            vscode.commands.executeCommand('taskmaster.initialize');
        }
        return;
    }

    // Initialize providers
    const taskMasterProvider = new TaskMasterProvider(workspaceFolder.uri.fsPath);
    const augmentIntegration = new AugmentIntegration(context);
    const contextProvider = new ContextProvider(workspaceFolder.uri.fsPath);

    // Register tree data provider
    vscode.window.createTreeView('taskmasterExplorer', {
        treeDataProvider: taskMasterProvider,
        showCollapseAll: true
    });

    // Register commands
    const commands = [
        vscode.commands.registerCommand('taskmaster.initialize', () => initializeTaskMaster(workspaceFolder.uri.fsPath)),
        vscode.commands.registerCommand('taskmaster.refreshTasks', () => taskMasterProvider.refresh()),
        vscode.commands.registerCommand('taskmaster.addTask', () => addTask(taskMasterProvider)),
        vscode.commands.registerCommand('taskmaster.addSubtask', (taskItem) => addSubtask(taskMasterProvider, taskItem)),
        vscode.commands.registerCommand('taskmaster.expandTask', (taskItem) => expandTask(taskMasterProvider, taskItem)),
        vscode.commands.registerCommand('taskmaster.markDone', (taskItem) => markTaskDone(taskMasterProvider, taskItem)),
        vscode.commands.registerCommand('taskmaster.openTask', (taskItem) => openTask(taskItem)),
        vscode.commands.registerCommand('taskmaster.nextTask', () => findNextTask(taskMasterProvider)),
        vscode.commands.registerCommand('taskmaster.generateFiles', () => generateTaskFiles(taskMasterProvider))
    ];

    // Register all commands with context
    commands.forEach(command => context.subscriptions.push(command));

    // Initialize Augment integration if enabled
    const config = vscode.workspace.getConfiguration('taskmaster');
    if (config.get('enableAugmentIntegration')) {
        await augmentIntegration.initialize();
        context.subscriptions.push(augmentIntegration);
    }

    // Register context provider for Augment
    context.subscriptions.push(contextProvider);

    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/.taskmaster/tasks/tasks.json');
    watcher.onDidChange(() => {
        if (config.get('autoRefresh')) {
            taskMasterProvider.refresh();
        }
    });
    context.subscriptions.push(watcher);

    // Show welcome message
    vscode.window.showInformationMessage('TaskMaster extension activated successfully!');
}

/**
 * Initialize TaskMaster in the current workspace
 */
async function initializeTaskMaster(workspacePath) {
    try {
        const terminal = vscode.window.createTerminal('TaskMaster Init');
        terminal.sendText('npx task-master-ai init');
        terminal.show();
        
        vscode.window.showInformationMessage('Initializing TaskMaster project...');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize TaskMaster: ${error.message}`);
    }
}

/**
 * Add a new task
 */
async function addTask(provider) {
    const title = await vscode.window.showInputBox({
        prompt: 'Enter task title',
        placeHolder: 'Task title...'
    });

    if (!title) return;

    const description = await vscode.window.showInputBox({
        prompt: 'Enter task description',
        placeHolder: 'Task description...'
    });

    if (!description) return;

    const priority = await vscode.window.showQuickPick(['high', 'medium', 'low'], {
        placeHolder: 'Select priority'
    });

    try {
        const terminal = vscode.window.createTerminal('TaskMaster');
        const command = `npx task-master-ai add-task --title="${title}" --description="${description}" --priority="${priority || 'medium'}"`;
        terminal.sendText(command);
        terminal.show();

        // Refresh after a delay
        setTimeout(() => provider.refresh(), 2000);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add task: ${error.message}`);
    }
}

/**
 * Add a subtask to the selected task
 */
async function addSubtask(provider, taskItem) {
    if (!taskItem || !taskItem.id) {
        vscode.window.showErrorMessage('Please select a task first');
        return;
    }

    const title = await vscode.window.showInputBox({
        prompt: 'Enter subtask title',
        placeHolder: 'Subtask title...'
    });

    if (!title) return;

    const description = await vscode.window.showInputBox({
        prompt: 'Enter subtask description',
        placeHolder: 'Subtask description...'
    });

    try {
        const terminal = vscode.window.createTerminal('TaskMaster');
        const command = `npx task-master-ai add-subtask --id="${taskItem.id}" --title="${title}" --description="${description || ''}"`;
        terminal.sendText(command);
        terminal.show();

        setTimeout(() => provider.refresh(), 2000);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add subtask: ${error.message}`);
    }
}

/**
 * Expand task into subtasks
 */
async function expandTask(provider, taskItem) {
    if (!taskItem || !taskItem.id) {
        vscode.window.showErrorMessage('Please select a task first');
        return;
    }

    const count = await vscode.window.showInputBox({
        prompt: 'Number of subtasks to generate',
        placeHolder: '5',
        value: '5'
    });

    if (!count) return;

    try {
        const terminal = vscode.window.createTerminal('TaskMaster');
        const command = `npx task-master-ai expand --id="${taskItem.id}" --num="${count}"`;
        terminal.sendText(command);
        terminal.show();

        setTimeout(() => provider.refresh(), 5000);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to expand task: ${error.message}`);
    }
}

/**
 * Mark task as done
 */
async function markTaskDone(provider, taskItem) {
    if (!taskItem || !taskItem.id) {
        vscode.window.showErrorMessage('Please select a task first');
        return;
    }

    try {
        const terminal = vscode.window.createTerminal('TaskMaster');
        const command = `npx task-master-ai set-status --id="${taskItem.id}" --status="done"`;
        terminal.sendText(command);
        terminal.show();

        setTimeout(() => provider.refresh(), 2000);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to mark task as done: ${error.message}`);
    }
}

/**
 * Open task file
 */
async function openTask(taskItem) {
    if (!taskItem || !taskItem.filePath) {
        vscode.window.showErrorMessage('Task file not found');
        return;
    }

    try {
        const document = await vscode.workspace.openTextDocument(taskItem.filePath);
        await vscode.window.showTextDocument(document);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open task file: ${error.message}`);
    }
}

/**
 * Find next task to work on
 */
async function findNextTask(provider) {
    try {
        const terminal = vscode.window.createTerminal('TaskMaster');
        terminal.sendText('npx task-master-ai next');
        terminal.show();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to find next task: ${error.message}`);
    }
}

/**
 * Generate task files
 */
async function generateTaskFiles(provider) {
    try {
        const terminal = vscode.window.createTerminal('TaskMaster');
        terminal.sendText('npx task-master-ai generate');
        terminal.show();

        setTimeout(() => provider.refresh(), 3000);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate task files: ${error.message}`);
    }
}

function deactivate() {
    console.log('TaskMaster VSCode extension is now deactivated');
}

module.exports = {
    activate,
    deactivate
};
