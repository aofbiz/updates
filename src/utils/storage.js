// Supabase storage with data transformation
// Data is stored in Supabase cloud database, accessible from any browser/device

import { supabase } from './supabase'

// Bump version to invalidate any previous cached compat modes that might be too strict.
const ORDERS_SCHEMA_CACHE_KEY = 'aof_orders_schema_missing_cols_v3'
const ORDER_SOURCES_WARNED_KEY = 'aof_warned_missing_order_sources_v1'
// Debug/verification helper: confirm multi-item orders really persisted
const ORDERS_MULTIITEM_VERIFY_KEY = 'aof_orders_multiitem_verify_v1'

// Helper function to handle Supabase errors
const handleSupabaseError = (error, operation) => {
  console.error(`Error ${operation}:`, error)
  return null
}

// ===== DATA TRANSFORMATION FUNCTIONS =====

// Transform order from frontend format (camelCase) to database format (snake_case)
const transformOrderToDB = (order) => {
  const firstItem = Array.isArray(order.orderItems) && order.orderItems.length > 0 ? order.orderItems[0] : null
  return {
    id: order.id,
    customer_name: order.customerName || '',
    address: order.address || null,
    customer_phone: order.phone || null,
    customer_whatsapp: order.whatsapp || null,
    customer_email: order.email || null,
    nearest_city: order.nearestCity || null,
    district: order.district || null,
    // Legacy single-item fields (derived from first order item when present)
    category_id: order.categoryId || firstItem?.categoryId || null,
    item_id: order.itemId || firstItem?.itemId || null,
    custom_item_name: order.customItemName || firstItem?.customItemName || null,
    quantity: order.quantity || firstItem?.quantity || 1,
    unit_price: parseFloat(order.unitPrice || firstItem?.unitPrice || order.totalAmount || 0),
    discount_type: order.discountType || null,
    discount_value: parseFloat(order.discountValue || order.discount || 0),
    total_amount: parseFloat(order.totalAmount || order.totalPrice || 0),
    cod_amount: parseFloat(order.codAmount || 0),
    advance_payment: parseFloat(order.advancePayment || 0),
    delivery_charge: parseFloat(order.deliveryCharge ?? 400),
    order_items: Array.isArray(order.orderItems)
      ? order.orderItems.map(it => ({
        categoryId: it.categoryId || null,
        itemId: it.itemId || null,
        customItemName: it.customItemName || null,
        name: it.name || it.itemName || it.customItemName || null,
        quantity: it.quantity ?? 0,
        unitPrice: it.unitPrice ?? 0,
        notes: it.notes || '',
        image: it.image || null
      }))
      : [],
    delivery_date: order.deliveryDate || null,
    status: order.status || 'Pending',
    payment_status: order.paymentStatus || 'Pending',
    tracking_number: order.trackingNumber || null,
    notes: order.notes || null,
    created_date: order.createdDate || new Date().toISOString().split('T')[0],
    order_date: order.orderDate || null,
    dispatch_date: order.dispatchDate || null,
    order_source: order.orderSource || 'Ad'
  }
}

// Transform order from database format (snake_case) to frontend format (camelCase)
const transformOrderFromDB = (order) => {
  const normalizedOrderItemsRaw = (() => {
    const raw = order.order_items
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    // Some DB/clients can return jsonb as object; treat non-array as empty
    return []
  })()

  const orderItems = normalizedOrderItemsRaw.length > 0
    ? normalizedOrderItemsRaw.map(it => ({
      categoryId: it.categoryId || null,
      itemId: it.itemId || null,
      customItemName: it.customItemName || null,
      name: it.name || it.itemName || it.customItemName || null,
      quantity: it.quantity ?? 0,
      unitPrice: it.unitPrice ?? 0,
      notes: it.notes || '',
      image: it.image || null
    }))
    : [{
      categoryId: order.category_id || null,
      itemId: order.item_id || null,
      customItemName: order.custom_item_name || null,
      name: order.custom_item_name || null,
      quantity: order.quantity || 1,
      unitPrice: order.unit_price || 0,
      notes: ''
    }]

  return {
    id: order.id,
    customerName: order.customer_name || '',
    address: order.address || '',
    phone: order.customer_phone || '',
    whatsapp: order.customer_whatsapp || order.customer_phone || '',
    email: order.customer_email || '',
    nearestCity: order.nearest_city || '',
    district: order.district || '',
    categoryId: order.category_id || null,
    itemId: order.item_id || null,
    customItemName: order.custom_item_name || null,
    quantity: order.quantity || 1,
    unitPrice: order.unit_price || 0,
    deliveryCharge: order.delivery_charge ?? 400,
    deliveryDate: order.delivery_date || null,
    orderItems,
    discountType: order.discount_type || null,
    discountValue: order.discount_value || 0,
    discount: order.discount_value || 0, // Alias for compatibility
    totalAmount: order.total_amount || 0,
    totalPrice: order.total_amount || 0, // Alias for compatibility
    codAmount: order.cod_amount || 0,
    status: order.status || 'Pending',
    paymentStatus: order.payment_status || 'Pending',
    trackingNumber: order.tracking_number || null,
    notes: order.notes || null,
    createdDate: order.created_date || new Date().toISOString().split('T')[0],
    orderDate: order.order_date || null,
    dispatchDate: order.dispatch_date || null,
    orderSource: order.order_source || 'Ad',
    advancePayment: order.advance_payment || 0
  }
}


