import { useState, useEffect, useMemo } from 'react'
import { Package, TrendingUp, AlertTriangle, Calendar, CreditCard, X, ShoppingBag, BarChart2, PieChart as PieChartIcon, Activity } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar, LabelList
} from 'recharts'
import SummaryCard from './SummaryCard'
import {
  calculateNetProfit,
  getPendingDispatch
} from '../utils/calculations'
import { getTopSellingProducts, formatCurrency } from '../utils/reportUtils'

const Dashboard = ({ orders, expenses, inventory = [], products, onNavigate }) => {
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  })
  const [showDateFilter, setShowDateFilter] = useState(false)

  // Get today's date for default end date
  const today = new Date().toISOString().split('T')[0]
  // Get 30 days ago for default start date
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0]

  // Filter orders and expenses by date range
  const filterByDateRange = (items, dateField) => {
    if (!dateFilter.startDate && !dateFilter.endDate) {
      return items
    }

    return items.filter(item => {
      const itemDate = item[dateField] || item.createdDate || ''
      if (!itemDate) return false

      const date = new Date(itemDate)
      const start = dateFilter.startDate ? new Date(dateFilter.startDate) : null
      const end = dateFilter.endDate ? new Date(dateFilter.endDate) : null

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

  // Calculate total value of pending dispatch orders
  const pendingDispatchValue = pendingDispatch.reduce((sum, order) => {
    const totalPrice = order.totalPrice || order.totalAmount || 0
    return sum + totalPrice
  }, 0)

  // Calculate Pending Payments (only dispatched orders with pending payment)
  const pendingPayments = filteredOrders.filter(order => {
    const status = order.status || 'Pending'
    const paymentStatus = order.paymentStatus || 'Pending'
    return status === 'Dispatched' && paymentStatus !== 'Paid'
  })

  const pendingPaymentsAmount = pendingPayments.reduce((sum, order) => {
    const totalPrice = order.totalPrice || order.totalAmount || 0
    return sum + totalPrice
  }, 0)

  // Calculate Critical Inventory Items (below reorder level)
  const criticalItems = inventory.filter(item => item.currentStock < item.reorderLevel)

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

  // 1. Trend Data: Daily Revenue vs Expenses
  const trendData = useMemo(() => {
    const dataMap = {}

    // Group Revenue by Date
    filteredOrders.forEach(order => {
      if (order.paymentStatus !== 'Paid') return
      const date = order.orderDate || order.createdDate || ''
      if (!date) return
      const dateKey = date.split('T')[0]
      if (!dataMap[dateKey]) dataMap[dateKey] = { date: dateKey, revenue: 0, expenses: 0 }
      dataMap[dateKey].revenue += Number(order.totalPrice || order.totalAmount || 0)
    })

    // Group Expenses by Date
    filteredExpenses.forEach(expense => {
      const date = expense.date || ''
      if (!date) return
      const dateKey = date.split('T')[0]
      if (!dataMap[dateKey]) dataMap[dateKey] = { date: dateKey, revenue: 0, expenses: 0 }
      dataMap[dateKey].expenses += Number(expense.amount || 0)
    })

    // Convert map to sorted array
    return Object.values(dataMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        // Format date for display: Dec 15
        displayName: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }))
  }, [filteredOrders, filteredExpenses])

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

  // Custom Label for Pie Chart (Donut Style)
  const renderCustomizedLabel = (props) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, name, fill } = props
    const RADIAN = Math.PI / 180
    const sin = Math.sin(-midAngle * RADIAN)
    const cos = Math.cos(-midAngle * RADIAN)
    const sx = cx + (outerRadius + 0) * cos
    const sy = cy + (outerRadius + 0) * sin
    const mx = cx + (outerRadius + 30) * cos
    const my = cy + (outerRadius + 30) * sin
    const ex = mx + (cos >= 0 ? 1 : -1) * 20
    const ey = my
    const textAnchor = cos >= 0 ? 'start' : 'end'

    return (
      <g>
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={-6} textAnchor={textAnchor} fill={fill} style={{ fontWeight: 700, fontSize: '14px' }}>
          {value}
        </text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={14} textAnchor={textAnchor} fill="var(--text-muted)" style={{ fontSize: '12px' }}>
          {name}
        </text>
      </g>
    )
  }

  // Calculate Total Orders into a value for the center text
  const totalOrdersCount = sourceData.reduce((sum, item) => sum + item.value, 0)


  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          padding: '12px',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px', color: 'var(--text-primary)' }}>{label}</p>
          {payload.map((entry, index) => {
            const isCurrency = ['Revenue', 'Expenses', 'Value'].includes(entry.name);
            const value = entry.value;
            const revenue = entry.payload?.revenue;

            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <p style={{ margin: 0, color: entry.color, fontSize: '0.85rem', fontWeight: 600 }}>
                  {entry.name}: {isCurrency ? 'Rs. ' : ''}{value.toLocaleString()}{!isCurrency ? ' Units' : ''}
                </p>
                {revenue && !isCurrency && (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Revenue: Rs. {revenue.toLocaleString()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    return null
  }

  // Calculate Total Orders for Current Month using Reports ROI logic
  const getOrdersCountBySource = () => {
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()

    const monthOrders = filteredOrders.filter(order => {
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
      const d = o.deliveryDate
      if (!d) return false
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return false
      return dt >= start && dt <= end
    }).sort((a, b) => new Date(a.deliveryDate) - new Date(b.deliveryDate))
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

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const clearDateFilter = () => {
    setDateFilter({
      startDate: '',
      endDate: ''
    })
  }

  const hasDateFilter = dateFilter.startDate || dateFilter.endDate

  return (
    <div className="dashboard-container">
      <div style={{ marginBottom: window.innerWidth < 600 ? '1.5rem' : '2.5rem' }}>
        <div className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{
              fontSize: window.innerWidth < 600 ? '1.75rem' : '2.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem',
              letterSpacing: '-0.02em'
            }}>
              Overview
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: window.innerWidth < 600 ? '0.85rem' : '1rem' }}>
              Real-time business performance metrics
            </p>
          </div>

          <div className="header-actions" style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            width: window.innerWidth < 600 ? '100%' : 'auto'
          }}>
            {showDateFilter && (
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.5rem',
                backgroundColor: 'var(--bg-card)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                width: window.innerWidth < 600 ? '100%' : 'auto',
                justifyContent: 'space-between'
              }}>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => handleDateFilterChange('startDate', e.target.value)}
                  className="form-input"
                  style={{ flex: 1, minWidth: '0', height: '36px', fontSize: '0.8rem', padding: '0.25rem' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>—</span>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => handleDateFilterChange('endDate', e.target.value)}
                  className="form-input"
                  style={{ flex: 1, minWidth: '0', height: '36px', fontSize: '0.8rem', padding: '0.25rem' }}
                />
              </div>
            )}
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className="btn btn-secondary"
              style={{
                height: '42px',
                padding: '0 1.25rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flex: window.innerWidth < 600 ? 1 : 'none',
                justifyContent: 'center'
              }}
            >
              <Calendar size={18} />
              <span>{showDateFilter ? 'Hide Filter' : 'Date Range'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Section: Quick KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2.5rem'
      }}>
        <SummaryCard
          title="Total Orders"
          value={totalOrdersThisMonth}
          icon={ShoppingBag}
          color="var(--accent-primary)"
          subtitle={`Ads: ${adsCount} | Organic: ${organicCount}`}
          onClick={() => onNavigate && onNavigate('orders')}
        />
        <SummaryCard
          title="Pending to Dispatch"
          value={pendingDispatch.length}
          icon={Package}
          color="var(--warning)"
          subtitle={`Rs.${pendingDispatchValue.toLocaleString('en-IN')} value`}
          onClick={() => onNavigate && onNavigate('orders', { statusFilter: 'pendingDispatch' })}
        />
        <SummaryCard
          title="Net Profit"
          value={`Rs.${netProfit.toLocaleString('en-IN')}`}
          icon={TrendingUp}
          color="var(--success)"
          subtitle={`Sales: Rs.${netSales.toLocaleString('en-IN')} | Expenses: Rs.${netExpenses.toLocaleString('en-IN')}`}
        />
        <SummaryCard
          title="Pending Payments"
          value={`Rs.${pendingPaymentsAmount.toLocaleString('en-IN')}`}
          icon={CreditCard}
          color="var(--danger)"
          subtitle={`${pendingPayments.length} open invoices`}
          onClick={() => onNavigate && onNavigate('orders', { statusFilter: 'Dispatched', paymentFilter: 'Pending' })}
        />
      </div>


      {/* Middle Section: Deliveries and Alerts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        marginBottom: '2.5rem'
      }}>
        <div className="card" style={{ padding: window.innerWidth < 600 ? '1.25rem' : '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: window.innerWidth < 600 ? '1.1rem' : '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={20} color="var(--accent-primary)" />
              Scheduled Deliveries
            </h3>
            <button
              onClick={() => onNavigate('orders', { scheduledDeliveries: true })}
              style={{ background: 'transparent', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600 }}
            >
              View All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {upcomingScheduledDeliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No deliveries scheduled for the next 3 days
              </div>
            ) : (
              upcomingScheduledDeliveries.slice(0, 4).map(delivery => (
                <div key={delivery.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  flexDirection: window.innerWidth < 400 ? 'column' : 'row',
                  alignItems: window.innerWidth < 400 ? 'flex-start' : 'center',
                  gap: window.innerWidth < 400 ? '0.75rem' : '0'
                }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>{delivery.customerName}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{delivery.nearestCity} • Order #{delivery.id}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.6rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      borderRadius: '20px',
                      fontWeight: 600
                    }}>
                      {new Date(delivery.deliveryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ padding: window.innerWidth < 600 ? '1.25rem' : '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: window.innerWidth < 600 ? '1.1rem' : '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={20} color="var(--warning)" />
              Low Stock Alerts
            </h3>
            <button
              onClick={() => onNavigate('inventory', { stockFilter: 'below' })}
              style={{ background: 'transparent', color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 600 }}
            >
              Inventory
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {criticalItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                All inventory levels are healthy
              </div>
            ) : (
              criticalItems.slice(0, 4).map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
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
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Category: {item.categoryName}</p>
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
        {/* Trend Area Chart */}
        <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--accent-primary)" />
            Profit Trend
          </h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="displayName" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="var(--danger)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Pie Chart */}
        <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChartIcon size={18} color="var(--success)" />
            Order Sources
          </h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  innerRadius={80}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={2}
                >
                  {sourceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                  <tspan x="50%" dy="-0.5em" fontSize="24" fontWeight="bold" fill="var(--text-primary)">
                    {totalOrdersCount}
                  </tspan>
                  <tspan x="50%" dy="1.5em" fontSize="14" fill="var(--text-muted)">
                    Total Orders
                  </tspan>
                </text>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ fontSize: '0.85rem' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products Chart */}
        <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} color="var(--warning)" />
            Top Selling Products
          </h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topSellingProducts.slice(0, 5)}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <defs>
                  {CHART_COLORS.map((color, index) => (
                    <linearGradient key={`barGrad-${index}`} id={`barGrad-${index}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.3} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
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
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', backdropFilter: 'blur(10px)' }}>
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
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Dashboard
