import { useMemo } from 'react'
import {
    BarChart, Bar, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts'
import { calculateCourierReportsMetrics, formatCurrency } from '../../utils/reportUtils'
import { Truck, DollarSign, AlertCircle, Clock, Package } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const CourierReports = ({ orders, expenses, isMobile }) => {
    const metrics = useMemo(() => calculateCourierReportsMetrics(orders, expenses), [orders, expenses])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem' }}>
            <style>{`
                .courier-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
                    gap: 1.5rem;
                }
                .courier-stat-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .courier-stat-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .courier-stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                @media (max-width: 768px) {
                    .courier-grid { grid-template-columns: 1fr; }
                }
            `}</style>

            {/* --- 1. Shipment Overview & COD Ledger Summary --- */}
            <div className="courier-grid">
                <div className="courier-stat-card">
                    <div className="courier-stat-header"><Truck size={18} /> Shipment Overview</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <div className="courier-stat-value">{orders.length}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Shipments</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--success)', fontWeight: 600 }}>{((orders.filter(o => o.status === 'Delivered').length / orders.length) * 100 || 0).toFixed(1)}%</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Delivered</div>
                        </div>
                    </div>
                </div>

                <div className="courier-stat-card">
                    <div className="courier-stat-header"><DollarSign size={18} /> COD Ledger</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <div className="courier-stat-value" style={{ color: 'var(--accent-primary)' }}>{formatCurrency(metrics.codLedger.pending)}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Collection</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(metrics.codLedger.collected)}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Collected</div>
                        </div>
                    </div>
                </div>

                <div className="courier-stat-card">
                    <div className="courier-stat-header"><Clock size={18} /> Delivery Metrics (TAT)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <div className="courier-stat-value">{metrics.tatMetrics.avgTAT} Days</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg. Dispatch Time</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'var(--warning)', fontWeight: 600 }}>{metrics.tatMetrics.tatChartData[0]?.value || 0}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Next Day Dispatches</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 2. Shipment Status & NDR Analysis --- */}
            <div className="courier-grid">
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Shipment Status Distribution</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.shipmentOverview}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={90}
                                    paddingAngle={5} dataKey="value"
                                    stroke="none"
                                >
                                    {metrics.shipmentOverview.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '0.85rem' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>NDR Analysis</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Non-Delivery Report & Return Trends</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', height: '240px' }}>
                        <div style={{ flex: 1, height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={metrics.ndrAnalysis.ndrStatusData}
                                        cx="50%" cy="50%"
                                        innerRadius={40} outerRadius={70}
                                        dataKey="value" stroke="none"
                                    >
                                        {metrics.ndrAnalysis.ndrStatusData.map((entry, index) => (
                                            <Cell key={`cell-ndr-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--danger)' }}>{metrics.ndrAnalysis.returnRate}%</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Overall Return Rate</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span>Total Dispatched</span>
                                    <span>{orders.filter(o => ['Dispatched', 'Delivered', 'returned'].includes(o.status)).length}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span>Returned</span>
                                    <span style={{ color: 'var(--danger)' }}>{orders.filter(o => o.status === 'returned').length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 3. Shipping Spend & TAT Distribution --- */}
            <div className="courier-grid">
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Shipping Spend Trend</h3>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.shippingSpendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Area type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorSpend)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Total Shipping Spend: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCurrency(metrics.totalShippingSpend)}</span>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dispatch Turnaround Time (TAT)</h3>
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.tatMetrics.tatChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                />
                                <Bar dataKey="value" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Performance: <span style={{ color: 'var(--success)', fontWeight: 700 }}>{metrics.tatMetrics.avgTAT} Days Avg.</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CourierReports
