import { useState, useMemo, useEffect } from 'react'
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { Truck, DollarSign, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { curfoxService } from '../../utils/curfox'
import { getSettings } from '../../utils/storage'
import { formatCurrency } from '../../utils/reportUtils'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const CourierReports = ({ isMobile, range }) => {
    const [loading, setLoading] = useState(true)
    const [progress, setProgress] = useState({ loaded: 0, total: 0, stage: '' })
    const [orders, setOrders] = useState([])
    const [trackingData, setTrackingData] = useState([])
    const [financeData, setFinanceData] = useState([])
    const [error, setError] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [forceRefresh, setForceRefresh] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

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

                if (curfoxOrders.length > 0) {
                    // Sample the last 100 waybills (optimized with concurrency)
                    // If date range is active, we might want all of them if the count is reasonable
                    const MAX_SAMPLE = 100
                    const waybills = curfoxOrders.slice(0, MAX_SAMPLE).map(o => o.waybill_number).filter(Boolean)

                    setProgress({ loaded: 0, total: waybills.length * 2, stage: 'Fetching Details...' })

                    let completed = 0;
                    const updateProgress = (done, total) => {
                        // We have two batch processes (finance & tracking), so roughly aggregate
                        // This is a bit loose but good enough for UI
                        completed += 1 // Increment by simplified step
                        setProgress(prev => ({
                            ...prev,
                            loaded: Math.min(prev.loaded + 1, prev.total)
                        }))
                    }

                    // 2. Fetch Finance & Tracking with progress
                    // specific callbacks for each to look smoother
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

    // --- Search & Filter ---
    const filteredOrders = useMemo(() => {
        if (!searchQuery) return dateFilteredOrders
        const q = searchQuery.toLowerCase()
        return dateFilteredOrders.filter(o =>
            (o.waybill_number || '').toLowerCase().includes(q) ||
            (o.customer_name || '').toLowerCase().includes(q) ||
            (o.customer_phone || '').toLowerCase().includes(q) ||
            (o.order_no || '').toLowerCase().includes(q)
        )
    }, [dateFilteredOrders, searchQuery])

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

            <div className="refresh-bar">
                <input
                    type="text"
                    placeholder="Search Waybill / Customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
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
            <div className="metrics-row">
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <Truck size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Total Shipments</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{dateFilteredOrders.length}</div>
                </div>
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <DollarSign size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Logistics Spend</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(shippingSpendTotal)}</div>
                </div>
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <DollarSign size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Total COD Collected</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(codMetrics.totalCollectedActual)}</div>
                </div>
                <div className="card metric-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        <Clock size={16} />
                        <span style={{ fontSize: '0.85rem' }}>Avg. Turnaround (TAT)</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{tatMetrics} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Days</span></div>
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

            {/* Detailed Shipment List */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Live Shipment Details</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Showing {filteredOrders.length} records</span>
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
                            {filteredOrders.length > 0 ? filteredOrders.map(o => {
                                const status = o.order_current_status?.name || 'Unknown'
                                const isDelivered = status.toUpperCase() === 'DELIVERED'
                                const destCity = o.destination_city?.name || o.destination_city_name || 'Unknown'

                                return (
                                    <tr key={o.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            {o.created_at ? new Date(o.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td>{o.order_no || '-'}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                                            {o.waybill_number}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{o.customer_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.customer_phone}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.85rem' }}>{destCity}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>{formatCurrency(o.cod || o.cod_amount || 0)}</span>
                                                {Number(o.collected_cod) > 0 && (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                                        Collected: {formatCurrency(o.collected_cod)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{formatCurrency(o.delivery_charge || 0)}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        No shipments found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default CourierReports