// ===== ORDERS =====

export const getOrders = async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_date', { ascending: false })

    if (error) {
      console.error('Error fetching orders:', error)
      return []
    }

    // Transform from database format to frontend format
    return (data || []).map(transformOrderFromDB)
  } catch (error) {
    console.error('Error reading orders:', error)
    return []
  }
}

export const saveOrders = async (orders) => {
  try {
    // De-duplicate by id to avoid Postgres upsert error:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" (code 21000)
    // Keep the last occurrence for each id.
    const dedupedOrders = (() => {
      const map = new Map()
        ; (orders || []).forEach(o => {
          if (!o?.id) return
          map.set(o.id, o)
        })
      return Array.from(map.values())
    })()
    const multiItemOrderFromUI = dedupedOrders.find(o => Array.isArray(o.orderItems) && o.orderItems.length > 1)

    // Get all existing orders from database
    const { data: existingOrders, error: fetchError } = await supabase
      .from('orders')
      .select('id')

    if (fetchError) {
      console.error('Error fetching existing orders:', fetchError)
      return false
    }

    const existingOrderIds = new Set((existingOrders || []).map(o => o.id))
    const newOrderIds = new Set((dedupedOrders || []).map(o => o.id))

    // Find orders to delete (exist in DB but not in new array)
    const ordersToDelete = Array.from(existingOrderIds).filter(id => !newOrderIds.has(id))

    // Delete orders that are no longer in the array
    if (ordersToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .in('id', ordersToDelete)

      if (deleteError) {
        console.error('Error deleting orders:', deleteError)
        return false
      }
    }

    if (!dedupedOrders || dedupedOrders.length === 0) {
      // All orders deleted
      return true
    }

    // Transform orders to database format
    const dbOrders = dedupedOrders.map(transformOrderToDB)

    const stripFields = (row, fieldsToStrip) => {
      const copy = { ...row }
      for (const f of fieldsToStrip) delete copy[f]
      return copy
    }

    // Compat levels:
    // - datesOnly: remove date fields (most common mismatch)
    // - datesNoItems: remove date fields + multi-item fields (older schema)
    // - datesSource: remove date fields + order_source
    // - datesSourceNoItems: remove date fields + order_source + multi-item fields
    const compatModes = {
      datesOnly: ['order_date', 'dispatch_date', 'delivery_date', 'advance_payment'],
      datesNoItems: ['order_date', 'dispatch_date', 'delivery_date', 'order_items', 'delivery_charge', 'advance_payment'],
      datesSource: ['order_date', 'dispatch_date', 'delivery_date', 'order_source', 'advance_payment'],
      datesSourceNoItems: ['order_date', 'dispatch_date', 'delivery_date', 'order_source', 'order_items', 'delivery_charge', 'advance_payment']
    }

    const getCachedSchemaMode = () => {
      try {
        const raw = localStorage.getItem(ORDERS_SCHEMA_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (parsed?.mode && compatModes[parsed.mode]) return parsed.mode
        return null
      } catch {
        return null
      }
    }

    const cacheSchemaMode = (mode) => {
      try {
        localStorage.setItem(ORDERS_SCHEMA_CACHE_KEY, JSON.stringify({ mode, at: Date.now() }))
      } catch {
        // ignore
      }
    }

    const shouldAlertSchema = () => {
      // Avoid spamming the same schema alert on every save
      try {
        const raw = localStorage.getItem(ORDERS_SCHEMA_CACHE_KEY)
        if (!raw) return true
        const parsed = JSON.parse(raw)
        // If we already cached a missing schema mode, don't keep alerting each save
        return !parsed?.mode
      } catch {
        return true
      }
    }

    // Use upsert to insert or update remaining orders
    const tryUpsert = async (rows) => {
      return await supabase.from('orders').upsert(rows, { onConflict: 'id' })
    }

    const verifyMultiItemsPersisted = async (savedOrderId) => {
      if (!savedOrderId) return
      try {
        const { data, error: verifyError } = await supabase
          .from('orders')
          .select('id, order_items, delivery_charge')
          .eq('id', savedOrderId)
          .single()
        if (verifyError) {
          console.warn('Multi-item verify failed (could not read saved order):', verifyError)
          return
        }
        const items = data?.order_items
        const ok = Array.isArray(items) && items.length > 1
        if (!ok) {
          console.warn(
            `Order #${savedOrderId} saved, but multiple items were NOT stored in Supabase.\n\n` +
            `Stored items count: ${Array.isArray(items) ? items.length : 0}\n\n` +
            'This means the save request is still falling back and stripping order_items.\n\n' +
            'Fix steps:\n' +
            '1) Supabase Dashboard → Settings → API → Reload schema cache\n' +
            '2) Hard refresh the app (Ctrl+F5)\n' +
            '3) Create a NEW multi-item order and re-check.\n\n' +
            'If it still happens, we need to inspect the exact payload being saved.'
          )
        }
      } catch (e) {
        console.warn('Multi-item verify failed (unexpected):', e)
      }
    }

    const clearCachedSchemaMode = () => {
      try { localStorage.removeItem(ORDERS_SCHEMA_CACHE_KEY) } catch { /* ignore */ }
    }

    // If we already know DB is missing newer columns, try to re-probe full payload
    // (users often migrate later; we should stop stripping fields once DB supports them).
    const cachedMode = getCachedSchemaMode()
    if (cachedMode) {
      const needsDates = Boolean(
        multiItemOrderFromUI?.deliveryDate ||
        multiItemOrderFromUI?.dispatchDate ||
        dedupedOrders.some(o => o?.deliveryDate || o?.dispatchDate)
      )

      const shouldProbeFull = needsDates || cachedMode !== 'datesOnly'
      if (shouldProbeFull) {
        const probeKey = `${ORDERS_SCHEMA_CACHE_KEY}__full_probe_done_v1`
        let alreadyProbed = false
        try { alreadyProbed = sessionStorage.getItem(probeKey) === '1' } catch { alreadyProbed = false }

        if (!alreadyProbed) {
          const { error: fullProbeErr } = await tryUpsert(dbOrders)
          try { sessionStorage.setItem(probeKey, '1') } catch { /* ignore */ }

          if (!fullProbeErr) {
            // DB accepts full payload now; stop stripping and clear cache.
            clearCachedSchemaMode()
            if (multiItemOrderFromUI) {
              await verifyMultiItemsPersisted(multiItemOrderFromUI.id)
            }
            return true
          }
          console.warn('Full payload probe failed; keeping cached compat mode:', fullProbeErr)
        }
      }

      // If cache says we must drop order_items, re-probe once per page load:
      // many users add DB columns later, but localStorage keeps the old strict mode.
      const cacheRequiresDroppingItems = cachedMode === 'datesNoItems' || cachedMode === 'datesSourceNoItems'
      const hasMultiItemOrder = dbOrders.some(o => Array.isArray(o.order_items) && o.order_items.length > 0)

      if (cacheRequiresDroppingItems && hasMultiItemOrder && multiItemOrderFromUI) {
        // Always try a less-destructive mode (keep order_items) for multi-item orders.
        // If it succeeds, upgrade cache immediately.
        const probeMode = cachedMode === 'datesSourceNoItems' ? 'datesSource' : 'datesOnly'
        const probeRows = dbOrders.map(r => stripFields(r, compatModes[probeMode]))
        const { error: probeErr } = await tryUpsert(probeRows)
        if (!probeErr) {
          cacheSchemaMode(probeMode)
          await verifyMultiItemsPersisted(multiItemOrderFromUI.id)
          return true
        }
        console.warn('Schema probe (keep order_items) failed; using cached compat mode:', probeErr)
      }

      const compatRows = dbOrders.map(r => stripFields(r, compatModes[cachedMode]))
      const { error: compatErr } = await tryUpsert(compatRows)
      if (compatErr) {
        console.error('Error saving orders (cached compat mode):', compatErr)
        return false
      }
      if (multiItemOrderFromUI) {
        if (cacheRequiresDroppingItems) {
          console.warn(
            `Order #${multiItemOrderFromUI.id} saved, but your app had to drop multi-item fields to match the current DB schema.\n\n` +
            `Result: order_items will be saved as [] (so after refresh you will see only one item).\n\n` +
            `Fix: Supabase must accept order_items and delivery_charge in the upsert payload. If you already added the columns, reload schema cache and try again.`
          )
        } else {
          await verifyMultiItemsPersisted(multiItemOrderFromUI.id)
        }
      }
      return true
    }

    // 1) Try full payload (includes newer fields like order_date/dispatch_date/order_source)
    const { error } = await tryUpsert(dbOrders)

    if (error) {
      console.error('Error saving orders:', error)
      console.error('Orders data:', dbOrders)

      // Duplicate IDs in the upsert payload
      if (error.code === '21000' || error.message?.includes('cannot affect row a second time')) {
        console.warn(
          'Cannot save orders because there are duplicate Order Numbers (IDs) in your current data.\n\n' +
          'Fix: search Orders for the duplicated order number and change one of them to a unique number, then try again.'
        )
        return false
      }

      // 2) Retry by removing only date fields first (keeps order_items so multi-item orders persist)
      const dbOrdersWithoutDates = dbOrders.map(order => stripFields(order, compatModes.datesOnly))
      const { error: retryDatesError } = await tryUpsert(dbOrdersWithoutDates)

      if (!retryDatesError) {
        cacheSchemaMode('datesOnly')
        console.warn('Saved orders without order_date/dispatch_date. Please run migration SQL to add them.')
        if (shouldAlertSchema()) {
          console.warn(
            'Orders saved, but your database is missing some newer columns.\n\n' +
            'Please run this in Supabase SQL Editor:\n\n' +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;\n"
          )
        }
        if (multiItemOrderFromUI) {
          await verifyMultiItemsPersisted(multiItemOrderFromUI.id)
        }
        return true
      }

      console.error('Error saving orders (retry without date fields):', retryDatesError)

      // 3) Retry removing date fields + multi-item fields (for older schemas missing order_items/delivery_charge)
      const dbOrdersWithoutDatesAndItems = dbOrders.map(order => stripFields(order, compatModes.datesNoItems))
      const { error: retryItemsError } = await tryUpsert(dbOrdersWithoutDatesAndItems)

      if (!retryItemsError) {
        cacheSchemaMode('datesNoItems')
        console.warn('Saved orders without date/item fields. Please run migration SQL to add them.')
        if (shouldAlertSchema()) {
          console.warn(
            'Orders saved, but your database is missing some newer columns.\n\n' +
            'Please run this in Supabase SQL Editor:\n\n' +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_items JSONB NOT NULL DEFAULT '[]'::jsonb;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10,2) DEFAULT 400;\n"
          )
        }
        return true
      }

      console.error('Error saving orders (retry without date fields + item fields):', retryItemsError)

      // 4) Retry without date fields + order_source (older DBs may not have this either)
      const dbOrdersWithoutDatesAndSource = dbOrders.map(order => stripFields(order, compatModes.datesSource))
      const { error: retrySourceError } = await tryUpsert(dbOrdersWithoutDatesAndSource)

      if (!retrySourceError) {
        cacheSchemaMode('datesSource')
        console.warn('Saved orders without order_date/dispatch_date/order_source. Please run migration SQL to add them.')
        if (shouldAlertSchema()) {
          console.warn(
            'Orders saved, but your database is missing some newer columns.\n\n' +
            'Please run this in Supabase SQL Editor:\n\n' +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'Ad';\n"
          )
        }
        if (multiItemOrderFromUI) {
          await verifyMultiItemsPersisted(multiItemOrderFromUI.id)
        }
        return true
      }

      console.error('Error saving orders (retry without date fields + order_source):', retrySourceError)

      // 5) Retry without date fields + order_source + item fields
      const dbOrdersWithoutDatesSourceAndItems = dbOrders.map(order => stripFields(order, compatModes.datesSourceNoItems))
      const { error: retrySourceItemsError } = await tryUpsert(dbOrdersWithoutDatesSourceAndItems)

      if (!retrySourceItemsError) {
        cacheSchemaMode('datesSourceNoItems')
        console.warn('Saved orders without date/source/item fields. Please run migration SQL to add them.')
        if (shouldAlertSchema()) {
          console.warn(
            'Orders saved, but your database is missing some newer columns.\n\n' +
            'Please run this in Supabase SQL Editor:\n\n' +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'Ad';\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_items JSONB NOT NULL DEFAULT '[]'::jsonb;\n" +
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10,2) DEFAULT 400;\n"
          )
        }
        return true
      }

      console.error('Error saving orders (retry without date fields + order_source + item fields):', retrySourceItemsError)

      // If we still fail, surface a single actionable message
      console.warn(
        'Failed to save orders due to a database schema mismatch.\n\n' +
        'Please ensure these columns exist in Supabase:\n' +
        '- order_date (DATE)\n' +
        '- dispatch_date (DATE)\n' +
        '- delivery_date (DATE)\n' +
        "- order_source (TEXT DEFAULT 'Ad')\n\n" +
        'After running the migration, refresh the app and try again.'
      )
      return false
    }

    if (multiItemOrderFromUI) {
      await verifyMultiItemsPersisted(multiItemOrderFromUI.id)
    }
    return true
  } catch (error) {
    console.error('Error saving orders:', error)
    return false
  }
}


