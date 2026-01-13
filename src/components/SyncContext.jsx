/**
 * SyncContext
 * 
 * Provides cloud sync functionality and auth state throughout the app.
 * Handles auto-sync when data changes.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentUser, onAuthStateChange, isSupabaseConfigured } from '../utils/supabaseClient'
import { pushToCloud, deleteFromCloud, queueSyncAction } from '../utils/syncEngine'

const SyncContext = createContext(null)

export const useSyncContext = () => {
    const context = useContext(SyncContext)
    if (!context) {
        // Return a no-op context if not within provider (for components that might render before provider)
        return {
            user: null,
            isConfigured: false,
            syncRecord: async () => { },
            deleteRecord: async () => { },
            isSyncing: false
        }
    }
    return context
}

export const SyncProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [isConfigured, setIsConfigured] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const syncQueueRef = useRef([])
    const syncTimeoutRef = useRef(null)

    // Check configuration and auth on mount
    useEffect(() => {
        const init = async () => {
            const configured = await isSupabaseConfigured()
            setIsConfigured(configured)

            if (configured) {
                const currentUser = await getCurrentUser()
                setUser(currentUser)
            }
        }
        init()

        // Subscribe to auth changes
        let unsubscribe = () => { }
        const setupAuthListener = async () => {
            unsubscribe = await onAuthStateChange((event, session) => {
                setUser(session?.user || null)
            })
        }
        setupAuthListener()

        return () => unsubscribe()
    }, [])

    // Process sync queue with debouncing
    const processSyncQueue = useCallback(async () => {
        if (!user || syncQueueRef.current.length === 0) return

        setIsSyncing(true)
        const queue = [...syncQueueRef.current]
        syncQueueRef.current = []

        for (const item of queue) {
            try {
                if (item.action === 'upsert') {
                    await pushToCloud(item.tableName, item.record, user.id)
                } else if (item.action === 'delete') {
                    await deleteFromCloud(item.tableName, item.recordId, user.id)
                }
            } catch (error) {
                console.error('Auto-sync error:', error)
                // Queue for later retry
                await queueSyncAction(item.tableName, item.action, item.record || { id: item.recordId })
            }
        }

        setIsSyncing(false)
    }, [user])

    // Debounced sync trigger
    const triggerSync = useCallback(() => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }
        // Debounce: wait 500ms after last change before syncing
        syncTimeoutRef.current = setTimeout(() => {
            processSyncQueue()
        }, 500)
    }, [processSyncQueue])

    /**
     * Sync a record after local save (upsert)
     */
    const syncRecord = useCallback(async (tableName, record) => {
        if (!isConfigured || !user) {
            // Not configured or not logged in - skip sync
            return
        }

        // Add to queue
        syncQueueRef.current.push({
            action: 'upsert',
            tableName,
            record
        })

        // Trigger debounced sync
        triggerSync()
    }, [isConfigured, user, triggerSync])

    /**
     * Sync a delete operation
     */
    const deleteRecord = useCallback(async (tableName, recordId) => {
        if (!isConfigured || !user) {
            return
        }

        // Add to queue
        syncQueueRef.current.push({
            action: 'delete',
            tableName,
            recordId
        })

        // Trigger debounced sync
        triggerSync()
    }, [isConfigured, user, triggerSync])

    const value = {
        user,
        isConfigured,
        isSyncing,
        syncRecord,
        deleteRecord
    }

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    )
}

export default SyncContext
