/**
 * Task Manager — Simple task list with add/check/delete
 * Persists tasks in localStorage
 */

(function () {
    'use strict';
    if (window.KTaskManager) return;

    const STORAGE_KEY = 'kelion_tasks';

    window.KTaskManager = {
        /**
         * Get all tasks
         * @returns {Array} Tasks array
         */
        getAll() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            } catch {
                return [];
            }
        },

        /**
         * Add a new task
         * @param {string} text - Task description
         * @returns {Object} Created task
         */
        add(text) {
            if (!text || !text.trim()) return null;
            const tasks = this.getAll();
            const task = {
                id: Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(36)).join('').slice(0, 6),
                text: text.trim(),
                done: false,
                created: new Date().toISOString()
            };
            tasks.push(task);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            console.log('📋 Task added:', task.text);
            return task;
        },

        /**
         * Toggle task completion
         * @param {string} id - Task ID
         */
        toggle(id) {
            const tasks = this.getAll();
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.done = !task.done;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            }
            return task;
        },

        /**
         * Remove a task
         * @param {string} id - Task ID
         */
        remove(id) {
            const tasks = this.getAll().filter(t => t.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        },

        /**
         * Clear all completed tasks
         */
        clearDone() {
            const tasks = this.getAll().filter(t => !t.done);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        },

        /**
         * Get task count summary
         */
        summary() {
            const tasks = this.getAll();
            return {
                total: tasks.length,
                done: tasks.filter(t => t.done).length,
                pending: tasks.filter(t => !t.done).length
            };
        }
    };

    console.log('📋 K Task Manager loaded');
})();