// ===== EXPENSES =====

export const getExpenses = async () => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching expenses:', error)
      return []
    }

    // Transform from database format to frontend format
    return (data || []).map(expense => ({
      id: expense.id,
      description: expense.description || expense.item || '',
      item: expense.item || expense.description || '',
      category: expense.category || '',
      quantity: expense.quantity || 0,
      unitCost: expense.unit_cost || 0,
      amount: expense.amount || expense.total || 0,
      inventoryItemId: expense.inventory_item_id || null,
      total: expense.total || expense.amount || 0,
      date: expense.date || new Date().toISOString().split('T')[0],
      payment_method: expense.payment_method || null,
      notes: expense.notes || null,
    }))
  } catch (error) {
    console.error('Error reading expenses:', error)
    return []
  }
}

export const saveExpenses = async (expenses) => {
  try {
    // Get all existing expenses from database
    const { data: existingExpenses, error: fetchError } = await supabase
      .from('expenses')
      .select('id')

    if (fetchError) {
      console.error('Error fetching existing expenses:', fetchError)
      return false
    }

    const existingExpenseIds = new Set((existingExpenses || []).map(e => e.id))
    const newExpenseIds = new Set((expenses || []).map(e => e.id))

    // Find expenses to delete (exist in DB but not in new array)
    const expensesToDelete = Array.from(existingExpenseIds).filter(id => !newExpenseIds.has(id))

    // Delete expenses that are no longer in the array
    if (expensesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .in('id', expensesToDelete)

      if (deleteError) {
        console.error('Error deleting expenses:', deleteError)
        return false
      }
    }

    if (!expenses || expenses.length === 0) {
      // All expenses deleted
      return true
    }

    // First, try to save with all new fields
    const dbExpenses = expenses.map(expense => ({
      id: expense.id,
      description: expense.description || expense.item || '',
      item: expense.item || expense.description || null,
      category: expense.category || null,
      quantity: expense.quantity ? parseFloat(expense.quantity) : null,
      unit_cost: expense.unitCost ? parseFloat(expense.unitCost) : null,
      amount: parseFloat(expense.amount || expense.total || 0),
      total: expense.total ? parseFloat(expense.total) : parseFloat(expense.amount || 0),
      date: expense.date || new Date().toISOString().split('T')[0],
      payment_method: expense.payment_method || null,
      notes: expense.notes || null,
      inventory_item_id: expense.inventoryItemId || null,
    }))

    let { error } = await supabase
      .from('expenses')
      .upsert(dbExpenses, { onConflict: 'id' })

    // If error is about missing columns, fall back to basic fields
    if (error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204' || error.details?.includes('column'))) {
      console.warn('New expense columns not found in database. Saving with basic fields only.')
      console.warn('Please run the migration SQL: update-expenses-schema.sql')

      // Save with only the basic fields that definitely exist
      const basicExpenses = expenses.map(expense => ({
        id: expense.id,
        description: expense.description || expense.item || '',
        category: expense.category || '',
        amount: parseFloat(expense.amount || expense.total || 0),
        date: expense.date || new Date().toISOString().split('T')[0]
      }))

      const { error: basicError } = await supabase
        .from('expenses')
        .upsert(basicExpenses, { onConflict: 'id' })

      if (basicError) {
        console.error('Error saving expenses (basic fields):', basicError)
        console.error('Expense data:', basicExpenses)
        return false
      }

      return true
    }

    if (error) {
      console.error('Error saving expenses:', error)
      console.error('Error details:', error.message, error.code, error.details)
      console.error('Expense data:', dbExpenses)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving expenses:', error)
    return false
  }
}

// ===== SETTINGS =====

export const getSettings = async () => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'settings')
      .single()

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

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching settings:', error)
      return defaultSettings
    }

    if (data && data.data) {
      // Merge defaults for missing keys
      const merged = { ...defaultSettings, ...data.data }
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
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 'settings',
        data: settings,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving settings:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// ===== ORDER COUNTER =====

export const getOrderCounter = async () => {
  try {
    const { data, error } = await supabase
      .from('order_counter')
      .select('value')
      .eq('id', 'counter')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching order counter:', error)
      return null
    }

    return data?.value ?? null
  } catch (error) {
    console.error('Error reading order counter:', error)
    return null
  }
}

