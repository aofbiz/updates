import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null

/**
 * Fetch the latest update record from Supabase
 */
export const getLatestUpdate = async () => {
    if (!supabase) {
        console.warn('UpdateService: Supabase credentials not found in env.')
        return null
    }
    try {
        const { data, error } = await supabase
            .from('updates')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                // No records found
                return null
            }
            throw error
        }

        return data
    } catch (error) {
        console.error('Error fetching latest update:', error)
        return null
    }
}
