/**
 * License Server Utility (Refactored v2.1.15)
 * 
 * Handles identity verification (Google Sign-In) and license status 
 * checks against the Master License Server.
 */

import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

// --- MASTER LICENSE SERVER CREDENTIALS ---
const MASTER_SUPABASE_URL = 'https://qrueudowswugtidmsphk.supabase.co'
const MASTER_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFydWV1ZG93c3d1Z3RpZG1zcGhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjcxMTYsImV4cCI6MjA4MzYwMzExNn0.mAASDPbmjEv_KVmeFtYQcagfB90Ea3eAv5U6gY69zds'

// Create a separate client for the Master License Server
export const masterClient = createClient(MASTER_SUPABASE_URL, MASTER_SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce' // Force PKCE globally for better security and stability
    }
})

/**
 * Perform Google Sign-In with platform-specific logic.
 */
export const signInWithGoogle = async () => {
    const isElectron = !!window.electronAPI
    const isNative = Capacitor.isNativePlatform()

    // Determine the correct redirect URL
    let redirectTo = window.location.origin
    if (isElectron) {
        redirectTo = 'allset://auth-callback'
    } else if (isNative) {
        redirectTo = 'com.aofbiz.app://auth-callback'
    }

    console.log(`[AUTH] Starting Google Login. Platform: ${isNative ? 'Mobile' : isElectron ? 'Desktop' : 'Web'}, Redirect: ${redirectTo}`)

    const { data, error } = await masterClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectTo,
            skipBrowserRedirect: isElectron, // Electron handles its own browser window
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    })

    if (error) throw error

    // Special handling for Electron: open the system browser manually
    if (isElectron && data?.url) {
        window.electronAPI.openExternal(data.url)
    }
}

/**
 * Verify license status for a given email.
 */
export const checkLicenseStatus = async (email) => {
    try {
        const { data, error } = await masterClient
            .from('licenses')
            .select('*')
            .eq('email', email)
            .maybeSingle()

        if (error && error.code !== 'PGRST116') {
            return { status: 'free', error: error.message }
        }

        return {
            status: data?.status || 'free',
            expiry: data?.expiry || null
        }
    } catch (err) {
        return { status: 'free', error: err.message }
    }
}

/**
 * Handle Auth Callback (Token exchange)
 * Supports both Implicit (tokens in fragment) and PKCE (code in query)
 */
export const handleAuthCallback = async (url) => {
    if (!url) return null

    // Normalize URL for easier parsing (handle fragment vs query)
    const normalizedUrl = url.replace('#', '?')
    const urlObj = new URL(normalizedUrl)

    const accessToken = urlObj.searchParams.get('access_token')
    const refreshToken = urlObj.searchParams.get('refresh_token')
    const code = urlObj.searchParams.get('code')

    if (accessToken && refreshToken) {
        const { data, error } = await masterClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        })
        if (error) throw error
        return { user: data.user, session: data.session }
    }

    if (code) {
        const { data, error } = await masterClient.auth.exchangeCodeForSession(code)
        if (error) throw error
        return { user: data.user, session: data.session }
    }

    return null
}

/**
 * Get current Google identity
 */
export const getIdentityUser = async () => {
    const { data: { user } } = await masterClient.auth.getUser()
    return user
}

/**
 * Sign out
 */
export const signOutIdentity = async () => {
    await masterClient.auth.signOut()
}

/**
 * Logging Leads
 */
export const registerFreeUser = async (user) => {
    if (!user) return
    try {
        await masterClient.from('free_users_leads').upsert({
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email.split('@')[0],
            last_login: new Date().toISOString()
        }, { onConflict: 'email' })
    } catch (err) { console.error('Lead error:', err) }
}

export const registerTrialUser = async (user) => {
    if (!user) return
    try {
        await masterClient.from('trial_users_leads').upsert({
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email.split('@')[0],
            trial_started_at: new Date().toISOString(),
            trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            last_login: new Date().toISOString()
        }, { onConflict: 'email' })
    } catch (err) { console.error('Trial Lead error:', err) }
}

export const logUnauthorizedAttempt = async (email) => {
    if (!email) return
    try {
        await masterClient.from('unauthorized_attempts').insert([{
            email,
            attempted_at: new Date().toISOString()
        }])
    } catch (err) { console.error('Audit log error:', err) }
}
