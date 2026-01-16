import { useState, useEffect } from 'react'
import { X, RefreshCw, Truck, Calendar, MapPin, User, CheckCircle } from 'lucide-react'
import { curfoxService } from '../utils/curfox'
import { getSettings } from '../utils/storage'

const CurfoxTrackingModal = ({ order, onSave, onClose }) => {
    const [trackingData, setTrackingData] = useState(null)
    const [financeData, setFinanceData] = useState(null)
    const [activeTab, setActiveTab] = useState('tracking')
    const [loading, setLoading] = useState(true)
    const [financeLoading, setFinanceLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchFinance = async () => {
        if (financeData || financeLoading) return
        try {
            setFinanceLoading(true)
            const settings = await getSettings()
            const authData = {
                tenant: settings.curfox.tenant,
                token: (await curfoxService.login(settings.curfox.email, settings.curfox.password, settings.curfox.tenant))?.token
            }
            if (!authData.token) return
            const data = await curfoxService.getFinanceStatus(order.trackingNumber, authData)
            setFinanceData(data)
        } catch (err) {
            console.error("Finance Fetch Error:", err)
        } finally {
            setFinanceLoading(false)
        }
    }

    const handleSyncFinance = async () => {
        if (!financeData || !onSave) return
        try {
            setFinanceLoading(true)
            const updatedOrder = {
                ...order,
                courierFinanceStatus: financeData.finance_status,
                courierInvoiceNo: financeData.invoice_no,
                courierInvoiceRef: financeData.invoice_ref_no,
                courierDepositedDate: financeData.finance_deposited_date || financeData.deposited_date || financeData.deposited_at
            }

            // Auto-mark as paid if deposited or approved
            if (financeData.finance_status === 'Deposited' || financeData.finance_status === 'Approved') {
                updatedOrder.paymentStatus = 'Paid'
            }

            await onSave(updatedOrder)
        } catch (err) {
            console.error("Sync Finance Error:", err)
        } finally {
            setFinanceLoading(false)
        }
    }

    useEffect(() => {
        const fetchTracking = async () => {
            try {
                setLoading(true)
                const settings = await getSettings()
                const authData = {
                    tenant: settings.curfox.tenant,
                    token: (await curfoxService.login(settings.curfox.email, settings.curfox.password, settings.curfox.tenant))?.token
                }

                if (!authData.token) throw new Error("Could not authenticate with Curfox")

                const data = await curfoxService.getTracking(order.trackingNumber, authData)
                setTrackingData(data)

                // Also fetch finance initial
                const fData = await curfoxService.getFinanceStatus(order.trackingNumber, authData)
                setFinanceData(fData)
            } catch (err) {
                console.error(err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        if (order?.trackingNumber) {
            fetchTracking()
        } else {
            setError("No tracking number found for this order")
            setLoading(false)
        }
    }, [order])

    const glassCardStyle = {
        backgroundColor: 'rgba(20, 20, 20, 0.4)',
        backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '12px',
        padding: '1rem'
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content tracking-modal-content" style={{ width: '100%', maxWidth: '600px', borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
                {/* Header */}
                <div className="modal-header tracking-modal-header" style={{
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
                            color: 'var(--accent-primary)'
                        }}>
                            <Truck size={24} />
                        </div>
                        <div>
                            Tracking Information
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>
                                Waybill: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{order.trackingNumber}</span>
                            </div>
                        </div>
                    </h2>
                    <button className="modal-close" onClick={onClose} style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--border-color)', background: 'transparent',
                        color: 'var(--text-muted)', cursor: 'pointer'
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="tracking-tabs-container">
                    <div style={{
                        display: 'flex',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '4px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)'
                    }}>
                        {['tracking', 'finance'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontWeight: activeTab === tab ? 600 : 500,
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    textTransform: 'capitalize',
                                    transition: 'all 0.2s ease',
                                    boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="tracking-content-body">
                    {loading ? (
                        <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                            <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
                            Fetching real-time updates...
                        </div>
                    ) : error ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Update Failed</div>
                            {error}
                        </div>
                    ) : (
                        activeTab === 'tracking' ? (
                            <div className="animate-fade-in">
                                {/* Current Status Card */}
                                <div className="status-card" style={{
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.1) 0%, rgba(var(--accent-rgb), 0.05) 100%)',
                                    border: '1px solid rgba(var(--accent-rgb), 0.2)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '4px' }}>
                                            Current Status
                                        </div>
                                        <div className="status-text" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {(() => {
                                                if (!trackingData) return 'Unknown';
                                                const getStatusText = (s) => typeof s === 'object' ? (s.name || s.status_name || 'Update') : String(s);
                                                if (Array.isArray(trackingData)) {
                                                    if (trackingData.length === 0) return 'No Status';
                                                    return getStatusText(trackingData[0].status_name || trackingData[0].status);
                                                }
                                                return getStatusText(trackingData.current_status?.name || trackingData.status || (trackingData.events && trackingData.events[0]?.status_name) || 'Unknown');
                                            })()}
                                        </div>
                                    </div>
                                    <div className="status-icon-container" style={{ borderRadius: '50%', color: 'var(--accent-primary)', background: 'rgba(var(--accent-rgb), 0.2)' }}>
                                        <Truck size={32} />
                                    </div>
                                </div>

                                {/* Order Info Grid */}
                                <div className="tracking-info-grid">
                                    <div style={glassCardStyle}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <User size={12} /> Customer
                                        </div>
                                        <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                                    </div>
                                    <div style={glassCardStyle}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <MapPin size={12} /> Destination
                                        </div>
                                        <div style={{ fontWeight: 600 }}>
                                            {(() => {
                                                return trackingData?.destination_city ||
                                                    (Array.isArray(trackingData) && trackingData[0]?.city) ||
                                                    (trackingData?.events && trackingData.events[0]?.city) || 'Unknown'
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div style={{ position: 'relative', paddingLeft: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Shipment History</h3>
                                    {(() => {
                                        const events = Array.isArray(trackingData) ? trackingData : trackingData?.events;
                                        if (!events || events.length === 0) return <div style={{ color: 'var(--text-muted)' }}>No history available.</div>;

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                {events.map((event, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: '1rem', position: 'relative', paddingBottom: idx === events.length - 1 ? 0 : '1.5rem' }}>
                                                        {/* Line */}
                                                        {idx !== events.length - 1 && (
                                                            <div style={{
                                                                position: 'absolute', left: '7px', top: '24px', bottom: '0', width: '2px',
                                                                backgroundColor: 'var(--border-color)'
                                                            }}></div>
                                                        )}
                                                        {/* Dot */}
                                                        <div style={{
                                                            width: '16px', height: '16px', borderRadius: '50%',
                                                            backgroundColor: idx === 0 ? 'var(--accent-primary)' : 'var(--bg-card)',
                                                            border: idx === 0 ? '4px solid rgba(var(--accent-rgb), 0.3)' : '2px solid var(--text-muted)',
                                                            flexShrink: 0, marginTop: '4px', zIndex: 1
                                                        }}></div>
                                                        {/* Content */}
                                                        <div>
                                                            <div style={{ fontWeight: idx === 0 ? 700 : 500, color: idx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                                                {(() => {
                                                                    const s = event.status_name || event.status;
                                                                    if (typeof s === 'object') return s.name || s.status_name || 'Update';
                                                                    return s;
                                                                })()}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                {event.created_at || event.time || event.date}
                                                            </div>
                                                            {event.city && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                                                                    {event.city}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {financeLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }} />
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Updating finance records...</p>
                                    </div>
                                ) : financeData ? (
                                    <>
                                        {/* Finance Status Card */}
                                        <div style={{
                                            padding: '2rem',
                                            borderRadius: '16px',
                                            background: financeData.finance_status === 'Deposited'
                                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)'
                                                : 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
                                            border: `1px solid ${financeData.finance_status === 'Deposited' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`,
                                            textAlign: 'center',
                                            backdropFilter: 'blur(12px)',
                                            WebkitBackdropFilter: 'blur(12px)',
                                        }}>
                                            <div style={{
                                                fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px',
                                                color: financeData.finance_status === 'Deposited' ? '#10b981' : '#eab308', marginBottom: '8px'
                                            }}>
                                                Finance Status
                                            </div>
                                            <div style={{
                                                fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                            }}>
                                                {financeData.finance_status || 'Pending'}
                                                {financeData.finance_status === 'Deposited' && <CheckCircle size={28} fill="#10b981" color="black" />}
                                            </div>
                                        </div>

                                        {/* Invoice Details */}
                                        <div style={{ ...glassCardStyle, padding: 0, overflow: 'hidden' }}>
                                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Invoice Ref No.</span>
                                                <span style={{ fontWeight: 600 }}>{financeData.invoice_ref_no || '—'}</span>
                                            </div>
                                            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Invoice No.</span>
                                                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{financeData.invoice_no || '—'}</span>
                                            </div>
                                            {(financeData.finance_deposited_date || financeData.deposited_date || financeData.deposited_at) && (
                                                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Deposited Date</span>
                                                    <span style={{ fontWeight: 600 }}>{financeData.finance_deposited_date || financeData.deposited_date || financeData.deposited_at}</span>
                                                </div>
                                            )}
                                            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Waybill ID</span>
                                                <span style={{ fontWeight: 600 }}>{order.trackingNumber}</span>
                                            </div>
                                        </div>

                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                                            Financial details are synchronized directly from the courier's invoicing system.
                                        </p>

                                        {/* Action Button */}
                                        <button
                                            onClick={handleSyncFinance}
                                            disabled={financeLoading}
                                            className="btn btn-primary"
                                            style={{
                                                width: '100%', padding: '1rem', borderRadius: '12px',
                                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem',
                                                fontSize: '1rem', fontWeight: 600, marginTop: '1rem'
                                            }}
                                        >
                                            {financeLoading ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                                            Sync Payment Status
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        <div style={{ marginBottom: '1rem', opacity: 0.5 }}><Truck size={48} /></div>
                                        <h3>No Finance Record</h3>
                                        <p>This order has not been invoiced by the courier yet.</p>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>

            <style>{`
                /* Default (Desktop) Styles */
                .tracking-modal-header {
                    padding: 1.5rem;
                }
                .tracking-tabs-container {
                    padding: 0 1.5rem;
                    margin-top: 1.5rem;
                }
                .tracking-content-body {
                    padding: 1.5rem;
                    min-height: 300px;
                }
                .tracking-info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .status-card {
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .status-text {
                    font-size: 1.75rem;
                }
                .status-icon-container {
                    padding: 1rem;
                }

                /* Mobile Optimizations */
                @media (max-width: 768px) {
                    .tracking-modal-content {
                        border-radius: 0 !important;
                        height: 100% !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        display: flex;
                        flex-direction: column;
                    }
                    .tracking-modal-header {
                        padding: 1rem;
                    }
                    .tracking-tabs-container {
                        padding: 0 1rem;
                        margin-top: 1rem;
                    }
                    .tracking-content-body {
                        padding: 1rem;
                        flex: 1;
                        overflow-y: auto;
                    }
                    .tracking-info-grid {
                        grid-template-columns: 1fr; /* Stack vertically */
                        gap: 0.75rem;
                        margin-bottom: 1.5rem;
                    }
                    .status-card {
                        padding: 1.25rem;
                        margin-bottom: 1.25rem;
                    }
                    .status-text {
                        font-size: 1.5rem;
                    }
                    .status-icon-container {
                        padding: 0.75rem;
                    }
                }
            `}</style>
        </div>
    )
}

export default CurfoxTrackingModal