export const saveOrderCounter = async (counter) => {
  try {
    const { error } = await supabase
      .from('order_counter')
      .upsert({
        id: 'counter',
        value: counter,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving order counter:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving order counter:', error)
    return false
  }
}


// ===== INVENTORY =====

// Transform inventory item from frontend format to database format
const transformInventoryToDB = (item) => {
  return {
    id: item.id,
    item_name: item.itemName || '',
    category: item.category || null,
    current_stock: parseFloat(item.currentStock || 0),
    reorder_level: parseFloat(item.reorderLevel || 0),
    unit_cost: parseFloat(item.unitCost || 0),
    supplier: item.supplier || null,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// Transform inventory item from database format to frontend format
const transformInventoryFromDB = (item) => {
  return {
    id: item.id,
    itemName: item.item_name || '',
    category: item.category || '',
    currentStock: parseFloat(item.current_stock || 0),
    reorderLevel: parseFloat(item.reorder_level || 0),
    unitCost: parseFloat(item.unit_cost || 0),
    supplier: item.supplier || '',
    createdAt: item.created_at || new Date().toISOString(),
    updatedAt: item.updated_at || new Date().toISOString()
  }
}

export const getInventory = async () => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      console.error('Error fetching inventory:', error)
      return []
    }

    return (data || []).map(transformInventoryFromDB)
  } catch (error) {
    console.error('Error reading inventory:', error)
    return []
  }
}

export const saveInventory = async (inventory) => {
  try {
    // Get all existing inventory items from database
    const { data: existingInventory, error: fetchError } = await supabase
      .from('inventory')
      .select('id')

    if (fetchError) {
      console.error('Error fetching existing inventory:', fetchError)
      return false
    }

    const existingIds = new Set((existingInventory || []).map(item => item.id))
    const newIds = new Set((inventory || []).map(item => item.id))

    // Find items to delete (exist in DB but not in new array)
    const itemsToDelete = Array.from(existingIds).filter(id => !newIds.has(id))

    // Delete items that are no longer in the array
    if (itemsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('inventory')
        .delete()
        .in('id', itemsToDelete)

      if (deleteError) {
        console.error('Error deleting inventory items:', deleteError)
        return false
      }
    }

    if (!inventory || inventory.length === 0) {
      return true
    }

    // Transform and upsert remaining items
    const dbInventory = inventory.map(transformInventoryToDB)

    const { error } = await supabase
      .from('inventory')
      .upsert(dbInventory, { onConflict: 'id' })

    if (error) {
      console.error('Error saving inventory:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving inventory:', error)
    return false
  }
}

export const getInventoryCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('data')
      .eq('id', 'inventory_categories')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching inventory categories:', error)
      return { categories: [] }
    }

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
    const { error } = await supabase
      .from('products')
      .upsert({
        id: 'inventory_categories',
        data: inventoryCategories,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving inventory categories:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving inventory categories:', error)
    return false
  }
}

// ===== EXPENSE CATEGORIES =====

export const getExpenseCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('data')
      .eq('id', 'expense_categories')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching expense categories:', error)
      return { categories: [] }
    }

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
    const { error } = await supabase
      .from('products')
      .upsert({
        id: 'expense_categories',
        data: expenseCategories,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving expense categories:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving expense categories:', error)
    return false
  }
}

