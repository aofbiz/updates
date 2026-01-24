// Local IndexedDB storage using Dexie
// Data is stored in the browser's IndexedDB.

import { db } from '../db'
import { isSupabaseConfigured, getSyncUserId } from './supabaseClient'
import { pushToCloud, deleteFromCloud } from './syncEngine'

// Bump version to invalidate any previous cached compat modes that might be too strict.
const ORDERS_SCHEMA_CACHE_KEY = 'allset_orders_schema_missing_cols_v4'
const ORDER_SOURCES_WARNED_KEY = 'allset_warned_missing_order_sources_v1'
// Debug/verification helper: confirm multi-item orders really persisted
const ORDERS_MULTIITEM_VERIFY_KEY = 'allset_orders_multiitem_verify_v1'

// Auto-sync helper - syncs record to cloud if configured
// Uses dynamic imports to avoid circular dependency
const autoSyncRecord = async (tableName, record) => {
  // Debounce - don't block the main operation
  setTimeout(async () => {
    try {
      console.log('Auto-sync: Attempting sync for', tableName)
      const configured = await isSupabaseConfigured()
      if (!configured) {
        console.log('Auto-sync: Supabase not configured')
        return
      }

      const userId = await getSyncUserId()
      if (!userId) {
        console.log('Auto-sync: No user ID found')
        return
      }

      // Add timestamp if missing
      const recordWithTimestamp = {
        ...record,
        updatedAt: record.updatedAt || new Date().toISOString()
      }

      const result = await pushToCloud(tableName, recordWithTimestamp, userId)
      if (result.success) {
        console.log(`Auto-sync: Pushed ${tableName} to cloud (User: ${userId})`)
      } else {
        console.warn(`Auto-sync: Push failed for ${tableName}`, result.error)
      }
    } catch (error) {
      console.warn('Auto-sync failed:', error.message)
    }
  }, 100)
}

// Auto-sync delete helper
const autoSyncDelete = async (tableName, recordId) => {
  setTimeout(async () => {
    try {
      console.log('Auto-sync: Attempting delete for', tableName)
      const configured = await isSupabaseConfigured()
      if (!configured) return

      const userId = await getSyncUserId()
      if (!userId) return

      await deleteFromCloud(tableName, recordId, userId)
      console.log(`Auto-sync: Deleted ${tableName}/${recordId} from cloud`)
    } catch (error) {
      console.warn('Auto-sync delete failed:', error.message)
    }
  }, 100)
}

// Helper to handle Errors (now locally)
const handleStorageError = (error, operation) => {
  console.error(`Error ${operation}:`, error)
  return null
}



// ===== ORDERS =====

export const getOrders = async () => {
  try {
    // Fetch all orders from Dexie, ordered by createdDate descending
    const data = await db.orders.orderBy('createdDate').reverse().toArray()

    // DECISION: We will store frontend-ready (camelCase) objects in Dexie.
    // So we don't need `transformOrderFromDB` if we save it clean.
    // The data fetched from Dexie should already be in the desired camelCase format.
    console.log(`storage: getOrders - Fetched ${data?.length} orders.`)
    return data || []
  } catch (error) {
    console.error('Error reading orders:', error)
    return []
  }
}

export const saveOrders = async (orders) => {
  try {
    // De-duplicate by id to avoid issues with bulkPut
    const dedupedOrders = (() => {
      const map = new Map()
        ; (orders || []).forEach(o => {
          if (!o?.id) return
          map.set(o.id, o)
        })
      return Array.from(map.values())
    })()

    // Get all existing order IDs from Dexie
    const existingOrderIds = new Set(await db.orders.toCollection().primaryKeys())
    const newOrderIds = new Set((dedupedOrders || []).map(o => o.id))

    // Find orders to delete (exist in DB but not in new array)
    const ordersToDelete = Array.from(existingOrderIds).filter(id => !newOrderIds.has(id))

    // Delete orders that are no longer in the array
    if (ordersToDelete.length > 0) {
      await db.orders.bulkDelete(ordersToDelete)
      // Auto-sync deletions
      for (const id of ordersToDelete) {
        autoSyncDelete('orders', id)
      }
    }

    if (!dedupedOrders || dedupedOrders.length === 0) {
      // All orders deleted or no orders to save
      return true
    }

    // Store directly in Dexie
    await db.orders.bulkPut(dedupedOrders)

    // Auto-sync: sync each order to cloud (debounced by syncEngine)
    for (const order of dedupedOrders) {
      autoSyncRecord('orders', order)
    }

    return true
  } catch (error) {
    console.error('Error saving orders:', error)
    return false
  }
}

