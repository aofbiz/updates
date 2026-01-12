import { masterClient } from '../utils/licenseServer'

/**
 * Fetches the latest update metadata from the Supabase master table.
 * @returns {Promise<Object|null>} The latest update row or null.
 */
export const getLatestUpdate = async () => {
    try {
        const { data, error } = await masterClient
            .from('updates')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === 'PGRST116') return null // No updates found
            throw error
        }

        return data
    } catch (err) {
        console.error('UpdateService: Failed to fetch latest update:', err)
        return null
    }
}
