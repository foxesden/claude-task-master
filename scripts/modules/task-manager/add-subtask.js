import path from 'path';

import { log, readJSON, writeJSON } from '../utils.js';
import { isTaskDependentOn } from '../task-manager.js';
import generateTaskFiles from './generate-task-files.js';
import {
    parseSubtaskId,
    generateSubtaskId,
    addNestedSubtask,
    findNestedSubtask,
    migrateLegacySubtasks
} from './nested-subtask-utils.js';

/**
 * Add a subtask to a parent task (supports nested subtasks)
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number|string} parentId - ID of the parent task or hierarchical subtask ID (e.g., "1.2.3")
 * @param {number|string|null} existingTaskId - ID of an existing task to convert to subtask (optional)
 * @param {Object} newSubtaskData - Data for creating a new subtask (used if existingTaskId is null)
 * @param {boolean} generateFiles - Whether to regenerate task files after adding the subtask
 * @returns {Object} The newly created or converted subtask with full hierarchical ID
 */
async function addSubtask(
	tasksPath,
	parentId,
	existingTaskId = null,
	newSubtaskData = null,
	generateFiles = true
) {
	try {
		log('info', `Adding subtask to parent ${parentId}...`);

		// Read the existing tasks
		const data = readJSON(tasksPath);
		if (!data || !data.tasks) {
			throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
		}

		// Determine if parentId is a task ID or hierarchical subtask ID
		let parentTask, targetPath, isNestedSubtask = false;

		if (typeof parentId === 'string' && parentId.includes('.')) {
			// Hierarchical subtask ID (e.g., "1.2.3")
			isNestedSubtask = true;
			const parsed = parseSubtaskId(parentId);
			parentTask = data.tasks.find(task => task.id === parsed.parentId);

			if (!parentTask) {
				throw new Error(`Parent task with ID ${parsed.parentId} not found`);
			}

			// Migrate legacy subtasks if needed
			migrateLegacySubtasks(parentTask);

			// Verify the target subtask exists
			const targetSubtask = findNestedSubtask(parentTask, parsed.path);
			if (!targetSubtask) {
				throw new Error(`Target subtask ${parentId} not found`);
			}

			targetPath = [...parsed.path, 0]; // Will be updated with actual new ID
		} else {
			// Regular task ID
			const parentIdNum = parseInt(parentId, 10);
			if (isNaN(parentIdNum)) {
				throw new Error(`Invalid parent ID: ${parentId}`);
			}

			parentTask = data.tasks.find(task => task.id === parentIdNum);
			if (!parentTask) {
				throw new Error(`Parent task with ID ${parentIdNum} not found`);
			}

			// Migrate legacy subtasks if needed
			migrateLegacySubtasks(parentTask);

			targetPath = [0]; // Will be updated with actual new ID
		}

		let newSubtask;

		// Case 1: Convert an existing task to a subtask
		if (existingTaskId !== null) {
			const existingTaskIdNum = parseInt(existingTaskId, 10);

			// Find the existing task
			const existingTaskIndex = data.tasks.findIndex(
				(t) => t.id === existingTaskIdNum
			);
			if (existingTaskIndex === -1) {
				throw new Error(`Task with ID ${existingTaskIdNum} not found`);
			}

			const existingTask = data.tasks[existingTaskIndex];

			// Check if task is already a subtask
			if (existingTask.parentTaskId) {
				throw new Error(
					`Task ${existingTaskIdNum} is already a subtask of task ${existingTask.parentTaskId}`
				);
			}

			// Check for circular dependency
			const rootParentId = isNestedSubtask ?
				parseSubtaskId(parentId).parentId :
				parseInt(parentId, 10);

			if (existingTaskIdNum === rootParentId) {
				throw new Error(`Cannot make a task a subtask of itself`);
			}

			// Check if parent task is a subtask of the task we're converting
			if (isTaskDependentOn(data.tasks, parentTask, existingTaskIdNum)) {
				throw new Error(
					`Cannot create circular dependency: task ${rootParentId} is already a subtask or dependent of task ${existingTaskIdNum}`
				);
			}

			// Use nested subtask utilities to add the converted task
			const convertedTaskData = {
				title: existingTask.title,
				description: existingTask.description || '',
				details: existingTask.details || '',
				status: existingTask.status || 'pending',
				dependencies: existingTask.dependencies || []
			};

			const result = addNestedSubtask(parentTask, targetPath, convertedTaskData);
			newSubtask = result.subtask;

			// Remove the task from the main tasks array
			data.tasks.splice(existingTaskIndex, 1);

			log('info', `Converted task ${existingTaskIdNum} to subtask ${result.fullId}`);
		}
		// Case 2: Create a new subtask
		else if (newSubtaskData) {
			// Use nested subtask utilities to add the new subtask
			const result = addNestedSubtask(parentTask, targetPath, newSubtaskData);
			newSubtask = result.subtask;

			log('info', `Created new subtask ${result.fullId}`);
		} else {
			throw new Error(
				'Either existingTaskId or newSubtaskData must be provided'
			);
		}

		// Write the updated tasks back to the file
		writeJSON(tasksPath, data);

		// Generate task files if requested
		if (generateFiles) {
			log('info', 'Regenerating task files...');
			await generateTaskFiles(tasksPath, path.dirname(tasksPath));
		}

		// Return the new subtask with additional metadata for nested subtasks
		return {
			...newSubtask,
			fullId: isNestedSubtask ?
				generateSubtaskId(parentTask.id, [...targetPath.slice(0, -1), newSubtask.id]) :
				`${parentTask.id}.${newSubtask.id}`,
			isNested: isNestedSubtask,
			depth: targetPath.length
		};
	} catch (error) {
		log('error', `Error adding subtask: ${error.message}`);
		throw error;
	}
}

export default addSubtask;
