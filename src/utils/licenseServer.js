/**
 * License Server Utility
 * 
 * Handles identity verification (Google Sign-In) and license status 
 * checks against the Master License Server.
 */

import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

// --- MASTER LICENSE SERVER CREDENTIALS ---
// These are for the developer's licensing project, NOT the user's data project.
const MASTER_SUPABASE_URL = 'https://qrueudowswugtidmsphk.supabase.co'
const MASTER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydWV1ZG93c3d1Z3RpZG1zcGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjcxMTYsImV4cCI6MjA4MzYwMzExNn0.mAASDPbmjEv_KVmeFtYQcagfB90Ea3eAv5U6gY69zds'
// ------------------------------------------

// Create a separate client for the Master License Server
const masterClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY)

/**
 * Perform Google Sign-In with platform-specific logic.
 */
export const signInWithGoogle = async () => {
    // Determine the correct redirect URL
    // If we're in Electron, use the custom protocol
    // If we're in web, use the current origin
    const isElectron = !!window.electronAPI
    const isMobile = Capacitor.isNativePlatform()

    let redirectTo = window.location.origin
    if (isElectron) {
        redirectTo = 'aof-biz://auth-callback'
    } else if (isMobile) {
        redirectTo = 'com.aofbiz.app://auth-callback'
    }

    const { data, error } = await masterClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectTo,
            skipBrowserRedirect: isElectron, // Prevent main window from navigating
            scopes: 'https://www.googleapis.com/auth/drive.file',
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    })

    if (error) throw error

    // In web, Supabase handles the redirect automatically.
    // In Electron, we open the auth URL in the system's default browser (e.g. Chrome/Edge)
    if (isElectron && data?.url) {
        window.electronAPI.openExternal(data.url)
    }
}

/**
 * Verify license status for a given email.
 * @param {string} email - The user's verified Google email.
 */
export const checkLicenseStatus = async (email) => {
    try {
        const { data, error } = await masterClient
            .from('licenses')
            .select('*')
            .eq('email', email)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
            console.error('License check error:', error)
            return { status: 'free', error: error.message }
        }

        if (!data) {
            return { status: 'free' } // Not found = Free user
        }

        return {
            status: data.status, // 'pro', 'trial', 'expired'
            expiry: data.expiry
        }
    } catch (err) {
        console.error('License check exception:', err)
        return { status: 'free', error: err.message }
    }
}

/**
 * Get the current authenticated identity user from the Master Server.
 */
export const getIdentityUser = async () => {
    const { data: { user } } = await masterClient.auth.getUser()
    return user
}

/**
 * Handle Auth Callback (Token exchange)
 * Used specifically for Electron's deep linking flow.
 */
export const handleAuthCallback = async (url) => {
    if (!url) return null

    // Extract access_token and refresh_token from hash/query
    const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1])
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
        const { data, error } = await masterClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        })
        if (error) throw error
        return { user: data.user, session: data.session }
    }

    return null
}

/**
 * Log an unauthorized access attempt to the master database.
 * @param {string} email - The email that tried to sign in.
 */
/**
 * Register or update a free user's information for marketing leads.
 * @param {object} user - The Supabase user object.
 */
export const registerFreeUser = async (user) => {
    if (!user) return
    try {
        await masterClient
            .from('free_users_leads')
            .upsert({
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                last_login: new Date().toISOString()
            }, {
                onConflict: 'email'
            })
    } catch (err) {
        console.error('Failed to register free user lead:', err)
    }
}

/**
 * Register a user starting a free trial.
 * @param {object} user - The Supabase user object.
 */
export const registerTrialUser = async (user) => {
    if (!user) return
    try {
        await masterClient
            .from('trial_users_leads')
            .upsert({
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email.split('@')[0],
                trial_started_at: new Date().toISOString(),
                trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                last_login: new Date().toISOString(),
                platform: window.electronAPI ? 'Desktop' : 'Web'
            }, {
                onConflict: 'email'
            })
    } catch (err) {
        console.error('Failed to register trial user lead:', err)
    }
}

export const logUnauthorizedAttempt = async (email) => {
    try {
        await masterClient
            .from('unauthorized_attempts')
            .insert([{
                email,
                attempted_at: new Date().toISOString(),
                platform: window.electronAPI ? 'Desktop' : 'Web'
            }])
    } catch (err) {
        console.error('Failed to log unauthorized attempt:', err)
    }
}

export const signOutIdentity = async () => {
    await masterClient.auth.signOut()
}

export { masterClient }
