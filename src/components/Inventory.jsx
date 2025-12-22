import { useState, useEffect, useMemo } from 'react'
import { Package, Filter, Search, AlertTriangle, CheckCircle, Plus, X, Save } from 'lucide-react'
import { getInventory, getInventoryCategories, saveInventory } from '../utils/storage'
import { addInventoryLog } from '../utils/inventoryLogs'

// --- Quick Restock Modal ---
const QuickRestockModal = ({ item, mode = 'add', onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) return
    onConfirm(item.id, qty, mode)
  }

  const isRemove = mode === 'remove'

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
        <form onSubmit={handleSubmit}>
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
  const [filter, setFilter] = useState(initialFilter || 'all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [inventoryCategories, setInventoryCategories] = useState({ categories: [] })
  const [restockConfig, setRestockConfig] = useState(null) // { item, mode }

  useEffect(() => {
    const loadCategories = async () => {
      const categories = await getInventoryCategories()
      setInventoryCategories(categories)
    }
    loadCategories()
  }, [])

  useEffect(() => {
    if (initialFilter) setFilter(initialFilter)
  }, [initialFilter])

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

  const handleRestock = async (itemId, quantity, mode) => {
    // Log the action
    const item = inventory.find(i => i.id === itemId)
    if (item) {
      await addInventoryLog({
        itemId: item.id,
        itemName: item.itemName,
        action: mode === 'remove' ? 'Deduct' : 'Restock',
        quantity: quantity
      })
    }

    const updatedInventory = inventory.map(item => {
      if (item.id === itemId) {
        const adjustment = mode === 'remove' ? -quantity : quantity
        return { ...item, currentStock: Math.max(0, item.currentStock + adjustment) }
      }
      return item
    })
    await saveInventory(updatedInventory)
    if (onUpdateInventory) onUpdateInventory(updatedInventory)
    setRestockConfig(null)
  }

  const getStockStatus = (item) => {
    const stock = item.currentStock
    const reorder = item.reorderLevel

    if (stock < reorder) {
      return { label: 'Critical', color: 'var(--error)', bg: 'rgba(239, 68, 68, 0.1)', icon: AlertTriangle }
    } else if (stock >= reorder && stock <= reorder * 1.2) {
      return { label: 'Low', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)', icon: AlertTriangle }
    } else {
      return { label: 'Good', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)', icon: CheckCircle }
    }
  }

  return (
    <div>
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

      <div className="inventory-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Inventory</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage and monitor your stock levels</p>
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

      {/* --- Filters --- */}
      <div className="inventory-filters" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
          <Filter size={18} color="var(--text-muted)" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', outline: 'none', minWidth: '100px', width: '100%' }}
          >
            <option value="all">All Status</option>
            <option value="below">Critical Only</option>
            <option value="approaching">Low Only</option>
            <option value="above">Good Only</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', outline: 'none', minWidth: '120px', width: '100%' }}
          >
            <option value="all">All Categories</option>
            {getUniqueCategories().map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
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
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Stock</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Value</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const status = getStockStatus(item)
                  const StatusIcon = status.icon
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.itemName}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{item.category || '-'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.currentStock.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        Rs.{(item.currentStock * (item.unitCost || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.25rem 0.75rem', borderRadius: '999px',
                          backgroundColor: status.bg, color: status.color,
                          fontSize: '0.75rem', fontWeight: 600
                        }}>
                          <StatusIcon size={12} /> {status.label}
                        </span>
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
                            style={{ padding: '0.4rem 0.8rem', display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}
                          >
                            <Plus size={14} /> Add
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
              const StatusIcon = status.icon
              return (
                <div key={item.id + '-mobile'} className="inventory-mobile-card">
                  <div className="inv-card-header">
                    <div>
                      <h4 className="inv-card-title">{item.itemName}</h4>
                      <p className="inv-card-category">{item.category || 'No Category'}</p>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.2rem 0.6rem', borderRadius: '999px',
                      backgroundColor: status.bg, color: status.color,
                      fontSize: '0.65rem', fontWeight: 600
                    }}>
                      <StatusIcon size={10} /> {status.label}
                    </span>
                  </div>

                  <div className="inv-card-stats">
                    <div>
                      <p className="inv-stat-label">Stock</p>
                      <p className="inv-stat-value" style={{ color: status.color }}>{item.currentStock.toLocaleString('en-IN')}</p>
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
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default Inventory
