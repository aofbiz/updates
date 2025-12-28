import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format, differenceInDays } from 'date-fns'

// --- General Helpers ---

export const formatCurrency = (amount) => {
    return `Rs. ${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const filterByDateRange = (data, dateField, startDate, endDate) => {
    if (!startDate || !endDate) return data
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    return data.filter(item => {
        const d = new Date(item[dateField])
        return d >= start && d <= end
    })
}

// --- Sales Calculations ---

export const calculateSalesMetrics = (orders, inventory = [], expenses = []) => {
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid')
    const revenue = paidOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0)
    const totalOrders = orders.length

    // Create inventory lookup map
    const inventoryMap = {}
    inventory.forEach(item => {
        if (item.id) inventoryMap[String(item.id)] = item
    })

    // 1. Source Distribution (Volume) - All Orders
    const sourceStats = {}
    orders.forEach(order => {
        const source = (order.orderSource || 'Ad').trim() // Default to 'Ad' to match Dashboard
        if (!sourceStats[source]) {
            sourceStats[source] = { name: source, orders: 0, revenue: 0, cost: 0, adsExpense: 0 }
        }
        sourceStats[source].orders += 1
    })

    // 2. Financial Metrics - Paid Orders Only
    paidOrders.forEach(order => {
        const source = (order.orderSource || 'Ad').trim()
        if (!sourceStats[source]) {
            sourceStats[source] = { name: source, orders: 0, revenue: 0, cost: 0, adsExpense: 0 }
        }

        const orderRevenue = Number(order.totalPrice) || 0
        sourceStats[source].revenue += orderRevenue

        let orderCost = 0
        const items = order.orderItems || []
        items.forEach(it => {
            const invItem = inventoryMap[String(it.itemId)]
            if (invItem) {
                const cost = Number(invItem.unitCost) || 0
                orderCost += (Number(it.quantity) || 0) * cost
            }
        })
        sourceStats[source].cost += orderCost
    })

    // 3. Subtract Ad Expenses - Category "Ads", match item name to source
    expenses.forEach(exp => {
        if (exp.category === 'Ads') {
            const item = (exp.item || exp.description || '').trim().toLowerCase()
            // Find a source that matches this name (case-insensitive)
            Object.keys(sourceStats).forEach(sourceName => {
                if (sourceName.toLowerCase() === item) {
                    sourceStats[sourceName].adsExpense += Number(exp.amount || exp.total || 0)
                }
            })
        }
    })

    // Transform for Recharts
    const sourceData = Object.values(sourceStats)
        .map(s => ({ name: s.name, value: s.orders }))
        .filter(d => d.value > 0)

    const profitabilityData = Object.values(sourceStats)
        .map(s => ({
            name: s.name,
            revenue: s.revenue,
            profit: s.revenue - s.cost - s.adsExpense
        }))
        .filter(d => d.revenue > 0 || d.profit !== 0)

    return { revenue, totalOrders, sourceData, profitabilityData }
}

export const getTopSellingProducts = (orders, inventory = [], products = { categories: [] }) => {
    const productStats = {}

    // Helper to get category name from products list
    const getCategoryName = (id) => {
        if (!id) return null;
        const category = products.categories.find(c => c.id === id);
        return category ? category.name : null;
    }

    // Helper to get item name from products list
    // Helper to get item name from products list
    const getItemName = (categoryId, itemId) => {
        if (!itemId) return null; // Item ID is strictly required

        // 1. Try direct lookup if Category ID is available
        if (categoryId && products.categories) {
            const category = products.categories.find(c => c.id === categoryId);
            if (category && category.items) {
                const item = category.items.find(i => String(i.id) === String(itemId) || i.id === itemId);
                if (item) return item.name;
            }
        }

        // 2. Global Backup Search: Look through ALL categories
        if (products.categories) {
            for (const cat of products.categories) {
                if (cat.items) {
                    const found = cat.items.find(i => String(i.id) === String(itemId) || i.id === itemId);
                    if (found) return found.name;
                }
            }
        }
        return null;
    }

    // Fallback: Create a lookup map for inventory items
    const inventoryMap = new Map();
    inventory.forEach(item => {
        if (item.id) {
            inventoryMap.set(item.id, {
                name: item.itemName,
                category: item.category
            });
        }
    });

    orders.forEach(order => {
        const items = order.orderItems || []
        // Handle legacy structure
        if (items.length === 0 && order.itemId) {
            items.push({
                itemId: order.itemId,
                categoryId: order.categoryId,
                itemName: order.itemName, // Critical: capture stored item name
                customItemName: order.customItemName,
                quantity: order.quantity || 1,
                unitPrice: order.unitPrice || 0
            })
        }

        items.forEach(item => {
            let name = 'Unknown Product';
            let category = 'Uncategorized';
            let key = item.itemId || item.customItemName || 'unknown';

            // 1. Resolve Category
            // Try to resolve category ID from products list first (Most reliable for standard categories)
            const resolvedCategoryName = getCategoryName(item.categoryId);
            if (resolvedCategoryName) {
                category = resolvedCategoryName;
            } else if (item.categoryId) {
                // Format ID if not found in map (e.g. 'custom' -> 'Custom')
                category = item.categoryId.charAt(0).toUpperCase() + item.categoryId.slice(1);
            } else if (item.itemId && inventoryMap.has(item.itemId)) {
                // Fallback to inventory
                category = inventoryMap.get(item.itemId).category || 'Uncategorized';
            }

            // 2. Resolve Item Name
            // Prioritize what is recorded in the order (the most reliable source)
            if (item.name || item.itemName) {
                name = item.name || item.itemName;
            } else if (item.customItemName) {
                name = item.customItemName;
            } else {
                // Try to resolve from products list
                const resolvedItemName = getItemName(item.categoryId, item.itemId);
                if (resolvedItemName) {
                    name = resolvedItemName;
                } else if (item.itemId && inventoryMap.has(item.itemId)) {
                    // Fallback to inventory
                    name = inventoryMap.get(item.itemId).name;
                } else if (item.itemId) {
                    name = 'Product ' + item.itemId;
                }
            }

            // Grouping Logic
            // If it's a standard product (has itemId), group by itemId. 
            // If it's custom (no itemId), group by name.
            if (item.itemId) {
                key = item.itemId;
            } else {
                key = name;
            }

            if (!productStats[key]) {
                productStats[key] = {
                    name: name,
                    category: category,
                    quantity: 0,
                    revenue: 0
                }
            } else {
                // Better name resolution strategy:
                // Always prefer a name that comes from a resolved source (not 'Product ...' and not 'Unknown')
                const isCurrentNameGeneric = productStats[key].name.startsWith('Product ') || productStats[key].name === 'Unknown Product';
                const isNewNameGeneric = name.startsWith('Product ') || name === 'Unknown Product';

                if (isCurrentNameGeneric && !isNewNameGeneric) {
                    productStats[key].name = name;
                } else if (!isNewNameGeneric && name !== productStats[key].name) {
                    // If we have two "real" names for the same ID, prefer the most recent one (implied by order iteration order)
                    // or purely by length/specificity if possible?
                    // For now, let's assume later orders might have corrected names, or just keep the first found valid one.
                    // Actually, let's try to lookup the ID in the Inventory/Products AGAIN to be sure we get the Canonical Name
                    if (item.itemId) {
                        // Force lookup to ensure we use the canonical catalog name if available, overriding potential "custom" variations in old orders
                        const canonicalName = getItemName(item.categoryId, item.itemId) || (inventoryMap.has(item.itemId) ? inventoryMap.get(item.itemId).name : null);
                        if (canonicalName) {
                            productStats[key].name = canonicalName;
                        }
                    }
                }
            }
            productStats[key].quantity += Number(item.quantity) || 0
            productStats[key].revenue += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        })
    })

    return Object.values(productStats).sort((a, b) => b.quantity - a.quantity).slice(0, 10)
}

// --- Expense Calculations ---

export const calculateExpenseMetrics = (expenses, orders = []) => {
    const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    // Sales for Ratio (Paid orders revenue)
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid')
    const totalSales = paidOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0)
    const expenseSalesRatio = totalSales > 0 ? (total / totalSales) * 100 : 0

    const byCategory = expenses.reduce((acc, e) => {
        const cat = (e.category || 'Other').trim()
        acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0)
        return acc
    }, {})

    const categoryData = Object.entries(byCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

    const topCategory = categoryData.length > 0 ? categoryData[0] : { name: 'N/A', value: 0 }

    // Aggregate by item/description for "Top Items"
    const byItem = expenses.reduce((acc, e) => {
        const name = (e.item || e.description || 'Unnamed').trim()
        if (!acc[name]) acc[name] = { name, amount: 0, category: e.category || 'Other' }
        acc[name].amount += Number(e.amount) || 0
        return acc
    }, {})

    const topItems = Object.values(byItem)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

    return { total, categoryData, expenseSalesRatio, topCategory, topItems }
}

// --- Profitability ---

export const calculateProfitability = (orders, expenses) => {
    // 1. Net Profit (Cash Basis)
    const revenue = orders
        .filter(o => o.paymentStatus === 'Paid')
        .reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0)

    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const netProfit = revenue - totalExpenses
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    return { netProfit, margin, revenue, totalExpenses }
}

export const calculateAverageBusinessMetrics = (orders, expenses) => {
    const paidOrdersEncoded = orders.filter(o => o.paymentStatus === 'Paid');
    const totalOrders = paidOrdersEncoded.length; // Use paid orders for revenue averaging to be accurate?? 
    // actually, for cost per order, maybe we should use *all* orders that are not cancelled?
    // Let's stick to "Valid" orders (not cancelled/returned) for the divisor to be safe.

    const validOrders = orders.filter(o => !['cancelled', 'returned'].includes(o.status?.toLowerCase()));
    const orderCount = validOrders.length;

    const { netProfit, revenue, totalExpenses } = calculateProfitability(orders, expenses);

    if (orderCount === 0) {
        return {
            avgRevenuePerOrder: 0,
            avgCostPerOrder: 0,
            avgProfitPerOrder: 0
        };
    }

    return {
        avgRevenuePerOrder: revenue / orderCount,
        avgCostPerOrder: totalExpenses / orderCount,
        avgProfitPerOrder: netProfit / orderCount
    };
}

export const getMonthlyFinancials = (orders, expenses) => {
    const data = {}

    // Revenue
    orders.forEach(o => {
        if (o.paymentStatus !== 'Paid') return
        const date = o.orderDate || o.createdDate
        if (!date) return
        const key = date.substring(0, 7)
        if (!data[key]) data[key] = { date: key, revenue: 0, expenses: 0, profit: 0 }
        data[key].revenue += Number(o.totalPrice) || 0
    })

    // Expenses
    expenses.forEach(e => {
        const date = e.date
        if (!date) return
        const key = date.substring(0, 7)
        if (!data[key]) data[key] = { date: key, revenue: 0, expenses: 0, profit: 0 }
        data[key].expenses += Number(e.amount) || 0
    })

    // Calculate Profit
    Object.values(data).forEach(item => {
        item.profit = item.revenue - item.expenses
    })

    return Object.values(data).sort((a, b) => a.date.localeCompare(b.date))
}

// --- Order Metrics ---

export const calculateOrderMetrics = (orders) => {
    const validOrders = orders.filter(o => !['cancelled', 'returned'].includes((o.status || '').toLowerCase()))
    const statusCounts = orders.reduce((acc, o) => {
        const s = o.status || 'New Order'
        // Consolidate status casing
        const normalized = s.charAt(0).toUpperCase() + s.slice(1)
        acc[normalized] = (acc[normalized] || 0) + 1
        return acc
    }, {})

    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

    // 1. Avg Order Value
    const revenue = validOrders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0)
    const avgOrderValue = validOrders.length > 0 ? (revenue / validOrders.length).toFixed(2) : 0

    // 2. Processing Time & Breakdown (Created -> Packed -> Dispatched)
    let totalProcessingDays = 0
    let processingCount = 0
    // We try to infer "Packed" time if we had logs, but for now we only have Created & Dispatch dates.
    // So we'll stick to Created -> Dispatched as the main "Processing" metric.

    // Bottleneck Analysis: Status Duration (just a snapshot of current state ages isn't history)
    // Instead we can show "Days to Dispatch" distribution maybe? Or just sticking to single Avg.

    orders.forEach(o => {
        if (o.status === 'Dispatched' && o.createdDate && o.dispatchDate) {
            const days = differenceInDays(parseISO(o.dispatchDate), parseISO(o.createdDate))
            if (days >= 0) {
                totalProcessingDays += days
                processingCount++
            }
        }
    })
    const avgProcessingTime = processingCount > 0 ? (totalProcessingDays / processingCount).toFixed(1) : '0'

    // 3. Seasonality (Monthly Volume)
    const volumeByMonth = {}
    validOrders.forEach(o => {
        const date = o.orderDate || o.createdDate
        if (!date) return
        const key = date.substring(0, 7) // YYYY-MM
        volumeByMonth[key] = (volumeByMonth[key] || 0) + 1
    })

    const monthlyVolume = Object.entries(volumeByMonth)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))

    // 4. District Breakdown
    const districtCounts = {}
    validOrders.forEach(o => {
        if (o.district) {
            const d = o.district.trim()
            districtCounts[d] = (districtCounts[d] || 0) + 1
        }
    })

    const districtData = Object.entries(districtCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

    const topDistrict = districtData.length > 0 ? districtData[0].name : 'N/A'

    // 5. Repeat Customer Rate
    const customerOrders = {}
    validOrders.forEach(o => {
        const normalizePhone = (p) => (p || '').replace(/\D/g, '')
        const key = normalizePhone(o.whatsapp) || normalizePhone(o.phone) || o.customerName
        customerOrders[key] = (customerOrders[key] || 0) + 1
    })

    const returningCustomers = Object.values(customerOrders).filter(count => count > 1).length
    const totalCustomers = Object.keys(customerOrders).length
    const repeatRate = totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100).toFixed(1) : 0

    return {
        statusData,
        avgProcessingTime,
        avgOrderValue,
        monthlyVolume,
        districtData,
        topDistrict,
        repeatRate,
        totalOrders: validOrders.length
    }
}

export const calculateConsumptionTrends = (orders) => {
    // 1. Filter valid orders
    const validOrders = orders.filter(o =>
        !['cancelled', 'returned'].includes((o.status || '').toLowerCase())
    )

    // 2. Aggregate quantities by Item and Month
    // Map: "YYYY-MM" -> { "ItemName": Qty, ... }
    const monthlyUsage = {}
    const itemTotals = {}

    validOrders.forEach(order => {
        const date = order.orderDate || order.createdDate
        if (!date) return
        const monthKey = date.substring(0, 7) // YYYY-MM

        if (!monthlyUsage[monthKey]) monthlyUsage[monthKey] = { date: monthKey }

        const items = order.orderItems || []
        // Handle legacy single-item orders
        if (items.length === 0 && (order.itemId || order.customItemName)) {
            items.push({
                customItemName: order.customItemName || 'Unknown Item',
                quantity: order.quantity || 1
            })
        }

        items.forEach(item => {
            const name = item.customItemName || item.itemName || 'Unknown Item'
            const qty = Number(item.quantity) || 0

            monthlyUsage[monthKey][name] = (monthlyUsage[monthKey][name] || 0) + qty
            itemTotals[name] = (itemTotals[name] || 0) + qty
        })
    })

    // 3. Find Top 5 High-Demand Items to display
    const topItems = Object.entries(itemTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0])

    // 4. Transform for Recharts
    // Recharts needs array of objects, keys matching lines
    const chartData = Object.values(monthlyUsage).sort((a, b) => a.date.localeCompare(b.date))

    return { chartData, topItems }
}
// --- Consolidated Aggregators for Reports ---

export const calculateProfitabilityMetrics = (orders, expenses) => {
    const { netProfit, margin, revenue, totalExpenses } = calculateProfitability(orders, expenses)
    const { avgRevenuePerOrder, avgCostPerOrder, avgProfitPerOrder } = calculateAverageBusinessMetrics(orders, expenses)
    const monthlyData = getMonthlyFinancials(orders, expenses)

    const pieData = [
        { name: 'Profit', value: Math.max(0, netProfit) },
        { name: 'Expenses', value: totalExpenses }
    ]

    // --- Profit by Source Calculation ---
    const sourceStats = {}
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid')

    // Revenue & Cost from Orders
    paidOrders.forEach(order => {
        const source = (order.orderSource || 'Ad').trim()
        if (!sourceStats[source]) {
            sourceStats[source] = { name: source, revenue: 0, cost: 0, adsExpense: 0 }
        }
        sourceStats[source].revenue += Number(order.totalPrice) || 0
        // Approximate cost (since we don't strictly link inventory cost snapshot to order yet, usage current unitCost)
        // If we had a cost snapshot in order items, we'd use that. For now, ignoring cost or using 0 if not easily available here without fetching inventory again.
        // Wait, calculateSalesMetrics fetches inventory. To be accurate we need inventory.
        // But the user didn't pass inventory to this function. 
        // Let's assume Cost is 0 for "Profit by Channel" in this specific view OR we accept we only show Revenue - Ad Spend?
        // "Profit by Channel" usually implies Gross Profit (Revenue - COGS) - Ads.
        // Without inventory passed in, we can't get COGS easily.
        // Let's look at how calculateSalesMetrics does it. It filters inputs: (orders, inventory, expenses).
        // createProfitabilityMetrics signature is (orders, expenses).
        // I should probably just focus on Revenue - Expenses (Ad Spend) for "Contribution Margin" by channel?
        // Or I should rely on the fact that the existing "Profit by Channel" in SalesReports MIGHT have been using COGS.
        // Let's check calculateSalesMetrics again.
        // Yes, calculateSalesMetrics uses inventory.
        // So to move it here, I need to pass inventory to ProfitabilityReports and then to this function.
    })

    // Ad Expenses
    expenses.forEach(exp => {
        if (exp.category === 'Ads') {
            const item = (exp.item || exp.description || '').trim().toLowerCase()
            Object.keys(sourceStats).forEach(sourceName => {
                if (sourceName.toLowerCase() === item) {
                    sourceStats[sourceName].adsExpense += Number(exp.amount || exp.total || 0)
                }
            })
        }
    })

    const profitabilityBySource = Object.values(sourceStats)
        .map(s => ({
            name: s.name,
            value: s.revenue - s.adsExpense // "Profit" (Revenue - Ads) excluding COGS if inventory not available
        }))
        .filter(d => d.value !== 0)
        .sort((a, b) => b.value - a.value)

    return {
        monthlyData,
        pieData,
        netProfit,
        margin,
        avgRevenuePerOrder,
        avgCostPerOrder,
        avgProfitPerOrder,
        profitabilityBySource
    }
}

export const calculateInventoryMetrics = (inventory) => {
    const totalValue = inventory.reduce((sum, item) => sum + (Number(item.currentStock || 0) * (Number(item.unitCost || 0))), 0)

    const lowStockItems = inventory
        .filter(item => {
            const qty = Number(item.currentStock) || 0
            const min = Number(item.reorderLevel) || 0
            if (min === 0) return false // Ignore low stock check if reorder level is 0
            return qty <= min
        })
        .map(i => ({
            name: i.itemName,
            category: i.category,
            quantity: i.currentStock,
            minStock: i.reorderLevel
        }))
        .sort((a, b) => a.quantity - b.quantity)

    const stockAlerts = lowStockItems.length

    const statusCounts = {
        'In Stock': 0,
        'Low Stock': 0,
        'Out of Stock': 0
    }

    inventory.forEach(item => {
        const qty = Number(item.currentStock) || 0
        const min = Number(item.reorderLevel) || 0

        if (qty <= 0 && min > 0) statusCounts['Out of Stock']++
        else if (min > 0 && qty <= min) statusCounts['Low Stock']++
        else statusCounts['In Stock']++
    })

    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

    return { statusData, lowStockItems, totalValue, stockAlerts }
}
