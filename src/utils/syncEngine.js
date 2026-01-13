/**
 * Sync Engine
 * 
 * Handles bidirectional synchronization between local Dexie database and Supabase.
 * Uses "Last Write Wins" (LWW) conflict resolution based on updated_at timestamps.
 */

import { db } from '../db'
import { getSupabase, isSupabaseConfigured } from './supabaseClient'

// Tables that should be synced
const SYNC_TABLES = ['orders', 'expenses', 'inventory', 'settings', 'trackingNumbers', 'orderSources', 'products', 'orderCounter', 'inventoryLogs', 'quotations']

// Map local table names to Supabase table names
const TABLE_MAP = {
    orders: 'orders',
    expenses: 'expenses',
    inventory: 'inventory',
    settings: 'settings',
    trackingNumbers: 'tracking_numbers',
    orderSources: 'order_sources',
    products: 'products',
    orderCounter: 'order_counter',
    inventoryLogs: 'inventory_logs',
    quotations: 'quotations'
}

/**
 * Push a single record to Supabase.
 * Called after every local save operation for Pro users.
 */
export const pushToCloud = async (tableName, record, userId) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return { success: false, queued: true }

        const supabaseTable = TABLE_MAP[tableName]
        if (!supabaseTable) {
            console.warn(`Unknown table for sync: ${tableName}`)
            return { success: false }
        }

        // Format record for Supabase (store full data as JSONB)
        const cloudRecord = {
            id: record.id,
            user_id: userId,
            data: record,
            updated_at: record.updatedAt || new Date().toISOString()
        }

        const { error } = await supabase
            .from(supabaseTable)
            .upsert(cloudRecord, { onConflict: 'id' })

        if (error) {
            console.error(`Error pushing to ${supabaseTable}:`, error)
            // Queue for later sync
            await queueSyncAction('upsert', tableName, record)
            return { success: false, queued: true, error: error.message }
        }

        return { success: true }
    } catch (error) {
        console.error('Push to cloud failed:', error)
        await queueSyncAction('upsert', tableName, record)
        return { success: false, queued: true, error: error.message }
    }
}

/**
 * Push a delete action to Supabase.
 */
export const deleteFromCloud = async (tableName, recordId, userId) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return { success: false, queued: true }

        const supabaseTable = TABLE_MAP[tableName]
        if (!supabaseTable) return { success: false }

        const { error } = await supabase
            .from(supabaseTable)
            .delete()
            .eq('id', recordId)
            .eq('user_id', userId)

        if (error) {
            console.error(`Error deleting from ${supabaseTable}:`, error)
            await queueSyncAction('delete', tableName, { id: recordId })
            return { success: false, queued: true }
        }

        return { success: true }
    } catch (error) {
        console.error('Delete from cloud failed:', error)
        await queueSyncAction('delete', tableName, { id: recordId })
        return { success: false, queued: true }
    }
}

/**
 * Pull all records from Supabase for a specific table.
 * Used for initial sync or full refresh.
 */
export const pullFromCloud = async (tableName, userId, lastSyncTime = null) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return { success: false, data: [] }

        const supabaseTable = TABLE_MAP[tableName]
        if (!supabaseTable) return { success: false, data: [] }

        let query = supabase
            .from(supabaseTable)
            .select('*')
            .eq('user_id', userId)

        // If we have a last sync time, only fetch updated records
        if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime)
        }

        const { data, error } = await query

        if (error) {
            console.error(`Error pulling from ${supabaseTable}:`, error)
            return { success: false, data: [], error: error.message }
        }

        // Extract the actual data from the JSONB column
        const records = (data || []).map(row => ({
            ...row.data,
            id: row.id,
            updatedAt: row.updated_at
        }))

        return { success: true, data: records }
    } catch (error) {
        console.error('Pull from cloud failed:', error)
        return { success: false, data: [], error: error.message }
    }
}

/**
 * Queue a sync action for later (when offline).
 */
export const queueSyncAction = async (action, tableName, record) => {
    try {
        await db.syncQueue.add({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            action,
            tableName,
            record,
            createdAt: new Date().toISOString(),
            attempts: 0
        })
    } catch (error) {
        console.error('Error queuing sync action:', error)
    }
}

/**
 * Process all queued sync actions.
 * Called when the app comes back online.
 */
