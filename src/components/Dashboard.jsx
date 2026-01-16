import { useState, useEffect, useMemo } from 'react'
import { Package, TrendingUp, AlertTriangle, Calendar, CreditCard, X, ShoppingBag, BarChart2, PieChart as PieChartIcon, Activity, Lock, Crown } from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, BarChart, Bar, LabelList
} from 'recharts'
import BaseAreaChart from './Common/Charts/BaseAreaChart'
import BaseDonutChart from './Common/Charts/BaseDonutChart'
import { startOfMonth, endOfMonth, format, subMonths, subDays, differenceInDays } from 'date-fns'
import SummaryCard from './SummaryCard'
import {
  calculateNetProfit,
  getPendingDispatch
} from '../utils/calculations'
import { getTotalMonthlyRecordsCount } from '../utils/storage'
import { getTopSellingProducts, formatCurrency } from '../utils/reportUtils'
import { COLORS, tooltipStyle, renderDonutLabel, chartTheme, CustomTooltip } from './Reports/ChartConfig'
import { useLicensing } from './LicensingContext'
import ProFeatureLock, { ProFeatureBadge } from './ProFeatureLock'
import CollapsibleDateFilter from './Common/CollapsibleDateFilter'


import { useTheme } from './ThemeContext'

const Dashboard = ({ orders, expenses, inventory = [], products, onNavigate }) => {
  const { isFreeUser } = useLicensing()
  const { effectiveTheme } = useTheme()
  const [monthlyRecords, setMonthlyRecords] = useState(0)

  useEffect(() => {
    if (isFreeUser) {
      getTotalMonthlyRecordsCount().then(setMonthlyRecords)
    }
  }, [isFreeUser, orders.length]) // Refresh when orders list changes

  // --- Filter State ---
  const [filterType, setFilterType] = useState('month') // 'month' or 'range'
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  })


  // Calculate effective date range for filtering
  const { effectiveStartDate, effectiveEndDate } = useMemo(() => {
    if (filterType === 'month') {
      const date = new Date(selectedMonth + '-01')
      return {
        effectiveStartDate: format(startOfMonth(date), 'yyyy-MM-dd'),
        effectiveEndDate: format(endOfMonth(date), 'yyyy-MM-dd')
      }
    }
    return {
      effectiveStartDate: dateRange.startDate,
      effectiveEndDate: dateRange.endDate
    }
  }, [filterType, selectedMonth, dateRange])

  // Filter orders and expenses by date range
  const filterByDateRange = (items, dateField) => {
    if (!effectiveStartDate && !effectiveEndDate) {
      return items
    }

    const start = effectiveStartDate ? new Date(effectiveStartDate) : null
    if (start) start.setHours(0, 0, 0, 0)

    const end = effectiveEndDate ? new Date(effectiveEndDate) : null
    if (end) end.setHours(23, 59, 59, 999)

    return items.filter(item => {
      const itemDate = item[dateField] || item.createdDate || ''
      if (!itemDate) return false

      const date = new Date(itemDate)

      if (start && end) {
        return date >= start && date <= end
      } else if (start) {
        return date >= start
      } else if (end) {
        return date <= end
      }
      return true
    })
  }

  const filteredOrders = filterByDateRange(orders, 'createdDate')
  const filteredExpenses = filterByDateRange(expenses, 'date')

  const pendingDispatch = getPendingDispatch(filteredOrders)
  const netProfit = calculateNetProfit(filteredOrders, filteredExpenses)

  // Calculate Net Sales (total revenue from paid orders)
  const netSales = filteredOrders
    .filter(order => order.paymentStatus === 'Paid')
    .reduce((sum, order) => {
      const totalPrice = order.totalPrice || order.totalAmount || 0
      return sum + totalPrice
    }, 0)

  // Calculate Net Expenses
  const netExpenses = filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)

  // --- Value Trend Indicators ---
  const { prevStartDate, prevEndDate, prevLabel } = useMemo(() => {
    if (filterType === 'month') {
      const currentMonthStart = new Date(selectedMonth + '-01')
      const prevMonthStart = subMonths(currentMonthStart, 1)
      return {
        prevStartDate: format(startOfMonth(prevMonthStart), 'yyyy-MM-dd'),
        prevEndDate: format(endOfMonth(prevMonthStart), 'yyyy-MM-dd'),
        prevLabel: 'vs last month'
      }
    } else if (effectiveStartDate && effectiveEndDate) {
      const start = new Date(effectiveStartDate)
      const end = new Date(effectiveEndDate)
      const duration = differenceInDays(end, start) + 1
      const prevEnd = subDays(start, 1)
      const prevStart = subDays(prevEnd, duration - 1)
      return {
        prevStartDate: format(prevStart, 'yyyy-MM-dd'),
        prevEndDate: format(prevEnd, 'yyyy-MM-dd'),
        prevLabel: 'vs previous period'
      }
    }
    return { prevStartDate: null, prevEndDate: null, prevLabel: '' }
  }, [filterType, selectedMonth, effectiveStartDate, effectiveEndDate])

  const prevFilteredOrders = useMemo(() => {
    if (!prevStartDate || !prevEndDate) return []
    const start = new Date(prevStartDate); start.setHours(0, 0, 0, 0)
    const end = new Date(prevEndDate); end.setHours(23, 59, 59, 999)
    return orders.filter(item => {
      const d = new Date(item.createdDate || '')
      return d >= start && d <= end
    })
  }, [orders, prevStartDate, prevEndDate])

  const prevFilteredExpenses = useMemo(() => {
    if (!prevStartDate || !prevEndDate) return []
    const start = new Date(prevStartDate); start.setHours(0, 0, 0, 0)
    const end = new Date(prevEndDate); end.setHours(23, 59, 59, 999)
    return expenses.filter(item => {
      const d = new Date(item.date || '')
      return d >= start && d <= end
    })
  }, [expenses, prevStartDate, prevEndDate])

  const prevNetSales = prevFilteredOrders
    .filter(order => order.paymentStatus === 'Paid')
    .reduce((sum, order) => sum + (order.totalPrice || order.totalAmount || 0), 0)

  const prevNetExpenses = prevFilteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const prevNetProfit = calculateNetProfit(prevFilteredOrders, prevFilteredExpenses)

  const calculateTrend = (current, previous) => {
    if (!previous && current > 0) return { value: 100, isPositive: true, label: prevLabel }
    if (!previous) return { value: 0, isPositive: true, label: prevLabel }
    const diff = current - previous
    const percent = (diff / previous) * 100
    return {
      value: percent.toFixed(1),
      isPositive: diff >= 0,
      label: prevLabel
    }
  }

  const salesTrend = calculateTrend(netSales, prevNetSales)
  const expensesTrend = calculateTrend(netExpenses, prevNetExpenses)
  // For expenses: Decrease is good (Green/Positive visually), Increase is bad (Red/Negative visually)
  const expensesTrendVisual = {
    ...expensesTrend,
    isPositive: Number(expensesTrend.value) <= 0
  }
  const profitTrend = calculateTrend(netProfit, prevNetProfit)

  const ordersTrend = calculateTrend(
    filteredOrders.filter(o => !['cancelled', 'returned'].includes((o.status || '').toLowerCase())).length,
    prevFilteredOrders.filter(item => !['cancelled', 'returned'].includes((item.status || '').toLowerCase())).length
  )

  // Calculate total value of pending dispatch orders
  const pendingDispatchValue = pendingDispatch.reduce((sum, order) => {
    const totalPrice = order.totalPrice || order.totalAmount || 0
    return sum + totalPrice
  }, 0)

  // Calculate Pending Payments (only dispatched orders with pending payment)
  const pendingPayments = (orders || []).filter(order => {
    const status = order.status || 'Pending'
    const paymentStatus = order.paymentStatus || 'Pending'
    return status === 'Dispatched' && paymentStatus !== 'Paid'
  })

  const pendingPaymentsAmount = pendingPayments.reduce((sum, order) => {
    const totalPrice = order.totalPrice || order.totalAmount || 0
    return sum + totalPrice
  }, 0)

  // Calculate Critical Inventory Items (at or below reorder level)
  const criticalItems = inventory.filter(item => item.currentStock <= item.reorderLevel)

  // Generate subtitle for critical items
  const getCriticalItemsSubtitle = () => {
    if (criticalItems.length === 0) {
      return 'No critical items'
    }
    if (criticalItems.length === 1) {
      return criticalItems[0].itemName
    }
    if (criticalItems.length <= 3) {
      return criticalItems.map(item => item.itemName).join(', ')
    }
    // Show first 3 items and count of remaining
    const firstThree = criticalItems.slice(0, 3).map(item => item.itemName).join(', ')
    const remaining = criticalItems.length - 3
    return `${firstThree} and ${remaining} more`
  }

  // --- Chart Data Transformations ---

  // 1. Trend Data: Daily Orders
  const trendData = useMemo(() => {
    const dataMap = {}

    filteredOrders.forEach(order => {
      const date = order.orderDate || order.createdDate || ''
      if (!date) return
      const dateKey = date.split('T')[0]
      if (!dataMap[dateKey]) dataMap[dateKey] = { date: dateKey, orders: 0, revenue: 0 }
      dataMap[dateKey].orders += 1
      dataMap[dateKey].revenue += Number(order.totalPrice || order.totalAmount || 0)
    })

    // Convert map to sorted array
    return Object.values(dataMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        // Format date for display: Dec 15
        displayName: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }))
  }, [filteredOrders])

  // 2. Source Distribution: Ad vs Organic
  const sourceData = useMemo(() => {
    const sources = filteredOrders.reduce((acc, order) => {
      const source = order.orderSource || 'Ad'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})

    return Object.entries(sources).map(([name, value]) => ({
      name: name,
      value: value
    }))
  }, [filteredOrders])

  // 3. Top Selling Products (Clone of Sales Report Logic)
  const topSellingProducts = useMemo(() => {
    return getTopSellingProducts(orders, inventory, products)
  }, [orders, inventory, products])

  // Removed local renderCustomizedLabel in favor of shared renderDonutLabel from ChartConfig

  // Calculate Total Orders into a value for the center text
  const totalOrdersCount = sourceData.reduce((sum, item) => sum + item.value, 0)




  // Calculate Total Orders for Current Month using Reports ROI logic
  const getOrdersCountBySource = () => {
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    const monthOrders = filteredOrders.filter(order => {
      // 1. Valid Status Filter (Crucial Fix)
      const status = (order.status || '').toLowerCase()
      if (status === 'cancelled' || status === 'returned') return false

      // Logic matching Reports ROI period filtering
      const orderDate = new Date(order.orderDate || order.createdDate || order.dispatchDate || '')
      return orderDate.getFullYear() === currentYear && orderDate.getMonth() === currentMonth
    })

    // Classification matching Reports isAdSourceKey logic
    const isAdSource = (source) => {
      const k = (source || '').toLowerCase().trim()
      return k === 'ad' || k === 'ads' || k.includes('ad') || k.includes('facebook') || k.includes('fb') || k.includes('meta') || k.includes('instagram') || k.includes('ig')
    }

    const adsCount = monthOrders.filter(o => isAdSource(o.orderSource)).length
    const organicCount = monthOrders.length - adsCount

    return {
      totalCount: monthOrders.length,
      adsCount,
      organicCount
    }
  }

  const { totalCount: totalOrdersThisMonth, adsCount, organicCount } = getOrdersCountBySource()

  // Scheduled deliveries: orders with a future deliveryDate within next 3 days
  const getUpcomingScheduledDeliveries = () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 3)
    end.setHours(23, 59, 59, 999)

    return (orders || []).filter(o => {
      // Exclude orders that are already processed/dispatched
      if (['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(o.status)) return false

      const d = o.scheduledDeliveryDate || o.deliveryDate
      if (!d) return false
      const dt = new Date(d)
      // Include anything from the past up to 3 days in the future
      return dt <= end
    }).sort((a, b) => new Date(a.scheduledDeliveryDate || a.deliveryDate) - new Date(b.scheduledDeliveryDate || b.deliveryDate))
  }

  const upcomingScheduledDeliveries = getUpcomingScheduledDeliveries()

  const getScheduledSubtitle = () => {
    if (upcomingScheduledDeliveries.length === 0) return 'No deliveries in next 3 days'
    const names = upcomingScheduledDeliveries
      .slice(0, 3)
      .map(o => o.customerName || o.id)
      .filter(Boolean)
    const extra = upcomingScheduledDeliveries.length - names.length
    return extra > 0 ? `${names.join(', ')} and ${extra} more` : names.join(', ')
  }



  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div className="page-header-info">
          <h1>Overview</h1>
          <p>Real-time business performance metrics</p>
        </div>
        <div className="page-header-actions">
          <CollapsibleDateFilter
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onRangeChange={setDateRange}
            align="right"
            onReset={() => {
              setFilterType('month')
              setSelectedMonth(format(new Date(), 'yyyy-MM'))
              setDateRange({
                startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
              })
            }}
          />
        </div>
      </div>

      {/* Top Section: Quick KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        {isFreeUser && (
          <div className="card" style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, var(--bg-card), rgba(var(--accent-rgb), 0.05))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-primary)'
                }}>
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Monthly Orders</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Free Plan Usage</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{monthlyRecords}</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 600 }}>/30</span>
              </div>
            </div>

            <div style={{
              height: '10px',
              backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '0.75rem',
              border: '1px solid rgba(var(--accent-rgb), 0.05)'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (monthlyRecords / 30) * 100)}%`,
                backgroundColor: monthlyRecords >= 30 ? 'var(--error)' : 'var(--accent-primary)',
                transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: monthlyRecords >= 30 ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 0 12px rgba(var(--accent-rgb), 0.4)'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 500, color: monthlyRecords >= 25 ? 'var(--error)' : 'var(--text-muted)' }}>
                {monthlyRecords >= 30 ? 'Limit reached' : `${30 - monthlyRecords} remaining this month`}
              </p>
              <button
                onClick={() => onNavigate('contact')}
                style={{
                  background: 'rgba(var(--accent-rgb), 0.1)', border: 'none',
                  color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', padding: '6px 12px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
                  e.currentTarget.style.color = 'white'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--accent-rgb), 0.1)'
                  e.currentTarget.style.color = 'var(--accent-primary)'
                }}
              >
                <Crown size={14} /> Upgrade
              </button>
            </div>
          </div>
        )}
        <SummaryCard
          title="Total Orders"
          value={totalOrdersThisMonth}
          icon={ShoppingBag}
          color="var(--accent-primary)"
          subtitle={`Ads: ${adsCount} | Organic: ${organicCount}`}
          trend={ordersTrend}
          onClick={() => onNavigate && onNavigate('orders')}
          disabled={totalOrdersThisMonth === 0}
        />
        <SummaryCard
          title="Pending to Dispatch"
          value={pendingDispatch.length}
          icon={Package}
          color="var(--warning)"
          subtitle={`Rs.${pendingDispatchValue.toLocaleString('en-IN')} value`}
          onClick={() => onNavigate && onNavigate('orders', { statusFilter: 'pendingDispatch' })}
          disabled={pendingDispatch.length === 0}
        />
        <SummaryCard
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              Net Profit
              <ProFeatureBadge size={14} />
            </div>
          }
          value={
            isFreeUser ? "Pro Feature" : (
              <span style={{ color: Number(netProfit) < 0 ? 'var(--danger)' : 'inherit' }}>
                {`Rs.${netProfit.toLocaleString('en-IN')}`}
              </span>
            )
          }
          icon={TrendingUp}
          color="var(--success)"
          subtitle={isFreeUser ? "Includes expense tracking" : `Sales: Rs.${netSales.toLocaleString('en-IN')} | Expenses: Rs.${netExpenses.toLocaleString('en-IN')}`}
          trend={profitTrend}
          disabled={isFreeUser}
        />
        <SummaryCard
          title="Pending Payments"
          value={`Rs.${pendingPaymentsAmount.toLocaleString('en-IN')}`}
          icon={CreditCard}
          color="var(--danger)"
          subtitle={`${pendingPayments.length} open invoices`}
          onClick={() => onNavigate && onNavigate('orders', { statusFilter: 'Dispatched', paymentFilter: 'Pending' })}
          disabled={pendingPayments.length === 0}
        />
      </div>


      {/* Middle Section: Deliveries and Alerts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        marginBottom: '2.5rem'
      }}>
        <div className="card" style={{
          padding: window.innerWidth < 600 ? '1.25rem' : '1.75rem',
          backgroundColor: (isFreeUser || upcomingScheduledDeliveries.length === 0) ? 'rgba(255, 255, 255, 0.02)' : undefined,
          border: (isFreeUser || upcomingScheduledDeliveries.length === 0) ? '1px solid rgba(255, 255, 255, 0.05)' : undefined,
          opacity: (isFreeUser || upcomingScheduledDeliveries.length === 0) ? 0.7 : 1
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{
              fontSize: window.innerWidth < 600 ? '1.1rem' : '1.25rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: upcomingScheduledDeliveries.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)'
            }}>
              <Calendar size={20} color={upcomingScheduledDeliveries.length === 0 ? "var(--text-muted)" : "var(--accent-primary)"} style={{ opacity: upcomingScheduledDeliveries.length === 0 ? 0.5 : 1 }} />
              Scheduled Deliveries
              <ProFeatureBadge size={16} />
            </h3>
            {upcomingScheduledDeliveries.length > 0 && !isFreeUser && (
              <button
                onClick={() => onNavigate('orders', { scheduledDeliveries: true })}
                style={{ background: 'transparent', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600 }}
              >
                View All
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isFreeUser ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Crown size={32} style={{ marginBottom: '1rem', opacity: 0.5, color: 'var(--accent-primary)' }} />
                <p>Scheduled deliveries tracking is a Pro feature</p>
              </div>
            ) : upcomingScheduledDeliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No deliveries scheduled for the next 3 days
              </div>
            ) : (
              upcomingScheduledDeliveries.slice(0, 4).map(delivery => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const dateToDisplay = delivery.scheduledDeliveryDate || delivery.deliveryDate
                const isOverdue = new Date(dateToDisplay) < today

                return (
                  <div key={delivery.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: isOverdue ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                    flexDirection: window.innerWidth < 400 ? 'column' : 'row',
                    alignItems: window.innerWidth < 400 ? 'flex-start' : 'center',
                    gap: window.innerWidth < 400 ? '0.75rem' : '0'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem', color: isOverdue ? 'var(--danger)' : 'inherit' }}>{delivery.customerName}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{delivery.nearestCity} • Order #{delivery.id}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.6rem',
                        backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                        color: isOverdue ? 'var(--danger)' : 'var(--accent-primary)',
                        borderRadius: '20px',
                        fontWeight: 600
                      }}>
                        {new Date(dateToDisplay).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="card" style={{
            padding: window.innerWidth < 600 ? '1.25rem' : '1.75rem',
            backgroundColor: (isFreeUser || criticalItems.length === 0) ? 'rgba(255, 255, 255, 0.02)' : undefined,
            border: (isFreeUser || criticalItems.length === 0) ? '1px solid rgba(255, 255, 255, 0.05)' : undefined,
            opacity: (isFreeUser || criticalItems.length === 0) ? 0.7 : 1,
            height: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: window.innerWidth < 600 ? '1.1rem' : '1.25rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                color: criticalItems.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)'
              }}>
                <AlertTriangle size={20} color={criticalItems.length === 0 ? "var(--text-muted)" : "var(--warning)"} style={{ opacity: criticalItems.length === 0 ? 0.5 : 1, marginRight: '0.75rem' }} />
                Low Stock Alerts
                <ProFeatureBadge size={16} />
              </h3>
              {criticalItems.length > 0 && !isFreeUser && (
                <button
                  onClick={() => onNavigate('inventory', { stockFilter: 'below' })}
                  style={{ background: 'transparent', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  Inventory
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {isFreeUser ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <Crown size={32} style={{ marginBottom: '1rem', opacity: 0.5, color: 'var(--accent-primary)' }} />
                  <p>Inventory management is a Pro feature</p>
                </div>
              ) : criticalItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  All inventory levels are healthy
                </div>
              ) : (
                criticalItems.slice(0, 4).map(item => (
                  <div key={item.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.1)',
                    flexDirection: window.innerWidth < 400 ? 'column' : 'row',
                    alignItems: window.innerWidth < 400 ? 'flex-start' : 'center',
                    gap: window.innerWidth < 400 ? '0.75rem' : '0'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>{item.itemName}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: {item.category || 'Uncategorized'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--danger)' }}>{item.currentStock} left</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Level: {item.reorderLevel}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Business Insights Charts - Moved to Bottom */}
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        margin: '2rem 0 1.5rem 0',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--text-primary)'
      }}>
        <Activity size={20} color="var(--accent-primary)" />
        Business Insights
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
        gap: '2rem',
        marginBottom: '2.5rem'
      }}>
        {/* Daily Orders Area Chart */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--accent-primary)" />
            Daily Orders
          </h3>
          <BaseAreaChart
            data={trendData}
            dataKey="orders"
            xAxisKey="displayName"
            color="var(--accent-primary)"
            gradientId="colorOrders"
            height={300}
            tooltipFormatter={(val) => val}
          />
        </div>

        {/* Source Pie Chart */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChartIcon size={18} color="var(--success)" />
            Order Sources
          </h3>
          <BaseDonutChart
            data={sourceData}
            centerLabel="Total Orders"
            centerValue={totalOrdersCount}
            height={300}
            tooltipFormatter={(val) => val}
          />
        </div>

        {/* Top Selling Products Chart */}
        <div style={{ position: 'relative' }}>
          <div className="card" style={{
            padding: '1.5rem',
            backgroundColor: isFreeUser ? 'rgba(255, 255, 255, 0.02)' : undefined,
            opacity: isFreeUser ? 0.7 : 1,
            height: '100%'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center' }}>
              <BarChart2 size={18} color="var(--warning)" style={{ marginRight: '0.5rem' }} />
              Top Selling Products
              <ProFeatureBadge size={14} />
            </h3>
            {!isFreeUser ? (
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={topSellingProducts.slice(0, 5)}
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                    <defs>
                      {COLORS.map((color, index) => (
                        <linearGradient key={`barGrad-${index}`} id={`barGrad-${index}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.3} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid {...chartTheme.grid} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                    />
                    <Tooltip
                      cursor={chartTheme.tooltipCursor}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div style={tooltipStyle}>
                              <p style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '5px' }}>{data.name}</p>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '5px' }}>{data.category}</p>
                              <div style={{ display: 'flex', gap: '15px' }}>
                                <span style={{ color: 'var(--accent-primary)' }}>{data.quantity} Units</span>
                                <span style={{ color: 'var(--success)' }}>{formatCurrency(data.revenue)}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="quantity"
                      radius={[0, 4, 4, 0]}
                      barSize={24}
                    >
                      <LabelList dataKey="quantity" position="right" fill="var(--text-muted)" fontSize={11} formatter={(val) => `${val}`} />
                      {topSellingProducts.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Crown size={32} style={{ marginBottom: '1rem', opacity: 0.5, color: 'var(--accent-primary)' }} />
                <p>Top selling products analysis is a Pro feature</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default Dashboard
