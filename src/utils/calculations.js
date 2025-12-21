// Calculation utilities for dashboard metrics

export const calculateNetProfit = (orders, expenses) => {
  const totalRevenue = orders
    .filter(order => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  return totalRevenue - totalExpenses;
};


export const getTodaysOrders = (orders) => {
  const today = new Date().toISOString().split('T')[0];
  return orders.filter(order => {
    const orderDate = order.dispatchDate || order.createdDate || '';
    return orderDate.startsWith(today);
  });
};

export const getPendingDispatch = (orders) => {
  return orders.filter(order =>
    order.status !== 'Dispatched' &&
    order.status !== 'returned' &&
    order.status !== 'refund' &&
    order.status !== 'cancelled'
  );
};

export const getMonthlyExpenses = (expenses, month, year) => {
  return expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === month && expenseDate.getFullYear() === year;
  });
};

export const getCategoryBreakdown = (expenses) => {
  const breakdown = {};
  expenses.forEach(expense => {
    const category = expense.category || 'Other';
    breakdown[category] = (breakdown[category] || 0) + (expense.amount || 0);
  });
  return breakdown;
};

// Sales Reports Functions
export const getMonthlySalesSummary = (orders, month, year) => {
  const monthOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate || order.createdDate || order.dispatchDate || '');
    return orderDate.getMonth() === month && orderDate.getFullYear() === year && order.paymentStatus === 'Paid';
  });

  const totalSales = monthOrders.reduce((sum, order) => sum + (order.totalPrice || order.totalAmount || 0), 0);
  const orderCount = monthOrders.length;
  const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

  return { totalSales, orderCount, avgOrderValue };
};

export const getTopProducts = (orders, products, limit = 10) => {
  const productSales = {};

  orders.forEach(order => {
    if (order.paymentStatus === 'Paid') {
      const items = Array.isArray(order.orderItems) && order.orderItems.length > 0
        ? order.orderItems
        : [{
          categoryId: order.categoryId,
          itemId: order.itemId,
          customItemName: order.customItemName,
          quantity: order.quantity || 1,
          unitPrice: order.unitPrice || 0
        }]

      items.forEach(oi => {
        const category = products?.categories?.find(cat => cat.id === oi.categoryId);
        const item = category?.items?.find(item => item.id === oi.itemId);
        const itemName = oi.name || oi.itemName || oi.customItemName || item?.name || 'Unknown';
        const revenue = (oi.quantity || 0) * (oi.unitPrice || 0);
        const quantity = oi.quantity || 1;

        if (!productSales[itemName]) {
          productSales[itemName] = { name: itemName, revenue: 0, quantity: 0, orders: 0 };
        }
        productSales[itemName].revenue += revenue;
        productSales[itemName].quantity += quantity;
        productSales[itemName].orders += 1;
      })
    }
  });

  return Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
};

export const getSalesByChannel = (orders) => {
  const channelSales = { 'Ad': { revenue: 0, orders: 0 }, 'Organic': { revenue: 0, orders: 0 } };

  orders.forEach(order => {
    const source = normalizeSourceName(order.orderSource);
    const revenue = order.totalPrice || order.totalAmount || 0;
    channelSales[source] = channelSales[source] || { revenue: 0, orders: 0 };
    channelSales[source].revenue += revenue;
    channelSales[source].orders += 1;
  });

  return channelSales;
};

const normalizeSourceName = (name) => {
  const n = (name || '').toString().trim()
  return n ? n : 'Ad'
}