export const processSyncQueue = async (userId) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return { processed: 0, failed: 0 }

        const queueItems = await db.syncQueue.toArray()
        let processed = 0
        let failed = 0

        for (const item of queueItems) {
            let result

            if (item.action === 'upsert') {
                result = await pushToCloud(item.tableName, item.record, userId)
            } else if (item.action === 'delete') {
                result = await deleteFromCloud(item.tableName, item.record.id, userId)
            }

            if (result?.success) {
                await db.syncQueue.delete(item.id)
                processed++
            } else {
                // Update attempt count
                await db.syncQueue.update(item.id, {
                    attempts: (item.attempts || 0) + 1,
                    lastAttempt: new Date().toISOString()
                })
                failed++
            }
        }

        return { processed, failed }
    } catch (error) {
        console.error('Error processing sync queue:', error)
        return { processed: 0, failed: 0, error: error.message }
    }
}

/**
 * Perform a full sync: push local data to cloud, then pull cloud data.
 */
export const fullSync = async (userId) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return { success: false, error: 'Not configured' }

        const results = { pushed: {}, pulled: {} }

        // STEP 1: Push all local data to cloud
        console.log('Sync: Pushing local data to cloud...')
        for (const tableName of SYNC_TABLES) {
            try {
                const localData = await getLocalData(tableName)
                if (localData && localData.length > 0) {
                    let pushCount = 0
                    for (const record of localData) {
                        const pushResult = await pushToCloud(tableName, record, userId)
                        if (pushResult.success) pushCount++
                    }
                    if (pushCount > 0) {
                        results.pushed[tableName] = pushCount
                        console.log(`Sync: Pushed ${pushCount} ${tableName} to cloud`)
                    }
                }
            } catch (err) {
                console.error(`Error pushing ${tableName}:`, err)
            }
        }

        // STEP 2: Pull all cloud data and merge
        console.log('Sync: Pulling cloud data...')
        for (const tableName of SYNC_TABLES) {
            try {
                const { success, data } = await pullFromCloud(tableName, userId)
                if (success && data.length > 0) {
                    results.pulled[tableName] = data.length
                    await mergeCloudData(tableName, data)
                    console.log(`Sync: Pulled ${data.length} ${tableName} from cloud`)
                }
            } catch (err) {
                console.error(`Error pulling ${tableName}:`, err)
            }
        }

        // STEP 3: Process any queued changes
        await processSyncQueue(userId)

        // STEP 4: Update last sync time
        await updateLastSyncTime()

        console.log('Sync: Complete!', results)
        return { success: true, results }
    } catch (error) {
        console.error('Full sync failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get local data from a Dexie table.
 */
const getLocalData = async (tableName) => {
    try {
        switch (tableName) {
            case 'orders':
                return await db.orders.toArray()
            case 'expenses':
                return await db.expenses.toArray()
            case 'inventory':
                return await db.inventory.toArray()
            case 'trackingNumbers':
                return await db.trackingNumbers.toArray()
            case 'orderSources':
                return await db.orderSources.toArray()
            case 'quotations':
                return await db.quotations.toArray()
            case 'inventoryLogs':
                return await db.inventoryLogs.toArray()
            case 'settings':
                return await db.settings.toArray()
            case 'products':
                return await db.products.toArray()
            case 'orderCounter':
                return await db.orderCounter.toArray()
            default:
                return []
        }
    } catch (error) {
        console.error(`Error getting local data for ${tableName}:`, error)
        return []
    }
}


/**
 * Merge cloud data with local data using Last-Write-Wins.
 */
const mergeCloudData = async (tableName, cloudRecords) => {
    try {
        const localTable = db[tableName]
        if (!localTable) return

        for (const cloudRecord of cloudRecords) {
            const localRecord = await localTable.get(cloudRecord.id)

            // If cloud is newer or local doesn't exist, use cloud version
            if (!localRecord ||
                new Date(cloudRecord.updatedAt) > new Date(localRecord.updatedAt || 0)) {
                await localTable.put(cloudRecord)
            }
        }
    } catch (error) {
        console.error(`Error merging cloud data for ${tableName}:`, error)
    }
}

/**
 * Update the last sync timestamp in settings.
 */
const updateLastSyncTime = async () => {
    try {
        const settings = await db.settings.get('settings')
        const currentData = settings?.data || {}

        await db.settings.put({
            id: 'settings',
            data: {
                ...currentData,
                lastSyncTime: new Date().toISOString()
            },
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error('Error updating last sync time:', error)
    }
}

/**
 * Get the last sync timestamp.
 */
export const getLastSyncTime = async () => {
    try {
        const settings = await db.settings.get('settings')
        return settings?.data?.lastSyncTime || null
    } catch {
        return null
    }
}

/**
 * Subscribe to realtime changes from Supabase.
 * Returns an unsubscribe function.
 */
export const subscribeToRealtimeChanges = async (userId, onDataChange) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return null

        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    handleRealtimeEvent(payload)
                }
            )
            .subscribe((status) => {
                console.log('Sync: Realtime subscription status:', status)
            })

        return () => {
            supabase.removeChannel(channel)
        }
    } catch (error) {
        console.error('Error subscribing to realtime:', error)
        return null
    }
}

