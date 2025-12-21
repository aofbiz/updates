import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, AlertTriangle, Plus, Trash2, Edit2, Edit, Package, Search, ChevronDown, ChevronUp, Download, Upload, Trash, MessageCircle } from 'lucide-react'
import { generateTrackingNumbersFromRange, getSettings, saveSettings, getOrders, getTrackingNumbers, saveTrackingNumbers, getProducts, getOrderCounter, saveOrderCounter, exportAllData, importAllData, clearAllData } from '../utils/storage'
import ProductsManagement from './ProductsManagement'
import ExpenseManagement from './ExpenseManagement'
import InventoryManagement from './InventoryManagement'
import DataHealthCheck from './DataHealthCheck'
import OrderSourcesManagement from './OrderSourcesManagement'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const Settings = ({ orders = [], expenses = [], inventory = [], onDataImported, onUpdateInventory }) => {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    trackingNumbers: false,
    dataManagement: false,
    dataHealth: false,
    orderSources: false,
    whatsappTemplates: false
  })
  const [products, setProducts] = useState({ categories: [] })
  const [trackingNumbers, setTrackingNumbers] = useState([])
  const [orderCounter, setOrderCounter] = useState(null)

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'default',
    title: '',
    message: '',
    onConfirm: null,
    isAlert: false
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
      onConfirm,
      isAlert: false,
      confirmText
    })
  }

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }))
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      // If clicking the same section that's already expanded, collapse it
      // Otherwise, expand the clicked section and collapse all others
      const isCurrentlyExpanded = prev[section]
      const newState = {}

      // Collapse all sections first
      Object.keys(prev).forEach(key => {
        newState[key] = false
      })

      // If the clicked section wasn't expanded, expand it
      if (!isCurrentlyExpanded) {
        newState[section] = true
      }

      return newState
    })
  }

  useEffect(() => {
    const loadData = async () => {
      const [loadedSettings, ordersData, productsData, trackingNumbersData, counter] = await Promise.all([
        getSettings(),
        getOrders(),
        getProducts(),
        getTrackingNumbers(),
        getOrderCounter()
      ])
      setSettings(loadedSettings || {})
      setProducts(productsData)
      setTrackingNumbers(trackingNumbersData)
      setOrderCounter(counter)
    }
    loadData()
  }, [])


  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <SettingsIcon size={32} />
          Settings
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Configure your application settings
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'general', label: 'General' },
          { id: 'products', label: 'Products' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'inventory', label: 'Inventory' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (
        <>

          <CollapsibleSection
            title="Tracking Number Management"
            icon={Package}
            isExpanded={expandedSections.trackingNumbers}
            onToggle={() => toggleSection('trackingNumbers')}
          >
            <TrackingNumberManagement
              trackingNumbers={trackingNumbers}
              setTrackingNumbers={setTrackingNumbers}
              showAlert={showAlert}
              showConfirm={showConfirm}
              showToast={addToast} // Pass showToast
            />
          </CollapsibleSection>

          {/* WhatsApp Templates Section */}
          <CollapsibleSection
            title="WhatsApp Message Templates"
            icon={MessageCircle}
            isExpanded={expandedSections.whatsappTemplates}
            onToggle={() => toggleSection('whatsappTemplates')}
          >
            <WhatsAppTemplates
              settings={settings}
              setSettings={setSettings}
              showAlert={showAlert}
              showConfirm={showConfirm}
              showToast={addToast}
            />
          </CollapsibleSection>

          {/* Order Sources Section */}
          <CollapsibleSection
            title="Order Sources"
            icon={Package}
            isExpanded={expandedSections.orderSources}
            onToggle={() => toggleSection('orderSources')}
          >
            <OrderSourcesManagement />
          </CollapsibleSection>

          {/* Data Management Section (includes Health Check) */}
          <CollapsibleSection
            title="Data Management"
            icon={Package}
            isExpanded={expandedSections.dataManagement}
            onToggle={() => toggleSection('dataManagement')}
          >
            <DataManagement
              orders={orders}
              expenses={expenses}
              inventory={inventory}
              products={products}
              trackingNumbers={trackingNumbers}
              orderCounter={orderCounter}
              onDataImported={onDataImported}
              showAlert={showAlert}
              showConfirm={showConfirm}
              showToast={addToast}
            />

            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                Data Health Check
              </h3>
              <DataHealthCheck orders={orders} expenses={expenses} inventory={inventory} />
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Products Tab Content */}
      {activeTab === 'products' && (
        <ProductsManagement />
      )}

      {/* Expenses Tab Content */}
      {activeTab === 'expenses' && (
        <ExpenseManagement />
      )}

      {/* Inventory Tab Content */}
      {activeTab === 'inventory' && (
        <InventoryManagement inventory={inventory} onUpdateInventory={onUpdateInventory} />
      )}

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        isAlert={modalConfig.isAlert}
        confirmText={modalConfig.confirmText}
      />

    </div>
  )
}

