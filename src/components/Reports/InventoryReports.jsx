import { useMemo, useState, useEffect } from 'react'
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { formatCurrency, calculateInventoryMetrics } from '../../utils/reportUtils'
import { getInventoryLogs } from '../../utils/inventoryLogs'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const InventoryReports = ({ inventory, isMobile }) => {
    const { statusData, lowStockItems, totalValue, stockAlerts } = useMemo(() =>
        calculateInventoryMetrics(inventory), [inventory]
    )

    const [logs, setLogs] = useState([])

    useEffect(() => {
        getInventoryLogs().then(setLogs)
    }, [inventory])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
            <style>{`
                .inventory-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
                    gap: 1rem;
                    width: 100%;
                }
                @media (max-width: 768px) {
                    .inventory-stats-grid { grid-template-columns: 1fr; }
                    .inventory-desktop-table { display: none; }
                    .inventory-mobile-list { display: flex !important; flex-direction: column; gap: 1rem; }
                    .inventory-mobile-card {
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid var(--border-color);
                        border-radius: 12px;
                        padding: 1rem;
                    }
                    .inventory-card-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 0.5rem;
                        font-size: 0.85rem;
                    }
                }
            `}</style>

            <div className="inventory-stats-grid">
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total Inventory Value</h3>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(totalValue)}</p>
                </div>
                <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Low Stock Alerts</h3>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>{stockAlerts}</p>
                </div>
            </div>

            <div className="card" style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Stock Status</h3>
                <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%" cy="45%"
                                innerRadius={50} outerRadius={70}
                                paddingAngle={5} dataKey="value" stroke="none"
                            >
                                {statusData.map((entry, index) => (
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

            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--error)' }}>Low Stock Alerts</h3>
                </div>

                <div className="inventory-desktop-table" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Product</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Category</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'right', fontSize: '0.8rem' }}>On Hand</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'right', fontSize: '0.8rem' }}>Min Required</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lowStockItems.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.85rem' }}>{item.name}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.category}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--error)', fontWeight: 600, fontSize: '0.85rem' }}>{item.quantity}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.minStock || 10}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="inventory-mobile-list" style={{ display: 'none', padding: '1rem' }}>
                    {lowStockItems.map((item, idx) => (
                        <div key={idx} className="inventory-mobile-card">
                            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{item.name}</div>
                            <div className="inventory-card-row"><span>Category</span><span>{item.category}</span></div>
                            <div className="inventory-card-row"><span>Current Stock</span><span style={{ color: 'var(--error)', fontWeight: 700 }}>{item.quantity}</span></div>
                            <div className="inventory-card-row" style={{ marginBottom: 0 }}><span>Min Required</span><span>{item.minStock || 10}</span></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Inventory History Table */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Usage History</h3>
                </div>
                <div className="inventory-desktop-table" style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Date</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Item</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Action</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'right', fontSize: '0.8rem' }}>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        No history recorded yet
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {new Date(log.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.85rem' }}>{log.itemName}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                backgroundColor: log.action === 'Restock' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                color: log.action === 'Restock' ? 'var(--success)' : 'var(--error)',
                                                fontWeight: 600
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>{log.quantity}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View for History */}
                <div className="inventory-mobile-list" style={{ display: 'none', padding: '1rem' }}>
                    {logs.map((log, idx) => (
                        <div key={idx} className="inventory-mobile-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{log.itemName}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()}</span>
                            </div>
                            <div className="inventory-card-row">
                                <span>Action</span>
                                <span style={{
                                    color: log.action === 'Restock' ? 'var(--success)' : 'var(--error)',
                                    fontWeight: 600
                                }}>{log.action}</span>
                            </div>
                            <div className="inventory-card-row" style={{ marginBottom: 0 }}>
                                <span>Quantity</span>
                                <span>{log.quantity}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default InventoryReports
