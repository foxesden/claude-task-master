/**
 * nested-subtask-utils.js
 * Utility functions for handling nested subtasks with unlimited depth
 */

import { log } from '../utils.js';

/**
 * Parse hierarchical subtask ID (e.g., "1.2.3.4" -> {parentId: 1, path: [2, 3, 4]})
 */
export function parseSubtaskId(subtaskId) {
    if (typeof subtaskId !== 'string' || !subtaskId.includes('.')) {
        throw new Error(`Invalid subtask ID format: ${subtaskId}. Must be in format "parentId.subtaskId" or "parentId.subtaskId.nestedId"`);
    }

    const parts = subtaskId.split('.').map(part => parseInt(part, 10));
    
    if (parts.some(part => isNaN(part) || part <= 0)) {
        throw new Error(`Invalid subtask ID format: ${subtaskId}. All parts must be positive integers`);
    }

    return {
        parentId: parts[0],
        path: parts.slice(1)
    };
}

/**
 * Generate hierarchical subtask ID from parent ID and path
 */
export function generateSubtaskId(parentId, path) {
    if (!Array.isArray(path) || path.length === 0) {
        throw new Error('Path must be a non-empty array');
    }
    
    return `${parentId}.${path.join('.')}`;
}

/**
 * Find a nested subtask by its hierarchical path
 */
export function findNestedSubtask(parentTask, path) {
    if (!parentTask || !parentTask.subtasks || path.length === 0) {
        return null;
    }

    let current = parentTask.subtasks;
    let subtask = null;

    for (let i = 0; i < path.length; i++) {
        const id = path[i];
        subtask = current.find(st => st.id === id);
        
        if (!subtask) {
            return null;
        }

        if (i < path.length - 1) {
            // Not the final level, continue deeper
            if (!subtask.subtasks) {
                return null; // Path doesn't exist
            }
            current = subtask.subtasks;
        }
    }

    return subtask;
}

/**
 * Find the parent container for a nested subtask
 */
export function findSubtaskParent(parentTask, path) {
    if (!parentTask || !parentTask.subtasks || path.length === 0) {
        return null;
    }

    if (path.length === 1) {
        // Direct child of parent task
        return {
            container: parentTask,
            subtasks: parentTask.subtasks
        };
    }

    // Navigate to the parent container
    const parentPath = path.slice(0, -1);
    const parentSubtask = findNestedSubtask(parentTask, parentPath);
    
    if (!parentSubtask) {
        return null;
    }

    if (!parentSubtask.subtasks) {
        parentSubtask.subtasks = [];
    }

    return {
        container: parentSubtask,
        subtasks: parentSubtask.subtasks
    };
}

/**
 * Get the next available ID at a specific nesting level
 */
export function getNextSubtaskId(subtasks) {
    if (!subtasks || subtasks.length === 0) {
        return 1;
    }

    const maxId = Math.max(...subtasks.map(st => st.id));
    return maxId + 1;
}

/**
 * Add a nested subtask at the specified path
 */
export function addNestedSubtask(parentTask, path, subtaskData) {
    const parentContainer = findSubtaskParent(parentTask, path);
    
    if (!parentContainer) {
        throw new Error(`Cannot find parent container for path: ${path.join('.')}`);
    }

    const newId = getNextSubtaskId(parentContainer.subtasks);
    const newSubtask = {
        id: newId,
        title: subtaskData.title,
        description: subtaskData.description || '',
        details: subtaskData.details || '',
        status: subtaskData.status || 'pending',
        dependencies: subtaskData.dependencies || [],
        subtasks: [] // Initialize empty subtasks array for potential nesting
    };

    parentContainer.subtasks.push(newSubtask);
    
    return {
        subtask: newSubtask,
        fullId: generateSubtaskId(parentTask.id, [...path.slice(0, -1), newId])
    };
}

/**
 * Remove a nested subtask
 */
export function removeNestedSubtask(parentTask, path) {
    const parentContainer = findSubtaskParent(parentTask, path);
    
    if (!parentContainer) {
        throw new Error(`Cannot find parent container for path: ${path.join('.')}`);
    }

    const subtaskId = path[path.length - 1];
    const subtaskIndex = parentContainer.subtasks.findIndex(st => st.id === subtaskId);
    
    if (subtaskIndex === -1) {
        throw new Error(`Subtask with ID ${subtaskId} not found`);
    }

    const removedSubtask = parentContainer.subtasks.splice(subtaskIndex, 1)[0];
    return removedSubtask;
}

/**
 * Update a nested subtask
 */
