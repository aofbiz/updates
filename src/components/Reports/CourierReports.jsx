import { useState, useMemo, useEffect } from 'react'
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { Truck, DollarSign, AlertTriangle, Clock, RefreshCw, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Filter, PackageCheck, Undo2, FileText } from 'lucide-react'
import { curfoxService } from '../../utils/curfox'
import { getSettings, saveOrders } from '../../utils/storage'
import { formatCurrency } from '../../utils/reportUtils'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const CourierReports = ({ isMobile, range, internalOrders = [], onUpdateOrders }) => {
    const [loading, setLoading] = useState(true)
    const [progress, setProgress] = useState({ loaded: 0, total: 0, stage: '' })
    const [orders, setOrders] = useState([])
    const [trackingData, setTrackingData] = useState([])
    const [financeData, setFinanceData] = useState([])
    const [error, setError] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [forceRefresh, setForceRefresh] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('All') // NEW
    const [currentPage, setCurrentPage] = useState(1) // NEW
    const itemsPerPage = 10 // NEW

    const [reconciliationList, setReconciliationList] = useState([])
    const [isUpdatingPayment, setIsUpdatingPayment] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                setProgress({ loaded: 0, total: 0, stage: 'Initializing...' })
                setError(null)
                const settings = await getSettings()
                const curfoxSettings = settings?.curfox || {}

                // Try to get cached auth first
                const authStr = localStorage.getItem('curfox_auth')
                const cachedAuth = authStr ? JSON.parse(authStr) : null

                let authData = {
                    tenant: cachedAuth?.tenant || curfoxSettings.tenant,
                    token: cachedAuth?.token,
                    businessId: curfoxSettings.businessId
                }

                // If no token, and integration is enabled, try to login
                if (!authData.token && curfoxSettings.enabled && curfoxSettings.email && curfoxSettings.password) {
                    try {
                        const loginRes = await curfoxService.login(curfoxSettings.email, curfoxSettings.password, curfoxSettings.tenant)
                        if (loginRes?.token) {
                            authData.token = loginRes.token
                            authData.tenant = curfoxSettings.tenant
                            localStorage.setItem('curfox_auth', JSON.stringify({ tenant: authData.tenant, token: authData.token }))
                        }
                    } catch (loginErr) {
                        console.error("Auto-login failed:", loginErr)
                    }
                }

                if (!authData.tenant || !authData.token) {
                    setError("Curfox not configured or connection failed. Please check integration settings.")
                    setLoading(false)
                    return
                }

                // 1. Fetch Orders
                setProgress({ loaded: 0, total: 0, stage: 'Fetching Orders...' })
                // Attempt to pass date range to API for better performance
                const params = {}
                if (range?.start) params.start_date = range.start
                if (range?.end) params.end_date = range.end

                const curfoxOrders = await curfoxService.getOrders(authData, params)
                console.log(`CourierReports: Fetched ${curfoxOrders.length} orders from Curfox`)
                if (curfoxOrders.length > 0) {
                    console.log('First Order Analysis:', {
                        keys: Object.keys(curfoxOrders[0]),
                        status: curfoxOrders[0].order_current_status?.name || curfoxOrders[0].status?.name || curfoxOrders[0].status,
                        cod: curfoxOrders[0].cod || curfoxOrders[0].cod_amount,
                        delivery: curfoxOrders[0].delivery_charge || curfoxOrders[0].freight_amount
                    })
                }
                setOrders(curfoxOrders)

                if (curfoxOrders.length > 0 || internalOrders.length > 0) {
                    // For Reports: Sample the last 100 waybills from Curfox
                    const MAX_SAMPLE = 100
                    const recentWaybills = curfoxOrders.slice(0, MAX_SAMPLE).map(o => o.waybill_number).filter(Boolean)

                    // For Reconciliation: Specifically target ALL internal orders that are Pending Payment
                    // This ensures we don't miss checking finance status for older orders
                    const pendingReconciliationWaybills = (internalOrders || [])
                        .filter(o => {
                            const s = (o.status || '').toLowerCase()
                            return o.paymentStatus !== 'Paid' &&
                                o.trackingNumber &&
                                o.trackingNumber.length > 5 &&
                                s !== 'cancelled' &&
                                s !== 'returned'
                        })
                        .map(o => o.trackingNumber)

                    // Combine and deduplicate
                    const waybills = [...new Set([...recentWaybills, ...pendingReconciliationWaybills])]

                    if (waybills.length === 0) {
                        setLoading(false)
                        return
                    }

                    setProgress({ loaded: 0, total: waybills.length * 2, stage: 'Fetching Details...' })

                    let completed = 0;
                    const updateProgress = (done, total) => {
                        completed += 1
                        setProgress(prev => ({
                            ...prev,
                            loaded: Math.min(prev.loaded + 1, prev.total)
                        }))
                    }

                    // 2. Fetch Finance & Tracking with progress
                    const onProgress = (c, t) => {
                        setProgress(prev => ({ ...prev, loaded: c + (prev.stage === 'Fetching Tracking...' ? t : 0) }))
                    }

                    setProgress({ loaded: 0, total: waybills.length, stage: 'Fetching Finance...' })
                    const finance = await curfoxService.bulkGetFinanceStatus(waybills, authData, (c, t) => {
                        setProgress({ loaded: c, total: t, stage: 'Fetching Finance...' })
                    }, forceRefresh)

                    setProgress({ loaded: 0, total: waybills.length, stage: 'Fetching Tracking...' })
                    const tracking = await curfoxService.bulkGetTracking(waybills, authData, (c, t) => {
                        setProgress({ loaded: c, total: t, stage: 'Fetching Tracking...' })
                    }, forceRefresh)

                    setFinanceData(finance)
                    setTrackingData(tracking)

                    if (forceRefresh) setForceRefresh(false)
                }

                setLoading(false)
            } catch (err) {
                console.error("Error loading courier reports:", err)
                setError("Failed to load data from Curfox.")
                setLoading(false)
            }
        }

        fetchData()
    }, [refreshKey, range?.start, range?.end])

    // --- Date Filtering (Local backup) ---
    const dateFilteredOrders = useMemo(() => {
        if (!range?.start || !range?.end) return orders
        const start = new Date(range.start)
        start.setHours(0, 0, 0, 0)
        const end = new Date(range.end)
        end.setHours(23, 59, 59, 999)

        return orders.filter(o => {
            const d = new Date(o.created_at)
            return d >= start && d <= end
        })
    }, [orders, range])

    // --- Report 1: Shipment Overview ---
    const shipmentStatusData = useMemo(() => {
        const counts = {}
        dateFilteredOrders.forEach(o => {
            // Exhaustive status check based on actual Royal Express / Curfox response structure
            const status = (
                o.order_current_status?.name ||
                o.status?.name ||
                (typeof o.status === 'string' ? o.status : null) ||
                o.status_name ||
                o.order_status?.name ||
                o.curr_status_name ||
                o.current_status ||
                'Unknown'
            )
            counts[status] = (counts[status] || 0) + 1
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value }))
    }, [orders])

    // --- Report 2: COD Ledger ---
    const codMetrics = useMemo(() => {
        let collected = 0
        let pending = 0
        let totalCollectedActual = 0

        dateFilteredOrders.forEach(o => {
            // Royal Express provides both 'cod' (ordered) and 'collected_cod' (actual)
            const codTarget = Number(o.cod || o.cod_amount || o.amount_to_collect || 0)
            const codActual = Number(o.collected_cod || 0)
            totalCollectedActual += codActual

            const financeStatus = o.finance_status || o.finance?.status || 'Pending'
            const statusName = (o.order_current_status?.name || '').toUpperCase()

            // If the status is DELIVERED or the finance status implies payment
            const isSettled =
                financeStatus === 'Deposited' ||
                financeStatus === 'Approved' ||
                statusName === 'DELIVERED' ||
                codActual > 0

            if (isSettled) {
                // If we have an actual collected amount, use it, otherwise use the COD target if delivered
                collected += (codActual > 0 ? codActual : codTarget)
            } else {
                pending += codTarget
            }
        })

        return {
            chartData: [
                { name: 'Collected', value: collected },
                { name: 'Pending', value: pending }
            ],
            totalCollectedActual
        }
    }, [orders])

    // --- Report 3: Shipping Spend ---
    const shippingSpendTotal = useMemo(() => {
        let totalSpend = 0
        dateFilteredOrders.forEach(o => {
            // Royal Express specifically uses 'delivery_charge'
            totalSpend += Number(
                o.delivery_charge ||
                o.freight_charge ||
                o.freight_amount ||
                o.total_delivery_charge ||
                0
            )
        })
        return totalSpend
    }, [orders])

    // --- Report 4: NDR Analysis ---
    const ndrData = useMemo(() => {
        const reasons = {}
        trackingData.forEach(t => {
            if (!t.history || !Array.isArray(t.history)) return
            const rtoEntry = t.history.find(h => {
                const s = h.status?.name || h.status || ''
                return s.toLowerCase().includes('rto') ||
                    s.toLowerCase().includes('fail') ||
                    s.toLowerCase().includes('return')
            })
            if (rtoEntry) {
                const reason = rtoEntry.remark || rtoEntry.status?.name || 'No Reason Provided'
                reasons[reason] = (reasons[reason] || 0) + 1
            }
        })
        return Object.entries(reasons).map(([name, value]) => ({ name, value }))
    }, [trackingData])

    // --- Report 5: Delivery Metrics (TAT) ---
    const tatMetrics = useMemo(() => {
        let totalTat = 0
        let count = 0
        trackingData.forEach(t => {
            if (!t.history || !Array.isArray(t.history)) return
            const created = t.history.find(h => (h.status?.name || h.status) === 'Created')
            const delivered = t.history.find(h => (h.status?.name || h.status) === 'Delivered')
            if (created && delivered) {
                const start = new Date(created.created_at)
                const end = new Date(delivered.created_at)
                totalTat += (end - start) / (1000 * 60 * 60 * 24) // in days
                count++
            }
        })
        return count > 0 ? (totalTat / count).toFixed(1) : 'N/A'
    }, [trackingData])

    // --- Report 6: Detailed Status Metrics ---
    const detailedMetrics = useMemo(() => {
        let pendingDelivery = { count: 0, amount: 0 }
        let delivered = { count: 0, amount: 0 }
        let toBeReturned = { count: 0, amount: 0 }
        let toBeInvoiced = { count: 0, amount: 0 }

        dateFilteredOrders.forEach(o => {
            const status = (
                o.order_current_status?.name ||
                o.status?.name ||
                (typeof o.status === 'string' ? o.status : null) ||
                'Unknown'
            ).toLowerCase()

            const cod = Number(o.cod || o.cod_amount || 0)
            const collected = Number(o.collected_cod || 0)
            const deliveryCharge = Number(o.delivery_charge || o.freight_amount || 0)

            // Look up finance status if available
            const finRecord = financeData.find(f => f.waybill_number === o.waybill_number)
            const financeStatus = (finRecord?.finance_status || finRecord?.status || o.finance_status || '').toLowerCase()

            // 1. To Be Returned (RTO)
            if (status.includes('return') || status.includes('rto') || status.includes('fail')) {
                toBeReturned.count++
                toBeReturned.amount += (cod > 0 ? cod : 0) // Value at risk
            }
            // 2. Delivered
            else if (status === 'delivered') {
                delivered.count++
                delivered.amount += (collected > 0 ? collected : cod)

                // 3. To Be Invoiced (Delivered but NOT Deposited/Approved)
                // "Deposited" usually means courier has paid us.
                const isSettled = financeStatus === 'deposited' || financeStatus === 'approved' || financeStatus.includes('paid')
                if (!isSettled) {
                    toBeInvoiced.count++
                    toBeInvoiced.amount += (collected > 0 ? collected : cod)
                }
            }
            // 4. Pending Delivery (In Transit, etc.)
            else if (status !== 'cancelled') {
                pendingDelivery.count++
                pendingDelivery.amount += cod
            }
        })

        return { pendingDelivery, delivered, toBeReturned, toBeInvoiced }
    }, [dateFilteredOrders, financeData])

    // --- Reconciliation Logic ---
    useEffect(() => {
        if (!internalOrders || internalOrders.length === 0 || !financeData || financeData.length === 0) {
            setReconciliationList([])
            return
        }

        const pendingInternal = internalOrders.filter(o => {
            const s = (o.status || '').toLowerCase()
            return (o.paymentStatus !== 'Paid') &&
                o.trackingNumber &&
                o.trackingNumber.length > 5 &&
                s !== 'cancelled' &&
                s !== 'returned'
        })

        const matches = []

        pendingInternal.forEach(internalOrder => {
            // Find corresponding finance record
            // Note: Curfox might use 'waybill_number' or match inside trackingData
            const financeRecord = financeData.find(f => f.waybill_number === internalOrder.trackingNumber)

            if (financeRecord) {
                const status = (financeRecord.finance_status || financeRecord.status || '').toLowerCase()
                // Check if paid in Curfox
                const isPaidInCurfox =
                    status === 'deposited' ||
                    status === 'approved' ||
                    status === 'collected' ||
                    status.includes('paid')

                if (isPaidInCurfox) {
                    matches.push({
                        internal: internalOrder,
                        finance: financeRecord,
                        amountMatch: Math.abs((Number(internalOrder.totalPrice) || 0) - (Number(financeRecord.cod_amount) || 0)) < 10
                    })
                }
            }
        })

        setReconciliationList(matches)
    }, [internalOrders, financeData])

    const handleMarkAsPaid = async (item) => {
        try {
            setIsUpdatingPayment(true)
            const updatedOrder = {
                ...item.internal,
                paymentStatus: 'Paid',
                // Maybe add a note or flag that it was auto-reconciled?
                notes: (item.internal.notes || '') + `\n[System] Marked as Paid via Courier Reconciliation on ${new Date().toLocaleDateString()}`
            }

            const success = await saveOrders([updatedOrder])
            if (success) {
                // Update global state
                if (onUpdateOrders) {
                    const newOrdersList = internalOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
                    onUpdateOrders(newOrdersList)
                }
                // Remove from local list immediately for UI responsiveness
                setReconciliationList(prev => prev.filter(i => i.internal.id !== item.internal.id))
            }
        } catch (err) {
            console.error("Failed to update payment status", err)
            // Ideally show toast here, but we don't have toast context injected easily unless passed or imported
            alert("Failed to update order status.")
        } finally {
            setIsUpdatingPayment(false)
        }
    }

    const handleMarkAllPaid = async () => {
        if (!confirm(`Are you sure you want to mark ${reconciliationList.length} orders as Paid?`)) return

        try {
            setIsUpdatingPayment(true)
            const updates = reconciliationList.map(item => ({
                ...item.internal,
                paymentStatus: 'Paid',
                notes: (item.internal.notes || '') + `\n[System] Bulk Paid via Courier Reconciliation on ${new Date().toLocaleDateString()}`
            }))

            const success = await saveOrders(updates)
            if (success) {
                if (onUpdateOrders) {
                    // Merge updates into full list
                    const updateMap = new Map(updates.map(u => [u.id, u]))
                    const newOrdersList = internalOrders.map(o => updateMap.has(o.id) ? updateMap.get(o.id) : o)
                    onUpdateOrders(newOrdersList)
                }
                setReconciliationList([])
            }
        } catch (err) {
            console.error("Failed to bulk update", err)
            alert("Failed to update orders.")
        } finally {
            setIsUpdatingPayment(false)
        }
    }


    // --- Search & Filter ---
    const uniqueStatuses = useMemo(() => {
        const statuses = new Set(dateFilteredOrders.map(o =>
            o.order_current_status?.name || o.status?.name || o.status || 'Unknown'
        ))
        return ['All', ...Array.from(statuses).sort()]
    }, [dateFilteredOrders])

    const filteredOrders = useMemo(() => {
        const q = searchQuery.toLowerCase()
        return dateFilteredOrders.filter(o => {
            // Text Search
            const matchesSearch =
                (o.waybill_number || '').toLowerCase().includes(q) ||
                (o.customer_name || '').toLowerCase().includes(q) ||
                (o.customer_phone || '').toLowerCase().includes(q) ||
                (o.order_no || '').toLowerCase().includes(q)

            // Status Filter
            const status = o.order_current_status?.name || o.status?.name || o.status || 'Unknown'
            const matchesStatus = statusFilter === 'All' || status === statusFilter

            return matchesSearch && matchesStatus
        }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    }, [dateFilteredOrders, searchQuery, statusFilter])

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredOrders.slice(start, start + itemsPerPage)
    }, [filteredOrders, currentPage, itemsPerPage])

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, statusFilter])

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .spin { animation: spin 1s linear infinite; }
                `}</style>
                <RefreshCw size={40} className="spin" style={{ color: 'var(--accent-primary)' }} />
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.5rem' }}>{progress.stage}</p>
                    {progress.total > 0 && progress.stage !== 'Fetching Orders...' && (
                        <div style={{ width: '200px', height: '6px', background: 'var(--bg-card)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${(progress.loaded / progress.total) * 100}%`,
                                height: '100%',
                                background: 'var(--accent-primary)',
                                transition: 'width 0.3s ease-out'
                            }} />
                        </div>
                    )}
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        {progress.total > 0 && progress.stage !== 'Fetching Orders...' ? `${progress.loaded} / ${progress.total}` : 'Please wait...'}
                    </p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                <AlertTriangle size={40} style={{ marginBottom: '1rem' }} />
                <p style={{ marginBottom: '1.5rem' }}>{error}</p>
                <button
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="btn btn-primary"
                    style={{ gap: '0.5rem' }}
                >
                    <RefreshCw size={18} /> Retry Fetch
                </button>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <style>{`
                .courier-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }
                .metrics-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }
                .metric-card {
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .refresh-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: -0.5rem;
                }
                .search-input {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    width: 100%;
                    max-width: 300px;
                    outline: none;
                    transition: all 0.2s;
                }
                .search-input:focus {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
                }
                .shipment-table-container {
                    width: 100%;
                    overflow-x: auto;
                    margin-top: 1rem;
                }
                .shipment-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }
                .shipment-table th {
                    text-align: left;
                    padding: 0.75rem 1rem;
                    color: var(--text-muted);
                    font-weight: 600;
                    border-bottom: 1px solid var(--border-color);
                }
                .shipment-table td {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid var(--border-color);
                }
                .status-badge {
                    padding: 0.2rem 0.6rem;
                    border-radius: 99px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
            `}</style>

            <div className="refresh-bar" style={{ justifyContent: 'flex-end' }}>
                <button
                    onClick={() => {
                        setForceRefresh(true)
                        setRefreshKey(k => k + 1)
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', gap: '0.4rem' }}
                >
                    <RefreshCw size={14} /> Refresh Live Data
                </button>
            </div>

            {/* Summary Metrics */}
            {/* Summary Metrics */}
            <div className="metrics-row">
                {/* 1. General Stats */}
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <Truck size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Total Shipments</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{dateFilteredOrders.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>All time</div>
                </div>
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <DollarSign size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Logistics Spend</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(shippingSpendTotal)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivery Charges</div>
                </div>

                {/* 2. New Detailed Cards */}
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <Clock size={16} color="#f59e0b" />
                        <span style={{ fontSize: '0.85rem' }}>Pending Delivery</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{detailedMetrics.pendingDelivery.count}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(detailedMetrics.pendingDelivery.amount)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Transit / Pickup</div>
                </div>

                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <PackageCheck size={16} color="#10b981" />
                        <span style={{ fontSize: '0.85rem' }}>Delivered Orders</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{detailedMetrics.delivered.count}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(detailedMetrics.delivered.amount)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Successfully Delivered</div>
                </div>

                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <FileText size={16} color="#8b5cf6" />
                        <span style={{ fontSize: '0.85rem' }}>To Be Invoiced</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{detailedMetrics.toBeInvoiced.count}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#8b5cf6' }}>{formatCurrency(detailedMetrics.toBeInvoiced.amount)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivered but Pending Payout</div>
                </div>

                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <Undo2 size={16} color="#ef4444" />
                        <span style={{ fontSize: '0.85rem' }}>To Be Returned</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{detailedMetrics.toBeReturned.count}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(detailedMetrics.toBeReturned.amount)}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RTO / Failed Delivery</div>
                </div>
            </div>

            <div className="courier-grid">
                {/* 1. Shipment Overview */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Shipment Status Dashboard</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={shipmentStatusData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {shipmentStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. COD Ledger */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>COD Reconciliation Ledger</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={codMetrics.chartData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {codMetrics.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#f59e0b'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(val) => formatCurrency(val)}
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. NDR Analysis */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Returns & NDR Analysis</h3>
                    {ndrData.length > 0 ? (
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ndrData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} style={{ fontSize: '0.75rem' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', fontSize: '12px' }}
                                    />
                                    <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem' }}>
                            No RTO/NDR events detected<br />in sampled orders history.
                        </div>
                    )}
                </div>
            </div>

            {/* Reconciliation Section */}
            {reconciliationList.length > 0 && (
                <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--accent-primary)', background: 'rgba(59, 130, 246, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)' }}>
                                <AlertCircle size={18} />
                                Payment Reconciliation Required
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Found {reconciliationList.length} orders marked as <b>Paid/Deposited</b> by courier but <b>Pending</b> in system.
                            </p>
                        </div>
                        <button
                            onClick={handleMarkAllPaid}
                            disabled={isUpdatingPayment}
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', gap: '0.5rem' }}
                        >
                            {isUpdatingPayment ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />}
                            Mark All as Paid
                        </button>
                    </div>

                    <div className="shipment-table-container">
                        <table className="shipment-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Order #</th>
                                    <th>Waybill</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Courier Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reconciliationList.map((item, idx) => (
                                    <tr key={idx} style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <td>{item.internal.createdDate}</td>
                                        <td>{item.internal.id}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{item.internal.trackingNumber}</td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{item.internal.customerName}</div>
                                            {!item.amountMatch && <span style={{ fontSize: '0.7rem', color: 'var(--warning)' }}>Amount mismatch!</span>}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>Sys: {formatCurrency(item.internal.totalPrice)}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COD: {formatCurrency(item.finance.cod_amount)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                                {item.finance.finance_status || item.finance.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleMarkAsPaid(item)}
                                                disabled={isUpdatingPayment}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                            >
                                                Mark Paid
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detailed Shipment List */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <style>{`
                    .table-toolbar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1.5rem;
                        flex-wrap: wrap;
                        gap: 1rem;
                    }
                    .toolbar-controls {
                        display: flex;
                        gap: 0.75rem;
                        align-items: center;
                    }
                    .filter-select {
                        background: var(--bg-card);
                        border: 1px solid var(--border-color);
                        color: var(--text-primary);
                        padding: 0.5rem 2rem 0.5rem 0.75rem;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        outline: none;
                        cursor: pointer;
                        appearance: none;
                        background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
                        background-repeat: no-repeat;
                        background-position: right 0.7rem top 50%;
                        background-size: 0.65rem auto;
                    }
                    .pagination-controls {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 1.5rem;
                        border-top: 1px solid var(--border-color);
                        padding-top: 1rem;
                    }
                    .page-btn {
                        background: var(--bg-card);
                        border: 1px solid var(--border-color);
                        color: var(--text-primary);
                        padding: 0.4rem 0.75rem;
                        border-radius: 6px;
                        font-size: 0.85rem;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 0.25rem;
                    }
                    .page-btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .page-btn:hover:not(:disabled) {
                        border-color: var(--accent-primary);
                        color: var(--accent-primary);
                    }

                    /* Mobile Optimization */
                    @media (max-width: 640px) {
                        .table-toolbar {
                            flex-direction: column;
                            align-items: stretch;
                            gap: 0.75rem;
                        }
                        .toolbar-controls {
                            flex-direction: column;
                            width: 100%;
                            gap: 0.5rem;
                            align-items: stretch;
                        }
                        .filter-select, .search-input {
                            width: 100% !important;
                            max-width: none !important;
                        }
                        
                        /* Card View for Table */
                        .shipment-table {
                            display: block;
                        }
                        .shipment-table thead {
                            display: none;
                        }
                        .shipment-table tbody {
                            display: block;
                        }
                        .shipment-table tbody tr {
                            display: flex;
                            flex-direction: column;
                            background: rgba(255, 255, 255, 0.03);
                            border: 1px solid var(--border-color);
                            border-radius: 12px;
                            padding: 1rem;
                            margin-bottom: 1rem;
                            position: relative;
                        }
                        
                        .shipment-table td {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 0.5rem 0;
                            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                            text-align: right;
                        }
                        .shipment-table td:last-child {
                            border-bottom: none;
                        }
                        
                        /* Default Labels for the bottom half */
                        .shipment-table td::before {
                            content: attr(data-label);
                            font-weight: 600;
                            color: var(--text-muted);
                            font-size: 0.8rem;
                            text-align: left;
                            margin-right: 1rem;
                            min-width: 80px;
                        }

                        /* SPECIAL HANDLING: Hide labels for Header Fields (Date, Order, Waybill, Customer) */
                        .shipment-table td:nth-child(1)::before,
                        .shipment-table td:nth-child(2)::before,
                        .shipment-table td:nth-child(3)::before,
                        .shipment-table td:nth-child(4)::before {
                            display: none;
                        }

                        /* Header Field Styling */
                        .shipment-table td:nth-child(1), /* Date */
                        .shipment-table td:nth-child(2), /* Order */
                        .shipment-table td:nth-child(3), /* Waybill */
                        .shipment-table td:nth-child(4)  /* Customer */ {
                            justify-content: flex-start;
                            text-align: left;
                            padding: 0.1rem 0;
                            border-bottom: none;
                        }

                        /* 1. Date - Make it small and muted */
                        .shipment-table td:nth-child(1) {
                            order: -1; 
                            font-size: 0.75rem;
                            color: var(--text-muted);
                            margin-bottom: 0.25rem;
                        }

                        /* 2. Order Number - Make it look like a Title */
                        .shipment-table td:nth-child(2) {
                            font-size: 1.1rem;
                            font-weight: 700;
                            color: var(--text-primary);
                        }
                        /* Add "Order #" prefix visually if needed, but value might suffice. Let's add prefix via CSS content if it's just a number */
                        .shipment-table td:nth-child(2)::after {
                             /* content: ' (Order)';  Optional context */
                        }

                        /* 3. Waybill */
                        .shipment-table td:nth-child(3) {
                            font-family: monospace;
                            font-size: 0.9rem;
                            margin-bottom: 0.5rem;
                        }

                        /* 4. Customer - Add separator after */
                        .shipment-table td:nth-child(4) {
                            font-size: 0.95rem;
                            padding-bottom: 0.75rem;
                            margin-bottom: 0.5rem;
                            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                            width: 100%;
                        }

                        /* Pagination stack */
                        .pagination-controls {
                            flex-direction: column;
                            gap: 1rem;
                        }
                    }
                `}</style>
                <div className="table-toolbar">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Live Shipment Details</h3>
                    <div className="toolbar-controls">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="filter-select"
                        >
                            {uniqueStatuses.map(s => (
                                <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                            style={{ width: '200px' }}
                        />
                    </div>
                </div>

                <div className="shipment-table-container">
                    <table className="shipment-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Order #</th>
                                <th>Waybill</th>
                                <th>Customer</th>
                                <th>Destination</th>
                                <th>COD Amount</th>
                                <th>Charges</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOrders.length > 0 ? paginatedOrders.map(o => {
                                const status = o.order_current_status?.name || 'Unknown'
                                const isDelivered = status.toUpperCase() === 'DELIVERED'
                                const destCity = o.destination_city?.name || o.destination_city_name || 'Unknown'

                                return (
                                    <tr key={o.id}>
                                        <td data-label="Date" style={{ whiteSpace: 'nowrap' }}>
                                            {o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td data-label="Order #">{o.order_no || '-'}</td>
                                        <td data-label="Waybill" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                                            {o.waybill_number}
                                        </td>
                                        <td data-label="Customer">
                                            <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                                        </td>
                                        <td data-label="Destination">
                                            <div style={{ fontSize: '0.85rem' }}>{destCity}</div>
                                        </td>
                                        <td data-label="COD Amount">
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span>{formatCurrency(o.cod || o.cod_amount || 0)}</span>
                                                {Number(o.collected_cod) > 0 && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                                        Collected: {formatCurrency(o.collected_cod)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Charges">{formatCurrency(o.delivery_charge || 0)}</td>
                                        <td data-label="Status">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                                                <span className="status-badge" style={{
                                                    background: isDelivered ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                    color: isDelivered ? '#10b981' : '#3b82f6'
                                                }}>
                                                    {status}
                                                </span>
                                                {(() => {
                                                    const fin = financeData.find(f => f.waybill_number === o.waybill_number);
                                                    if (!fin) return null;
                                                    const finStatus = fin.finance_status || fin.status;
                                                    const isDeposited = finStatus === 'Deposited';
                                                    return (
                                                        <span className="status-badge" style={{
                                                            fontSize: '0.6rem',
                                                            background: isDeposited ? 'rgba(123, 31, 162, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                            color: isDeposited ? '#e040fb' : 'var(--text-muted)',
                                                            border: '1px solid currentColor'
                                                        }}>
                                                            {finStatus}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        No shipments found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredOrders.length > 0 && (
                    <div className="pagination-controls">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredOrders.length)} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                            <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', padding: '0 0.5rem' }}>
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CourierReports