// Ad ROI / Source Performance Reports
// Allocation logic:
// - "Ad/Marketing" expenses are allocated ONLY to ad-like sources (e.g., Ad, Ads, Facebook Ads).
// - All other expenses are allocated across ALL sources by revenue share.
export const getSourcePerformance = (orders, expenses, month, year, sourceNames = []) => {
  // Build a display-name map so we always show the "Settings" casing for known sources
  const displayMap = {}
    ; (sourceNames || []).forEach(n => {
      const key = normalizeSourceName(n).toLowerCase()
      displayMap[key] = normalizeSourceName(n)
    })

  const periodOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate || order.createdDate || order.dispatchDate || '');
    return orderDate.getMonth() === month && orderDate.getFullYear() === year;
  });

  const periodExpenses = getMonthlyExpenses(expenses, month, year);
  const isAdExpense = (expense) => {
    // Option B: treat category exactly "Ads" as ad spend (case-insensitive)
    const cat = (expense?.category || '').toString().trim().toLowerCase()
    return cat === 'ads'
  }

  const adExpensesTotal = periodExpenses
    .filter(isAdExpense)
    .reduce((sum, expense) => sum + (expense.amount || expense.total || 0), 0)

  const otherExpensesTotal = periodExpenses
    .filter(e => !isAdExpense(e))
    .reduce((sum, expense) => sum + (expense.amount || expense.total || 0), 0)

  const totalExpenses = adExpensesTotal + otherExpensesTotal;

  const bySource = {};
  const ensure = (name) => {
    const normalized = normalizeSourceName(name)
    const key = normalized.toLowerCase()
    const displayName = displayMap[key] || normalized

    if (!bySource[key]) {
      bySource[key] = {
        source: displayName,
        orders: 0,
        revenue: 0,
        avgOrderValue: 0,
        allocatedExpenses: 0,
        profit: 0
      };
    }
  };

  // Seed with configured sources so we show zeros too
  (sourceNames || []).forEach(ensure);

  periodOrders.forEach(order => {
    const source = normalizeSourceName(order.orderSource);
    ensure(source);
    const revenue = order.totalPrice || order.totalAmount || 0;
    const key = source.toLowerCase()
    bySource[key].orders += 1;
    bySource[key].revenue += revenue;
  });

  const sources = Object.values(bySource);
  const totalRevenue = sources.reduce((sum, s) => sum + (s.revenue || 0), 0);

  // Determine which sources are "ad-like" so they receive ad expense allocation
  const isAdSourceKey = (key) => {
    const k = (key || '').toLowerCase()
    return k === 'ad' || k === 'ads' || k.includes('ad') || k.includes('facebook') || k.includes('meta')
  }

  const adSources = sources.filter(s => isAdSourceKey(s.source) || isAdSourceKey(s.source.toLowerCase()))
  const adRevenueTotal = adSources.reduce((sum, s) => sum + (s.revenue || 0), 0)

  sources.forEach(s => {
    s.avgOrderValue = s.orders > 0 ? s.revenue / s.orders : 0;

    const revenueShareAll = totalRevenue > 0 ? (s.revenue / totalRevenue) : 0;
    const otherAllocated = otherExpensesTotal * revenueShareAll;

    const adEligible = isAdSourceKey(s.source) || isAdSourceKey((s.source || '').toLowerCase())
    const adShare = (adEligible && adRevenueTotal > 0) ? (s.revenue / adRevenueTotal) : 0
    const adAllocated = adEligible ? (adExpensesTotal * adShare) : 0

    s.allocatedExpenses = otherAllocated + adAllocated;
    s.profit = s.revenue - s.allocatedExpenses;
  });

  return {
    sources: sources.sort((a, b) => b.revenue - a.revenue),
    totals: {
      totalOrders: periodOrders.length,
      totalRevenue,
      totalExpenses,
      adExpensesTotal,
      otherExpensesTotal
    }
  };
};

// Inventory Reports Functions
export const getInventoryStatusOverview = (inventory) => {
  const critical = inventory.filter(item => item.currentStock < item.reorderLevel);
  const low = inventory.filter(item => {
    const stock = item.currentStock;
    const reorder = item.reorderLevel;
    return stock >= reorder && stock <= reorder * 1.2;
  });
  const normal = inventory.filter(item => item.currentStock > item.reorderLevel * 1.2);

  return { critical, low, normal, total: inventory.length };
};

// Expense Reports Functions
export const getHighCostItems = (expenses, limit = 10) => {
  const itemCosts = {};

  expenses.forEach(expense => {
    const itemName = expense.item || expense.description || 'Unknown';
    const amount = expense.amount || 0;

    if (!itemCosts[itemName]) {
      itemCosts[itemName] = { name: itemName, total: 0, count: 0 };
    }
    itemCosts[itemName].total += amount;
    itemCosts[itemName].count += 1;
  });

  return Object.values(itemCosts)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};

// Profitability Functions
export const getCostPerOrder = (expenses, orders) => {
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const paidOrders = orders.filter(order => order.paymentStatus === 'Paid').length;
  return paidOrders > 0 ? totalExpenses / paidOrders : 0;
};

export const getROIOnAds = (orders, expenses) => {
  const adOrders = orders.filter(order =>
    (order.orderSource === 'Ad' || !order.orderSource) && order.paymentStatus === 'Paid'
  );
  const adRevenue = adOrders.reduce((sum, order) => sum + (order.totalPrice || order.totalAmount || 0), 0);

  // Assume marketing expenses are expenses with category containing "marketing" or "ad"
  const adExpenses = expenses
    .filter(expense => {
      const category = (expense.category || '').toLowerCase();
      return category.includes('marketing') || category.includes('ad') || category.includes('advertising');
    })
    .reduce((sum, expense) => sum + (expense.amount || 0), 0);

  const roi = adExpenses > 0 ? ((adRevenue - adExpenses) / adExpenses) * 100 : 0;
  return { adRevenue, adExpenses, roi, adOrders: adOrders.length };
};