/**
 * Handle incoming realtime events from Supabase.
 */
const handleRealtimeEvent = async (payload) => {
    try {
        const { eventType, table, new: newRecord, old: oldRecord } = payload

        // Find local table name from Supabase table name
        const localTableName = Object.keys(TABLE_MAP).find(key => TABLE_MAP[key] === table)
        if (!localTableName) return

        const localTable = db[localTableName]
        if (!localTable) return

        console.log(`Realtime: processing ${eventType} for ${localTableName}`)

        if (eventType === 'DELETE') {
            // Delete local record
            if (oldRecord && oldRecord.id) {
                await localTable.delete(oldRecord.id)
                // Dispatch event for UI updates
                window.dispatchEvent(new Event(`sync:${localTableName}`))
                // Also dispatch generic update for common listeners
                window.dispatchEvent(new Event('ordersUpdated'))
            }
        } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
            // Upsert local record
            let recordData = newRecord.data

            if (!recordData && newRecord.id) {
                recordData = { ...newRecord }
                delete recordData.user_id
                delete recordData.updated_at
            }

            if (recordData) {
                const mergedRecord = {
                    ...recordData,
                    id: newRecord.id,
                    updatedAt: newRecord.updated_at
                }

                // Check local timestamp to prevent overwriting newer local changes
                const localRecord = await localTable.get(newRecord.id)
                if (!localRecord || new Date(mergedRecord.updatedAt) > new Date(localRecord.updatedAt || 0)) {
                    await localTable.put(mergedRecord)
                    // Dispatch specific event for UI updates
                    window.dispatchEvent(new Event(`sync:${localTableName}`))
                    // Also dispatch generic update
                    window.dispatchEvent(new Event('ordersUpdated'))
                }
            }
        }
    } catch (error) {
        console.error('Error handling realtime event:', error)
    }
}

/**
 * Wipe all data for the user from the cloud.
 * CAUTION: Destructive action.
 */
export const wipeCloudData = async (userId) => {
    try {
        const supabase = await getSupabase()
        if (!supabase || !userId) return { success: false, error: 'Not configured' }

        console.log('Sync: Initiating full cloud wipe for user:', userId)
        const results = { deleted: {}, errors: [] }

        // We iterate through all tables and delete everything belonging to this user
        // We also attempt to delete 'anon-user' data just in case some syncs happened without auth
        const userIdsToClear = [userId, 'anon-user']

        for (const tableName of SYNC_TABLES) {
            const supabaseTable = TABLE_MAP[tableName]
            if (supabaseTable) {
                try {
                    let totalDeleted = 0
                    for (const id of userIdsToClear) {
                        const { count, error } = await supabase
                            .from(supabaseTable)
                            .delete({ count: 'exact' })
                            .eq('user_id', id)

                        if (error) {
                            console.error(`Error wiping ${tableName} for ${id}:`, error)
                            results.errors.push(`${tableName}(${id}): ${error.message}`)
                        } else {
                            totalDeleted += (count || 0)
                        }
                    }
                    results.deleted[tableName] = totalDeleted
                } catch (err) {
                    console.error(`Exception wiping ${tableName}:`, err)
                    results.errors.push(`${tableName}: ${err.message}`)
                }
            }
        }

        console.log('Sync: Cloud wipe complete.', results)
        return {
            success: results.errors.length === 0,
            message: results.errors.length === 0 ? 'Cloud wipe successful' : 'Cloud wipe partially failed',
            results
        }
    } catch (error) {
        console.error('Cloud wipe failed:', error)
        return { success: false, error: error.message }
    }
}