// ===== ORDER SOURCES =====

export const getOrderSources = async () => {
  try {
    const { data, error } = await supabase
      .from('order_sources')
      .select('*')
      .order('name', { ascending: true })

    // If table doesn't exist yet, fall back to defaults (keeps app usable pre-migration)
    if (error) {
      try {
        const alreadyWarned = localStorage.getItem(ORDER_SOURCES_WARNED_KEY) === '1'
        if (!alreadyWarned) {
          console.warn('Order sources table missing/unavailable, using defaults:', error)
          localStorage.setItem(ORDER_SOURCES_WARNED_KEY, '1')
        }
      } catch {
        console.warn('Order sources table missing/unavailable, using defaults:', error)
      }
      return [
        { id: 'Ad', name: 'Ad' },
        { id: 'Organic', name: 'Organic' }
      ]
    }

    if (!data || data.length === 0) {
      // If empty, provide defaults but don't auto-write (avoids unexpected DB writes)
      return [
        { id: 'Ad', name: 'Ad' },
        { id: 'Organic', name: 'Organic' }
      ]
    }

    return data.map(s => ({
      id: s.id,
      name: s.name
    }))
  } catch (error) {
    console.warn('Error reading order sources:', error)
    return [
      { id: 'Ad', name: 'Ad' },
      { id: 'Organic', name: 'Organic' }
    ]
  }
}

