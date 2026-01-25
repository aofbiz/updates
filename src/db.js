
import Dexie from 'dexie';

export const db = new Dexie('allset_db');

db.version(7).stores({
    // Main data
    orders: 'id, createdDate, status, paymentStatus, customerName, orderSource, _v, _deleted',
    products: 'id',
    inventory: 'id, category, itemName, _v, _deleted',
    expenses: 'id, date, category, _v, _deleted',
    trackingNumbers: 'number, status',

    // Settings & Meta
    settings: 'id',
    orderCounter: 'id',
    orderSources: 'id, name', // Added name index

    // File Storage (Images)
    files: 'id, relatedId, type',

    // Logs
    inventoryLogs: '++id, inventoryItemId, date',
    quotations: 'id, createdDate',

    // Sync Queue (for offline sync)
    syncQueue: 'id, tableName, action, createdAt'
});


export const resetDatabase = async () => {
    await db.delete();
    await db.open();
}
