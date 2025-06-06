/**
 * migration-utils.js
 * Utilities for migrating TaskMaster projects to support new features
 */

import fs from 'fs';
import path from 'path';
import { log, readJSON, writeJSON } from '../utils.js';
import { migrateLegacySubtasks } from './nested-subtask-utils.js';

/**
 * Migration manager for TaskMaster projects
 */
class MigrationManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
        this.configPath = path.join(projectRoot, '.taskmaster', 'config.json');
        this.backupDir = path.join(projectRoot, '.taskmaster', 'backups');
    }

    /**
     * Check if migration is needed
     */
    async checkMigrationNeeded() {
        try {
            if (!fs.existsSync(this.tasksPath)) {
                return { needed: false, reason: 'No tasks file found' };
            }

            const data = readJSON(this.tasksPath);
            if (!data || !data.tasks) {
                return { needed: false, reason: 'Invalid tasks file' };
            }

            // Check for legacy subtask format
            const hasLegacySubtasks = data.tasks.some(task => 
                task.subtasks && task.subtasks.length > 0 && 
                task.subtasks.some(st => st.subtasks === undefined)
            );

            // Check for missing version info
            const hasVersionInfo = data.meta && data.meta.version;

            // Check for missing VSCode integration
            const vscodeDir = path.join(this.projectRoot, '.vscode');
            const hasVSCodeIntegration = fs.existsSync(vscodeDir);

            const migrations = [];
            
            if (hasLegacySubtasks) {
                migrations.push('nested-subtasks');
            }
            
            if (!hasVersionInfo) {
                migrations.push('version-metadata');
            }
            
            if (!hasVSCodeIntegration) {
                migrations.push('vscode-integration');
            }

            return {
                needed: migrations.length > 0,
                migrations,
                reason: migrations.length > 0 ? 
                    `Migrations needed: ${migrations.join(', ')}` : 
                    'Project is up to date'
            };
        } catch (error) {
            return { 
                needed: false, 
                error: error.message,
                reason: `Error checking migration: ${error.message}` 
            };
        }
    }

    /**
     * Create backup before migration
     */
    async createBackup() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
            
            if (!fs.existsSync(backupPath)) {
                fs.mkdirSync(backupPath, { recursive: true });
            }

            // Backup tasks.json
            if (fs.existsSync(this.tasksPath)) {
                const backupTasksPath = path.join(backupPath, 'tasks.json');
                fs.copyFileSync(this.tasksPath, backupTasksPath);
            }

            // Backup config.json
            if (fs.existsSync(this.configPath)) {
                const backupConfigPath = path.join(backupPath, 'config.json');
                fs.copyFileSync(this.configPath, backupConfigPath);
            }

            log('info', `Backup created at: ${backupPath}`);
            return backupPath;
        } catch (error) {
            log('error', `Failed to create backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Migrate to nested subtasks format
     */
    async migrateToNestedSubtasks() {
        try {
            log('info', 'Migrating to nested subtasks format...');

            const data = readJSON(this.tasksPath);
            if (!data || !data.tasks) {
                throw new Error('Invalid tasks file');
            }

            let migrationCount = 0;

            // Migrate each task
            data.tasks.forEach(task => {
                if (task.subtasks && task.subtasks.length > 0) {
                    const hadLegacyFormat = task.subtasks.some(st => st.subtasks === undefined);
                    
                    if (hadLegacyFormat) {
                        migrateLegacySubtasks(task);
                        migrationCount++;
                    }
                }
            });

            // Update metadata
            if (!data.meta) {
                data.meta = {};
            }
            
            data.meta.nestedSubtasksSupport = true;
            data.meta.lastMigration = new Date().toISOString();

            writeJSON(this.tasksPath, data);
            
            log('info', `Migrated ${migrationCount} tasks to nested subtasks format`);
            return { success: true, migratedTasks: migrationCount };
        } catch (error) {
            log('error', `Failed to migrate to nested subtasks: ${error.message}`);
            throw error;
        }
    }

    /**
     * Add version metadata
     */
    async addVersionMetadata() {
        try {
            log('info', 'Adding version metadata...');

            const data = readJSON(this.tasksPath);
            if (!data) {
                throw new Error('Invalid tasks file');
            }

            if (!data.meta) {
                data.meta = {};
            }

            // Add version and metadata
            data.meta.version = '2.0.0';
            data.meta.schemaVersion = '2.0';
            data.meta.features = [
                'nested-subtasks',
                'vscode-integration',
                'augment-integration'
            ];
            
            if (!data.meta.createdAt) {
                data.meta.createdAt = new Date().toISOString();
            }
            
            data.meta.updatedAt = new Date().toISOString();

            writeJSON(this.tasksPath, data);
            
            log('info', 'Version metadata added successfully');
            return { success: true };
        } catch (error) {
            log('error', `Failed to add version metadata: ${error.message}`);
            throw error;
        }
    }

    /**
     * Setup VSCode integration
     */
    async setupVSCodeIntegration() {
        try {
            log('info', 'Setting up VSCode integration...');

            // Import VSCode integration module
            const { default: VSCodeIntegration } = await import('../vscode-integration.js');
            const integration = new VSCodeIntegration(this.projectRoot);
            
            const success = await integration.initialize();
            
            if (!success) {
                throw new Error('Failed to initialize VSCode integration');
            }

            log('info', 'VSCode integration setup completed');
            return { success: true };
        } catch (error) {
            log('error', `Failed to setup VSCode integration: ${error.message}`);
            throw error;
        }
    }

    /**
     * Run all necessary migrations
     */
    async runMigrations(migrations = null) {
        try {
            const check = await this.checkMigrationNeeded();
            
            if (!check.needed) {
                log('info', check.reason);
                return { success: true, message: check.reason };
            }

            const migrationsToRun = migrations || check.migrations;
            
            log('info', `Running migrations: ${migrationsToRun.join(', ')}`);

            // Create backup first
            const backupPath = await this.createBackup();

            const results = {};

            // Run migrations in order
            for (const migration of migrationsToRun) {
                try {
                    switch (migration) {
                        case 'nested-subtasks':
                            results[migration] = await this.migrateToNestedSubtasks();
                            break;
                        case 'version-metadata':
                            results[migration] = await this.addVersionMetadata();
                            break;
                        case 'vscode-integration':
                            results[migration] = await this.setupVSCodeIntegration();
                            break;
                        default:
                            log('warn', `Unknown migration: ${migration}`);
                            results[migration] = { success: false, error: 'Unknown migration' };
                    }
                } catch (error) {
                    log('error', `Migration ${migration} failed: ${error.message}`);
                    results[migration] = { success: false, error: error.message };
                }
            }

            const successfulMigrations = Object.keys(results).filter(
                key => results[key].success
            );
            
            const failedMigrations = Object.keys(results).filter(
                key => !results[key].success
            );

            if (failedMigrations.length > 0) {
                log('warn', `Some migrations failed: ${failedMigrations.join(', ')}`);
                log('info', `Backup available at: ${backupPath}`);
            }

            log('info', `Migration completed. Successful: ${successfulMigrations.length}, Failed: ${failedMigrations.length}`);

            return {
                success: failedMigrations.length === 0,
                results,
                backupPath,
                successfulMigrations,
                failedMigrations
            };
        } catch (error) {
            log('error', `Migration process failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restoreFromBackup(backupPath) {
        try {
            log('info', `Restoring from backup: ${backupPath}`);

            if (!fs.existsSync(backupPath)) {
                throw new Error(`Backup path does not exist: ${backupPath}`);
            }

            // Restore tasks.json
            const backupTasksPath = path.join(backupPath, 'tasks.json');
            if (fs.existsSync(backupTasksPath)) {
                fs.copyFileSync(backupTasksPath, this.tasksPath);
                log('info', 'Restored tasks.json');
            }

            // Restore config.json
            const backupConfigPath = path.join(backupPath, 'config.json');
            if (fs.existsSync(backupConfigPath)) {
                fs.copyFileSync(backupConfigPath, this.configPath);
                log('info', 'Restored config.json');
            }

            log('info', 'Restore completed successfully');
            return { success: true };
        } catch (error) {
            log('error', `Failed to restore from backup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get migration status
     */
    async getStatus() {
        try {
            const check = await this.checkMigrationNeeded();
            const data = readJSON(this.tasksPath);
            
            return {
                migrationNeeded: check.needed,
                availableMigrations: check.migrations || [],
                currentVersion: data?.meta?.version || 'unknown',
                schemaVersion: data?.meta?.schemaVersion || 'unknown',
                features: data?.meta?.features || [],
                lastMigration: data?.meta?.lastMigration || null,
                nestedSubtasksSupport: data?.meta?.nestedSubtasksSupport || false
            };
        } catch (error) {
            return {
                error: error.message,
                migrationNeeded: false
            };
        }
    }
}

export default MigrationManager;
