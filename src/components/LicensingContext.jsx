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
    registerTrialUser
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
    const [userMode, setUserMode] = useState(() => {
        const saved = localStorage.getItem('aof_user_mode') || sessionStorage.getItem('aof_user_mode')
        return saved || null
    })
    const [rememberSelection, setRememberSelection] = useState(() => localStorage.getItem('aof_remember_selection') === 'true')

    // Trial state
    const [timeLeft, setTimeLeft] = useState(0)
    const TRIAL_DURATION = 3 * 24 * 60 * 60 * 1000 // 3 days

    /**
     * Calculate and update trial time
     */
    const updateTrialTime = useCallback(() => {
        const trialStart = localStorage.getItem('aof_trial_start')
        if (trialStart) {
            const now = Date.now()
            const startStr = trialStart
            const remaining = TRIAL_DURATION - (now - parseInt(startStr))
            setTimeLeft(Math.max(0, remaining))
            return remaining > 0
        }
        return false
    }, [])

    /**
     * Initial Load: Check Auth and License
     */
    useEffect(() => {
        const initLicensing = async () => {
            setIsLoading(true)
            try {
                // 1. Check if we have a Google Identity
                const user = await getIdentityUser()
                if (user) {
                    // 2. Check Pro status
                    const result = await checkLicenseStatus(user.email)

                    if (result.status === 'pro') {
                        // User is Pro - unlock everything
                        setIdentityUser(user)
                        setLicenseStatus('pro')
                        setUserMode('pro')
                        setAuthError(null)
                    } else {
                        // User is NOT Pro - check if they are trying to access Pro or just using Free
                        const intendedMode = localStorage.getItem('aof_user_mode') || sessionStorage.getItem('aof_user_mode')

                        if (intendedMode === 'pro') {
                            // Trying to access Pro - REJECT
                            await logUnauthorizedAttempt(user.email)
                            await signOutIdentity()
                            setIdentityUser(null)
                            setAuthError('ACCOUNT_NOT_AUTHORIZED')
                            setUserMode(null)
                        } else {
                            // Using Free mode - ALLOW but collect lead
                            await registerFreeUser(user)
                            setIdentityUser(user)
                            setLicenseStatus('free')
                            setAuthError(null)
                        }
                    }
                } else {
                    // 3. Fallback to local trial logic if no identity
                    updateTrialTime()
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
            try {
                const user = await handleAuthCallback(url)
                if (user) {
                    const result = await checkLicenseStatus(user.email)

                    if (result.status === 'pro') {
                        setIdentityUser(user)
                        setLicenseStatus('pro')
                        setUserMode('pro')
                        setAuthError(null)
                    } else {
                        const intendedMode = localStorage.getItem('aof_user_mode') || sessionStorage.getItem('aof_user_mode')
                        const authIntent = sessionStorage.getItem('aof_auth_intent')

                        if (authIntent === 'trial') {
                            await activateTrial(user)
                            setAuthError(null)
                            sessionStorage.removeItem('aof_auth_intent')
                        } else if (intendedMode === 'pro') {
                            await logUnauthorizedAttempt(user.email)
                            await signOutIdentity()
                            setIdentityUser(null)
                            setAuthError('ACCOUNT_NOT_AUTHORIZED')
                            setUserMode(null)
                        } else {
                            await registerFreeUser(user)
                            setIdentityUser(user)
                            setLicenseStatus('free')
                            setAuthError(null)
                        }
                    }
                }
            } catch (err) {
                console.error('Deep link auth fail:', err)
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
                localStorage.setItem('aof_user_mode', userMode)
            } else {
                sessionStorage.setItem('aof_user_mode', userMode)
                localStorage.removeItem('aof_user_mode')
            }
        } else {
            localStorage.removeItem('aof_user_mode')
            sessionStorage.removeItem('aof_user_mode')
        }
    }, [userMode, rememberSelection])

    useEffect(() => {
        localStorage.setItem('aof_remember_selection', rememberSelection)
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
        await signOutIdentity()
        setIdentityUser(null)
        setLicenseStatus('free')
        setAuthError(null)
        // Don't reset userMode automatically so user can still browse local
    }

    const activateTrial = async (user = null) => {
        // If we have a user from login, capture them as a lead
        if (user) {
            await registerTrialUser(user)
            setIdentityUser(user)
        }

        const now = Date.now().toString()
        localStorage.setItem('aof_trial_start', now)
        updateTrialTime()
        setUserMode('pro') // Unlock features temporarily
    }

    const resetSelection = () => {
        setUserMode(null)
        setRememberSelection(false)
        localStorage.removeItem('aof_user_mode')
        localStorage.removeItem('aof_remember_selection')
    }

    // Derivative states for UI - Strictly controlled
    // A user is Pro ONLY if they chose 'pro' mode AND (they have a license OR trial is active)
    const isProUser = userMode === 'pro' && (licenseStatus === 'pro' || timeLeft > 0)
    const isFreeUser = userMode === 'free' || !isProUser
    const isTrialActive = timeLeft > 0 && licenseStatus !== 'pro'
    const isTrialExpired = localStorage.getItem('aof_trial_start') && timeLeft <= 0 && licenseStatus !== 'pro'

    const value = {
        identityUser,
        licenseStatus,
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
