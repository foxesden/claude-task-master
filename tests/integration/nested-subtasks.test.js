/**
 * Integration tests for nested subtask functionality
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    parseSubtaskId, 
    generateSubtaskId, 
    addNestedSubtask, 
    findNestedSubtask,
    removeNestedSubtask,
    updateNestedSubtask,
    getAllNestedSubtasks,
    validateNestedDependencies,
    migrateLegacySubtasks,
    getSubtaskStatistics
} from '../../scripts/modules/task-manager/nested-subtask-utils.js';
import addSubtask from '../../scripts/modules/task-manager/add-subtask.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Nested Subtasks Integration', () => {
    let tempDir;
    let tasksPath;
    let sampleTask;

    beforeEach(() => {
        // Create temporary directory for test files
        tempDir = path.join(__dirname, 'temp', `test-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        tasksPath = path.join(tempDir, 'tasks.json');

        // Create sample task with nested subtasks
        sampleTask = {
            id: 1,
            title: 'Main Task',
            description: 'A task for testing nested subtasks',
            status: 'pending',
            dependencies: [],
            priority: 'medium',
            details: 'Test task details',
            testStrategy: 'Test strategy',
            subtasks: [
                {
                    id: 1,
                    title: 'Level 1 Subtask',
                    description: 'First level subtask',
                    status: 'pending',
                    dependencies: [],
                    subtasks: [
                        {
                            id: 1,
                            title: 'Level 2 Subtask',
                            description: 'Second level subtask',
                            status: 'pending',
                            dependencies: [],
                            subtasks: []
                        }
                    ]
                },
                {
                    id: 2,
                    title: 'Another Level 1 Subtask',
                    description: 'Another first level subtask',
                    status: 'done',
                    dependencies: [],
                    subtasks: []
                }
            ]
        };

        // Create tasks file
        const tasksData = {
            meta: {
                projectName: 'Test Project',
                version: '2.0.0',
                nestedSubtasksSupport: true
            },
            tasks: [sampleTask]
        };

        fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
    });

    afterEach(() => {
        // Clean up temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Subtask ID Parsing', () => {
        test('should parse simple subtask ID', () => {
            const result = parseSubtaskId('1.2');
            expect(result).toEqual({
                parentId: 1,
                path: [2]
            });
        });

        test('should parse nested subtask ID', () => {
            const result = parseSubtaskId('1.2.3.4');
            expect(result).toEqual({
                parentId: 1,
                path: [2, 3, 4]
            });
        });

        test('should throw error for invalid format', () => {
            expect(() => parseSubtaskId('invalid')).toThrow();
            expect(() => parseSubtaskId('1')).toThrow();
            expect(() => parseSubtaskId('1.0')).toThrow();
        });
    });

    describe('Subtask ID Generation', () => {
        test('should generate simple subtask ID', () => {
            const result = generateSubtaskId(1, [2]);
            expect(result).toBe('1.2');
        });

        test('should generate nested subtask ID', () => {
            const result = generateSubtaskId(1, [2, 3, 4]);
            expect(result).toBe('1.2.3.4');
        });

        test('should throw error for empty path', () => {
            expect(() => generateSubtaskId(1, [])).toThrow();
        });
    });

    describe('Finding Nested Subtasks', () => {
        test('should find first level subtask', () => {
            const subtask = findNestedSubtask(sampleTask, [1]);
            expect(subtask).toBeDefined();
            expect(subtask.title).toBe('Level 1 Subtask');
        });

        test('should find second level subtask', () => {
            const subtask = findNestedSubtask(sampleTask, [1, 1]);
            expect(subtask).toBeDefined();
            expect(subtask.title).toBe('Level 2 Subtask');
        });

        test('should return null for non-existent path', () => {
            const subtask = findNestedSubtask(sampleTask, [1, 2, 3]);
            expect(subtask).toBeNull();
        });
    });

    describe('Adding Nested Subtasks', () => {
        test('should add subtask to first level', () => {
            const subtaskData = {
                title: 'New Level 1 Subtask',
                description: 'New subtask description',
                status: 'pending'
            };

            const result = addNestedSubtask(sampleTask, [3], subtaskData);
            
            expect(result.subtask).toBeDefined();
            expect(result.subtask.id).toBe(3);
            expect(result.subtask.title).toBe('New Level 1 Subtask');
            expect(result.fullId).toBe('1.3');
            expect(sampleTask.subtasks).toHaveLength(3);
        });

        test('should add subtask to second level', () => {
            const subtaskData = {
                title: 'New Level 2 Subtask',
                description: 'New nested subtask',
                status: 'pending'
            };

            const result = addNestedSubtask(sampleTask, [1, 2], subtaskData);
            
            expect(result.subtask).toBeDefined();
            expect(result.subtask.id).toBe(2);
            expect(result.fullId).toBe('1.1.2');
            
            const parentSubtask = findNestedSubtask(sampleTask, [1]);
            expect(parentSubtask.subtasks).toHaveLength(2);
        });
    });

    describe('Removing Nested Subtasks', () => {
        test('should remove first level subtask', () => {
            const removed = removeNestedSubtask(sampleTask, [2]);
            
            expect(removed).toBeDefined();
            expect(removed.title).toBe('Another Level 1 Subtask');
            expect(sampleTask.subtasks).toHaveLength(1);
        });

        test('should remove second level subtask', () => {
            const removed = removeNestedSubtask(sampleTask, [1, 1]);
            
            expect(removed).toBeDefined();
            expect(removed.title).toBe('Level 2 Subtask');
            
            const parentSubtask = findNestedSubtask(sampleTask, [1]);
            expect(parentSubtask.subtasks).toHaveLength(0);
        });
    });

    describe('Updating Nested Subtasks', () => {
        test('should update subtask properties', () => {
            const updates = {
                title: 'Updated Title',
                status: 'in-progress',
                description: 'Updated description'
            };

            const updated = updateNestedSubtask(sampleTask, [1, 1], updates);
            
            expect(updated.title).toBe('Updated Title');
            expect(updated.status).toBe('in-progress');
            expect(updated.description).toBe('Updated description');
        });

        test('should not update protected properties', () => {
            const updates = {
                id: 999,
                subtasks: []
            };

            const original = findNestedSubtask(sampleTask, [1, 1]);
            const originalId = original.id;
            const originalSubtasks = original.subtasks;

            updateNestedSubtask(sampleTask, [1, 1], updates);
            
            expect(original.id).toBe(originalId);
            expect(original.subtasks).toBe(originalSubtasks);
        });
    });

    describe('Getting All Nested Subtasks', () => {
        test('should return all subtasks with full IDs', () => {
            const allSubtasks = getAllNestedSubtasks(sampleTask);
            
            expect(allSubtasks).toHaveLength(3);
            expect(allSubtasks[0].fullId).toBe('1.1');
            expect(allSubtasks[1].fullId).toBe('1.1.1');
            expect(allSubtasks[2].fullId).toBe('1.2');
        });

        test('should include depth information', () => {
            const allSubtasks = getAllNestedSubtasks(sampleTask);
            
            expect(allSubtasks[0].depth).toBe(1);
            expect(allSubtasks[1].depth).toBe(2);
            expect(allSubtasks[2].depth).toBe(1);
        });
    });

    describe('Dependency Validation', () => {
        test('should validate correct dependencies', () => {
            // Add valid dependency
            const subtask = findNestedSubtask(sampleTask, [1, 1]);
            subtask.dependencies = ['1.2'];

            const errors = validateNestedDependencies(sampleTask);
            expect(errors).toHaveLength(0);
        });

        test('should detect invalid dependencies', () => {
            // Add invalid dependency
            const subtask = findNestedSubtask(sampleTask, [1, 1]);
            subtask.dependencies = ['1.3.4']; // Non-existent subtask

            const errors = validateNestedDependencies(sampleTask);
            expect(errors).toHaveLength(1);
            expect(errors[0].subtaskId).toBe('1.1.1');
            expect(errors[0].invalidDependency).toBe('1.3.4');
        });
    });

    describe('Legacy Migration', () => {
        test('should migrate legacy subtasks', () => {
            const legacyTask = {
                id: 1,
                title: 'Legacy Task',
                subtasks: [
                    {
                        id: 1,
                        title: 'Legacy Subtask',
                        status: 'pending'
                        // No subtasks property
                    }
                ]
            };

            const migrated = migrateLegacySubtasks(legacyTask);
            
            expect(migrated.subtasks[0].subtasks).toBeDefined();
            expect(Array.isArray(migrated.subtasks[0].subtasks)).toBe(true);
        });

        test('should not modify already migrated tasks', () => {
            const alreadyMigrated = { ...sampleTask };
            const original = JSON.stringify(alreadyMigrated);
            
            migrateLegacySubtasks(alreadyMigrated);
            
            expect(JSON.stringify(alreadyMigrated)).toBe(original);
        });
    });

    describe('Subtask Statistics', () => {
        test('should calculate correct statistics', () => {
            const stats = getSubtaskStatistics(sampleTask);
            
            expect(stats.total).toBe(3);
            expect(stats.byStatus.pending).toBe(2);
            expect(stats.byStatus.done).toBe(1);
            expect(stats.maxDepth).toBe(2);
            expect(stats.hasNested).toBe(true);
        });
    });

    describe('Integration with addSubtask function', () => {
        test('should add nested subtask via addSubtask function', async () => {
            const newSubtaskData = {
                title: 'Integration Test Subtask',
                description: 'Added via addSubtask function',
                status: 'pending'
            };

            // Mock generateTaskFiles to avoid file operations
            const mockGenerateTaskFiles = jest.fn().mockResolvedValue(true);
            jest.unstable_mockModule('../../scripts/modules/task-manager/generate-task-files.js', () => ({
                default: mockGenerateTaskFiles
            }));

            const result = await addSubtask(
                tasksPath,
                '1.1', // Add to nested subtask
                null,
                newSubtaskData,
                false // Don't generate files
            );

            expect(result).toBeDefined();
            expect(result.title).toBe('Integration Test Subtask');
            expect(result.fullId).toBe('1.1.2');
            expect(result.isNested).toBe(true);
            expect(result.depth).toBe(2);

            // Verify the subtask was added to the file
            const updatedData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
            const parentSubtask = findNestedSubtask(updatedData.tasks[0], [1]);
            expect(parentSubtask.subtasks).toHaveLength(2);
        });
    });
});

describe('VSCode Integration', () => {
    let tempDir;
    let projectRoot;

    beforeEach(() => {
        tempDir = path.join(__dirname, 'temp', `vscode-test-${Date.now()}`);
        projectRoot = tempDir;
        fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should initialize VSCode integration', async () => {
        const { default: VSCodeIntegration } = await import('../../scripts/modules/vscode-integration.js');
        const integration = new VSCodeIntegration(projectRoot);
        
        const success = await integration.initialize();
        expect(success).toBe(true);

        // Check that VSCode files were created
        const vscodeDir = path.join(projectRoot, '.vscode');
        expect(fs.existsSync(vscodeDir)).toBe(true);
        expect(fs.existsSync(path.join(vscodeDir, 'settings.json'))).toBe(true);
        expect(fs.existsSync(path.join(vscodeDir, 'tasks.json'))).toBe(true);
        expect(fs.existsSync(path.join(vscodeDir, 'extensions.json'))).toBe(true);
    });

    test('should get correct integration status', async () => {
        const { default: VSCodeIntegration } = await import('../../scripts/modules/vscode-integration.js');
        const integration = new VSCodeIntegration(projectRoot);
        
        await integration.initialize();
        const status = integration.getStatus();
        
        expect(status.initialized).toBe(true);
        expect(status.vscodeDir).toBe(true);
        expect(status.settingsConfigured).toBe(true);
        expect(status.tasksConfigured).toBe(true);
    });
});
