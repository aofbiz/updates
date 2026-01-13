/**
 * Supabase Client
 * 
 * Initializes and exports the Supabase client using user-provided credentials.
 * Credentials are stored in local settings.
 */

import { createClient } from '@supabase/supabase-js'
import { db } from '../db'

let supabaseInstance = null
let initPromise = null

/**
 * Get or create the Supabase client instance.
 * Returns null if credentials are not configured.
 */
export const getSupabase = async () => {
    if (supabaseInstance) return supabaseInstance

    // If an initialization is already in progress, wait for it
    if (initPromise) return initPromise

    initPromise = (async () => {
        try {
            const settings = await db.settings.get('settings')
            const supabaseConfig = settings?.data?.supabase

            if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
                initPromise = null
                return null
            }

            supabaseInstance = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10
                    }
                }
            })

            return supabaseInstance
        } catch (error) {
            console.error('Error initializing Supabase client:', error)
            return null
        } finally {
            initPromise = null
        }
    })()

    return initPromise
}

/**
 * Check if Supabase is configured with valid credentials.
 */
export const isSupabaseConfigured = async () => {
    try {
        const settings = await db.settings.get('settings')
        const supabaseConfig = settings?.data?.supabase
        return !!(supabaseConfig?.url && supabaseConfig?.anonKey)
    } catch {
        return false
    }
}

/**
 * Save Supabase credentials to settings.
 */
export const saveSupabaseCredentials = async (url, anonKey, connectionString = null) => {
    try {
        const settings = await db.settings.get('settings')
        const currentData = settings?.data || {}

        await db.settings.put({
            id: 'settings',
            data: {
                ...currentData,
                supabase: {
                    url,
                    anonKey,
                    connectionString,
                    configuredAt: new Date().toISOString()
                }
            },
            updatedAt: new Date().toISOString()
        })

        // Reset instance so next getSupabase() uses new credentials
        supabaseInstance = null
        return true
    } catch (error) {
        console.error('Error saving Supabase credentials:', error)
        return false
    }
}

/**
 * Clear Supabase credentials and disconnect.
 */
export const clearSupabaseCredentials = async () => {
    try {
        const settings = await db.settings.get('settings')
        const currentData = settings?.data || {}
        delete currentData.supabase

        await db.settings.put({
            id: 'settings',
            data: currentData,
            updatedAt: new Date().toISOString()
        })

        supabaseInstance = null
        return true
    } catch (error) {
        console.error('Error clearing Supabase credentials:', error)
        return false
    }
}

/**
 * Test the Supabase connection by attempting a simple query.
 */
export const testSupabaseConnection = async () => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return { success: false, error: 'No credentials configured' }
        }

        // Try to get schema information - this should work even with empty tables
        const { error } = await supabase.from('orders').select('id').limit(1)

        if (error) {
            // Check if it's a "table doesn't exist" error
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                return { success: false, error: 'Tables not set up. Please run the setup script.' }
            }
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

// ==================== AUTHENTICATION ====================

/**
 * Sign up a new user with email and password.
 */
export const signUp = async (email, password) => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return { success: false, error: 'Supabase not configured' }
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, user: data.user, session: data.session }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

/**
 * Sign in an existing user with email and password.
 */
export const signIn = async (email, password) => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return { success: false, error: 'Supabase not configured' }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true, user: data.user, session: data.session }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

/**
 * Sign out the current user.
 */
export const signOut = async () => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return { success: false, error: 'Supabase not configured' }
        }

        const { error } = await supabase.auth.signOut()

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

/**
 * Get the current authenticated user.
 */
export const getCurrentUser = async () => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return null
        }

        const { data: { user } } = await supabase.auth.getUser()
        return user
    } catch (error) {
        console.error('Error getting current user:', error)
        return null
    }
}

/**
 * Get a consistent user ID for syncing.
 * Returns the authenticated user's ID if logged in,
 * otherwise returns 'anon-user' if the hub is configured.
 */
export const getSyncUserId = async () => {
    const user = await getCurrentUser()
    if (user) return user.id

    // If not logged in, only return 'anon-user' if we actually have credentials
    const configured = await isSupabaseConfigured()
    return configured ? 'anon-user' : null
}

/**
 * Get the current session.
 */
export const getSession = async () => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return null
        }

        const { data: { session } } = await supabase.auth.getSession()
        return session
    } catch (error) {
        console.error('Error getting session:', error)
        return null
    }
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export const onAuthStateChange = async (callback) => {
    try {
        const supabase = await getSupabase()
        if (!supabase) {
            return () => { }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session)
        })

        return () => subscription.unsubscribe()
    } catch (error) {
        console.error('Error subscribing to auth changes:', error)
        return () => { }
    }
}
