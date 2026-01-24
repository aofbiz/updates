import { useState, useEffect, useMemo } from 'react'
import { Package, Filter, Search, AlertTriangle, CheckCircle, Plus, X, Save, History, ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react'
import CustomDropdown from './Common/CustomDropdown'
import CollapsibleDateFilter from './Common/CollapsibleDateFilter'
import { getInventory, getInventoryCategories, saveInventory, addInventoryLog, getInventoryLogs, deleteInventoryLog, clearInventoryLogs, deleteInventoryItem } from '../utils/storage'
import ProFeatureLock from './ProFeatureLock'
import { useLicensing } from './LicensingContext'
import { format, startOfMonth, endOfMonth, parse, isWithinInterval } from 'date-fns'
import ConfirmationModal from './ConfirmationModal'

// --- Quick Restock Modal ---
const QuickRestockModal = ({ item, mode = 'add', onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState('')
  const [transactionType, setTransactionType] = useState(mode === 'add' ? 'Restock' : 'Used in Order')

  const isRemove = mode === 'remove'

  const handleSubmit = (e) => {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) return
    onConfirm(item.id, qty, mode, transactionType)
  }

  const typeOptions = isRemove
    ? ['Used in Order', 'Damaged', 'Expired', 'Correction (-)', 'Other']
    : ['Restock', 'Return', 'Correction (+)', 'Other']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{isRemove ? 'Deduct Stock' : 'Quick Restock'}</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Item</p>
          <p style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.itemName}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Current Stock: {item.currentStock}</p>
        </div>
        <form noValidate onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Quantity to {isRemove ? 'Remove' : 'Add'}</label>
            <input
              type="number"
              className="form-input"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              autoFocus
              min="0.0001"
              step="any"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason / Type</label>
            <CustomDropdown
              options={typeOptions.map(opt => ({ value: opt, label: opt }))}
              value={transactionType}
              onChange={setTransactionType}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn ${isRemove ? 'btn-danger' : 'btn-primary'}`}>
              {isRemove ? 'Remove Stock' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
const Inventory = ({ inventory, onUpdateInventory, initialFilter }) => {
  const { isFreeUser } = useLicensing()
  const [filter, setFilter] = useState(initialFilter || 'all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [inventoryCategories, setInventoryCategories] = useState({ categories: [] })
  const [restockConfig, setRestockConfig] = useState(null) // { item, mode }
  const [recentLogs, setRecentLogs] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'default', confirmText: 'Confirm', onConfirm: null })

  const showConfirm = (title, message, onConfirm, type = 'danger', confirmText = 'Confirm') => {
    setModalConfig({ isOpen: true, title, message, onConfirm, type, confirmText })
  }

  // Date Filter State for History
  const [filterType, setFilterType] = useState(() => localStorage.getItem('allset_inventory_filter_type') || 'month')
  const [selectedMonth, setSelectedMonth] = useState(() => localStorage.getItem('allset_inventory_selected_month') || format(new Date(), 'yyyy-MM'))
  const [startDate, setStartDate] = useState(() => localStorage.getItem('allset_inventory_start_date') || format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => localStorage.getItem('allset_inventory_end_date') || format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getInventoryCategories()
      setInventoryCategories(categories)
    }
    loadCategories()
    loadLogs()
  }, [])

  const loadLogs = async () => {
    const logs = await getInventoryLogs()
    setRecentLogs(logs)
  }

  // Listen for cloud sync updates
  useEffect(() => {
    const handleSync = (e) => {
      console.log('Inventory: Sync update detected, refreshing logs...', e.type)
      loadLogs()
    }
    window.addEventListener('sync:inventoryLogs', handleSync)
    window.addEventListener('sync:inventory_logs', handleSync) // Handle both naming conventions
    return () => {
      window.removeEventListener('sync:inventoryLogs', handleSync)
      window.removeEventListener('sync:inventory_logs', handleSync)
    }
  }, [])

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter)
  }, [initialFilter])

  // Persist date filter state
  useEffect(() => {
    localStorage.setItem('allset_inventory_filter_type', filterType)
  }, [filterType])

  useEffect(() => {
    localStorage.setItem('allset_inventory_selected_month', selectedMonth)
  }, [selectedMonth])

  useEffect(() => {
    localStorage.setItem('allset_inventory_start_date', startDate)
  }, [startDate])

  useEffect(() => {
    localStorage.setItem('allset_inventory_end_date', endDate)
  }, [endDate])

  // Filter logs by date
  const filteredLogs = useMemo(() => {
    return recentLogs.filter(log => {
      if (!log.date) return true
      try {
        const logDate = new Date(log.date)

        if (filterType === 'month') {
          const monthStart = startOfMonth(parse(selectedMonth, 'yyyy-MM', new Date()))
          const monthEnd = endOfMonth(parse(selectedMonth, 'yyyy-MM', new Date()))
          return isWithinInterval(logDate, { start: monthStart, end: monthEnd })
        } else {
          const rangeStart = parse(startDate, 'yyyy-MM-dd', new Date())
          const rangeEnd = parse(endDate, 'yyyy-MM-dd', new Date())
          return isWithinInterval(logDate, { start: rangeStart, end: rangeEnd })
        }
      } catch (error) {
        return true
      }
    })
  }, [recentLogs, filterType, selectedMonth, startDate, endDate])

  const getUniqueCategories = () => {
    const categories = new Set()
    inventory.forEach(item => {
      if (item.category && item.category.trim()) categories.add(item.category)
    })
    return Array.from(categories).sort()
  }

  const getFilteredInventory = () => {
    let filtered = [...inventory]

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    if (filter === 'below') {
      filtered = filtered.filter(item => item.currentStock < item.reorderLevel)
    } else if (filter === 'approaching') {
      filtered = filtered.filter(item => {
        const stock = item.currentStock
        const reorder = item.reorderLevel
        return stock >= reorder && stock <= reorder * 1.2
      })
    } else if (filter === 'above') {
      filtered = filtered.filter(item => item.currentStock > item.reorderLevel * 1.2)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.itemName.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        (item.supplier && item.supplier.toLowerCase().includes(query))
      )
    }

    return filtered.sort((a, b) => (Number(a.currentStock) || 0) - (Number(b.currentStock) || 0))
  }

  const filteredInventory = useMemo(() => getFilteredInventory(), [inventory, filter, categoryFilter, searchQuery])

  // --- Metrics ---
  const metrics = useMemo(() => {
    const totalItems = inventory.length
    const totalValue = inventory.reduce((sum, item) => sum + (item.currentStock * (item.unitCost || 0)), 0)
    const lowStockCount = inventory.filter(item => item.currentStock < item.reorderLevel).length
    return { totalItems, totalValue, lowStockCount }
  }, [inventory])

  const handleRestock = async (itemId, quantity, mode, transactionType) => {

    const updatedInventory = inventory.map(item => {
      if (item.id === itemId) {
        const adjustment = mode === 'remove' ? -quantity : quantity
        const newStock = Math.max(0, item.currentStock + adjustment)

        // Log the transaction
        addInventoryLog({
          inventoryItemId: item.id,
          itemName: item.itemName,
          category: item.category,
          transactionType: transactionType, // e.g., 'Restock', 'Used'
          quantityChange: adjustment,
          balanceAfter: newStock
        }).then(() => loadLogs()) // Refresh logs in background

        return { ...item, currentStock: newStock }
      }
      return item
    })
    await saveInventory(updatedInventory)
    if (onUpdateInventory) onUpdateInventory(updatedInventory)
    setRestockConfig(null)
  }

  const getStockStatus = (item) => {
    const stock = Number(item.currentStock) || 0
    const reorder = Number(item.reorderLevel) || 0

    if (reorder === 0) return null

    if (stock < reorder) {
      return { label: 'Critical', color: 'var(--error)', bg: 'rgba(239, 68, 68, 0.1)', icon: AlertTriangle }
    } else if (stock >= reorder && stock <= reorder * 1.2) {
      return { label: 'Low', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)', icon: AlertTriangle }
    } else {
      return { label: 'Good', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)', icon: CheckCircle }
    }
  }

  const handleClearLogs = async () => {
    showConfirm('Clear All History', 'Are you sure you want to delete all transaction history? This cannot be undone.', async () => {
      await clearInventoryLogs()
      loadLogs()
    })
  }

  const handleDeleteLog = async (logId) => {
    showConfirm('Delete Log Entry', 'Are you sure you want to delete this log entry?', async () => {
      await deleteInventoryLog(logId)
      loadLogs()
    })
  }

  const handleDeleteItem = async (itemId) => {
    showConfirm('Delete Inventory Item', 'Are you sure you want to delete this item? This will also remove it from the dashboard.', async () => {
      const success = await deleteInventoryItem(itemId)
      if (success) {
        if (onUpdateInventory) {
          const updated = inventory.filter(i => i.id !== itemId)
          onUpdateInventory(updated)
        }
      }
    })
  }

  // Wrap entire content with ProFeatureLock for Free users
  const content = (
    <div>
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
      />
      <style>{`
        @media (max-width: 600px) {
          .inventory-header h1 {
            font-size: 1.5rem !important;
          }
          .inventory-filters {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .inventory-filters > div {
            width: 100% !important;
          }
          .inventory-metrics-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 480px) {
          .inventory-desktop-table {
            display: none !important;
          }
          .inventory-mobile-cards {
            display: flex !important;
            flex-direction: column !important;
            gap: 1rem !important;
          }
          .inventory-mobile-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 1.25rem;
          }
          .inv-card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
          }
          .inv-card-title {
            font-weight: 700;
            color: var(--text-primary);
            font-size: 1rem;
            margin-bottom: 0.25rem;
          }
          .inv-card-category {
            font-size: 0.8rem;
            color: var(--text-muted);
          }
          .inv-card-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1.25rem;
            padding: 0.75rem;
            background: rgba(255, 255, 255, 0.02);
            border-radius: var(--radius);
          }
          .inv-stat-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 0.2rem;
          }
          .inv-stat-value {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-primary);
          }
        }

        @media (min-width: 481px) {
          .inventory-mobile-cards {
            display: none !important;
          }
        }
      `}</style>

      <div className="page-header">
        <div className="page-header-info">
          <h1>Inventory</h1>
          <p>Manage and monitor your stock levels</p>
        </div>
      </div>

      {/* --- Restock Modal --- */}
      {restockConfig && (
        <QuickRestockModal
          item={restockConfig.item}
          mode={restockConfig.mode}
          onClose={() => setRestockConfig(null)}
          onConfirm={handleRestock}
        />
      )}

      {/* --- Summary Cards --- */}
      <div className="inventory-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>Total Inventory Value</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Rs. {metrics.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>Unique Items</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.totalItems}</p>
        </div>
        <div className="card" style={{
          padding: '1.25rem',
          borderColor: metrics.lowStockCount > 0 ? 'rgba(239, 68, 68, 0.5)' : undefined,
          boxShadow: metrics.lowStockCount > 0 ? '0 0 20px rgba(239, 68, 68, 0.15)' : undefined
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>Critical Stock Items</h3>
          <p style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: metrics.lowStockCount > 0 ? 'var(--error)' : 'var(--text-muted)',
            textShadow: metrics.lowStockCount > 0 ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none'
          }}>
            {metrics.lowStockCount}
          </p>
        </div>
      </div>




      {/* --- Usage History Toggle --- */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', color: 'var(--accent-primary)',
            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', padding: 0
          }}
        >
          <History size={16} />
          {showHistory ? 'Hide Usage History' : 'Show Usage History'}
        </button>
      </div>

      {showHistory && (
        <div className="card" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Transactions</h3>
              {filteredLogs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  style={{
                    background: 'none', border: 'none', color: 'var(--error)',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    padding: '4px 8px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                  onMouseEnter={e => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                >
                  Clear History
                </button>
              )}
            </div>
            <CollapsibleDateFilter
              filterType={filterType}
              onFilterTypeChange={setFilterType}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              startDate={startDate}
              endDate={endDate}
              onRangeChange={({ startDate: newStart, endDate: newEnd }) => {
                if (newStart) setStartDate(newStart)
                if (newEnd) setEndDate(newEnd)
              }}
              onReset={() => {
                setFilterType('month')
                setSelectedMonth(format(new Date(), 'yyyy-MM'))
                setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
                setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
              }}
              align="right"
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Item</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Qty Change</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Balance</th>
                  <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found for the selected period.</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const isPositive = log.quantityChange > 0
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {new Date(log.date).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 500 }}>
                          {log.itemName}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.category}</div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
                          <span style={{
                            padding: '0.2rem 0.6rem', borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '0.75rem'
                          }}>
                            {log.transactionType}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: isPositive ? 'var(--success)' : 'var(--error)' }}>
                          {isPositive ? '+' : ''}{log.quantityChange}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {log.balanceAfter}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '4px', opacity: 0.7,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.target.style.color = 'var(--error)'; e.target.style.opacity = 1 }}
                            onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; e.target.style.opacity = 0.7 }}
                            title="Delete Log"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Filters --- */}
      <div className="inventory-filters" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: '180px' }}>
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'below', label: 'Critical Only' },
              { value: 'approaching', label: 'Low Only' },
              { value: 'above', label: 'Good Only' }
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Categories' },
              ...getUniqueCategories().map(category => ({ value: category, label: category }))
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            searchable={getUniqueCategories().length > 5}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', flex: 1, minWidth: '250px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', width: '100%' }}
          />
        </div>
      </div>

      {/* --- Inventory Table / Cards --- */}
      {filteredInventory.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Package size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>No items match your filter.</p>
        </div>
      ) : (
        <>
          <div className="card inventory-desktop-table" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Reorder</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Stock</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Value</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item)
                  const StatusIcon = status ? status.icon : null
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.itemName}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{item.category || '-'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.reorderLevel}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.currentStock.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        Rs.{(item.currentStock * (item.unitCost || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        {status && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.25rem 0.75rem', borderRadius: '999px',
                            backgroundColor: status.bg, color: status.color,
                            fontSize: '0.75rem', fontWeight: 600
                          }}>
                            <StatusIcon size={12} /> {status.label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => setRestockConfig({ item, mode: 'remove' })}
                            title="Deduct Stock"
                            style={{ padding: '0.4rem', color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setRestockConfig({ item, mode: 'add' })}
                            title="Add Stock"
                            style={{ padding: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete Item"
                            style={{ padding: '0.4rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="inventory-mobile-cards">
            {filteredInventory.map((item) => {
              const status = getStockStatus(item)
              const StatusIcon = status ? status.icon : null
              return (
                <div key={item.id + '-mobile'} className="inventory-mobile-card">
                  <div className="inv-card-header">
                    <div>
                      <h4 className="inv-card-title">{item.itemName}</h4>
                      <p className="inv-card-category">{item.category || 'No Category'}</p>
                    </div>
                    {status && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.6rem', borderRadius: '999px',
                        backgroundColor: status.bg, color: status.color,
                        fontSize: '0.65rem', fontWeight: 600
                      }}>
                        <StatusIcon size={10} /> {status.label}
                      </span>
                    )}
                  </div>

                  <div className="inv-card-stats">
                    <div>
                      <p className="inv-stat-label">Stock</p>
                      <p className="inv-stat-value" style={{ color: status ? status.color : 'var(--text-primary)' }}>{item.currentStock.toLocaleString('en-IN')}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="inv-stat-label">Value</p>
                      <p className="inv-stat-value">Rs.{(item.currentStock * (item.unitCost || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setRestockConfig({ item, mode: 'remove' })}
                      style={{ flex: 1, justifyContent: 'center', color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none' }}
                    >
                      Deduct
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setRestockConfig({ item, mode: 'add' })}
                      style={{ flex: 2, justifyContent: 'center' }}
                    >
                      <Plus size={14} /> Add Stock
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ padding: '0.5rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: 'none' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

    </div>
  )

  // If Free user, wrap with ProFeatureLock
  if (isFreeUser) {
    return (
      <ProFeatureLock
        featureName="Inventory Management"
        showContent={false}
        features={[
          "Real-time Stock Tracking & Monitoring",
          "Low Stock Alerts & Reorder Levels",
          "Comprehensive Usage History & Logs",
          "Inventory Valuation & Cost Analysis"
        ]}
      >
        {content}
      </ProFeatureLock>
    )
  }

  return content
}

export default Inventory