export const deleteOrder = async (orderId) => {
  try {
    await db.orders.delete(orderId)
    // Auto-sync deletion
    autoSyncDelete('orders', orderId)
    return true
  } catch (error) {
    console.error('Error deleting order:', error)
    return false
  }
}



// ===== EXPENSES =====

export const getExpenses = async () => {
  try {
    const data = await db.expenses.orderBy('date').reverse().toArray()

    // Data stored in Dexie should already be in camelCase, so no transformation needed.
    console.log(`storage: getExpenses - Fetched ${data?.length} rows.`)
    return data || []
  } catch (error) {
    console.error('Error reading expenses:', error)
    return []
  }
}

export const saveExpenses = async (expenses) => {
  try {
    // Get all existing expense IDs from Dexie
    const existingExpenseIds = new Set(await db.expenses.toCollection().primaryKeys())
    const newExpenseIds = new Set((expenses || []).map(e => e.id))

    // Find expenses to delete (exist in DB but not in new array)
    const expensesToDelete = Array.from(existingExpenseIds).filter(id => !newExpenseIds.has(id))

    // Delete expenses that are no longer in the array
    if (expensesToDelete.length > 0) {
      await db.expenses.bulkDelete(expensesToDelete)
      // Auto-sync deletions
      for (const id of expensesToDelete) {
        autoSyncDelete('expenses', id)
      }
    }

    if (!expenses || expenses.length === 0) {
      // All expenses deleted or no expenses to save
      return true
    }

    // Store directly in Dexie
    await db.expenses.bulkPut(expenses)

    // Auto-sync each expense
    for (const expense of expenses) {
      autoSyncRecord('expenses', expense)
    }

    return true
  } catch (error) {
    console.error('Error saving expenses:', error)
    return false
  }
}

export const deleteExpense = async (expenseId) => {
  try {
    await db.expenses.delete(expenseId)
    // Auto-sync deletion
    autoSyncDelete('expenses', expenseId)
    return true
  } catch (error) {
    console.error('Error deleting expense:', error)
    return false
  }
}

// ===== SETTINGS =====


