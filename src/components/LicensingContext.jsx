/**
 * Licensing Context
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
    // Identity state (Google)
    const [identityUser, setIdentityUser] = useState(null)
    const [licenseStatus, setLicenseStatus] = useState('free') // 'free', 'pro', 'trial'
    const [isLoading, setIsLoading] = useState(true)
    const [authError, setAuthError] = useState(null)

    // Mode selection persistence
    const [userMode, setUserMode] = useState(null)
    const [rememberSelection, setRememberSelection] = useState(() => localStorage.getItem('allset_remember_selection') === 'true')

    // Trial state
    const [timeLeft, setTimeLeft] = useState(0)
    const TRIAL_DURATION = 3 * 24 * 60 * 60 * 1000 // 3 days

    /**
     * Calculate and update trial time
     */
    const updateTrialTime = useCallback(() => {
        const trialStart = localStorage.getItem('allset_trial_start')
        if (trialStart) {
            const now = Date.now()
            const startStr = trialStart
            const elapsed = now - parseInt(startStr)
            const remaining = TRIAL_DURATION - elapsed

            if (remaining <= 0) {
                // Trial Expired
                setTimeLeft(0)
                // Automatically switch to free mode if trial expires while in pro mode
                if (userMode === 'pro' && licenseStatus !== 'pro') {
                    setUserMode('free')
                }
                // We do NOT clear allset_trial_start here so we know they DID have a trial that is now expired
                // This prevents them from starting a new one.
                return false
            } else {
                // Trial Active
                setTimeLeft(remaining)
                return true
            }
        }
        return false
    }, [userMode, licenseStatus])

    // Periodically check trial status while app is running
    useEffect(() => {
        const timer = setInterval(() => {
            if (timeLeft > 0) {
                updateTrialTime()
            }
        }, 60000) // Check every minute
        return () => clearInterval(timer)
    }, [timeLeft, updateTrialTime])

    /**
     * Initial Load: Check Auth and License
     */
    useEffect(() => {
        const initLicensing = async () => {
            setIsLoading(true)
            try {
                // 1. Check if we have a Google Identity
                const user = await getIdentityUser()
                const intendedMode = localStorage.getItem('allset_user_mode') || sessionStorage.getItem('allset_user_mode')

                if (user) {
                    // 2. Check Pro status
                    const result = await checkLicenseStatus(user.email)

                    if (result.status === 'pro') {
                        // User is Pro - unlock everything
                        setIdentityUser(user)
                        setLicenseStatus('pro')

                        // ONLY auto-upgrade to pro mode if they haven't explicitly chosen 'free'
                        if (intendedMode !== 'free') {
                            setUserMode('pro')
                        }
                        setAuthError(null)
                    } else {
                        // User is NOT Pro - check if they are trying to access Pro or just using Free
                        const authIntent = localStorage.getItem('allset_auth_intent') || sessionStorage.getItem('allset_auth_intent')

                        // Check for valid trial
                        const hasActiveTrial = updateTrialTime()

                        if (authIntent === 'trial') {
                            await activateTrial(user)
                            localStorage.removeItem('allset_auth_intent')
                            sessionStorage.removeItem('allset_auth_intent')
                        } else if (intendedMode === 'pro') {
                            if (hasActiveTrial) {
                                // Allow Pro access via Trial
                                setIdentityUser(user)
                                setLicenseStatus('free')
                                setAuthError(null)
                                setUserMode('pro')
                            } else {
                                // Trying to access Pro without license or trial - REJECT
                                await logUnauthorizedAttempt(user.email)
                                await signOutIdentity()
                                setIdentityUser(null)
                                setAuthError('ACCOUNT_NOT_AUTHORIZED')
                                setUserMode(null)
                            }
                        } else {
                            // Default to Free mode (either intended or fallback)
                            // Even if a trial exists, they chose FREE or were redirected here
                            await registerFreeUser(user)
                            setIdentityUser(user)
                            setLicenseStatus('free')
                            setAuthError(null)
                            setUserMode('free')

                            if (authIntent === 'free') {
                                localStorage.removeItem('allset_auth_intent')
                                sessionStorage.removeItem('allset_auth_intent')
                            }
                        }
                    }
                } else {
                    // 3. No Identity User Found -> KILL Guest Session
                    console.log('Licensing: No identity user found. Resetting guest mode.')
                    setUserMode(null)
                    setIdentityUser(null)
                    setLicenseStatus('free')
                }
            } catch (err) {
                console.error('Licensing check failed:', err)
            } finally {
                setIsLoading(false)
            }
        }
        initLicensing()

        // Unified Deep Link Handler
        const handleAuthUrl = async (url) => {
            if (!url) return
            console.log('Processing auth callback:', url)
            setIsLoading(true)
            try {
                const authResult = await handleAuthCallback(url)
                if (authResult?.user) {
                    const { user } = authResult
                    const result = await checkLicenseStatus(user.email)

                    if (result.status === 'pro') {
                        setIdentityUser(user)
                        setLicenseStatus('pro')
                        setUserMode('pro')
                        setAuthError(null)
                    } else {
                        const intendedMode = localStorage.getItem('allset_user_mode') || sessionStorage.getItem('allset_user_mode')
                        const authIntent = localStorage.getItem('allset_auth_intent') || sessionStorage.getItem('allset_auth_intent')

                        // Check for valid existing trial
                        const hasActiveTrial = updateTrialTime()

                        if (authIntent === 'trial') {
                            await activateTrial(user)
                            setAuthError(null)
                            localStorage.removeItem('allset_auth_intent')
                            sessionStorage.removeItem('allset_auth_intent')
                            // activateTrial sets userMode to 'pro' internally
                        } else if (intendedMode === 'pro') {
                            if (hasActiveTrial) {
                                // Allow Pro access via valid Trial
                                setIdentityUser(user)
                                setLicenseStatus('free')
                                setAuthError(null)
                                setUserMode('pro') // FORCE UI update
                            } else {
                                await logUnauthorizedAttempt(user.email)
                                await signOutIdentity()
                                setIdentityUser(null)
                                setAuthError('ACCOUNT_NOT_AUTHORIZED')
                                setUserMode(null)
                            }
                        } else {
                            await registerFreeUser(user)
                            setIdentityUser(user)
                            setLicenseStatus('free')
                            setAuthError(null)
                            setUserMode('free') // FORCE UI update

                            if (authIntent === 'free') {
                                localStorage.removeItem('allset_auth_intent')
                                sessionStorage.removeItem('allset_auth_intent')
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Deep link auth fail:', err)
                setAuthError('Login failed during authentication callback.')
            } finally {
                // Small delay to ensure all state updates are processed before clearing loader
                setTimeout(() => setIsLoading(false), 500)
            }
        }

        // Electron Deep Link Listener
        if (window.electronAPI?.onAuthCallback) {
            window.electronAPI.onAuthCallback(handleAuthUrl)
        }

        // Capacitor Deep Link Listener
        let appListener = null
        if (Capacitor.isNativePlatform()) {
            appListener = App.addListener('appUrlOpen', (data) => {
                handleAuthUrl(data.url)
            })
        }

        return () => {
            if (appListener) appListener.remove()
        }
    }, [updateTrialTime])

    /**
     * Persist selection
     */
    useEffect(() => {
        if (userMode) {
            if (rememberSelection) {
                localStorage.setItem('allset_user_mode', userMode)
            } else {
                sessionStorage.setItem('allset_user_mode', userMode)
                localStorage.removeItem('allset_user_mode')
            }
        } else {
            localStorage.removeItem('allset_user_mode')
            sessionStorage.removeItem('allset_user_mode')
        }
    }, [userMode, rememberSelection])

    useEffect(() => {
        localStorage.setItem('allset_remember_selection', rememberSelection)
    }, [rememberSelection])

    /**
     * Actions
     */
    const login = async () => {
        setIsLoading(true)
        try {
            await signInWithGoogle()
        } catch (err) {
            console.error('Login failed:', err)
            setIsLoading(false)
            throw err
        }
    }

    const logout = async () => {
        setIsLoading(true)
        try {
            await signOutIdentity()
            setIdentityUser(null)
            setLicenseStatus('free')
            setAuthError(null)
            setUserMode(null) // Kick back to selection screen
            localStorage.removeItem('allset_user_mode')
            sessionStorage.removeItem('allset_user_mode')
        } catch (err) {
            console.error('Logout failed:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const activateTrial = async (user = null) => {
        // If we have a user from login, capture them as a lead
        if (user) {
            await registerTrialUser(user)
            setIdentityUser(user)
        }

        const now = Date.now().toString()
        localStorage.setItem('allset_trial_start', now)
        updateTrialTime()
        setUserMode('pro') // Unlock features temporarily
    }

    const resetSelection = () => {
        setUserMode(null)
        setRememberSelection(false)
        localStorage.removeItem('allset_user_mode')
        localStorage.removeItem('allset_remember_selection')
    }

    // Derivative states for UI - Strictly controlled
    // A user is Pro ONLY if they chose 'pro' mode AND (they have a license OR trial is active)
    const isProUser = userMode === 'pro' && (licenseStatus === 'pro' || timeLeft > 0)

    // A user is Free if they chose 'free' mode OR they chose 'pro' but don't have access
    const isFreeUser = userMode === 'free' || (userMode === 'pro' && licenseStatus !== 'pro' && timeLeft <= 0)

    // Trial is ONLY active if:
    // 1. They are in pro mode
    // 2. They don't have a full license
    // 3. Time is remaining
    // 4. They actually have a trial start record
    const isTrialActive = userMode === 'pro' && licenseStatus !== 'pro' && timeLeft > 0 && !!localStorage.getItem('allset_trial_start')

    const isTrialExpired = userMode === 'pro' && licenseStatus !== 'pro' && timeLeft <= 0 && !!localStorage.getItem('allset_trial_start')

    const [session, setSession] = useState(null)

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await masterClient.auth.getSession()
            setSession(session)
        }
        getSession()

        const { data: { subscription } } = masterClient.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    const value = {
        identityUser,
        licenseStatus,
        session,
        isLoading,
        userMode,
        setUserMode,
        resetSelection,
        rememberSelection,
        setRememberSelection,
        isProUser,
        isFreeUser,
        isTrialActive,
        isTrialExpired,
        timeLeft,
        authError,
        setAuthError,
        login,
        logout,
        activateTrial
    }

    return (
        <LicensingContext.Provider value={value}>
            {children}
        </LicensingContext.Provider>
    )
}

export const useLicensing = () => {
    const context = useContext(LicensingContext)
    if (!context) {
        throw new Error('useLicensing must be used within a LicensingProvider')
    }
    return context
}
