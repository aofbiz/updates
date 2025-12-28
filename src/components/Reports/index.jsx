import { useState, useEffect, useMemo, useRef } from 'react'
import SalesReports from './SalesReports'
import ExpenseReports from './ExpenseReports'
import ProfitabilityReports from './ProfitabilityReports'
import OrdersReports from './OrdersReports'
import InventoryReports from './InventoryReports'
import CourierReports from './CourierReports'
import { Truck, FileText, TrendingUp, DollarSign, ShoppingBag, Package, PieChart, Download, Calendar, Printer, ChevronDown, FileSpreadsheet } from 'lucide-react'
import { filterByDateRange, getMonthlyFinancials } from '../../utils/reportUtils'
import * as XLSX from 'xlsx'
import { startOfMonth, endOfMonth, format } from 'date-fns'

const Reports = ({ orders, expenses, inventory }) => {
    const [activeTab, setActiveTab] = useState('sales')
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const exportMenuRef = useRef(null)

    // Global Filters
    const [filterType, setFilterType] = useState('month') // 'month' or 'range'
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    })

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)

        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setShowExportMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            window.removeEventListener('resize', handleResize)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Calculate effective date range for filtering
    const effectiveRange = useMemo(() => {
        if (filterType === 'month') {
            const date = new Date(selectedMonth + '-01')
            return {
                start: format(startOfMonth(date), 'yyyy-MM-dd'),
                end: format(endOfMonth(date), 'yyyy-MM-dd')
            }
        }
        return dateRange
    }, [filterType, selectedMonth, dateRange])

    // Filtered Data
    const filteredOrders = useMemo(() => {
        return filterByDateRange(orders, 'orderDate', effectiveRange.start, effectiveRange.end)
    }, [orders, effectiveRange])

    const filteredExpenses = useMemo(() => {
        return filterByDateRange(expenses, 'date', effectiveRange.start, effectiveRange.end)
    }, [expenses, effectiveRange])

    const getExportData = () => {
        // 1. Sales Sheet
        const sales = filteredOrders.map(o => ({
            ID: o.id,
            Date: o.orderDate,
            Customer: o.customerName,
            Amount: o.totalPrice,
            Status: o.status,
            Source: o.orderSource,
            Payment: o.paymentStatus
        }))

        // 2. Expenses Sheet
        const exps = filteredExpenses.map(e => ({
            Date: e.date,
            Item: e.item || e.description,
            Category: e.category,
            Amount: e.amount,
            Reference: e.reference || ''
        }))

        // 3. Profitability (Monthly Breakdown)
        const profitability = getMonthlyFinancials(filteredOrders, filteredExpenses).map(m => ({
            Month: m.date,
            Revenue: m.revenue,
            Expenses: m.expenses,
            Profit: m.profit,
            Margin: m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) + '%' : '0%'
        }))

        // 4. Orders Sheet (Detailed)
        const ordersData = filteredOrders.map(o => ({
            ID: o.id,
            Date: o.orderDate,
            Customer: o.customerName,
            Status: o.status,
            Source: o.orderSource,
            Total: o.totalPrice,
            Items: (o.orderItems || []).map(i => `${i.itemName} (x${i.quantity})`).join(', ')
        }))

        // 5. Inventory Sheet
        const inv = inventory.map(i => ({
            Name: i.itemName,
            Category: i.category,
            Stock: i.currentStock,
            Unit: i.unit,
            Cost: i.unitCost,
            Value: (Number(i.currentStock) || 0) * (Number(i.unitCost) || 0)
        }))

        return { sales, exps, profitability, ordersData, inv }
    }

    const handleExportExcel = () => {
        const { sales, exps, profitability, ordersData, inv } = getExportData()
        const wb = XLSX.utils.book_new()

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales), "Sales")
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exps), "Expenses")
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(profitability), "Profitability")
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersData), "Orders")
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inv), "Inventory")

        XLSX.writeFile(wb, `Full_Business_Report_${effectiveRange.start}_to_${effectiveRange.end}.xlsx`)
        setShowExportMenu(false)
    }

    const handlePrint = () => {
        setShowExportMenu(false)
        window.print()
    }

    const tabs = [
        { id: 'sales', label: 'Sales', icon: TrendingUp },
        { id: 'expenses', label: 'Expenses', icon: DollarSign },
        { id: 'profitability', label: 'Profitability', icon: PieChart },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'courier', label: 'Courier', icon: Truck },
    ]

    const renderContent = () => {
        const props = {
            orders: filteredOrders,
            expenses: filteredExpenses,
            inventory,
            isMobile,
            // Pass the original range if needed by sub-components
            range: effectiveRange
        }
        switch (activeTab) {
            case 'sales': return <SalesReports {...props} />
            case 'expenses': return <ExpenseReports {...props} />
            case 'profitability': return <ProfitabilityReports {...props} />
            case 'orders': return <OrdersReports {...props} />
            case 'inventory': return <InventoryReports {...props} />
            case 'courier': return <CourierReports {...props} />
            default: return <SalesReports {...props} />
        }
    }

    return (
        <div style={{
            padding: window.innerWidth < 450 ? '0.25rem' : (isMobile ? '0.75rem' : '1.5rem'),
            maxWidth: '100%',
            margin: '0 auto',
            overflowX: 'hidden'
        }}>
            <style>{`
                .reports-header-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .reports-header h1 {
                    font-size: 1.875rem;
                    font-weight: 800;
                    color: #fff;
                    margin-bottom: 0.25rem;
                    letter-spacing: -0.025em;
                    line-height: 1.2;
                }
                .reports-header p {
                    color: var(--text-muted);
                    font-size: 1rem;
                    line-height: 1.4;
                }
                .report-controls {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.4rem;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                }
                .filter-input {
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 0.85rem;
                    outline: none;
                    padding: 0.25rem 0.5rem;
                }
                .filter-input::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                }
                
                .export-dropdown {
                    position: relative;
                }
                .export-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 0.5rem;
                    background: #1f2937;
                    border: 1px solid var(--border-color);
                    border-radius: 10px;
                    padding: 0.5rem;
                    min-width: 160px;
                    z-index: 1000;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                }
                .export-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.6rem 0.8rem;
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                }
                .export-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                @media (max-width: 1100px) {
                    .reports-header-container {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 1.25rem;
                    }
                    .report-controls {
                        justify-content: space-between;
                        width: 100%;
                    }
                }
                @media (max-width: 600px) {
                    .reports-header h1 { font-size: 1.35rem !important; }
                    .reports-header p { font-size: 0.8rem !important; }
                    .report-controls {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .filter-group {
                        justify-content: space-between;
                    }
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.55rem 1rem;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    white-space: nowrap;
                    border: none;
                    cursor: pointer;
                    background: transparent;
                    color: var(--text-muted);
                    border-radius: 8px;
                }
                .tab-btn.active {
                    background-color: var(--accent-primary);
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
                }
                .tab-btn:hover:not(.active) {
                    background-color: rgba(255, 255, 255, 0.05);
                    color: #fff;
                }
            `}</style>

            <div className="reports-header-container">
                <div className="reports-header">
                    <h1>Financial Reports</h1>
                    <p>Comprehensive analytics of your business performance</p>
                </div>

                <div className="report-controls">
                    <div className="filter-group">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="filter-input"
                            style={{ borderRight: '1px solid var(--border-color)', paddingRight: '0.5rem' }}
                        >
                            <option value="month">By Month</option>
                            <option value="range">Custom Range</option>
                        </select>

                        {filterType === 'month' ? (
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="filter-input"
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="filter-input"
                                />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="filter-input"
                                />
                            </div>
                        )}
                    </div>

                    <div className="export-dropdown" ref={exportMenuRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            style={{ gap: '0.5rem', minWidth: '130px', justifyContent: 'space-between' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Download size={16} /> Export
                            </div>
                            <ChevronDown size={14} />
                        </button>

                        {showExportMenu && (
                            <div className="export-menu">
                                <button className="export-item" onClick={handleExportExcel}>
                                    <FileSpreadsheet size={16} style={{ color: '#10b981' }} /> Excel (.xlsx)
                                </button>
                                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>
                                <button className="export-item" onClick={handlePrint}>
                                    <Printer size={16} style={{ color: '#ec4899' }} /> Print / PDF
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                overflowX: 'auto',
                paddingBottom: '0.75rem',
                marginBottom: '1.5rem',
                gap: '0.4rem',
                borderBottom: '1px solid var(--border-color)',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0
            }} className="no-scrollbar">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`tab-btn ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <div className="animate-fade-in" style={{ paddingBottom: '2rem' }}>
                {renderContent()}
            </div>
        </div>
    )
}

export default Reports