export const getSettings = async () => {
  const defaultWhatsappTemplate = `Order No: {{order_id}}
Tracking number: {{tracking_number}}

අද දින ඔබගේ ඇනවුම කුරියර් එකට බාරදෙන අතර ඔවුන් වැඩ කරන දින 4ක් ඇතුලත ඔබගේ ඇනවුම ඔබට ලබා දීමට කටයුතු කරන බැවින් හෙට දිනයේ සිට එම කුරියර් සේවාව මගින් ඔබට ඇමතුම් ලැබුනහොත් එවාට ප්‍රතිචාර දක්වන මෙන් ඉල්ලා සිටිමු. යම්කිසි හේතුවක් නිසා ප්‍රතිචාර දැක්වීමට නොහැකි වුවහොත් එම දුරකතන අංකයට ඔබ විසින් ඇමතුමක් ලබාගෙන ඔවුන් හා සම්බන්ද වී ඔබගේ ඇනවුම ගෙන්වාගන්න. නැවත ඔවුන්ම ඇමතුමක් ලබා ගන්නා තෙක් රැදි නොසිටින්න. මෙමගින් ඔබගේ ඇනවුම ප්‍රමාදවලින් තොරව ලබා ගත හැකිවේ. 

{{item_details}}

🚚 ඩිලිවරි ගාස්තු - {{delivery_charge}} 

මුලු මුදල - Rs. {{cod_amount}}

ඔබ සදහන් කල ලිපිනය:- 
🔸NAME: {{customer_name}}
🔸ADDRESS: {{address}}
🔸PHONE NUMBER: {{phone}}
🔸WHATSAPP NUMBER: {{whatsapp}}
🔸NEAREST CITY: {{city}}
🔸DISTRICT: {{district}}

මෙහියම්කිසි ගැටලුවක් ඇතිනම් විමසීමට කාරුණික වන්න.`

  const defaultSettings = {
    businessName: 'AllSet',
    businessTagline: 'From Chaos to Clarity',
    businessLogo: null,
    orderNumberConfig: {
      enabled: false,
      startingNumber: 1000,
      configured: false
    },
    whatsappTemplates: {
      viewOrder: defaultWhatsappTemplate,
      quickAction: defaultWhatsappTemplate
    }
  }

  try {
    const data = await db.settings.get('settings')

    if (data && data.data) {
      // Merge defaults for missing keys
      let merged = { ...defaultSettings, ...data.data }

      // Handle blank values specifically (ensure defaults if empty string)
      if (!merged.businessName || merged.businessName.trim() === '') {
        merged.businessName = defaultSettings.businessName
      }
      if (!merged.businessTagline || merged.businessTagline.trim() === '') {
        merged.businessTagline = defaultSettings.businessTagline
      }

      if (!data.data.whatsappTemplates) {
        merged.whatsappTemplates = defaultSettings.whatsappTemplates
      }
      return merged
    }

    // Save default settings if none exist
    await saveSettings(defaultSettings)
    return defaultSettings
  } catch (error) {
    console.error('Error reading settings:', error)
    return {
      orderNumberConfig: {
        enabled: false,
        startingNumber: 1000,
        configured: false
      },
      whatsappTemplates: {
        viewOrder: '',
        quickAction: ''
      }
    }
  }
}