export function updateNestedSubtask(parentTask, path, updates) {
    const subtask = findNestedSubtask(parentTask, path);
    
    if (!subtask) {
        throw new Error(`Subtask not found at path: ${path.join('.')}`);
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
        if (key !== 'id' && key !== 'subtasks') { // Protect ID and subtasks structure
            subtask[key] = updates[key];
        }
    });

    return subtask;
}

/**
 * Get all nested subtasks in a flat array with their full IDs
 */
export function getAllNestedSubtasks(parentTask, includeParentId = true) {
    const result = [];
    
    function traverse(subtasks, currentPath, parentTaskId) {
        if (!subtasks) return;
        
        subtasks.forEach(subtask => {
            const fullPath = [...currentPath, subtask.id];
            const fullId = includeParentId ? 
                generateSubtaskId(parentTaskId, fullPath) : 
                fullPath.join('.');
            
            result.push({
                ...subtask,
                fullId,
                path: fullPath,
                depth: fullPath.length
            });

            // Recursively process nested subtasks
            if (subtask.subtasks && subtask.subtasks.length > 0) {
                traverse(subtask.subtasks, fullPath, parentTaskId);
            }
        });
    }

    if (parentTask.subtasks) {
        traverse(parentTask.subtasks, [], parentTask.id);
    }

    return result;
}

/**
 * Check if a subtask has nested subtasks
 */
export function hasNestedSubtasks(subtask) {
    return subtask && subtask.subtasks && subtask.subtasks.length > 0;
}

/**
 * Get the depth of nesting for a subtask path
 */
export function getSubtaskDepth(path) {
    return Array.isArray(path) ? path.length : 0;
}

/**
 * Validate subtask dependencies within nested structure
 */
export function validateNestedDependencies(parentTask) {
    const allSubtasks = getAllNestedSubtasks(parentTask);
    const errors = [];

    allSubtasks.forEach(subtask => {
        if (subtask.dependencies && subtask.dependencies.length > 0) {
            subtask.dependencies.forEach(depId => {
                // Check if dependency exists within the same parent task
                const dependencyExists = allSubtasks.some(st => st.fullId === depId || st.id === depId);
                
                if (!dependencyExists) {
                    errors.push({
                        subtaskId: subtask.fullId,
                        invalidDependency: depId,
                        message: `Subtask ${subtask.fullId} has invalid dependency: ${depId}`
                    });
                }
            });
        }
    });

    return errors;
}

/**
 * Convert legacy single-level subtasks to new nested format
 */
export function migrateLegacySubtasks(task) {
    if (!task.subtasks) {
        return task;
    }

    // Check if already in new format (has subtasks array in subtasks)
    const hasNestedFormat = task.subtasks.some(st => st.subtasks !== undefined);
    
    if (hasNestedFormat) {
        return task; // Already migrated
    }

    // Migrate to new format
    task.subtasks = task.subtasks.map(subtask => ({
        ...subtask,
        subtasks: [] // Add empty subtasks array
    }));

    log('info', `Migrated task ${task.id} subtasks to nested format`);
    return task;
}

/**
 * Get subtask statistics for a task
 */
export function getSubtaskStatistics(parentTask) {
    const allSubtasks = getAllNestedSubtasks(parentTask);
    
    const stats = {
        total: allSubtasks.length,
        byStatus: {},
        byDepth: {},
        maxDepth: 0,
        hasNested: false
    };

    allSubtasks.forEach(subtask => {
        // Count by status
        stats.byStatus[subtask.status] = (stats.byStatus[subtask.status] || 0) + 1;
        
        // Count by depth
        stats.byDepth[subtask.depth] = (stats.byDepth[subtask.depth] || 0) + 1;
        
        // Track max depth
        if (subtask.depth > stats.maxDepth) {
            stats.maxDepth = subtask.depth;
        }
        
        // Check if we have nested subtasks (depth > 1)
        if (subtask.depth > 1) {
            stats.hasNested = true;
        }
    });

    return stats;
}

/**
 * Format subtask for display with proper indentation
 */
export function formatSubtaskForDisplay(subtask, depth = 0, showFullId = true) {
    const indent = '  '.repeat(depth);
    const statusIcon = getStatusIcon(subtask.status);
    const id = showFullId ? subtask.fullId : subtask.id;
    
    return `${indent}${statusIcon} ${id}: ${subtask.title}`;
}

/**
 * Get status icon for subtask
 */
function getStatusIcon(status) {
    switch (status) {
        case 'done': return '✅';
        case 'in-progress': return '🔄';
        case 'pending': return '⏳';
        case 'deferred': return '⏸️';
        case 'cancelled': return '❌';
        default: return '📋';
    }
}
