import { useEffect } from 'react'
import { getSettings } from '../utils/storage'
import { useToast } from './Toast/ToastContext'

const AutoBackupHandler = ({ session, dataLoading }) => {
    const { addToast } = useToast()

    useEffect(() => {
        if (!session || dataLoading) return

        const runAutoBackupCheck = async () => {
            try {
                // 1. Get Settings
                const settings = await getSettings()

                // 2. Check if Auto Backup is enabled and configured
                if (!settings?.googleDrive?.autoBackup || !settings?.googleDrive?.clientId) {
                    return
                }

                // 3. Time check (Default: daily = 86400000 ms)
                const lastBackup = settings.googleDrive.lastBackup
                const now = new Date().getTime()
                let backupInterval = 24 * 60 * 60 * 1000 // Daily default
                const freq = settings.googleDrive.frequency || 'daily'

                if (freq === 'hourly') backupInterval = 60 * 60 * 1000
                if (freq === '6hours') backupInterval = 6 * 60 * 60 * 1000
                if (freq === '12hours') backupInterval = 12 * 60 * 60 * 1000
                if (freq === 'weekly') backupInterval = 7 * 24 * 60 * 60 * 1000
                if (freq === 'monthly') backupInterval = 30 * 24 * 60 * 60 * 1000

                if (lastBackup && (now - new Date(lastBackup).getTime() < backupInterval)) {
                    console.log("Auto-backup skipped: Too soon.")
                    return
                }

                // 4. Notify User
                console.log("Backup is due! Notifying user.")
                addToast("Cloud Backup is due. Please visit Settings -> Backup to sync.", "info", 6000)

            } catch (e) {
                console.error("Auto Backup check failed", e)
            }
        }

        // Delay slightly to let app settle, similar to original implementation
        const timeout = setTimeout(runAutoBackupCheck, 5000)
        return () => clearTimeout(timeout)

    }, [session, dataLoading, addToast])

    return null // This component acts as a logic handler, renders nothing
}

export default AutoBackupHandler
