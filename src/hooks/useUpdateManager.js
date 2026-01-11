import { useState, useEffect, useCallback } from 'react'
import { getLatestUpdate } from '../services/updateService'
import pkg from '../../package.json'

/**
 * useUpdateManager
 * 
 * High-level hook to manage software updates across platforms.
 * Bridges Electron IPC and Capacitor logic.
 */
export const useUpdateManager = () => {
    const [status, setStatus] = useState('idle') // 'idle', 'checking', 'available', 'downloading', 'ready', 'none'
    const [progress, setProgress] = useState(0)
    const [updateInfo, setUpdateInfo] = useState(null)
    const [error, setError] = useState(null)
    const [supabaseUpdate, setSupabaseUpdate] = useState(null)
    const [autoUpdate, setAutoUpdate] = useState(() => {
        const saved = localStorage.getItem('aof_auto_update')
        return saved === null ? true : saved === 'true'
    })

    const currentVersion = pkg.version

    const isElectron = !!window.electronAPI

    // Persist autoUpdate setting
    useEffect(() => {
        localStorage.setItem('aof_auto_update', autoUpdate)
    }, [autoUpdate])

    /**
     * Handle Update Status from Electron
     */
    useEffect(() => {
        if (isElectron && window.electronAPI.onUpdateStatus) {
            window.electronAPI.onUpdateStatus((data) => {
                const { type, info, message, error: updateError, percent } = data

                switch (type) {
                    case 'checking':
                        setStatus('checking')
                        break
                    case 'available':
                        setStatus('available')
                        setUpdateInfo(info)
                        // If auto-update is on, start download immediately
                        if (autoUpdate) {
                            window.electronAPI.startDownload()
                        }
                        break
                    case 'not-available':
                        setStatus('none')
                        break
                    case 'downloading':
                        setStatus('downloading')
                        setProgress(percent || 0)
                        break
                    case 'downloaded':
                        setStatus('ready')
                        setProgress(100)
                        break
                    case 'error':
                        setStatus('idle')
                        setError(updateError || message)
                        break
                    default:
                        break
                }
            })
        }
    }, [isElectron, autoUpdate])

    /**
     * Actions
     */
    const checkForUpdates = useCallback(async () => {
        setError(null)
        setStatus('checking')

        try {
            // First check Supabase for the latest public metadata
            const latest = await getLatestUpdate()
            setSupabaseUpdate(latest)

            if (latest && latest.version !== currentVersion) {
                // There is a newer version on Supabase
                if (isElectron) {
                    // On Desktop, trigger the actual binary check
                    try {
                        const result = await window.electronAPI.checkForUpdates()
                        // If result indicates no update available via GH but Supabase says yes,
                        // we'll still show the available state using Supabase info
                        if (status === 'none' || status === 'idle') {
                            setStatus('available')
                            setUpdateInfo({
                                version: latest.version,
                                releaseNotes: latest.release_notes
                            })
                        }
                    } catch (err) {
                        setStatus('available')
                        setUpdateInfo({
                            version: latest.version,
                            releaseNotes: latest.release_notes
                        })
                    }
                } else {
                    // On Mobile/Web, just show availability
                    setStatus('available')
                    setUpdateInfo({
                        version: latest.version,
                        releaseNotes: latest.release_notes
                    })
                }
            } else {
                // Supabase says we are up to date
                if (isElectron) {
                    await window.electronAPI.checkForUpdates()
                } else {
                    setTimeout(() => setStatus('none'), 1000)
                }
            }
        } catch (err) {
            console.error('Update Check Error:', err)
            setError('Failed to check for updates: ' + err.message)
            setStatus('idle')
        }
    }, [isElectron, currentVersion])

    const startDownload = useCallback(async () => {
        if (isElectron) {
            await window.electronAPI.startDownload()
        }
    }, [isElectron])

    const installUpdate = useCallback(async () => {
        if (isElectron) {
            await window.electronAPI.installUpdate()
        }
    }, [isElectron])

    // Auto-check on launch (once)
    useEffect(() => {
        checkForUpdates()
    }, [])

    return {
        status,
        progress,
        updateInfo,
        supabaseUpdate,
        currentVersion,
        error,
        autoUpdate,
        setAutoUpdate,
        checkForUpdates,
        startDownload,
        installUpdate
    }
}