export const saveOrderSources = async (sources) => {
  try {
    if (!sources || sources.length === 0) {
      const { error } = await supabase.from('order_sources').delete().neq('id', '')
      return !error
    }

    // Delete removed ones (keeps DB exactly in sync with Settings list)
    const { data: existing, error: fetchError } = await supabase.from('order_sources').select('id')
    if (fetchError) {
      console.error('Error fetching existing order sources:', fetchError)
      return false
    }

    const existingIds = new Set((existing || []).map(r => r.id))
    const newIds = new Set((sources || []).map(r => r.id))
    const toDelete = Array.from(existingIds).filter(id => !newIds.has(id))
    if (toDelete.length) {
      const { error: delError } = await supabase.from('order_sources').delete().in('id', toDelete)
      if (delError) {
        console.error('Error deleting order sources:', delError)
        return false
      }
    }

    const dbRows = sources.map(s => ({
      id: s.id,
      name: s.name,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase
      .from('order_sources')
      .upsert(dbRows, { onConflict: 'id' })

    if (error) {
      console.error('Error saving order sources:', error)
      return false
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
    const { error } = await supabase
      .from('orders')
      .update({ order_source: newName })
      .eq('order_source', oldName)

    if (error) {
      console.warn('Error updating order_source in orders:', error)
      return false
    }
    return true
  } catch (e) {
    console.warn('Error updating order_source in orders:', e)
    return false
  }
}

// ===== TRACKING NUMBERS =====

export const getTrackingNumbers = async () => {
  try {
    const { data, error } = await supabase
      .from('tracking_numbers')
      .select('*')
      .order('number', { ascending: true })

    if (error) {
      console.error('Error fetching tracking numbers:', error)
      return []
    }

    // Transform to match expected format
    return (data || []).map(tn => ({
      id: tn.id,
      number: tn.number,
      status: tn.status,
      assignedTo: tn.assigned_to
    }))
  } catch (error) {
    console.error('Error reading tracking numbers:', error)
    return []
  }
}

export const saveTrackingNumbers = async (trackingNumbers) => {
  try {
    // Get all existing tracking numbers to sync (delete removed ones)
    const { data: existingData, error: fetchError } = await supabase
      .from('tracking_numbers')
      .select('id')

    if (fetchError) {
      console.error('Error fetching existing tracking numbers:', fetchError)
      return false
    }

    const existingIds = new Set((existingData || []).map(tn => tn.id))
    const newIds = new Set((trackingNumbers || []).map(tn => tn.id || tn.number))

    // Find tracking numbers to delete
    const idsToDelete = Array.from(existingIds).filter(id => !newIds.has(id))

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('tracking_numbers')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) {
        console.error('Error deleting tracking numbers:', deleteError)
        return false
      }
    }

    if (!trackingNumbers || trackingNumbers.length === 0) {
      return true
    }

    // Transform to database format
    const dbFormat = trackingNumbers.map(tn => ({
      id: tn.id || tn.number,
      number: tn.number,
      status: tn.status || 'available',
      assigned_to: tn.assignedTo || null
    }))

    const { error } = await supabase
      .from('tracking_numbers')
      .upsert(dbFormat, { onConflict: 'id' })

    if (error) {
      console.error('Error saving tracking numbers:', error)
      return false
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
    const { data, error } = await supabase
      .from('products')
      .select('data')
      .eq('id', 'products')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching products:', error)
      return null
    }

    if (data && data.data && data.data.categories && data.data.categories.length > 0) {
      return data.data
    }

    // Return default products if none exist
    const defaultProducts = getDefaultProducts()
    await saveProducts(defaultProducts)
    return defaultProducts
  } catch (error) {
    console.error('Error reading products:', error)
    const defaultProducts = getDefaultProducts()
    return defaultProducts
  }
}

export const saveProducts = async (products) => {
  try {
    const { error } = await supabase
      .from('products')
      .upsert({
        id: 'products',
        data: products,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving products:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error saving products:', error)
    return false
  }
}

// Get default products data
const getDefaultProducts = () => {
  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9)
  }

  const mommyFramesId = generateId()
  const plymountId = generateId()
  const customId = generateId()
  const keytagId = generateId()

  return {
    categories: [
      {
        id: mommyFramesId,
        name: 'Mommy Frames',
        items: [
          { id: generateId(), name: 'Wall Frame Couple', price: 1590 },
          { id: generateId(), name: 'Wall Frame Hand Folded', price: 1590 },
          { id: generateId(), name: 'Wall Frame Heart Holding', price: 1590 },
          { id: generateId(), name: 'Wall Frame Circle', price: 1690 },
          { id: generateId(), name: 'Wall Frame Family', price: 1590 },
          { id: generateId(), name: 'Table Frame Couple', price: 1990 },
          { id: generateId(), name: 'Table Frame Hand Folded', price: 1990 },
          { id: generateId(), name: 'Table Frame Heart Holding', price: 1990 }
        ]
      },
      {
        id: plymountId,
        name: 'Plymount',
        items: [
          { id: generateId(), name: '4x6', price: 940 },
          { id: generateId(), name: '6x8', price: 1155 },
          { id: generateId(), name: '8x10', price: 1430 },
          { id: generateId(), name: '8x12', price: 1510 },
          { id: generateId(), name: '10x12', price: 1680 },
          { id: generateId(), name: '10x15', price: 1880 },
          { id: generateId(), name: '12x15', price: 2070 },
          { id: generateId(), name: '12x18', price: 2250 },
          { id: generateId(), name: '16x24', price: 3950 },
          { id: generateId(), name: '20x30', price: 6750 }
        ]
      },
      {
        id: customId,
        name: 'Custom',
        items: []
      },
      {
        id: keytagId,
        name: 'Keytag',
        items: []
      }
    ]
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
    // Update in Supabase
    const { error } = await supabase
      .from('tracking_numbers')
      .update({
        status: 'used',
        updated_at: new Date().toISOString()
      })
      .eq('number', trackingNumber)

    if (error) {
      console.error('Error updating tracking number:', error)
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
export const exportAllData = async (orders, expenses, products, settings, trackingNumbers, orderCounter, inventory) => {
  try {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      orders: orders || [],
      expenses: expenses || [],
      inventory: inventory || [],
      products: products || { categories: [] },
      settings: settings || {},
      trackingNumbers: trackingNumbers || [],
      orderCounter: orderCounter || null,
      orderSources: await getOrderSources()
    }

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aof-ms-backup-${new Date().toISOString().split('T')[0]}.json`
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
export const importAllDataFromObject = async (data) => {
  try {
    // Validate data structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format')
    }

    // Import data to Supabase
    if (data.orders) await saveOrders(data.orders)
    if (data.expenses) await saveExpenses(data.expenses)
    if (data.inventory) await saveInventory(data.inventory)
    if (data.products) await saveProducts(data.products)
    if (data.settings) await saveSettings(data.settings)
    if (data.trackingNumbers) await saveTrackingNumbers(data.trackingNumbers)
    if (data.orderCounter !== undefined) await saveOrderCounter(data.orderCounter)
    if (data.orderSources) await saveOrderSources(data.orderSources)

    return {
      success: true,
      message: 'Data imported successfully!',
      data: {
        orders: data.orders || [],
        expenses: data.expenses || [],
        inventory: data.inventory || [],
        products: data.products || { categories: [] },
        settings: data.settings || {},
        trackingNumbers: data.trackingNumbers || [],
        orderCounter: data.orderCounter || null,
        orderSources: data.orderSources || []
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
    // Delete all data from Supabase
    await Promise.all([
      supabase.from('orders').delete().neq('id', ''),
      supabase.from('inventory').delete().neq('id', ''),
      supabase.from('expenses').delete().neq('id', ''),
      supabase.from('order_sources').delete().neq('id', ''),
      supabase.from('tracking_numbers').delete().neq('id', ''),
      supabase.from('order_counter').delete().eq('id', 'counter'),
      supabase.from('products').delete().eq('id', 'products'),
      supabase.from('settings').delete().eq('id', 'settings')
    ])

    return { success: true, message: 'All data cleared successfully!' }
  } catch (error) {
    console.error('Error clearing data:', error)
    return { success: false, message: 'Failed to clear data: ' + error.message }
  }
}

// ===== INVENTORY LOGS =====

export const getInventoryLogs = async () => {
  try {
    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(100) // Fetch last 100 logs by default

    if (error) {
      if (error.code === '42P01') { // table does not exist
        return []
      }
      console.error('Error fetching inventory logs:', error)
      return []
    }

    return (data || []).map(log => ({
      id: log.id,
      inventoryItemId: log.inventory_item_id,
      itemName: log.item_name,
      category: log.category,
      transactionType: log.transaction_type,
      quantityChange: parseFloat(log.quantity_change || 0),
      balanceAfter: parseFloat(log.balance_after || 0),
      date: log.date,
      notes: log.notes
    }))
  } catch (error) {
    console.error('Error reading inventory logs:', error)
    return []
  }
}


export const addInventoryLog = async (logData) => {
  try {
    const dbLog = {
      inventory_item_id: logData.inventoryItemId,
      item_name: logData.itemName,
      category: logData.category,
      transaction_type: logData.transactionType,
      quantity_change: logData.quantityChange,
      balance_after: logData.balanceAfter,
      date: new Date().toISOString(),
      notes: logData.notes || ''
    }

    const { error } = await supabase
      .from('inventory_logs')
      .insert([dbLog])

    if (error) {
      console.error('Error adding inventory log:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error adding inventory log:', error)
    return false
  }
}

export const deleteInventoryLog = async (logId) => {
  try {
    const { error } = await supabase
      .from('inventory_logs')
      .delete()
      .eq('id', logId)

    if (error) {
      console.error('Error deleting inventory log:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting inventory log:', error)
    return false
  }
}

