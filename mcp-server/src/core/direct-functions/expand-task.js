/**
 * expand-task.js
 * Direct function implementation for expanding a task into subtasks
 */

import expandTask from '../../../../scripts/modules/task-manager/expand-task.js';
import {
	readJSON,
	writeJSON,
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../../../../scripts/modules/utils.js';
import path from 'path';
import fs from 'fs';
import { createLogWrapper } from '../../tools/utils.js';

/**
 * Direct function wrapper for expanding a task into subtasks with error handling.
 *
 * @param {Object} args - Command arguments
 * @param {string} args.tasksJsonPath - Explicit path to the tasks.json file.
 * @param {string} args.id - The ID of the task to expand.
 * @param {number|string} [args.num] - Number of subtasks to generate.
 * @param {boolean} [args.research] - Enable research role for subtask generation.
 * @param {string} [args.prompt] - Additional context to guide subtask generation.
 * @param {boolean} [args.force] - Force expansion even if subtasks exist.
 * @param {string} [args.projectRoot] - Project root directory.
 * @param {Object} log - Logger object
 * @param {Object} context - Context object containing session
 * @param {Object} [context.session] - MCP Session object
 * @returns {Promise<Object>} - Task expansion result { success: boolean, data?: any, error?: { code: string, message: string } }
 */
export async function expandTaskDirect(args, log, context = {}) {
	const { session } = context; // Extract session
	// Destructure expected args, including projectRoot
	const { tasksJsonPath, id, num, research, prompt, force, projectRoot } = args;

	// Log session root data for debugging
	log.info(
		`Session data in expandTaskDirect: ${JSON.stringify({
			hasSession: !!session,
			sessionKeys: session ? Object.keys(session) : [],
			roots: session?.roots,
			rootsStr: JSON.stringify(session?.roots)
		})}`
	);

	// Check if tasksJsonPath was provided
	if (!tasksJsonPath) {
		log.error('expandTaskDirect called without tasksJsonPath');
		return {
			success: false,
			error: {
				code: 'MISSING_ARGUMENT',
				message: 'tasksJsonPath is required'
			}
		};
	}

	// Use provided path
	const tasksPath = tasksJsonPath;

	log.info(`[expandTaskDirect] Using tasksPath: ${tasksPath}`);

	// Validate task ID - support both numeric and subtask IDs
	const taskId = id;
	if (!taskId) {
		log.error('Task ID is required');
		return {
			success: false,
			error: {
				code: 'INPUT_VALIDATION_ERROR',
				message: 'Task ID is required'
			}
		};
	}

	// Process other parameters
	const numSubtasks = num ? parseInt(num, 10) : undefined;
	const useResearch = research === true;
	const additionalContext = prompt || '';
	const forceFlag = force === true;

	try {
		log.info(
			`[expandTaskDirect] Expanding task ${taskId} into ${numSubtasks || 'default'} subtasks. Research: ${useResearch}, Force: ${forceFlag}`
		);

		// Read tasks data
		log.info(`[expandTaskDirect] Attempting to read JSON from: ${tasksPath}`);
		const data = readJSON(tasksPath);
		log.info(
			`[expandTaskDirect] Result of readJSON: ${data ? 'Data read successfully' : 'readJSON returned null or undefined'}`
		);

		if (!data || !data.tasks) {
			log.error(
				`[expandTaskDirect] readJSON failed or returned invalid data for path: ${tasksPath}`
			);
			return {
				success: false,
				error: {
					code: 'INVALID_TASKS_FILE',
					message: `No valid tasks found in ${tasksPath}. readJSON returned: ${JSON.stringify(data)}`
				}
			};
		}

		// Enhanced task finding logic for subtasks
		log.info(`[expandTaskDirect] Searching for task/subtask ID ${taskId} in data`);
		let task = null;
		let isSubtask = false;
		let mainTaskIndex = -1;

		// Check if taskId is a subtask ID (contains dots)
		if (taskId.includes('.')) {
			isSubtask = true;
			const parts = taskId.split('.');
			const mainTaskId = parseInt(parts[0], 10);

			// Find the main task
			mainTaskIndex = data.tasks.findIndex((t) => t.id === mainTaskId);
			if (mainTaskIndex === -1) {
				return {
					success: false,
					error: {
						code: 'TASK_NOT_FOUND',
						message: `Main task ${mainTaskId} not found`
					}
				};
			}

			// Navigate to the subtask using nested-subtask-utils
			const { findSubtaskByPath } = require('../../../scripts/modules/task-manager/nested-subtask-utils.js');
			const subtaskResult = findSubtaskByPath(data.tasks[mainTaskIndex], parts.slice(1).map(Number));

			if (!subtaskResult) {
				return {
					success: false,
					error: {
						code: 'TASK_NOT_FOUND',
						message: `Subtask ${taskId} not found`
					}
				};
			}

			task = subtaskResult.subtask;
			log.info(`[expandTaskDirect] Subtask found: Yes`);
		} else {
			// Handle main task (original logic)
			const numericTaskId = parseInt(taskId, 10);
			task = data.tasks.find((t) => t.id === numericTaskId);
			if (task) {
				mainTaskIndex = data.tasks.findIndex((t) => t.id === numericTaskId);
			}
			log.info(`[expandTaskDirect] Main task found: ${task ? 'Yes' : 'No'}`);
		}

		if (!task) {
			return {
				success: false,
				error: {
					code: 'TASK_NOT_FOUND',
					message: `Task with ID ${taskId} not found`
				}
			};
		}

		// Check if task is completed
		if (task.status === 'done' || task.status === 'completed') {
			return {
				success: false,
				error: {
					code: 'TASK_COMPLETED',
					message: `Task ${taskId} is already marked as ${task.status} and cannot be expanded`
				}
			};
		}

		// Handle force flag for clearing existing subtasks
		const hasExistingSubtasks = task.subtasks && task.subtasks.length > 0;
		if (hasExistingSubtasks && forceFlag) {
			log.info(
				`Force flag set. Clearing existing ${task.subtasks.length} subtasks for ${isSubtask ? 'subtask' : 'task'} ${taskId}.`
			);
			task.subtasks = [];
		} else if (hasExistingSubtasks) {
			log.info(
				`${isSubtask ? 'Subtask' : 'Task'} ${taskId} already has ${task.subtasks.length} subtasks. Will append new subtasks.`
			);
		}

		// Keep a copy of the task before modification
		const originalTask = JSON.parse(JSON.stringify(task));

		// Tracking subtasks count before expansion
		const subtasksCountBefore = task.subtasks ? task.subtasks.length : 0;

		// Create a backup of the tasks.json file
		const backupPath = path.join(path.dirname(tasksPath), 'tasks.json.bak');
		fs.copyFileSync(tasksPath, backupPath);

		// Directly modify the data instead of calling the CLI function
		if (!task.subtasks) {
			task.subtasks = [];
		}

		// Save tasks.json with potentially empty subtasks array
		writeJSON(tasksPath, data);

		// Create logger wrapper using the utility
		const mcpLog = createLogWrapper(log);

		let wasSilent; // Declare wasSilent outside the try block
		// Process the request
		try {
			// Enable silent mode to prevent console logs from interfering with JSON response
			wasSilent = isSilentMode(); // Assign inside the try block
			if (!wasSilent) enableSilentMode();

			// Call the core expandTask function with the wrapped logger and projectRoot
			const coreResult = await expandTask(
				tasksPath,
				taskId,
				numSubtasks,
				useResearch,
				additionalContext,
				{
					mcpLog,
					session,
					projectRoot,
					commandName: 'expand-task',
					outputType: 'mcp'
				},
				forceFlag
			);

			// Restore normal logging
			if (!wasSilent && isSilentMode()) disableSilentMode();

			// Read the updated data and find the updated task
			const updatedData = readJSON(tasksPath);
			let updatedTask;

			if (isSubtask) {
				// For subtasks, navigate to the nested subtask again
				const parts = taskId.split('.');
				const mainTaskId = parseInt(parts[0], 10);
				const mainTask = updatedData.tasks.find((t) => t.id === mainTaskId);
				if (mainTask) {
					const { findSubtaskByPath } = require('../../../scripts/modules/task-manager/nested-subtask-utils.js');
					const subtaskResult = findSubtaskByPath(mainTask, parts.slice(1).map(Number));
					updatedTask = subtaskResult ? subtaskResult.subtask : null;
				}
			} else {
				// For main tasks, find directly
				const numericTaskId = parseInt(taskId, 10);
				updatedTask = updatedData.tasks.find((t) => t.id === numericTaskId);
			}

			// Calculate how many subtasks were added
			const subtasksAdded = updatedTask.subtasks
				? updatedTask.subtasks.length - subtasksCountBefore
				: 0;

			// Return the result, including telemetryData
			log.info(
				`Successfully expanded task ${taskId} with ${subtasksAdded} new subtasks`
			);
			return {
				success: true,
				data: {
					task: coreResult.task,
					subtasksAdded,
					hasExistingSubtasks,
					telemetryData: coreResult.telemetryData
				}
			};
		} catch (error) {
			// Make sure to restore normal logging even if there's an error
			if (!wasSilent && isSilentMode()) disableSilentMode();

			log.error(`Error expanding task: ${error.message}`);
			return {
				success: false,
				error: {
					code: 'CORE_FUNCTION_ERROR',
					message: error.message || 'Failed to expand task'
				}
			};
		}
	} catch (error) {
		log.error(`Error expanding task: ${error.message}`);
		return {
			success: false,
			error: {
				code: 'CORE_FUNCTION_ERROR',
				message: error.message || 'Failed to expand task'
			}
		};
	}
}