// Collapsible Section Component (Reusable for future sections)
// Pattern for adding new collapsible sections:
// 1. Add section name to expandedSections state: { sectionName: true }
// 2. Wrap content in <CollapsibleSection> component
// 3. Pass: title, icon (optional), isExpanded={expandedSections.sectionName}, onToggle={() => toggleSection('sectionName')}
const CollapsibleSection = ({ title, icon: Icon, isExpanded, onToggle, children }) => {
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: isExpanded ? '1.5rem' : 0
        }}
      >
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {Icon && <Icon size={20} />}
          {title}
        </h2>
        {isExpanded ? (
          <ChevronUp size={20} color="var(--text-secondary)" />
        ) : (
          <ChevronDown size={20} color="var(--text-secondary)" />
        )}
      </button>

      {isExpanded && (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// Tracking Number Management Component
// Tracking Number Management Component
const TrackingNumberManagement = ({ trackingNumbers, setTrackingNumbers, showAlert, showConfirm, showToast }) => {
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [showBulkDeleteRange, setShowBulkDeleteRange] = useState(false)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [deleteRangeStart, setDeleteRangeStart] = useState('')
  const [deleteRangeEnd, setDeleteRangeEnd] = useState('')
  const [selectedNumbers, setSelectedNumbers] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all, available, used
  const [editingNumber, setEditingNumber] = useState(null) // { id, number }
  const [editValue, setEditValue] = useState('')

  // trackingNumbers and setTrackingNumbers are passed as props

  const handleBulkAdd = async () => {
    if (!rangeStart || !rangeEnd) {
      showToast('Please enter both start and end tracking numbers', 'warning')
      return
    }

    const newNumbers = generateTrackingNumbersFromRange(rangeStart.trim(), rangeEnd.trim())
    if (newNumbers.length === 0) {
      showToast('Invalid range format. Please use format like RM02818735 – RM02818900', 'warning')
      return
    }

    const existingSet = new Set(trackingNumbers.map(tn => tn.number))
    const toAdd = newNumbers.filter(tn => !existingSet.has(tn.number))

    if (toAdd.length === 0) {
      showToast('All tracking numbers in this range already exist', 'warning')
      return
    }

    const updated = [...trackingNumbers, ...toAdd]
    await saveTrackingNumbers(updated)
    setTrackingNumbers(updated)
    setRangeStart('')
    setRangeEnd('')
    setShowBulkAdd(false)
    showToast(`Added ${toAdd.length} tracking numbers`, 'success')
  }

  const handleBulkDelete = () => {
    if (selectedNumbers.size === 0) {
      showToast('Please select tracking numbers to delete', 'warning')
      return
    }

    showConfirm('Delete Selected', `Delete ${selectedNumbers.size} tracking number(s)?`, async () => {
      const updated = trackingNumbers.filter(tn => !selectedNumbers.has(tn.number))
      await saveTrackingNumbers(updated)
      setTrackingNumbers(updated)
      setSelectedNumbers(new Set())
      showToast(`Deleted ${selectedNumbers.size} tracking number(s)`, 'success')
    }, 'danger', 'Delete')
  }

  const handleDelete = (number) => {
    showConfirm('Delete Tracking Number', `Delete tracking number ${number}?`, async () => {
      const updated = trackingNumbers.filter(tn => tn.number !== number)
      await saveTrackingNumbers(updated)
      setTrackingNumbers(updated)
      showToast('Tracking number deleted', 'success')
    }, 'danger', 'Delete')
  }

  const handleEdit = (tn) => {
    setEditingNumber({ id: tn.id, number: tn.number })
    setEditValue(tn.status)
  }

  const handleSaveEdit = async () => {
    if (!editValue || (editValue !== 'available' && editValue !== 'used')) {
      showToast('Please select a valid status', 'warning')
      return
    }

    const updated = trackingNumbers.map(tn =>
      tn.id === editingNumber.id
        ? { ...tn, status: editValue }
        : tn
    )
    await saveTrackingNumbers(updated)
    setTrackingNumbers(updated)
    setEditingNumber(null)
    setEditValue('')
    showToast('Tracking number status updated', 'success')
  }

  const handleCancelEdit = () => {
    setEditingNumber(null)
    setEditValue('')
  }

  const handleBulkDeleteByRange = () => {
    if (!deleteRangeStart || !deleteRangeEnd) {
      showToast('Please enter both start and end tracking numbers', 'warning')
      return
    }

    const rangeNumbers = generateTrackingNumbersFromRange(deleteRangeStart.trim(), deleteRangeEnd.trim())
    if (rangeNumbers.length === 0) {
      showToast('Invalid range format. Please use format like RM02818735 – RM02818900', 'warning')
      return
    }

    const rangeSet = new Set(rangeNumbers)
    const toDelete = trackingNumbers.filter(tn => rangeSet.has(tn.number))

    if (toDelete.length === 0) {
      showToast('No tracking numbers found in this range', 'warning')
      return
    }

    showConfirm('Delete Range', `Delete ${toDelete.length} tracking number(s) in this range?`, async () => {
      const updated = trackingNumbers.filter(tn => !rangeSet.has(tn.number))
      await saveTrackingNumbers(updated)
      setTrackingNumbers(updated)
      setDeleteRangeStart('')
      setDeleteRangeEnd('')
      setShowBulkDeleteRange(false)
      showToast(`Deleted ${toDelete.length} tracking number(s)`, 'success')
    }, 'danger', 'Delete')
  }

  const handleBulkDeleteByStatus = () => {
    if (filterStatus === 'all') {
      showToast('Please select a specific status (Available or Used) from the filter dropdown', 'warning')
      return
    }

    const toDelete = trackingNumbers.filter(tn => tn.status === filterStatus)
    if (toDelete.length === 0) {
      showToast(`No tracking numbers with status "${filterStatus}" found`, 'warning')
      return
    }

    const statusLabel = filterStatus === 'available' ? 'Available' : 'Used'

    showConfirm('Delete All by Status', `Delete all ${toDelete.length} ${statusLabel} tracking number(s)? This action cannot be undone.`, async () => {
      const updated = trackingNumbers.filter(tn => tn.status !== filterStatus)
      await saveTrackingNumbers(updated)
      setTrackingNumbers(updated)
      showToast(`Deleted ${toDelete.length} ${statusLabel} tracking number(s)`, 'success')
    }, 'danger', 'Delete')
  }

  const toggleSelect = (number) => {
    const newSelected = new Set(selectedNumbers)
    if (newSelected.has(number)) {
      newSelected.delete(number)
    } else {
      newSelected.add(number)
    }
    setSelectedNumbers(newSelected)
  }

  const toggleSelectAll = () => {
    const filtered = getFilteredNumbers()
    const allSelected = filtered.every(tn => selectedNumbers.has(tn.number))
    if (allSelected) {
      setSelectedNumbers(new Set())
    } else {
      setSelectedNumbers(new Set(filtered.map(tn => tn.number)))
    }
  }

  const getFilteredNumbers = () => {
    let filtered = trackingNumbers

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(tn => tn.status === filterStatus)
    }

    // Filter by search
    if (searchTerm) {
      filtered = filtered.filter(tn =>
        tn.number.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return filtered.sort((a, b) => a.number.localeCompare(b.number))
  }

  const filteredNumbers = getFilteredNumbers()
  const availableCount = trackingNumbers.filter(tn => tn.status === 'available').length
  const usedCount = trackingNumbers.filter(tn => tn.status === 'used').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowBulkAdd(!showBulkAdd)}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          Bulk Add
        </button>
        <button
          onClick={() => setShowBulkDeleteRange(!showBulkDeleteRange)}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Trash2 size={18} />
          Delete by Range
        </button>
        <button
          onClick={handleBulkDeleteByStatus}
          className="btn btn-danger"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Trash2 size={18} />
          Delete by Status
        </button>
      </div>

      {/* Bulk Add Form */}
      {showBulkAdd && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Add Tracking Numbers by Range
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Enter range like: RM02818735 – RM02818900
          </p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Start Number</label>
              <input
                type="text"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                placeholder="RM02818735"
                className="form-input"
              />
            </div>
            <div style={{ paddingBottom: '0.5rem' }}>–</div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">End Number</label>
              <input
                type="text"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                placeholder="RM02818900"
                className="form-input"
              />
            </div>
            <button onClick={handleBulkAdd} className="btn btn-primary">
              Add Range
            </button>
            <button onClick={() => setShowBulkAdd(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete by Range Form */}
      {showBulkDeleteRange && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius)',
          marginBottom: '1.5rem',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--danger)' }}>
            Delete Tracking Numbers by Range
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Enter range like: RM02818735 – RM02818900
          </p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Start Number</label>
              <input
                type="text"
                value={deleteRangeStart}
                onChange={(e) => setDeleteRangeStart(e.target.value)}
                placeholder="RM02818735"
                className="form-input"
              />
            </div>
            <div style={{ paddingBottom: '0.5rem' }}>–</div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">End Number</label>
              <input
                type="text"
                value={deleteRangeEnd}
                onChange={(e) => setDeleteRangeEnd(e.target.value)}
                placeholder="RM02818900"
                className="form-input"
              />
            </div>
            <button onClick={handleBulkDeleteByRange} className="btn btn-danger">
              Delete Range
            </button>
            <button onClick={() => setShowBulkDeleteRange(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          flex: 1,
          minWidth: '150px'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Total
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {trackingNumbers.length}
          </div>
        </div>
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderRadius: 'var(--radius)',
          flex: 1,
          minWidth: '150px'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Available
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
            {availableCount}
          </div>
        </div>
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius)',
          flex: 1,
          minWidth: '150px'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
            Used
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger)' }}>
            {usedCount}
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            placeholder="Search tracking numbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.5rem'
            }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="used">Used</option>
        </select>
        {selectedNumbers.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="btn btn-danger"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Trash2 size={16} />
            Delete Selected ({selectedNumbers.size})
          </button>
        )}
      </div>

      {/* Tracking Numbers Table */}
      <div style={{ overflowX: 'auto' }}>
        {filteredNumbers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No tracking numbers found. Add tracking numbers using the Bulk Add button.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={filteredNumbers.length > 0 && filteredNumbers.every(tn => selectedNumbers.has(tn.number))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Tracking Number</th>
                <th>Status</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredNumbers.map((tn) => (
                <tr
                  key={tn.number}
                  style={{
                    backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedNumbers.has(tn.number)}
                      onChange={() => toggleSelect(tn.number)}
                    />
                  </td>
                  <td style={{ fontWeight: 500 }}>{tn.number}</td>
                  <td>
                    {editingNumber?.id === tn.id ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit()
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        className="form-input"
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          backgroundColor: editValue === 'used' ? 'var(--danger)' : 'var(--success)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 'var(--radius)',
                          cursor: 'pointer'
                        }}
                        autoFocus
                      >
                        <option value="available">Available</option>
                        <option value="used">Used</option>
                      </select>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.75rem',
                        backgroundColor: tn.status === 'used' ? 'var(--danger)' : 'var(--success)',
                        color: 'white'
                      }}>
                        {tn.status === 'used' ? 'Used' : 'Available'}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingNumber?.id === tn.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={handleSaveEdit}
                          className="btn btn-sm btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          onClick={() => handleEdit(tn)}
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(tn.number)}
                          className="btn btn-sm btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Data Management Component
const DataManagement = ({ orders, expenses, inventory, products, settings, trackingNumbers, orderCounter, onDataImported, showAlert, showConfirm, showToast }) => {
  const [importStatus, setImportStatus] = useState(null)

  const handleExport = async () => {
    // Also include inventory in the export function call
    const result = await exportAllData(orders, expenses, products, settings, trackingNumbers, orderCounter, inventory)
    if (result.success) {
      showToast(result.message, 'success')
    } else {
      showToast(result.message, 'error')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      showToast('Please select a valid JSON file', 'warning')
      return
    }

    try {
      setImportStatus('Importing...')
      const result = await importAllData(file)

      if (result.success) {
        setImportStatus('Import successful!')
        showToast('Data imported successfully! The page will reload.', 'success')

        // Call the callback to update parent state
        if (onDataImported) {
          onDataImported(result.data)
        }

        // Reload page after a short delay to show imported data
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setImportStatus('Import failed')
        showToast(result.message, 'error')
      }
    } catch (error) {
      setImportStatus('Import failed')
      showToast('Failed to import data: ' + error.message, 'error')
    } finally {
      e.target.value = '' // Reset file input
    }
  }

  const handleClear = () => {
    showConfirm('Warning: Data Loss', 'Are you sure you want to clear ALL data? This action cannot be undone!', () => {
      showConfirm('Final Confirmation', 'This will delete all orders, expenses, products, settings, and tracking numbers. Are you absolutely sure?', async () => {
        const result = await clearAllData()
        if (result.success) {
          showToast('All data cleared! The page will reload.', 'success')
          setTimeout(() => window.location.reload(), 1500)
        } else {
          showToast(result.message, 'error')
        }
      }, 'danger', 'Yes, Delete Everything')
    }, 'danger', 'Proceed')
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>
          Export & Import Data
        </h3>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          marginBottom: '1.5rem'
        }}>
          Export your data to a JSON file that can be imported in any browser or incognito mode.
          Data is also automatically saved to localStorage for quick access.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <Download size={32} color="var(--accent-primary)" style={{ margin: '0 auto 0.5rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Export Data</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Save all data to a JSON file
            </p>
            <button
              onClick={handleExport}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <Download size={16} style={{ marginRight: '0.5rem' }} />
              Export to File
            </button>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <Upload size={32} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Import Data</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Load data from a JSON file
            </p>
            <label className="btn btn-success" style={{ width: '100%', cursor: 'pointer', display: 'inline-block' }}>
              <Upload size={16} style={{ marginRight: '0.5rem' }} />
              Import from File
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
            {importStatus && (
              <p style={{
                fontSize: '0.75rem',
                color: importStatus.includes('success') ? 'var(--success)' : 'var(--danger)',
                marginTop: '0.5rem'
              }}>
                {importStatus}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{
        padding: '1rem',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid var(--danger)',
        borderRadius: 'var(--radius)',
        marginTop: '2rem'
      }}>
        <h4 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--danger)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Trash size={18} />
          Danger Zone
        </h4>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem'
        }}>
          Permanently delete all data from localStorage. Make sure you have exported your data before clearing!
        </p>
        <button
          onClick={handleClear}
          className="btn btn-danger"
        >
          <Trash size={16} style={{ marginRight: '0.5rem' }} />
          Clear All Data
        </button>
      </div>
    </div>
  )
}

// WhatsApp Templates Management Component
const WhatsAppTemplates = ({ settings, setSettings, showAlert, showConfirm, showToast }) => {
  const [viewOrderTemplate, setViewOrderTemplate] = useState(settings?.whatsappTemplates?.viewOrder || '')
  const [quickActionTemplate, setQuickActionTemplate] = useState(settings?.whatsappTemplates?.quickAction || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const updatedSettings = {
      ...settings,
      whatsappTemplates: {
        viewOrder: viewOrderTemplate,
        quickAction: quickActionTemplate
      }
    }
    const success = await saveSettings(updatedSettings)
    if (success) {
      setSettings(updatedSettings)
      showToast('WhatsApp templates saved successfully!', 'success')
    } else {
      showToast('Failed to save templates.', 'error')
    }
    setIsSaving(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Customize the messages sent to customers via WhatsApp. Use the following placeholders:
          <br />
          <code style={{ color: 'var(--accent-primary)' }}>{'{{order_id}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{order_date}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{tracking_number}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{customer_name}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{address}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{phone}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{whatsapp}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{city}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{district}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{item_details}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{subtotal}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{discount}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{total_price}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{delivery_charge}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{cod_amount}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{delivery_date}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{dispatch_date}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{status}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{payment_status}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{notes}}'}</code>,
          <code style={{ color: 'var(--accent-primary)' }}>{'{{source}}'}</code>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>View Order Page Template</label>
          <textarea
            className="form-input"
            value={viewOrderTemplate}
            onChange={(e) => setViewOrderTemplate(e.target.value)}
            style={{ height: '300px', fontFamily: 'monospace', fontSize: '0.875rem' }}
            placeholder="Template for 'Send to WhatsApp' button in Order View..."
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>Quick Action Template (Table)</label>
          <textarea
            className="form-input"
            value={quickActionTemplate}
            onChange={(e) => setQuickActionTemplate(e.target.value)}
            style={{ height: '300px', fontFamily: 'monospace', fontSize: '0.875rem' }}
            placeholder="Template for 'Send WhatsApp' quick action in table..."
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Templates'}
        </button>
      </div>
    </div>
  )
}

export default Settings
