import { useState, useCallback, useEffect } from 'react'
import { getLatestUpdate } from '../services/updateService'
import pkg from '../../package.json'

export const useUpdateManager = () => {
    const [status, setStatus] = useState('idle') // idle, checking, available, downloading, ready, up-to-date, error
    const [updateInfo, setUpdateInfo] = useState(null)
    const [progress, setProgress] = useState(0)
    const [downloadStats, setDownloadStats] = useState({ speed: 0, total: 0, transferred: 0 })
    const [error, setError] = useState(null)

    const currentVersion = pkg.version

    const compareVersions = (latest, current) => {
        if (!latest || !current) return 0
        const parse = (v) => v.replace(/^v/, '').split('.').map(Number)
        const l = parse(latest)
        const c = parse(current)

        // Pad with zeros if version lengths differ
        const length = Math.max(l.length, c.length)
        for (let i = 0; i < length; i++) {
            const lVal = l[i] || 0
            const cVal = c[i] || 0
            if (lVal > cVal) return 1
            if (lVal < cVal) return -1
        }
        return 0
    }

    const checkForUpdates = useCallback(async (isSilent = false) => {
        if (!isSilent) setStatus('checking')
        setError(null)

        try {
            // Add a small delay for non-silent check to feel more interactive
            if (!isSilent) await new Promise(r => setTimeout(r, 800))

            const latest = await getLatestUpdate()
            if (!latest) {
                if (!isSilent) setStatus('up-to-date')
                return
            }

            if (compareVersions(latest.version, currentVersion) > 1 || compareVersions(latest.version, currentVersion) === 1) {
                setUpdateInfo({
                    ...latest,
                    is_mandatory: latest.is_mandatory || false
                })
                setStatus('available')
            } else {
                if (!isSilent) setStatus('up-to-date')
            }
        } catch (err) {
            console.error('UpdateManager: Check failed:', err)
            setError('Failed to check for updates.')
            setStatus('error')
        }
    }, [currentVersion])

    const startDownload = useCallback(async (platform = null) => {
        if (!updateInfo) return

        // Determine which link to use
        const useApk = platform === 'apk' || (!platform && !window.electronAPI)
        const downloadUrl = useApk ? updateInfo.apk_link : updateInfo.exe_link

        if (!downloadUrl) {
            setError(`${useApk ? 'APK' : 'EXE'} download link missing.`)
            setStatus('error')
            return
        }

        // If it's an APK or we are not in Electron, open in browser
        if (useApk || !window.electronAPI) {
            window.open(downloadUrl, '_blank')
            if (useApk && window.electronAPI) {
                // If we are in Electron but downloading APK, just keep status as available
                return
            }
            setStatus('ready')
        } else {
            // Electron EXE flow
            setStatus('downloading')
            setProgress(0)
            try {
                window.electronAPI.onUpdateStatus(({ type, percent, total, transferred, speed, error: dlError }) => {
                    if (type === 'downloading') {
                        setProgress(percent)
                        setDownloadStats({ total: total || 0, transferred: transferred || 0, speed: speed || 0 })
                    }
                    if (type === 'downloaded') setStatus('ready')
                    if (type === 'error') {
                        setError(dlError || 'Download failed.')
                        setStatus('error')
                    }
                })
                await window.electronAPI.startDownload(downloadUrl, updateInfo.checksum)
            } catch (err) {
                setStatus('error')
                setError('Failed to initiate download.')
            }
        }
    }, [updateInfo])

    const installUpdate = useCallback(() => {
        if (window.electronAPI) {
            window.electronAPI.installUpdate()
        }
    }, [])

    return {
        status,
        updateInfo,
        progress,
        downloadStats,
        error,
        checkForUpdates,
        startDownload,
        installUpdate,
        currentVersion
    }
}
