import { useState, useCallback, useEffect } from 'react'
import { getLatestUpdate } from '../services/updateService'
import { openExternalUrl, isCapacitor } from '../utils/platform'
import pkg from '../../package.json'

export const useUpdateManager = () => {
    const [status, setStatus] = useState('idle') // idle, checking, available, downloading, ready, up-to-date, error
    const [updateInfo, setUpdateInfo] = useState(null)
    const [progress, setProgress] = useState(0)
    const [downloadStats, setDownloadStats] = useState({ speed: 0, total: 0, transferred: 0 })
    const [error, setError] = useState(null)
    const [deadline, setDeadline] = useState(null)
    const [timeRemaining, setTimeRemaining] = useState(null)
    const [isBlocked, setIsBlocked] = useState(false)
    const [downloadedFilePath, setDownloadedFilePath] = useState(null)

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

            if (compareVersions(latest.version, currentVersion) >= 0) {
                const isMandatory = latest.is_mandatory || false

                if (isMandatory) {
                    const storedDeadline = localStorage.getItem('mandatory_deadline')
                    let targetDeadline

                    if (storedDeadline) {
                        targetDeadline = parseInt(storedDeadline, 10)
                    } else {
                        targetDeadline = Date.now() + (48 * 60 * 60 * 1000) // 48 hours from now
                        localStorage.setItem('mandatory_deadline', targetDeadline.toString())
                    }
                    setDeadline(targetDeadline)
                }

                setUpdateInfo({
                    ...latest,
                    is_mandatory: isMandatory,
                    // Uses exe_size and apk_size directly from the database row if provided
                })

                if (compareVersions(latest.version, currentVersion) > 0) {
                    setStatus('available')
                } else {
                    if (!isSilent) setStatus('up-to-date')
                }
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

        // If it's an APK or we are not in Electron, check for Capacitor or Web
        if (useApk || !window.electronAPI) {
            if (isCapacitor()) {
                // Capacitor Mobile Download & Install Flow
                try {
                    setStatus('downloading')
                    setProgress(0)

                    const { Filesystem, Directory } = await import('@capacitor/filesystem')
                    const { FileOpener } = await import('@capawesome-team/capacitor-file-opener')

                    const fileName = downloadUrl.split('/').pop() || 'update.apk'

                    console.log('UpdateManager: Starting APK download...', { fileName, downloadUrl })

                    // 1. Download the file
                    const downloadResult = await Filesystem.downloadFile({
                        url: downloadUrl,
                        path: fileName,
                        directory: Directory.Cache,
                        progress: true
                    })

                    console.log('UpdateManager: Download complete, result:', downloadResult)

                    // 2. Get the full file URI (required for FileOpener)
                    const uriResult = await Filesystem.getUri({
                        path: fileName,
                        directory: Directory.Cache
                    })

                    console.log('UpdateManager: Full file URI:', uriResult.uri)

                    setStatus('ready')
                    setProgress(100)
                    setDownloadedFilePath(uriResult.uri) // Store the full URI, not relative path

                    // 3. Trigger installation immediately
                    await FileOpener.openFile({
                        path: uriResult.uri,
                        mimeType: 'application/vnd.android.package-archive' // Explicit APK MIME type
                    })
                } catch (err) {
                    console.error('Capacitor Download/Install error:', err)
                    setError('Failed to download or install update: ' + (err.message || err))
                    setStatus('error')
                }
            } else {
                // Web Browser flow
                openExternalUrl(downloadUrl)
                if (useApk && window.electronAPI) {
                    // If we are in Electron but downloading APK, just keep status as available
                    return
                }
                setStatus('ready')
            }
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

    // Timer logic for blocking screen
    useEffect(() => {
        if (!deadline) return

        const checkTime = () => {
            const now = Date.now()
            const remaining = deadline - now

            setTimeRemaining(remaining)

            if (remaining <= 0) {
                setIsBlocked(true)
            } else {
                setIsBlocked(false)
            }
        }

        checkTime() // Initial check
        const interval = setInterval(checkTime, 60000) // Check every minute (sufficient for UI)

        return () => clearInterval(interval)
    }, [deadline])

    const installUpdate = useCallback(async () => {
        if (window.electronAPI) {
            window.electronAPI.installUpdate()
        } else if (isCapacitor() && downloadedFilePath) {
            try {
                console.log('installUpdate: Opening APK for installation:', downloadedFilePath)
                const { FileOpener } = await import('@capawesome-team/capacitor-file-opener')
                await FileOpener.openFile({
                    path: downloadedFilePath,
                    mimeType: 'application/vnd.android.package-archive' // Explicit APK MIME type
                })
            } catch (err) {
                console.error('File opener error:', err)
                setError('Failed to open installer: ' + (err.message || err))
            }
        } else {
            console.warn('installUpdate: Cannot install - no Electron API and no downloaded file path')
        }
    }, [downloadedFilePath])

    const cancelDownload = useCallback(async () => {
        if (window.electronAPI) {
            await window.electronAPI.cancelDownload()
            setStatus('available')
            setProgress(0)
            setDownloadStats({ total: 0, transferred: 0, speed: 0 })
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
        cancelDownload,
        installUpdate,
        currentVersion,
        deadline,
        timeRemaining,
        isBlocked
    }
}
