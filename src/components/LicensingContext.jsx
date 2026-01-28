/**
 * Licensing Context (Refactored v2.1.15)
 * 
 * Manages the application's licensing state, trial logic, 
 * and identity-linked verification.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
    getIdentityUser,
    checkLicenseStatus,
    handleAuthCallback,
    signInWithGoogle,
    signOutIdentity,
    logUnauthorizedAttempt,
    registerFreeUser,
    registerTrialUser,
    masterClient
} from '../utils/licenseServer'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

const LicensingContext = createContext(null)

export const LicensingProvider = ({ children }) => {
    // 1. Core Auth/License State
    const [identityUser, setIdentityUser] = useState(null)
    const [licenseStatus, setLicenseStatus] = useState('free') // 'free', 'pro', 'trial'
    const [userMode, setUserMode] = useState(null) // 'free', 'pro', or null (Choice Screen)
    const [isLoading, setIsLoading] = useState(true)
    const [authError, setAuthError] = useState(null)

    // 2. Settings
    const [rememberSelection, setRememberSelection] = useState(() => localStorage.getItem('allset_remember_selection') === 'true')

    // 3. Trial State
    const [timeLeft, setTimeLeft] = useState(0)
    const TRIAL_DURATION = 3 * 24 * 60 * 60 * 1000 // 3 days

    // Timeout utility for network calls
    const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), ms))
    ])

    /**
     * Helper: Re-evaluate everything for a user
     */
    const refreshUserLicense = useCallback(async (user) => {
        if (!user) {
            setIdentityUser(null)
            setUserMode(null)
            return
        }

        const result = await checkLicenseStatus(user.email)
        setIdentityUser(user)
        setLicenseStatus(result.status)

        // Cache identity and license for offline use
        localStorage.setItem('allset_cached_identity', JSON.stringify({
            email: user.email,
            name: user.user_metadata?.full_name,
            cachedAt: Date.now()
        }))
        localStorage.setItem('allset_cached_license', result.status)

        // Retrieval of intents/modes
        const savedMode = localStorage.getItem('allset_user_mode') || sessionStorage.getItem('allset_user_mode')
        const authIntent = localStorage.getItem('allset_auth_intent') || sessionStorage.getItem('allset_auth_intent')

        // Logical Branching
        if (result.status === 'pro') {
            // Priority 1: User is a paying Pro member. They get Pro mode unless they chose Free.
            setUserMode(savedMode === 'free' ? 'free' : 'pro')
        } else if (authIntent === 'trial') {
            // Priority 2: User explicitly clicked "Start Trial"
            const trialStart = localStorage.getItem('allset_trial_start')
            if (!trialStart) {
                // If no trial ever started, register it now
                await registerTrialUser(user)
                localStorage.setItem('allset_trial_start', Date.now().toString())
            }
            setUserMode('pro')
            localStorage.removeItem('allset_auth_intent')
            sessionStorage.removeItem('allset_auth_intent')
        } else {
            // Priority 3: Free or Existing Trial check
            const trialStart = localStorage.getItem('allset_trial_start')
            const hasActiveTrial = trialStart && (Date.now() - parseInt(trialStart) < TRIAL_DURATION)

            if (savedMode === 'pro') {
                if (hasActiveTrial) {
                    setUserMode('pro')
                } else {
                    // Access Denied: User wants Pro, but no License and no Active Trial
                    await logUnauthorizedAttempt(user.email)
                    await signOutIdentity()
                    setIdentityUser(null)
                    setAuthError('ACCOUNT_NOT_AUTHORIZED')
                    setUserMode(null)
                }
            } else if (savedMode === 'free') {
                await registerFreeUser(user)
                setUserMode('free')
            } else {
                // No clear mode chosen yet (Choice Screen)
                setUserMode(null)
            }
        }
    }, [TRIAL_DURATION])

    /**
     * Initial Boot: Try to find a user
     */
    useEffect(() => {
        const init = async () => {
            setIsLoading(true)
            try {
                // Try to get identity with 5s timeout
                const user = await withTimeout(getIdentityUser(), 5000)
                if (user) {
                    await withTimeout(refreshUserLicense(user), 10000)
                } else {
                    setUserMode(null)
                }
            } catch (err) {
                console.warn('Network unavailable or timeout, using cached state:', err.message)

                // Fallback to cached identity/license
                const cachedIdentityStr = localStorage.getItem('allset_cached_identity')
                const cachedLicense = localStorage.getItem('allset_cached_license')
                const cachedMode = localStorage.getItem('allset_user_mode') || sessionStorage.getItem('allset_user_mode')

                if (cachedIdentityStr && cachedMode) {
                    try {
                        const cachedIdentity = JSON.parse(cachedIdentityStr)
                        setIdentityUser(cachedIdentity)
                        setLicenseStatus(cachedLicense || 'free')
                        setUserMode(cachedMode)
                        console.log('Loaded cached identity for offline use:', cachedIdentity.email)
                    } catch (parseErr) {
                        console.error('Failed to parse cached identity:', parseErr)
                        setUserMode(null)
                    }
                } else {
                    // No cache available - stay on mode selection (offline first-time)
                    setUserMode(null)
                }
            } finally {
                setIsLoading(false)
            }
        }
        init()
    }, [refreshUserLicense])

    /**
     * Deep Link Listener: Handle incoming logins
     */
    useEffect(() => {
        const handleDeepLink = async (url) => {
            if (!url) return
            console.log('[AUTH] Deep Link Received:', url)
            setIsLoading(true)
            try {
                const res = await handleAuthCallback(url)
                if (res?.user) {
                    console.log('[AUTH] Callback successful, refreshing license.')
                    await refreshUserLicense(res.user)
                    setAuthError(null)
                }
            } catch (err) {
                console.error('[AUTH] Deep link exchange fail:', err)
                setAuthError('AUTHENTICATION_FAILED')
            } finally {
                setTimeout(() => setIsLoading(false), 500)
            }
        }

        // Electron
        if (window.electronAPI?.onAuthCallback) {
            window.electronAPI.onAuthCallback(handleDeepLink)
        }

        // Mobile
        let appListener = null
        if (Capacitor.isNativePlatform()) {
            appListener = App.addListener('appUrlOpen', (data) => handleDeepLink(data.url))
        }

        return () => { if (appListener) appListener.remove() }
    }, [refreshUserLicense])

    /**
     * Actions
     */
    const login = async (mode = 'pro', intent = null) => {
        setIsLoading(true)
        setAuthError(null)

        // Pre-persist intent so it's available after redirect
        localStorage.setItem('allset_user_mode', mode)
        if (intent) localStorage.setItem('allset_auth_intent', intent)
        else localStorage.removeItem('allset_auth_intent')

        try {
            await signInWithGoogle()
        } catch (err) {
            console.error('[AUTH] SignIn call failed:', err)
            setAuthError('LOGIN_CLICK_FAILED')
            setIsLoading(false)
        }
    }

    const logout = async () => {
        setIsLoading(true)
        await signOutIdentity()
        setIdentityUser(null)
        setUserMode(null)
        localStorage.removeItem('allset_user_mode')
        sessionStorage.removeItem('allset_user_mode')
        sessionStorage.removeItem('allset_auth_intent')
        setIsLoading(false)
    }

    const activateTrial = async (user = null) => {
        const targetUser = user || identityUser
        if (targetUser) await registerTrialUser(targetUser)

        localStorage.setItem('allset_trial_start', Date.now().toString())
        setUserMode('pro')
    }

    // Persist Mode Changes (Sync UI preference with storage)
    useEffect(() => {
        if (userMode) {
            if (rememberSelection) localStorage.setItem('allset_user_mode', userMode)
            else sessionStorage.setItem('allset_user_mode', userMode)
        }
    }, [userMode, rememberSelection])

    useEffect(() => {
        localStorage.setItem('allset_remember_selection', rememberSelection)
    }, [rememberSelection])

    // Trial Timer Logic
    useEffect(() => {
        const checkTrial = () => {
            const trialStart = localStorage.getItem('allset_trial_start')
            if (trialStart) {
                const remaining = TRIAL_DURATION - (Date.now() - parseInt(trialStart))
                setTimeLeft(remaining > 0 ? remaining : 0)
            }
        }
        checkTrial()
        const timer = setInterval(checkTrial, 60000)
        return () => clearInterval(timer)
    }, [TRIAL_DURATION])

    // Export simplified status
    const isProUser = userMode === 'pro' && (licenseStatus === 'pro' || timeLeft > 0)
    const isFreeUser = userMode === 'free' || (userMode === 'pro' && licenseStatus !== 'pro' && timeLeft <= 0)
    const isTrialActive = userMode === 'pro' && licenseStatus !== 'pro' && timeLeft > 0

    const value = {
        identityUser, licenseStatus, isLoading, userMode, setUserMode,
        rememberSelection, setRememberSelection, isProUser, isFreeUser,
        isTrialActive, timeLeft, authError, setAuthError,
        login, logout, activateTrial,
        resetSelection: () => {
            setUserMode(null)
            setRememberSelection(false)
            localStorage.removeItem('allset_user_mode')
            localStorage.removeItem('allset_auth_intent')
        }
    }

    return (
        <LicensingContext.Provider value={value}>
            {children}
        </LicensingContext.Provider>
    )
}

export const useLicensing = () => useContext(LicensingContext)
