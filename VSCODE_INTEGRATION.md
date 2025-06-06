# TaskMaster VSCode Integration

This document describes the VSCode integration features for TaskMaster, including Augment Code extension support and nested subtask functionality.

## Features

### 1. VSCode Extension Integration

TaskMaster now includes a dedicated VSCode extension that provides:

- **Task Explorer**: View and manage tasks directly in VSCode sidebar
- **Command Palette Integration**: Access TaskMaster commands via Ctrl+Shift+P
- **Task File Navigation**: Click to open task files directly
- **Status Management**: Mark tasks as done, in-progress, etc. from VSCode
- **Subtask Support**: Create and manage nested subtasks with unlimited depth

### 2. Augment Code Integration

Deep integration with the Augment Code extension:

- **Context Provider**: TaskMaster automatically provides project context to Augment
- **Current Task Awareness**: Augment knows what task you're working on
- **Smart Suggestions**: Get contextual suggestions based on task progress
- **Workflow Integration**: Seamless task management within Augment workflows

### 3. Nested Subtasks

Enhanced subtask support with unlimited nesting depth:

- **Hierarchical IDs**: Subtasks use format like `1.2.3.4` for deep nesting
- **Dependency Management**: Dependencies work across all nesting levels
- **Visual Hierarchy**: Clear indentation and structure in displays
- **Backward Compatibility**: Existing single-level subtasks continue to work

## Installation

### 1. Initialize VSCode Integration

```bash
# Initialize VSCode integration for existing project
task-master vscode --init

# Check integration status
task-master vscode --status

# Setup Augment Code integration
task-master vscode --augment
```

### 2. Install VSCode Extension

The TaskMaster VSCode extension is located in the `vscode-extension/` directory:

```bash
# From your project root
cd vscode-extension
code --install-extension .
```

### 3. Configure Augment Integration

Add to your VSCode settings.json:

```json
{
  "taskmaster.enableAugmentIntegration": true,
  "augment.taskmaster.enabled": true,
  "augment.taskmaster.contextProvider": true
}
```

## Usage

### VSCode Extension Commands

Access these commands via Command Palette (Ctrl+Shift+P):

- `TaskMaster: Initialize` - Initialize TaskMaster in workspace
- `TaskMaster: Refresh Tasks` - Reload task list
- `TaskMaster: Add Task` - Create new task
- `TaskMaster: Add Subtask` - Add subtask to selected task
- `TaskMaster: Expand Task` - Generate subtasks for task
- `TaskMaster: Mark as Done` - Complete selected task
- `TaskMaster: Find Next Task` - Find next available task
- `TaskMaster: Generate Files` - Generate task files

### Task Explorer

The Task Explorer appears in the VSCode sidebar when TaskMaster is detected:

- **Tree View**: Hierarchical display of tasks and subtasks
- **Status Icons**: Visual indicators for task status
- **Context Menu**: Right-click for task actions
- **Drag & Drop**: Reorder tasks (coming soon)

### Nested Subtasks

Create nested subtasks with unlimited depth:

```bash
# Add subtask to task 5
task-master add-subtask --id=5 --title="Setup Database"

# Add nested subtask to subtask 5.2
task-master add-subtask --id=5.2 --title="Configure Connection Pool"

# Add deeply nested subtask
task-master add-subtask --id=5.2.1 --title="Set Pool Size"
```

Hierarchical IDs:
- `5` - Task 5
- `5.2` - Subtask 2 of Task 5
- `5.2.1` - Subtask 1 of Subtask 5.2
- `5.2.1.3` - Subtask 3 of Subtask 5.2.1

### Augment Integration

When Augment Code extension is active, TaskMaster provides:

#### Context Information
- Current project status and progress
- Active tasks and next available tasks
- Recent task completions
- Project phase (initialization, development, etc.)

#### Available Commands
- `Get Current Task` - Retrieve task currently being worked on
- `Get Next Task` - Find next task to work on
- `Get Task Context` - Get detailed context for specific task
- `Update Task Progress` - Update progress on current task

#### Smart Suggestions
Augment receives contextual suggestions like:
- "No tasks currently in progress. Consider starting the next available task."
- "Multiple tasks in progress. Consider focusing on completing current tasks."
- "Tasks could benefit from being expanded into subtasks."

## Migration

### Migrate Existing Projects

For existing TaskMaster projects, run the enhanced migration:

```bash
# Check what migrations are needed
task-master migrate-enhanced --check

# Run all available migrations
task-master migrate-enhanced

# Run specific migrations
task-master migrate-enhanced --migrations=nested-subtasks,vscode-integration

# Restore from backup if needed
task-master migrate-enhanced --restore=/path/to/backup
```

### Migration Types

1. **nested-subtasks**: Converts existing subtasks to support nesting
2. **version-metadata**: Adds version and feature metadata
3. **vscode-integration**: Sets up VSCode configuration files

## Configuration

### VSCode Settings

TaskMaster adds these settings to `.vscode/settings.json`:

```json
{
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
}
```

### VSCode Tasks

TaskMaster creates these VSCode tasks in `.vscode/tasks.json`:

- **TaskMaster: Initialize** - Initialize new project
- **TaskMaster: List Tasks** - Show all tasks
- **TaskMaster: Next Task** - Find next task
- **TaskMaster: Generate Files** - Generate task files
- **TaskMaster: Start MCP Server** - Start MCP server for integrations

### Extension Recommendations

Added to `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "augmentcode.augment"
  ]
}
```

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure `.taskmaster` directory exists
   - Run `task-master vscode --init`
   - Reload VSCode window

2. **Augment integration not working**
   - Check Augment extension is installed and active
   - Verify settings: `task-master vscode --status`
   - Run `task-master vscode --augment`

3. **Nested subtasks not displaying**
   - Run migration: `task-master migrate-enhanced`
   - Check schema version: `task-master migrate-enhanced --check`

### Debug Mode

Enable debug logging in VSCode:

```json
{
  "taskmaster.debug": true
}
```

Check VSCode Developer Console (Help > Toggle Developer Tools) for TaskMaster logs.

## API Reference

### VSCode Extension API

The extension exposes these APIs for other extensions:

```javascript
// Get TaskMaster extension
const taskmaster = vscode.extensions.getExtension('taskmaster.vscode');

// Get current task
const currentTask = await taskmaster.exports.getCurrentTask();

// Get project status
const status = await taskmaster.exports.getProjectStatus();
```

### Augment Integration API

TaskMaster registers these commands with Augment:

- `taskmaster.getCurrentTask()` - Returns current task object
- `taskmaster.getNextTask()` - Returns next available task
- `taskmaster.getTaskContext(taskId)` - Returns detailed task context
- `taskmaster.updateTaskProgress(taskId, progress)` - Updates task progress

## Contributing

To contribute to VSCode integration:

1. Fork the repository
2. Make changes in `vscode-extension/` directory
3. Test with `code --install-extension .`
4. Submit pull request

For Augment integration improvements, modify:
- `vscode-extension/src/augmentIntegration.js`
- `vscode-extension/src/contextProvider.js`
- `scripts/modules/vscode-integration.js`
