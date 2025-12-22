
const STORAGE_KEY = 'aof_inventory_logs';

/**
 * Get all inventory logs
 * @returns {Promise<Array>} Array of log objects
 */
export const getInventoryLogs = async () => {
    try {
        const logs = localStorage.getItem(STORAGE_KEY);
        return logs ? JSON.parse(logs) : [];
    } catch (error) {
        console.error('Error getting inventory logs:', error);
        return [];
    }
};

/**
 * Add a new inventory log
 * @param {Object} log - Log object { itemId, itemName, action, quantity, reason }
 */
export const addInventoryLog = async (log) => {
    try {
        const logs = await getInventoryLogs();
        const newLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            ...log
        };
        const updatedLogs = [newLog, ...logs]; // Add to beginning (newest first)

        // Optional: Limit log size to prevent storage issues (e.g., last 1000 entries)
        if (updatedLogs.length > 1000) {
            updatedLogs.length = 1000;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
        return newLog;
    } catch (error) {
        console.error('Error adding inventory log:', error);
        return null;
    }
};
