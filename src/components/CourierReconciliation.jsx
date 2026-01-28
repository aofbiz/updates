import { useState, useEffect, useMemo } from 'react'
import { Truck, RefreshCw, Search, DollarSign, Wallet, Package, RefreshCcw, AlertCircle, ChevronRight, Filter, ClipboardList, CalendarClock, AlertOctagon, Receipt, CheckCircle, X } from 'lucide-react'
import { curfoxService } from '../utils/curfox'
import { getSettings, saveOrder } from '../utils/storage'
import Pagination from './Common/Pagination'
import { useToast } from './Toast/ToastContext'
import ConfirmationModal from './ConfirmationModal'

const CourierReconciliation = ({ orders, onUpdateOrders, onNavigate }) => {
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState({ done: 0, total: 0 })
    const [activeTab, setActiveTab] = useState('shipment') // 'shipment', 'finance'
    const [financeData, setFinanceData] = useState({})
    const [trackingData, setTrackingData] = useState({})
    const [selectedOrders, setSelectedOrders] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [courierStatusFilter, setCourierStatusFilter] = useState('all')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)

    const { addToast } = useToast()
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        type: 'default',
        title: '',
        message: '',
        onConfirm: null,
        isAlert: false,
        confirmText: 'Confirm',
        cancelText: 'Cancel'
    })

    const showAlert = (title, message, type = 'default') => {
        setModalConfig({
            isOpen: true,
            type,
            title,
            message,
            onConfirm: null,
            isAlert: true
        })
    }

    const showConfirm = (title, message, onConfirm, type = 'default', confirmText = 'Confirm') => {
        setModalConfig({
            isOpen: true,
            type,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                closeModal();
            },
            isAlert: false,
            confirmText,
            cancelText: 'Cancel'
        })
    }

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }))
    }

    // Navigation handler
    const handleRowDoubleClick = (orderId) => {
        if (onNavigate) {
            onNavigate('orders', { searchTerm: orderId.toString() })
        }
    }

    const handleSyncPayment = async (order, fin) => {
        if (!order || !fin) return
        setLoading(true)
        try {
            const updatedOrder = {
                ...order,
                paymentStatus: 'Paid',
                courierFinanceStatus: fin.finance_status,
                courierInvoiceNo: fin.invoice_no,
                courierInvoiceRef: fin.invoice_ref_no,
                courierDepositedDate: fin.finance_deposited_date || fin.deposited_date || fin.deposited_at || order.courierDepositedDate
            }
            await saveOrder(updatedOrder)
            if (onUpdateOrders) onUpdateOrders()
            addToast(`Order #${order.id} marked as Paid and synced.`)
        } catch (err) {
            console.error(err)
            addToast("Sync failed", "error")
        } finally {
            setLoading(false)
        }
    }

    const getCourierStatusColor = (status) => {
        const s = (status || '').toUpperCase()
        if (s.includes('DELIVERED')) return '#10b981' // Green
        if (s.includes('TRANSIT') || s.includes('PICKUP')) return '#3b82f6' // Blue
        if (s.includes('RESCHEDULED')) return '#eab308' // Yellow
        if (s.includes('FAILED TO DELIVER')) return '#ef4444' // Red
        return 'inherit'
    }

    // Helper to get status text from complex Curfox objects
    const getStatusText = (trk) => {
        if (!trk) return '—';
        const s = trk.status_name || trk.status_text || trk.status;
        if (typeof s === 'object') return s.name || s.status_name || 'Update';
        return String(s || 'Synced');
    }

    // List of common placeholder strings that are not valid tracking numbers
    const INVALID_PLACEHOLDERS = ['000', 'hand over', 'handover', 'pending', 'null', 'undefined', 'n/a', 'none'];

    const isTrackingValid = (wb) => {
        if (!wb) return false;
        const normalized = wb.toString().toLowerCase().trim();
        return normalized.length > 3 && !INVALID_PLACEHOLDERS.includes(normalized);
    }

    // Status mapping for filtering
    const SHIPMENT_STATUSES = [
        { value: 'all', label: 'All Statuses' },
        { value: 'ACTIVE_ONLY', label: 'Active Only (Not Delivered)' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'ASSIGNED TO DESTINATION RIDER', label: 'Assigned to Rider' },
        { value: 'RESCHEDULED', label: 'Rescheduled' },
        { value: 'FAILED TO DELIVER', label: 'Failed to Deliver' },
        { value: 'unsynced', label: 'Not Synced' }
    ]

    const FINANCE_STATUSES = [
        { value: 'all', label: 'All Statuses' },
        { value: 'TO_BE_INVOICED', label: 'To Be Invoiced' },
        { value: 'NOT_INVOICED', label: 'Not Invoiced' },
        { value: 'DEPOSITED', label: 'Deposited' }
    ]

    // REFINED FILTER: Only show active orders in Order Management that have tracking
    const dispatchedOrders = useMemo(() => {
        if (!orders) return []
        const EXCLUDED_STATUSES = ['cancelled', 'returned', 'refund', 'refunded']
        return orders.filter(o => {
            if (!o || !o.id) return false
            const status = (o.status || '').toLowerCase()
            return !EXCLUDED_STATUSES.includes(status) && !!o.trackingNumber
        }).sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
    }, [orders])

    const filteredOrders = useMemo(() => {
        let result = dispatchedOrders;

        // 1. Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(o =>
                o.id.toString().includes(q) ||
                o.customerName?.toLowerCase().includes(q) ||
                o.trackingNumber?.toLowerCase().includes(q) ||
                o.nearestCity?.toLowerCase().includes(q)
            )
        }

        // 2. Status filter
        if (courierStatusFilter !== 'all') {
            result = result.filter(o => {
                const trk = trackingData[o.trackingNumber]
                const fin = financeData[o.trackingNumber]
                const trkName = getStatusText(trk).toUpperCase()
                const finStatus = (fin?.finance_status || '').toUpperCase()
                const isDelivered = trkName.includes('DELIVERED')

                if (activeTab === 'shipment') {
                    if (courierStatusFilter === 'ACTIVE_ONLY') return !isDelivered
                    if (courierStatusFilter === 'unsynced') return !trk
                    if (!trk) return false

                    // Exact or partial match check for shipment statuses
                    return trkName === courierStatusFilter || trkName.includes(courierStatusFilter)
                } else {
                    if (courierStatusFilter === 'TO_BE_INVOICED') {
                        return isDelivered && (finStatus !== 'DEPOSITED' && finStatus !== 'APPROVED')
                    }
                    if (courierStatusFilter === 'NOT_INVOICED') {
                        return !finStatus || (finStatus !== 'INVOICED' && finStatus !== 'DEPOSITED' && finStatus !== 'APPROVED')
                    }
                    if (courierStatusFilter === 'DEPOSITED') {
                        return finStatus === 'DEPOSITED' || finStatus === 'APPROVED'
                    }
                    if (courierStatusFilter === 'INVOICED') {
                        return finStatus === 'INVOICED'
                    }
                    return true
                }
            })
        }

        return result
    }, [dispatchedOrders, searchQuery, courierStatusFilter, activeTab, trackingData, financeData])

    // Paginated orders
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredOrders.slice(start, start + itemsPerPage)
    }, [filteredOrders, currentPage, itemsPerPage])

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, courierStatusFilter])

    // Reset sub-filter when tab changes
    useEffect(() => {
        setCourierStatusFilter('all')
    }, [activeTab])

    const fetchAllData = async (force = false) => {
        if (loading) return
        setLoading(true)

        try {
            const settings = await getSettings()
            if (!settings?.curfox?.email) throw new Error("Curfox settings not configured")

            const auth = await curfoxService.login(settings.curfox.email, settings.curfox.password, settings.curfox.tenant)
            if (!auth || !auth.token) throw new Error("Connection to courier failed")

            const authData = { ...settings.curfox, token: auth.token }

            const allWaybills = dispatchedOrders
                .map(o => o.trackingNumber?.trim())
                .filter(isTrackingValid);

            if (allWaybills.length === 0) {
                setLoading(false)
                return
            }

            // Optimization: Skip orders that have reached their final destination in the cache
            const waybillsForTracking = allWaybills.filter(wb => {
                const trk = trackingData[wb]
                if (!trk) return true // Refresh if no data
                const status = getStatusText(trk).toUpperCase()
                return !status.includes('DELIVERED')
            })

            const waybillsForFinance = allWaybills.filter(wb => {
                const fin = financeData[wb]
                if (!fin) return true // Refresh if no data
                const status = (fin.finance_status || '').toUpperCase()
                return status !== 'DEPOSITED' && status !== 'APPROVED'
            })

            setProgress({ done: 0, total: waybillsForTracking.length + waybillsForFinance.length })

            // 1. Fetch Tracking Statuses
            let newTrackingData = trackingData
            if (waybillsForTracking.length > 0) {
                const trackingList = await curfoxService.bulkGetTracking(waybillsForTracking, authData, (done) => {
                    setProgress(prev => ({ ...prev, done }))
                }, force)

                const newTracking = {}
                if (Array.isArray(trackingList)) {
                    trackingList.forEach(t => {
                        if (t && t.waybill_number) {
                            newTracking[t.waybill_number] = t.history?.[0] || null
                        }
                    })
                }
                newTrackingData = { ...trackingData, ...newTracking }
                setTrackingData(newTrackingData)
            } else {
                setProgress(prev => ({ ...prev, done: prev.done + 0 }))
            }

            // 2. Fetch Financial Statuses
            if (waybillsForFinance.length > 0) {
                const financeList = await curfoxService.bulkGetFinanceStatus(waybillsForFinance, authData, (done) => {
                    setProgress(prev => ({ ...prev, done: waybillsForTracking.length + done }))
                }, force)

                const newFinance = {}
                if (Array.isArray(financeList)) {
                    financeList.forEach(f => {
                        if (f && f.waybill_number) {
                            newFinance[f.waybill_number] = f
                        }
                    })
                }
                setFinanceData(prev => ({ ...prev, ...newFinance }))
            }

        } catch (err) {
            console.error(err)
            showAlert("Sync Error", err.message, "danger")
        } finally {
            setLoading(false)
            setProgress({ done: 0, total: 0 })
        }
    }

    const handleBulkMarkPaid = () => {
        if (selectedOrders.length === 0) return

        showConfirm(
            "Mark as Paid",
            `Are you sure you want to mark ${selectedOrders.length} orders as Paid? This will also sync their courier financial details.`,
            async () => {
                setLoading(true)
                try {
                    for (const orderId of selectedOrders) {
                        const order = orders.find(o => o.id === orderId)
                        if (!order) continue
                        const fin = financeData[order.trackingNumber]
                        const updatedOrder = {
                            ...order,
                            paymentStatus: 'Paid',
                            courierFinanceStatus: fin?.finance_status || order.courierFinanceStatus,
                            courierInvoiceNo: fin?.invoice_no || order.courierInvoiceNo,
                            courierInvoiceRef: fin?.invoice_ref_no || order.courierInvoiceRef,
                            courierDepositedDate: fin?.finance_deposited_date || fin?.deposited_date || order.courierDepositedDate
                        }
                        await saveOrder(updatedOrder)
                    }
                    if (onUpdateOrders) onUpdateOrders()
                    setSelectedOrders([])
                    addToast(`${selectedOrders.length} orders updated successfully.`)
                } catch (err) {
                    console.error(err)
                    addToast("Update failed", "error")
                } finally {
                    setLoading(false)
                }
            }
        )
    }

    const stats = useMemo(() => {
        const counts = { total: 0, rescheduled: 0, failed: 0, toBeInvoiced: 0, deposited: 0 }
        dispatchedOrders.forEach(o => {
            const trk = trackingData[o.trackingNumber]; const fin = financeData[o.trackingNumber]
            const trkName = getStatusText(trk).toUpperCase()
            const finStatus = (fin?.finance_status || '').toUpperCase()
            const isDelivered = trkName.includes('DELIVERED')

            if (!isDelivered) counts.total++
            if (trkName.includes('RESCHEDULED')) counts.rescheduled++
            if (trkName.includes('FAILED TO DELIVER')) counts.failed++

            if (finStatus === 'DEPOSITED' || finStatus === 'APPROVED') {
                counts.deposited++
            } else if (isDelivered) {
                // If delivered but not deposited, it's either Invoiced or Not Invoiced -> both are "To Be Invoiced" effectively for the user's audit
                counts.toBeInvoiced++
            }
        })
        return counts
    }, [dispatchedOrders, trackingData, financeData])

    return (
        <div className="courier-recon-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
            <style>{`
                .recon-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; gap: 1.5rem; }
                .recon-title h1 { font-size: 1.875rem; font-weight: 800; }
                .recon-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem; }
                .stat-card { background: var(--bg-card); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 20px; display: flex; align-items: center; gap: 1rem; transition: all 0.2s ease; cursor: pointer; }
                .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.15); border-color: var(--accent-primary); }
                .stat-card.active { border-color: var(--accent-primary); background: rgba(var(--accent-rgb), 0.05); }
                .stat-icon-wrapper { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .stat-content { display: flex; flex-direction: column; gap: 2px; }
                .stat-label { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
                .stat-value { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
                .recon-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
                .recon-actions { display: flex; gap: 1rem; flex: 1; flex-wrap: wrap; }
                .search-box { display: flex; align-items: center; gap: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.6rem 1rem; border-radius: 12px; flex: 2; min-width: 250px; }
                .search-box input { background: transparent; border: none; color: var(--text-primary); width: 100%; outline: none; }
                .filter-dropdown { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.6rem 1rem; border-radius: 12px; flex: 1.5; min-width: 250px; }
                .filter-dropdown select { background: transparent; border: none; color: var(--text-primary); width: 100%; outline: none; font-weight: 600; cursor: pointer; }
                .recon-tabs { display: flex; background: var(--bg-secondary); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color); }
                .tab-btn { padding: 0.6rem 1.25rem; border-radius: 8px; border: none; background: transparent; color: var(--text-muted); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; }
                .tab-btn.active { background: var(--bg-card); color: var(--text-primary); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .recon-table-wrapper { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; overflow: hidden; }
                .recon-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .recon-table th { text-align: left; padding: 1rem; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-color); color: var(--text-muted); text-transform: uppercase; font-size: 0.7rem; }
                .recon-table td { padding: 1rem; border-bottom: 1px solid var(--border-color); }
                .recon-table tr { cursor: pointer; transition: background 0.2s ease; }
                .recon-table tr:hover { background: rgba(255,255,255,0.03); }
                .recon-table tr.selected { background: rgba(var(--accent-rgb), 0.1); }
                .progress-bar { position: fixed; top: 0; left:0; right: 0; height: 3px; background: var(--bg-secondary); z-index: 1000; }
                .progress-fill { height: 100%; background: var(--accent-primary); transition: width 0.3s ease; }
                .invalid-wb { display: flex; align-items: center; gap: 4px; color: #ef4444; font-size: 0.7rem; font-weight: 600; margin-top: 2px; }
                .sync-action-btn { 
                    background: rgba(16, 185, 129, 0.1); 
                    border: 1px solid rgba(16, 185, 129, 0.2); 
                    color: #10b981; 
                    padding: 4px; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                .sync-action-btn:hover {
                    background: #10b981;
                    color: white;
                }
                .mobile-only { display: none; }

                @media (max-width: 768px) {
                    .mobile-only { display: block; }
                    .courier-recon-container { padding: 1rem !important; }
                    .recon-header { flex-direction: column; align-items: stretch; gap: 1rem; }
                    .recon-title h1 { font-size: 1.5rem; }
                    .recon-stats { 
                        display: grid; 
                        grid-template-columns: repeat(2, 1fr);
                        gap: 0.75rem;
                        margin-bottom: 1.5rem;
                    }
                    .stat-card { padding: 0.875rem; }
                    .stat-card:nth-child(5) { grid-column: span 2; }
                    .stat-icon-wrapper { width: 36px; height: 36px; border-radius: 10px; }
                    .stat-icon-wrapper svg { width: 18px; height: 18px; }
                    .stat-value { font-size: 1.25rem; }
                    .stat-label { font-size: 0.65rem; }
                    .recon-controls, .recon-actions { flex-direction: column; align-items: stretch; }
                    .recon-tabs { width: 100%; justify-content: center; }
                    .tab-btn { flex: 1; justify-content: center; }
                    .filter-dropdown, .search-box { min-width: unset; width: 100%; }
                    
                    /* Mobile Table as Cards */
                    .recon-table-wrapper { background: transparent; border: none; box-shadow: none; overflow: visible; }
                    .recon-table thead { display: none; }
                    .recon-table, .recon-table tbody, .recon-table tr, .recon-table td { display: block; width: 100%; }
                    .recon-table tr { 
                        margin-bottom: 2rem; 
                        border: 1px solid var(--border-color); 
                        border-radius: 16px; 
                        padding: 1.25rem;
                        background: var(--bg-card);
                        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                        transition: transform 0.2s ease;
                    }
                    .recon-table tr.selected { border: 2px solid var(--accent-primary); background: rgba(var(--accent-rgb), 0.05); }
                    .recon-table td { 
                        padding: 0.75rem 0; 
                        border: none; 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center;
                    }
                    .recon-table td::before {
                        content: attr(data-label);
                        font-weight: 700;
                        color: var(--text-muted);
                        font-size: 0.75rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .recon-table td:first-child { border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 0.75rem; }
                }
            `}</style>

            {loading && progress.total > 0 && (
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${(progress.done / (progress.total * 2)) * 100}%` }}></div></div>
            )}

            <header className="recon-header">
                <div className="recon-title">
                    <h1>Courier Reconciliation</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Audit shipment & finance for active tracked orders.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={() => fetchAllData(false)} disabled={loading}><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Sync Status</button>
                    <button className="btn btn-primary" onClick={() => fetchAllData(true)} disabled={loading}><RefreshCcw size={18} /> Force Sync</button>
                </div>
            </header>

            <div className="recon-stats">
                <div
                    className={`stat-card ${activeTab === 'shipment' && courierStatusFilter === 'ACTIVE_ONLY' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('shipment'); setCourierStatusFilter('ACTIVE_ONLY'); }}
                >
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><ClipboardList size={22} /></div>
                    <div className="stat-content"><div className="stat-label">Total Active</div><div className="stat-value">{stats.total}</div></div>
                </div>
                <div
                    className={`stat-card ${activeTab === 'shipment' && courierStatusFilter === 'RESCHEDULED' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('shipment'); setCourierStatusFilter('RESCHEDULED'); }}
                >
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}><CalendarClock size={22} /></div>
                    <div className="stat-content"><div className="stat-label">Rescheduled</div><div className="stat-value">{stats.rescheduled}</div></div>
                </div>
                <div
                    className={`stat-card ${activeTab === 'shipment' && courierStatusFilter === 'FAILED TO DELIVER' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('shipment'); setCourierStatusFilter('FAILED TO DELIVER'); }}
                >
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><AlertOctagon size={22} /></div>
                    <div className="stat-content"><div className="stat-label">Failed Delivery</div><div className="stat-value">{stats.failed}</div></div>
                </div>
                <div
                    className={`stat-card ${activeTab === 'finance' && courierStatusFilter === 'TO_BE_INVOICED' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('finance'); setCourierStatusFilter('TO_BE_INVOICED'); }}
                >
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><Receipt size={22} /></div>
                    <div className="stat-content"><div className="stat-label">To be Invoiced</div><div className="stat-value">{stats.toBeInvoiced}</div></div>
                </div>
                <div
                    className={`stat-card ${activeTab === 'finance' && courierStatusFilter === 'DEPOSITED' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('finance'); setCourierStatusFilter('DEPOSITED'); }}
                >
                    <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><CheckCircle size={22} /></div>
                    <div className="stat-content"><div className="stat-label">Deposited</div><div className="stat-value">{stats.deposited}</div></div>
                </div>
            </div>

            <div className="recon-controls">
                <div className="recon-tabs">
                    <button className={`tab-btn ${activeTab === 'shipment' ? 'active' : ''}`} onClick={() => setActiveTab('shipment')}><Truck size={16} /> Shipment</button>
                    <button className={`tab-btn ${activeTab === 'finance' ? 'active' : ''}`} onClick={() => setActiveTab('finance')}><DollarSign size={16} /> Finance</button>
                </div>
                <div className="recon-actions">
                    <div className="filter-dropdown">
                        <Filter size={18} style={{ color: 'var(--text-muted)' }} />
                        <select
                            value={courierStatusFilter}
                            onChange={(e) => setCourierStatusFilter(e.target.value)}
                        >
                            {(activeTab === 'shipment' ? SHIPMENT_STATUSES : FINANCE_STATUSES).map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="search-box">
                        <Search size={18} style={{ color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Search orders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    {(searchQuery || courierStatusFilter !== 'all') && (
                        <button
                            className="btn btn-secondary"
                            style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                                setSearchQuery('')
                                setCourierStatusFilter('all')
                            }}
                        >
                            <X size={16} /> Clear
                        </button>
                    )}
                </div>
                {selectedOrders.length > 0 && activeTab === 'finance' && (
                    <button className="btn btn-primary" onClick={handleBulkMarkPaid}><Wallet size={18} /> Mark {selectedOrders.length} Paid</button>
                )}
            </div>

            <div className="recon-table-wrapper">
                {filteredOrders.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}><Package size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} /><h3>No matching orders found</h3></div>
                ) : (
                    <>
                        <table className="recon-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}><input type="checkbox" checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} onChange={(e) => setSelectedOrders(e.target.checked ? filteredOrders.map(o => o.id) : [])} /></th>
                                    <th>Order</th><th>Customer</th><th>Waybill</th>
                                    {activeTab === 'shipment' ? (<th>Courier Status</th>) : (<><th>Finance Status</th><th>App Status</th><th>Total</th></>)}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedOrders.map(order => {
                                    const trk = trackingData[order.trackingNumber]; const fin = financeData[order.trackingNumber]; const isSelected = selectedOrders.includes(order.id)
                                    const courierStatus = getStatusText(trk)
                                    const isValidWb = isTrackingValid(order.trackingNumber)
                                    return (
                                        <tr
                                            key={order.id}
                                            className={isSelected ? 'selected' : ''}
                                            onDoubleClick={() => handleRowDoubleClick(order.id)}
                                            style={{ position: 'relative' }}
                                        >
                                            <td data-label="Select">
                                                <input type="checkbox" checked={isSelected} onChange={(e) => setSelectedOrders(prev => e.target.checked ? [...prev, order.id] : prev.filter(id => id !== order.id))} />
                                                <div className="mobile-only" style={{ opacity: 0.5, fontSize: '0.7rem' }}>Double click to view</div>
                                            </td>
                                            <td data-label="Order">
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700 }}>#{order.id}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{order.orderDate}</div>
                                                </div>
                                            </td>
                                            <td data-label="Customer">
                                                <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                                            </td>
                                            <td data-label="Waybill">
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontFamily: 'monospace', opacity: isValidWb ? 1 : 0.5 }}>{order.trackingNumber}</div>
                                                    {!isValidWb && <div className="invalid-wb"><AlertCircle size={10} /> Placeholder</div>}
                                                </div>
                                            </td>
                                            {activeTab === 'shipment' ? (
                                                <td data-label="Status">
                                                    {!isValidWb ? (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not Shipped</span>
                                                    ) : (
                                                        <span style={{ fontWeight: 700, color: getCourierStatusColor(courierStatus) }}>{courierStatus}</span>
                                                    )}
                                                </td>
                                            ) : (
                                                <>
                                                    <td data-label="Courier Finance">
                                                        {!isValidWb ? (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Data</span>
                                                        ) : (
                                                            <span style={{ fontWeight: 700, color: (fin?.finance_status === 'Deposited' || fin?.finance_status === 'Approved' ? '#10b981' : (fin?.finance_status === 'Invoiced' ? '#3b82f6' : 'inherit')) }}>{fin?.finance_status || 'Pending'}</span>
                                                        )}
                                                    </td>
                                                    <td data-label="App Status">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: order.paymentStatus === 'Paid' ? '#10b981' : '#ef4444' }}>{order.paymentStatus}</span>
                                                            {isValidWb && (fin?.finance_status === 'Deposited' || fin?.finance_status === 'Approved') && order.paymentStatus !== 'Paid' && (
                                                                <button
                                                                    className="sync-action-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSyncPayment(order, fin);
                                                                    }}
                                                                    title="Sync Payment Status (Mark as Paid)"
                                                                >
                                                                    <RefreshCw size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td data-label="Total">
                                                        <span style={{ fontWeight: 700 }}>LKR {order.totalPrice?.toLocaleString()}</span>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        <div style={{ padding: '0 1rem 1rem' }}>
                            <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(filteredOrders.length / itemsPerPage)}
                                onPageChange={setCurrentPage}
                                totalItems={filteredOrders.length}
                                itemsPerPage={itemsPerPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        </div>
                    </>
                )}
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                isAlert={modalConfig.isAlert}
                confirmText={modalConfig.confirmText}
                cancelText={modalConfig.cancelText}
            />
        </div>
    )
}

export default CourierReconciliation
