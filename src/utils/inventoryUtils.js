/**
 * Inventory Utilities
 * 
 * Handles automatic inventory adjustments based on order status changes.
 */

import { getInventory, saveInventory, addInventoryLog } from './storage'

/**
 * Deduct order items from inventory when an order is dispatched.
 * @param {Object} order - The order object with items array
 */
export const deductOrderFromInventory = async (order) => {
    // Orders store items in 'orderItems', not 'items'
    const orderItems = order?.orderItems || order?.items

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        console.log('deductOrderFromInventory: No items to deduct', { orderId: order?.id, orderItems })
        return { success: false, message: 'No items to deduct' }
    }

    try {
        const inventory = await getInventory()
        if (!inventory || inventory.length === 0) {
            console.log('deductOrderFromInventory: Inventory is empty')
            return { success: false, message: 'Inventory is empty' }
        }

        console.log(`deductOrderFromInventory: Processing order #${order?.id || order?.orderNumber}`, {
            itemCount: orderItems.length,
            inventoryCount: inventory.length
        })

        let updated = false
        const updatedInventory = inventory.map(invItem => {
            // Find matching order items by name
            const matchingOrderItems = orderItems.filter(
                orderItem => orderItem.name?.toLowerCase().trim() === invItem.itemName?.toLowerCase().trim()
            )

            if (matchingOrderItems.length > 0) {
                // Sum up all quantities for matching items
                const totalQty = matchingOrderItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 1), 0)
                const newStock = Math.max(0, (invItem.currentStock || 0) - totalQty)

                console.log(`deductOrderFromInventory: Deducting ${totalQty} from "${invItem.itemName}" (${invItem.currentStock} → ${newStock})`)

                // Log the transaction
                addInventoryLog({
                    inventoryItemId: invItem.id,
                    itemName: invItem.itemName,
                    category: invItem.category,
                    transactionType: `Used in Order #${order.orderNumber || order.id}`,
                    quantityChange: -totalQty,
                    balanceAfter: newStock
                })

                updated = true
                return { ...invItem, currentStock: newStock }
            }
            return invItem
        })

        if (updated) {
            await saveInventory(updatedInventory)
            window.dispatchEvent(new CustomEvent('inventoryUpdated'))
            console.log('deductOrderFromInventory: Inventory updated successfully')
        } else {
            console.log('deductOrderFromInventory: No matching inventory items found for order items:',
                orderItems.map(i => i.name))
        }

        return { success: true, updated }
    } catch (error) {
        console.error('Error deducting from inventory:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Add order items back to inventory when an order is returned.
 * @param {Object} order - The order object with items array
 */
export const returnOrderToInventory = async (order) => {
    // Orders store items in 'orderItems', not 'items'
    const orderItems = order?.orderItems || order?.items

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        console.log('returnOrderToInventory: No items to return', { orderId: order?.id, orderItems })
        return { success: false, message: 'No items to return' }
    }

    try {
        const inventory = await getInventory()
        if (!inventory || inventory.length === 0) {
            console.log('returnOrderToInventory: Inventory is empty')
            return { success: false, message: 'Inventory is empty' }
        }

        console.log(`returnOrderToInventory: Processing order #${order?.id || order?.orderNumber}`, {
            itemCount: orderItems.length,
            inventoryCount: inventory.length
        })

        let updated = false
        const updatedInventory = inventory.map(invItem => {
            // Find matching order items by name
            const matchingOrderItems = orderItems.filter(
                orderItem => orderItem.name?.toLowerCase().trim() === invItem.itemName?.toLowerCase().trim()
            )

            if (matchingOrderItems.length > 0) {
                // Sum up all quantities for matching items
                const totalQty = matchingOrderItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 1), 0)
                const newStock = (invItem.currentStock || 0) + totalQty

                console.log(`returnOrderToInventory: Adding ${totalQty} to "${invItem.itemName}" (${invItem.currentStock} → ${newStock})`)

                // Log the transaction
                addInventoryLog({
                    inventoryItemId: invItem.id,
                    itemName: invItem.itemName,
                    category: invItem.category,
                    transactionType: `Return Order #${order.orderNumber || order.id}`,
                    quantityChange: totalQty,
                    balanceAfter: newStock
                })

                updated = true
                return { ...invItem, currentStock: newStock }
            }
            return invItem
        })

        if (updated) {
            await saveInventory(updatedInventory)
            window.dispatchEvent(new CustomEvent('inventoryUpdated'))
            console.log('returnOrderToInventory: Inventory updated successfully')
        } else {
            console.log('returnOrderToInventory: No matching inventory items found for order items:',
                orderItems.map(i => i.name))
        }

        return { success: true, updated }
    } catch (error) {
        console.error('Error returning to inventory:', error)
        return { success: false, error: error.message }
    }
}