export const saveSettings = async (settings) => {
  try {
    const s = { ...settings } // ensure plain obj
    const record = {
      id: 'settings',
      data: s,
      updatedAt: new Date().toISOString()
    }
    await db.settings.put(record)
    autoSyncRecord('settings', record)
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// ===== ORDER COUNTER =====

export const getOrderCounter = async () => {
  try {
    const data = await db.orderCounter.get('counter')
    return data?.value ?? null
  } catch (error) {
    console.error('Error reading order counter:', error)
    return null
  }
}

export const saveOrderCounter = async (counter) => {
  try {
    const record = {
      id: 'counter',
      value: counter,
      updatedAt: new Date().toISOString()
    }
    await db.orderCounter.put(record)
    autoSyncRecord('orderCounter', record)
    return true
  } catch (error) {
    console.error('Error saving order counter:', error)
    return false
  }
}


// ===== INVENTORY =====

export const getInventory = async () => {
  try {
    const data = await db.inventory.orderBy('itemName').toArray()

    // Data stored in Dexie should already be in camelCase, so no transformation needed.
    console.log(`storage: getInventory - Fetched ${data?.length} rows.`)
    return data || []
  } catch (error) {
    console.error('Error reading inventory:', error)
    return []
  }
}

export const saveInventory = async (inventory) => {
  try {
    // Get all existing inventory item IDs from Dexie
    const existingIds = new Set(await db.inventory.toCollection().primaryKeys())
    const newIds = new Set((inventory || []).map(item => item.id))

    // Find items to delete (exist in DB but not in new array)
    const itemsToDelete = Array.from(existingIds).filter(id => !newIds.has(id))

    // Delete items that are no longer in the array
    if (itemsToDelete.length > 0) {
      await db.inventory.bulkDelete(itemsToDelete)
    }

    if (!inventory || inventory.length === 0) {
      return true
    }

    // Store directly in Dexie. No need for Supabase-specific transformations.
    await db.inventory.bulkPut(inventory)

    // Auto-sync
    for (const item of inventory) {
      autoSyncRecord('inventory', item)
    }
    return true
  } catch (error) {
    console.error('Error saving inventory:', error)
    return false
  }
}

export const deleteInventoryItem = async (itemId) => {
  try {
    await db.inventory.delete(itemId)
    autoSyncDelete('inventory', itemId)
    return true
  } catch (error) {
    console.error('Error deleting inventory item:', error)
    return false
  }
}

export const getInventoryCategories = async () => {
  try {
    const data = await db.products.get('inventory_categories')

    if (data && data.data && data.data.categories) {
      return data.data
    }

    const defaultInventoryCategories = { categories: [] }
    await saveInventoryCategories(defaultInventoryCategories)
    return defaultInventoryCategories
  } catch (error) {
    console.error('Error reading inventory categories:', error)
    return { categories: [] }
  }
}

export const saveInventoryCategories = async (inventoryCategories) => {
  try {
    const record = {
      id: 'inventory_categories',
      data: inventoryCategories,
      updatedAt: new Date().toISOString()
    }
    await db.products.put(record)
    autoSyncRecord('products', record)
    return true
  } catch (error) {
    console.error('Error saving inventory categories:', error)
    return false
  }
}

// ===== EXPENSE CATEGORIES =====

export const getExpenseCategories = async () => {
  try {
    const data = await db.products.get('expense_categories')

    if (data && data.data && data.data.categories) {
      // Backward compatible normalization: ensure each category has an `items` array
      return {
        categories: (data.data.categories || []).map(cat => ({
          ...cat,
          items: Array.isArray(cat.items) ? cat.items : []
        }))
      }
    }

    // Return default structure
    const defaultExpenseCategories = { categories: [] }
    await saveExpenseCategories(defaultExpenseCategories)
    return defaultExpenseCategories
  } catch (error) {
    console.error('Error reading expense categories:', error)
    return { categories: [] }
  }
}

export const saveExpenseCategories = async (expenseCategories) => {
  try {
    const record = {
      id: 'expense_categories',
      data: expenseCategories,
      updatedAt: new Date().toISOString()
    }
    await db.products.put(record)
    autoSyncRecord('products', record)
    return true
  } catch (error) {
    console.error('Error saving expense categories:', error)
    return false
  }
}

// ===== ORDER SOURCES =====

export const getOrderSources = async () => {
  try {
    const data = await db.orderSources.orderBy('name').toArray()
    return (data || []).map(s => ({
      id: s.id,
      name: s.name
    }))
  } catch (error) {
    console.warn('Error reading order sources:', error)
    return []
  }
}

export const saveOrderSources = async (sources) => {
  try {
    if (!sources || sources.length === 0) {
      // Clear all order sources if an empty array is passed
      const existing = await db.orderSources.toCollection().primaryKeys()
      await db.orderSources.clear()
      for (const id of existing) {
        autoSyncDelete('orderSources', id)
      }
      return true
    }

    // Delete removed ones (keeps DB exactly in sync with Settings list)
    const existing = await db.orderSources.toCollection().primaryKeys()
    const existingIds = new Set(existing)
    const newIds = new Set((sources || []).map(r => r.id))
    const toDelete = Array.from(existingIds).filter(id => !newIds.has(id))
    if (toDelete.length) {
      await db.orderSources.bulkDelete(toDelete)
    }

    const dbRows = sources.map(s => ({
      id: s.id,
      name: s.name,
      updatedAt: new Date().toISOString()
    }))

    await db.orderSources.bulkPut(dbRows)

    // Auto-sync
    for (const row of dbRows) {
      autoSyncRecord('orderSources', row)
    }
    return true
  } catch (error) {
    console.error('Error saving order sources:', error)
    return false
  }
}

// Update all orders that reference an old source name to a new source name (best effort).
export const renameOrderSourceInOrders = async (oldName, newName) => {
  try {
    if (!oldName || !newName || oldName === newName) return true
    const ordersToUpdate = await db.orders.where('orderSource').equals(oldName).toArray()
    const updatedOrders = ordersToUpdate.map(order => ({ ...order, orderSource: newName }))
    await db.orders.bulkPut(updatedOrders)
    return true
  } catch (e) {
    console.warn('Error updating orderSource in orders:', e)
    return false
  }
}

// ===== TRACKING NUMBERS =====

export const getTrackingNumbers = async () => {
  try {
    const data = await db.trackingNumbers.orderBy('number').toArray()

    // Data stored in Dexie should already be in camelCase, so no transformation needed.
    return data || []
  } catch (error) {
    console.error('Error reading tracking numbers:', error)
    return []
  }
}

export const saveTrackingNumbers = async (trackingNumbers) => {
  try {
    // Get all existing tracking numbers to sync (delete removed ones)
    const existingIds = new Set(await db.trackingNumbers.toCollection().primaryKeys())
    const newIds = new Set((trackingNumbers || []).map(tn => tn.id || tn.number))

    // Find tracking numbers to delete
    const idsToDelete = Array.from(existingIds).filter(id => !newIds.has(id))

    if (idsToDelete.length > 0) {
      await db.trackingNumbers.bulkDelete(idsToDelete)
    }

    if (!trackingNumbers || trackingNumbers.length === 0) {
      return true
    }

    // Ensure IDs are present and store directly in Dexie
    const dbFormat = trackingNumbers.map(tn => ({
      id: tn.id || tn.number, // Ensure an ID exists for Dexie
      number: tn.number,
      status: tn.status || 'available',
      assignedTo: tn.assignedTo || null,
      updatedAt: new Date().toISOString()
    }))

    await db.trackingNumbers.bulkPut(dbFormat)

    // Auto-sync
    for (const tn of dbFormat) {
      autoSyncRecord('trackingNumbers', tn)
    }
    return true
  } catch (error) {
    console.error('Error saving tracking numbers:', error)
    return false
  }
}

// ===== PRODUCTS =====

export const getProducts = async () => {
  try {
    const data = await db.products.get('products')

    if (data && data.data && data.data.categories) {
      return data.data
    }

    const emptyProducts = { categories: [] }
    return emptyProducts
  } catch (error) {
    console.error('Error reading products:', error)
    return { categories: [] }
  }
}

export const saveProducts = async (products) => {
  try {
    const record = {
      id: 'products',
      data: products,
      updatedAt: new Date().toISOString()
    }
    await db.products.put(record)
    autoSyncRecord('products', record)
    return true
  } catch (error) {
    console.error('Error saving products:', error)
    return false
  }
}


// ===== UTILITY FUNCTIONS =====

// Generate tracking numbers from range
export const generateTrackingNumbersFromRange = (start, end) => {
  const numbers = []
  const startMatch = start.match(/^([A-Z]+)(\d+)$/)
  const endMatch = end.match(/^([A-Z]+)(\d+)$/)

  if (!startMatch || !endMatch) return numbers

  const prefix = startMatch[1]
  const endPrefix = endMatch[1]

  if (prefix !== endPrefix) return numbers

  const startNum = parseInt(startMatch[2], 10)
  const endNum = parseInt(endMatch[2], 10)

  if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) return numbers

  for (let i = startNum; i <= endNum; i++) {
    const numStr = i.toString().padStart(startMatch[2].length, '0')
    numbers.push({
      id: `${prefix}${numStr}`,
      number: `${prefix}${numStr}`,
      status: 'available',
      assignedTo: null
    })
  }

  return numbers
}

// Get available tracking numbers
export const getAvailableTrackingNumbers = async (trackingNumbers = [], orders = []) => {
  const usedNumbers = new Set(orders
    .filter(order => order.trackingNumber)
    .map(order => order.trackingNumber)
  )

  return trackingNumbers
    .filter(tn => tn.status === 'available' && !usedNumbers.has(tn.number))
    .map(tn => tn.number)
}

// Mark tracking number as used
export const markTrackingNumberAsUsed = async (trackingNumber, trackingNumbers = []) => {
  try {
    // Update in Dexie
    const tnToUpdate = await db.trackingNumbers.get(trackingNumber)
    if (tnToUpdate) {
      const updated = {
        ...tnToUpdate,
        status: 'used',
        updatedAt: new Date().toISOString()
      }
      await db.trackingNumbers.put(updated)
      autoSyncRecord('trackingNumbers', updated)
    }

    // Return updated local array
    return trackingNumbers.map(tn =>
      tn.number === trackingNumber
        ? { ...tn, status: 'used' }
        : tn
    )
  } catch (error) {
    console.error('Error marking tracking number as used:', error)
    return trackingNumbers
  }
}

// Calculate next order number based on last saved order (for preview/editing)
// Always uses sequential numbering - finds max order number and adds 1
export const calculateNextOrderNumber = (orders = []) => {
  if (!orders || orders.length === 0) {
    // No orders exist, start at 1
    return '1'
  }

  // Find all numeric order IDs
  const numericOrderIds = orders
    .map(order => {
      const id = parseInt(order.id, 10)
      return isNaN(id) ? null : id
    })
    .filter(id => id !== null && id > 0)

  if (numericOrderIds.length > 0) {
    // Find the maximum order number and add 1
    const maxOrderNumber = Math.max(...numericOrderIds)
    return (maxOrderNumber + 1).toString()
  } else {
    // No numeric IDs found, start at 1
    return '1'
  }
}



// ===== FILE EXPORT/IMPORT FUNCTIONS =====

// Export all data to a JSON file
export const exportAllData = async (orders, expenses, products, settings, trackingNumbers, orderCounter, inventory, includeSettings = true) => {
  try {
    // Fetch additional data from database
    const [orderSources, quotations, expenseCategories, inventoryCategories, inventoryLogs] = await Promise.all([
      getOrderSources(),
      getQuotations(),
      getExpenseCategories(),
      getInventoryCategories(),
      getInventoryLogs(null) // Fetch ALL logs for backup
    ])

    const data = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      orders: orders || [],
      expenses: expenses || [],
      inventory: inventory || [],
      products: products || { categories: [] },
      trackingNumbers: trackingNumbers || [],
      orderCounter: orderCounter || null,
      orderSources: orderSources || [],
      quotations: quotations || [],
      expenseCategories: expenseCategories || [],
      quotations: quotations || [],
      expenseCategories: expenseCategories || [],
      inventoryCategories: inventoryCategories || [],
      inventoryLogs: inventoryLogs || []
    }

    // Only include settings if requested
    if (includeSettings) {
      data.settings = settings || {}
    }

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `allset-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return { success: true, message: 'Data exported successfully!' }
  } catch (error) {
    console.error('Error exporting data:', error)
    return { success: false, message: 'Failed to export data: ' + error.message }
  }
}

// Import data from a JSON object
export const importAllDataFromObject = async (data, includeSettings = true) => {
  try {
    // Validate data structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format')
    }

    // Import data to Dexie
    if (data.orders) await saveOrders(data.orders)
    if (data.expenses) await saveExpenses(data.expenses)
    if (data.inventory) await saveInventory(data.inventory)
    if (data.products) await saveProducts(data.products)
    if (data.trackingNumbers) await saveTrackingNumbers(data.trackingNumbers)
    if (data.orderCounter !== undefined) await saveOrderCounter(data.orderCounter)
    if (data.orderSources) await saveOrderSources(data.orderSources)
    if (data.quotations) await saveQuotations(data.quotations)
    if (data.expenseCategories) await saveExpenseCategories(data.expenseCategories)
    if (data.inventoryCategories) await saveInventoryCategories(data.inventoryCategories)
    if (data.inventoryLogs) await saveInventoryLogs(data.inventoryLogs)
    if (data.inventoryCategories) await saveInventoryCategories(data.inventoryCategories)

    // Only import settings if requested
    if (includeSettings && data.settings) {
      await saveSettings(data.settings)
    }

    return {
      success: true,
      message: 'Data imported successfully!',
      data: {
        orders: data.orders || [],
        expenses: data.expenses || [],
        inventory: data.inventory || [],
        products: data.products || { categories: [] },
        settings: includeSettings ? (data.settings || {}) : {},
        trackingNumbers: data.trackingNumbers || [],
        orderCounter: data.orderCounter || null,
        orderSources: data.orderSources || [],
        quotations: data.quotations || [],
        expenseCategories: data.expenseCategories || [],
        inventoryCategories: data.inventoryCategories || []
      }
    }
  } catch (error) {
    console.error('Error importing data:', error)
    return { success: false, message: 'Failed to import data: ' + error.message }
  }
}

// Import data from a JSON file
export const importAllData = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result)
        const result = await importAllDataFromObject(data)
        if (result.success) {
          resolve(result)
        } else {
          reject(result)
        }
      } catch (error) {
        console.error('Error importing data:', error)
        reject({ success: false, message: 'Failed to import data: ' + error.message })
      }
    }

    reader.onerror = () => {
      reject({ success: false, message: 'Failed to read file' })
    }

    reader.readAsText(file)
  })
}

// Clear all data
export const clearAllData = async () => {
  try {
    // Attempt to wipe cloud data first if configured
    try {
      const { getSyncUserId } = await import('./supabaseClient')
      const { wipeCloudData } = await import('./syncEngine')

      const syncId = await getSyncUserId()
      if (syncId) {
        console.log('Clearing all data from cloud for sync ID:', syncId)
        await wipeCloudData(syncId)
      }
    } catch (cloudError) {
      console.error('Failed to wipe cloud data (continuing with local clear):', cloudError)
    }

    // Clear all data from Dexie stores
    await Promise.all([
      db.orders.clear(),
      db.inventory.clear(),
      db.expenses.clear(),
      db.orderSources.clear(),
      db.trackingNumbers.clear(),
      db.orderCounter.clear(),
      db.products.clear(), // This table holds products, inventory categories, and expense categories
      db.settings.clear(),
      db.quotations.clear(),
      db.inventoryLogs.clear(),
      db.syncQueue.clear() // Clear sync queue for a fresh start
    ])

    return { success: true, message: 'All data cleared successfully (Local & Cloud)!' }
  } catch (error) {
    console.error('Error clearing data:', error)
    return { success: false, message: 'Failed to clear data: ' + error.message }
  }
}

// ===== INVENTORY LOGS =====

export const getInventoryLogs = async (limit = 100) => {
  try {
    let query = db.inventoryLogs.orderBy('date').reverse()

    // Only apply limit if it is provided (not null/undefined/0/false)
    if (limit) {
      query = query.limit(limit)
    }

    const data = await query.toArray()

    // Data stored in Dexie should already be in camelCase, so no transformation needed.
    return data || []
  } catch (error) {
    console.error('Error reading inventory logs:', error)
    return []
  }
}


export const addInventoryLog = async (logData) => {
  try {
    const dbLog = {
      id: logData.id || Date.now().toString(), // Ensure an ID for Dexie
      inventoryItemId: logData.inventoryItemId,
      itemName: logData.itemName,
      category: logData.category,
      transactionType: logData.transactionType,
      quantityChange: parseFloat(logData.quantityChange || 0),
      balanceAfter: parseFloat(logData.balanceAfter || 0),
      date: logData.date || new Date().toISOString(),
      notes: logData.notes || ''
    }

    const record = {
      ...dbLog,
      updatedAt: dbLog.date
    }
    await db.inventoryLogs.add(record)
    autoSyncRecord('inventoryLogs', record)
    return true
  } catch (error) {
    console.error('Error adding inventory log:', error)
    return false
  }
}

export const deleteInventoryLog = async (logId) => {
  try {
    await db.inventoryLogs.delete(logId)
    autoSyncDelete('inventoryLogs', logId)
    return true
  } catch (error) {
    console.error('Error deleting inventory log:', error)
    return false
  }
}

export const clearInventoryLogs = async () => {
  try {
    const logs = await db.inventoryLogs.toArray()
    await db.inventoryLogs.clear()

    // Sync deletions to cloud
    for (const log of logs) {
      autoSyncDelete('inventoryLogs', log.id)
    }
    return true
  } catch (error) {
    console.error('Error clearing inventory logs:', error)
    return false
  }
}


export const saveInventoryLogs = async (logs) => {
  try {
    // Bulk put to Dexie
    const records = logs.map(log => ({
      ...log,
      updatedAt: log.date || new Date().toISOString()
    }))

    await db.inventoryLogs.bulkPut(records)

    // Trigger auto-sync for each
    records.forEach(record => {
      autoSyncRecord('inventoryLogs', record)
    })

    return true
  } catch (error) {
    console.error('Error saving inventory logs:', error)
    return false
  }
}

// ===== QUOTATIONS =====

export const getQuotations = async () => {
  try {
    const data = await db.quotations.orderBy('createdDate').reverse().toArray()
    console.log(`storage: getQuotations - Fetched ${data?.length} rows.`)
    return data || []
  } catch (error) {
    console.error('Error reading quotations:', error)
    return []
  }
}

export const saveQuotations = async (quotations) => {
  try {
    // Get all existing quotation IDs from Dexie
    const existingIds = new Set(await db.quotations.toCollection().primaryKeys())
    const newIds = new Set((quotations || []).map(q => q.id))

    // Find quotations to delete (exist in DB but not in new array)
    const quotationsToDelete = Array.from(existingIds).filter(id => !newIds.has(id))

    // Delete quotations that are no longer in the array
    if (quotationsToDelete.length > 0) {
      await db.quotations.bulkDelete(quotationsToDelete)
      // Auto-sync deletions
      for (const id of quotationsToDelete) {
        autoSyncDelete('quotations', id)
      }
    }

    if (!quotations || quotations.length === 0) {
      return true
    }

    // Store directly in Dexie
    await db.quotations.bulkPut(quotations)

    // Auto-sync
    for (const q of quotations) {
      autoSyncRecord('quotations', q)
    }
    return true
  } catch (error) {
    console.error('Error saving quotations:', error)
    return false
  }
}

export const deleteQuotation = async (id) => {
  try {
    await db.quotations.delete(id)
    autoSyncDelete('quotations', id)
    return true
  } catch (error) {
    console.error('Error deleting quotation:', error)
    return false
  }
}

export const calculateNextQuotationNumber = (quotations = []) => {
  if (!quotations || quotations.length === 0) {
    return '1000'
  }

  const numericIds = quotations
    .map(q => {
      const id = parseInt(q.id, 10)
      return isNaN(id) ? null : id
    })
    .filter(id => id !== null && id > 0)

  if (numericIds.length > 0) {
    const maxId = Math.max(...numericIds)
    return (maxId + 1).toString()
  } else {
    return '1000'
  }
}

// ===== RECORD USAGE TRACKING =====

/**
 * Counts total orders and quotations created in the current month.
 * @param {string} excludeRecordId - Optional, used when editing to avoid counting the current record
 * @returns {Promise<number>}
 */
export const getTotalMonthlyRecordsCount = async (excludeRecordId = null) => {
  try {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    // 1. Count Orders
    const orders = await getOrders()
    const monthlyOrders = orders.filter(order =>
      order.createdDate >= firstDay && order.id !== excludeRecordId
    ).length

    // 2. Count Quotations
    const quotations = await getQuotations()
    const monthlyQuotations = quotations.filter(q =>
      q.createdDate >= firstDay && q.id !== excludeRecordId
    ).length

    return monthlyOrders + monthlyQuotations
  } catch (error) {
    console.error('Error calculating monthly records count:', error)
    return 0
  }
}

