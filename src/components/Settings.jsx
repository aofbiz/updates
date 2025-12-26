import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, AlertTriangle, Plus, Trash2, Edit2, Edit, Package, Search, ChevronDown, ChevronUp, Download, Upload, Trash, MessageCircle, X, LogOut, Database, Truck, RefreshCw, CheckCircle } from 'lucide-react'
import { loadGoogleScript, initTokenClient, uploadFileToDrive, listFilesFromDrive, downloadFileFromDrive } from '../utils/googleDrive'
import { curfoxService } from '../utils/curfox'

import { generateTrackingNumbersFromRange, getSettings, saveSettings, getOrders, getTrackingNumbers, saveTrackingNumbers, getProducts, getOrderCounter, saveOrderCounter, exportAllData, importAllData, clearAllData, importAllDataFromObject } from '../utils/storage'
import ProductsManagement from './ProductsManagement'
import ExpenseManagement from './ExpenseManagement'
import InventoryManagement from './InventoryManagement'
import DataHealthCheck from './DataHealthCheck'
import OrderSourcesManagement from './OrderSourcesManagement'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const Settings = ({ orders = [], expenses = [], inventory = [], onDataImported, onUpdateInventory, onLogout }) => {
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    trackingNumbers: false,
    dataManagement: false,
    dataHealth: false,
    orderSources: false,
    googleDrive: false,
    whatsappTemplates: false,
    curfoxIntegration: false,
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
      <style>{`
        @media (max-width: 600px) {
          .settings-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
          .settings-header div {
            width: 100%;
          }
          .settings-header .btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .settings-tabs {
            overflow-x: auto !important;
            white-space: nowrap !important;
            padding-bottom: 0.5rem !important;
          }
          .settings-tabs button {
            padding: 0.75rem 1rem !important;
            flex-shrink: 0 !important;
          }
        }
      `}</style>

      <div className="header-container settings-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <SettingsIcon size={28} />
            Settings
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Configure your application settings
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-muted)'
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="settings-tabs" style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none'
      }}>
        {[
          { id: 'general', label: 'General' },
          { id: 'backup', label: 'Backup & Data' },
          { id: 'products', label: 'Products' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'inventory', label: 'Inventory' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
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
            title="Tracking Numbers"
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
          {/* Curfox Integration Section */}
          <CollapsibleSection
            title="Curfox Courier Integration"
            icon={Truck}
            isExpanded={expandedSections.curfoxIntegration}
            onToggle={() => toggleSection('curfoxIntegration')}
          >
            <CurfoxSettings
              settings={settings}
              setSettings={setSettings}
              showToast={addToast}
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
        </>
      )}

      {/* Backup & Data Tab Content */}
      {activeTab === 'backup' && (
        <>
          {/* Google Drive Backup Section */}
          <CollapsibleSection
            title="Google Drive Cloud Backup & Restore"
            icon={Database}
            isExpanded={expandedSections.googleDrive}
            onToggle={() => toggleSection('googleDrive')}
          >
            <GoogleDriveBackup
              settings={settings}
              setSettings={setSettings}
              orders={orders}
              expenses={expenses}
              inventory={inventory}
              products={products}
              trackingNumbers={trackingNumbers}
              orderCounter={orderCounter}
              showToast={addToast}
              showConfirm={showConfirm}
              onDataImported={onDataImported}
            />
          </CollapsibleSection>

          {/* Data Management Section (includes Health Check) */}
          <CollapsibleSection
            title="Manual Backup & Restore"
            icon={Package}
            isExpanded={expandedSections.dataManagement}
            onToggle={() => toggleSection('dataManagement')}
          >
            <DataManagement
              orders={orders}
              expenses={expenses}
              inventory={inventory}
              products={products}
              settings={settings}
              trackingNumbers={trackingNumbers}
              orderCounter={orderCounter}
              onDataImported={onDataImported}
              showAlert={showAlert}
              showConfirm={showConfirm}
              showToast={addToast}
            />

          </CollapsibleSection>

          {/* Data Health Check Section */}
          <CollapsibleSection
            title="Data Health Check"
            icon={AlertTriangle}
            isExpanded={expandedSections.dataHealth}
            onToggle={() => toggleSection('dataHealth')}
          >
            <DataHealthCheck orders={orders} expenses={expenses} inventory={inventory} />
          </CollapsibleSection>
        </>
      )}

      {/* Products Tab Content */}
      {
        activeTab === 'products' && (
          <ProductsManagement />
        )
      }

      {/* Expenses Tab Content */}
      {
        activeTab === 'expenses' && (
          <ExpenseManagement />
        )
      }

      {/* Inventory Tab Content */}
      {
        activeTab === 'inventory' && (
          <InventoryManagement inventory={inventory} onUpdateInventory={onUpdateInventory} />
        )
      }

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

    </div >
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
      <style>{`
        @media (max-width: 600px) {
          .tn-actions {
            flex-direction: column !important;
            gap: 0.75rem !important;
          }
          .tn-actions .btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .tn-range-form {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
          }
          .tn-range-form .form-group {
            width: 100% !important;
          }
          .tn-range-form .btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .tn-stats {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (max-width: 480px) {
          .tn-table-desktop {
            display: none !important;
          }
          .tn-mobile-list {
            display: block !important;
          }
          .tn-mobile-card {
            background: var(--bg-secondary);
            padding: 1rem;
            border-radius: var(--radius);
            margin-bottom: 1rem;
            border: 1px solid var(--border-color);
          }
          .tn-mobile-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
          }
        }
        
        @media (min-width: 481px) {
          .tn-mobile-list {
            display: none !important;
          }
        }
      `}</style>
      <div className="tn-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
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
          Delete Range
        </button>
        <button
          onClick={handleBulkDeleteByStatus}
          className="btn btn-danger"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Trash2 size={18} />
          Delete Status
        </button>
      </div>

      {/* Bulk Add Form */}
      {showBulkAdd && (
        <div className="card" style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Add Tracking Numbers by Range
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Enter range like: <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>RM02818735 – RM02818900</span>
          </p>
          <div className="tn-range-form" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
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
            <div className="hidden-mobile" style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)' }}>–</div>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleBulkAdd} className="btn btn-primary" style={{ flex: 1 }}>
                Add Range
              </button>
              <button onClick={() => setShowBulkAdd(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete by Range Form */}
      {showBulkDeleteRange && (
        <div className="card" style={{
          padding: '1.25rem',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          marginBottom: '1.5rem',
          border: '1px solid var(--danger)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--danger)' }}>
            Delete Tracking Numbers by Range
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Enter range like: <span style={{ color: 'var(--danger)', fontWeight: 500 }}>RM02818735 – RM02818900</span>
          </p>
          <div className="tn-range-form" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
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
            <div className="hidden-mobile" style={{ paddingBottom: '0.75rem', color: 'var(--text-muted)' }}>–</div>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleBulkDeleteByRange} className="btn btn-danger" style={{ flex: 1 }}>
                Delete Range
              </button>
              <button onClick={() => setShowBulkDeleteRange(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="tn-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{trackingNumbers.length}</div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--success)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase' }}>Available</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{availableCount}</div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--danger)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase' }}>Used</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{usedCount}</div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
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
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredNumbers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No tracking numbers found. Add tracking numbers using the Bulk Add button.</p>
          </div>
        ) : (
          <>
            <div className="tn-table-desktop" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ width: '50px', padding: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={filteredNumbers.length > 0 && filteredNumbers.every(tn => selectedNumbers.has(tn.number))}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tracking Number</th>
                    <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNumbers.map((tn) => (
                    <tr
                      key={tn.number}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.02)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedNumbers.has(tn.number)}
                          onChange={() => toggleSelect(tn.number)}
                        />
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{tn.number}</td>
                      <td style={{ padding: '1rem' }}>
                        {editingNumber?.id === tn.id ? (
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="form-input"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              height: 'auto',
                              width: '120px'
                            }}
                            autoFocus
                          >
                            <option value="available">Available</option>
                            <option value="used">Used</option>
                          </select>
                        ) : (
                          <span style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '50px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: tn.status === 'used' ? 'var(--danger)' : 'var(--success)'
                          }}>
                            {tn.status === 'used' ? 'Used' : 'Available'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {editingNumber?.id === tn.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={handleSaveEdit} className="btn btn-sm btn-primary" style={{ padding: '0.3rem' }} title="Save">✓</button>
                            <button onClick={handleCancelEdit} className="btn btn-sm btn-secondary" style={{ padding: '0.3rem' }} title="Cancel">✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleEdit(tn)} className="btn btn-sm btn-secondary" style={{ padding: '0.3rem' }} title="Edit"><Edit2 size={12} /></button>
                            <button onClick={() => handleDelete(tn.number)} className="btn btn-sm btn-danger" style={{ padding: '0.3rem' }} title="Delete"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tn-mobile-list" style={{ padding: '0.5rem' }}>
              {filteredNumbers.map((tn) => (
                <div key={tn.number + '-mobile'} className="tn-mobile-card" style={{
                  backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.02)' : 'var(--bg-card)'
                }}>
                  <div className="tn-mobile-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedNumbers.has(tn.number)}
                        onChange={() => toggleSelect(tn.number)}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tn.number}</span>
                    </div>
                    {editingNumber?.id === tn.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleSaveEdit} className="btn btn-sm btn-primary" style={{ padding: '0.3rem 0.6rem' }}>Save</button>
                        <button onClick={handleCancelEdit} className="btn btn-sm btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>X</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleEdit(tn)} className="btn btn-sm btn-secondary" style={{ padding: '0.3rem' }}><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(tn.number)} className="btn btn-sm btn-danger" style={{ padding: '0.3rem' }}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Status</span>
                    {editingNumber?.id === tn.id ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="form-input"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', height: 'auto', width: 'auto' }}
                      >
                        <option value="available">Available</option>
                        <option value="used">Used</option>
                      </select>
                    ) : (
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '50px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: tn.status === 'used' ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {tn.status === 'used' ? 'Used' : 'Available'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
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
          Export & Restore Data (Manual)
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
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Restore Data</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Load data from a JSON backup file
            </p>
            <label className="btn btn-success" style={{ width: '100%', cursor: 'pointer', display: 'inline-block' }}>
              <Upload size={16} style={{ marginRight: '0.5rem' }} />
              Restore from File
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
    </div>
  )
}



// Curfox Settings Component
const CurfoxSettings = ({ settings, setSettings, showToast }) => {
  const [email, setEmail] = useState(settings?.curfox?.email || '')
  const [password, setPassword] = useState(settings?.curfox?.password || '')
  const [tenant, setTenant] = useState(settings?.curfox?.tenant || '')
  const [businessId, setBusinessId] = useState(settings?.curfox?.businessId || '')
  const [originCity, setOriginCity] = useState(settings?.curfox?.originCity || '')
  const [originDistrict, setOriginDistrict] = useState(settings?.curfox?.originDistrict || '')
  const [isEnabled, setIsEnabled] = useState(settings?.curfox?.enabled || false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleTestConnection = async () => {
    setIsTesting(true)
    try {
      if (!email || !password || !tenant) {
        showToast('Please enter Email, Password, and Tenant', 'warning')
        setIsTesting(false)
        return
      }

      const authData = await curfoxService.login(email, password, tenant)
      if (authData && authData.token) {
        showToast('Connection Successful! Fetching profile data...', 'success')

        const authPayload = { ...settings.curfox, token: authData.token, email, password, tenant }

        // 1. Fetch Businesses (Branches) - This is usually what merchant_business_id needs!
        const businesses = await curfoxService.getBusinesses(authPayload)
        let foundBusinessId = null

        if (businesses && businesses.length > 0) {
          foundBusinessId = businesses[0].id
          setBusinessId(foundBusinessId)
          showToast(`Found Business: ${businesses[0].name || businesses[0].id}`, 'info')
        }

        // 2. Fetch User Profile for backup info (City/District)
        const userProfile = await curfoxService.getUserDetails(authPayload)

        if (userProfile) {
          if (!foundBusinessId) {
            const bId = userProfile.merchant_id || userProfile.merchant?.id
            setBusinessId(bId)
          }

          const m = userProfile.merchant || {}
          const cityCandidate = userProfile.city || m.city || m.city_name || m.origin_city
          const districtCandidate = userProfile.district || m.district || m.district_name || m.origin_state

          if (cityCandidate) setOriginCity(cityCandidate)
          if (districtCandidate) setOriginDistrict(districtCandidate)

          if (cityCandidate || foundBusinessId) {
            showToast('Profile data auto-filled', 'info')
          }
        }
      } else {
        showToast('Connection Failed. Check credentials.', 'error')
      }
    } catch (error) {
      showToast('Connection Error: ' + error.message, 'error')
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const updatedSettings = {
      ...settings,
      curfox: {
        email,
        password,
        tenant,
        businessId,
        originCity,
        originDistrict,
        enabled: isEnabled
      }
    }

    const success = await saveSettings(updatedSettings)
    if (success) {
      setSettings(updatedSettings)
      showToast('Curfox settings saved successfully!', 'success')
    } else {
      showToast('Failed to save settings.', 'error')
    }
    setIsSaving(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Connect to Curfox Courier API to enable automated dispatching.
          <br />
          <strong>Note:</strong> Enabling this allows both hybrid and fully automated workflows.
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label className="switch">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
          <span className="slider round"></span>
        </label>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {isEnabled ? 'Integration Enabled' : 'Integration Disabled'}
        </span>
      </div>

      {isEnabled && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div className="form-group">
            <label className="form-label">Merchant Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="merchant@example.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your Curfox password"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tenant Name ID</label>
            <input
              type="text"
              className="form-input"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              placeholder="e.g. developers"
            />
            <small style={{ color: 'var(--text-muted)' }}>Found in your Curfox URL (e.g. <strong>tenant</strong>.curfox.com)</small>
          </div>
          <div className="form-group">
            <label className="form-label">Merchant Business ID</label>
            <input
              type="text"
              className="form-input"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              placeholder="Auto-fetched or Enter Manually"
            />
            <small style={{ color: 'var(--text-muted)' }}>Required for Dispatch orders</small>
          </div>

          <div className="form-group">
            <label className="form-label">Pickup City (Origin)</label>
            <input
              type="text"
              className="form-input"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
              placeholder="e.g. Colombo 05"
            />
            <small style={{ color: 'var(--text-muted)' }}>Must match your Curfox Pickup City</small>
          </div>
          <div className="form-group">
            <label className="form-label">Pickup District (Origin)</label>
            <input
              type="text"
              className="form-input"
              value={originDistrict}
              onChange={(e) => setOriginDistrict(e.target.value)}
              placeholder="e.g. Colombo"
            />
            <small style={{ color: 'var(--text-muted)' }}>Must match your Curfox Pickup District</small>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button
          onClick={handleTestConnection}
          className="btn btn-secondary"
          disabled={isTesting || !isEnabled}
        >
          {isTesting ? (
            <><RefreshCw className="spin" size={18} /> Testing...</>
          ) : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
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
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          Customize messages sent to customers via WhatsApp. Hover over placeholders to see what they do.
        </p>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)'
        }}>
          {['order_id', 'order_date', 'tracking_number', 'customer_name', 'address', 'phone', 'whatsapp', 'city', 'district', 'item_details', 'subtotal', 'discount', 'total_price', 'delivery_charge', 'cod_amount', 'delivery_date', 'dispatch_date', 'status', 'payment_status', 'notes', 'source'].map(p => (
            <code key={p} style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.4rem',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--accent-primary)',
              borderRadius: '4px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>{`{{${p}}}`}</code>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>Order View Template</label>
          <textarea
            className="form-input"
            value={viewOrderTemplate}
            onChange={(e) => setViewOrderTemplate(e.target.value)}
            style={{ height: '250px', fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: '1.5' }}
            placeholder="Template for 'Send to WhatsApp' button in Order View..."
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>Quick Action Template</label>
          <textarea
            className="form-input"
            value={quickActionTemplate}
            onChange={(e) => setQuickActionTemplate(e.target.value)}
            style={{ height: '250px', fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: '1.5' }}
            placeholder="Template for 'Send WhatsApp' quick action in table..."
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: window.innerWidth < 600 ? '100%' : 'auto', justifyContent: 'center' }}
        >
          {isSaving ? (
            'Saving...'
          ) : (
            <>
              <Save size={18} />
              Save Templates
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Google Drive Backup Component
const GoogleDriveBackup = ({ settings, setSettings, orders, expenses, inventory, products, trackingNumbers, orderCounter, showToast, showConfirm, onDataImported }) => {
  const [clientId, setClientId] = useState(settings?.googleDrive?.clientId || '')
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(settings?.googleDrive?.autoBackup || false)
  const [backupFrequency, setBackupFrequency] = useState(settings?.googleDrive?.frequency || 'daily')
  const [isConnected, setIsConnected] = useState(false)
  const [tokenClient, setTokenClient] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [driveFiles, setDriveFiles] = useState([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [lastBackup, setLastBackup] = useState(settings?.googleDrive?.lastBackup || null)

  useEffect(() => {
    if (settings?.googleDrive) {
      setClientId(settings.googleDrive.clientId || '')
      setIsAutoBackupEnabled(settings.googleDrive.autoBackup || false)
      setBackupFrequency(settings.googleDrive.frequency || 'daily')
      setLastBackup(settings.googleDrive.lastBackup || null)
    }

    loadGoogleScript().catch(err => console.error("Failed to load Google Script", err))
  }, [settings])

  const handleSaveSettings = async () => {
    const updatedSettings = {
      ...settings,
      googleDrive: {
        ...settings?.googleDrive,
        clientId,
        autoBackup: isAutoBackupEnabled,
        frequency: backupFrequency
      }
    }
    const success = await saveSettings(updatedSettings)
    if (success) {
      setSettings(updatedSettings)
      showToast('Google Drive settings saved', 'success')

      if (clientId && window.google) {
        try {
          const client = initTokenClient(clientId, (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              setAccessToken(tokenResponse.access_token)
              setIsConnected(true)
              showToast('Connected to Google Drive!', 'success')
            }
          })
          setTokenClient(client)
        } catch (e) {
          console.error("Error initializing token client", e)
        }
      }
    } else {
      showToast('Failed to save settings', 'error')
    }
  }

  const handleConnect = () => {
    if (!clientId) {
      showToast('Please enter a Client ID first', 'warning')
      return
    }

    if (!tokenClient) {
      try {
        const client = initTokenClient(clientId, (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token)
            setIsConnected(true)
            showToast('Connected to Google Drive!', 'success')
          }
        })
        setTokenClient(client)
        client.requestAccessToken();
      } catch (e) {
        console.error("Error initializing token client", e)
        showToast('Error initializing Google Sign-In', 'error')
      }
    } else {
      tokenClient.requestAccessToken();
    }
  }

  const handleBackupNow = async () => {
    if (!accessToken) {
      showToast('Please connect to Google Drive first', 'warning')
      handleConnect()
      return
    }

    setIsUploading(true)
    try {
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        orders,
        expenses,
        products,
        settings,
        trackingNumbers,
        orderCounter,
        inventory
      }

      const fileName = `AOF_Backup_${new Date().toISOString().slice(0, 10)}_${new Date().getTime()}.json`
      const content = JSON.stringify(exportData, null, 2)

      await uploadFileToDrive(accessToken, fileName, content)

      const now = new Date().toISOString()
      setLastBackup(now)

      const updatedSettings = {
        ...settings,
        googleDrive: {
          ...settings?.googleDrive,
          lastBackup: now
        }
      }
      await saveSettings(updatedSettings)
      setSettings(updatedSettings)

      showToast('Backup uploaded successfully!', 'success')
      // Refresh file list if visible
      if (driveFiles.length > 0) fetchDriveFiles()
    } catch (error) {
      console.error("Backup failed", error)
      showToast('Backup failed: ' + error.message, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const fetchDriveFiles = async () => {
    if (!accessToken) return
    setIsLoadingFiles(true)
    try {
      const files = await listFilesFromDrive(accessToken)
      setDriveFiles(files)
    } catch (error) {
      showToast('Failed to load backups from Drive', 'error')
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const handleRestoreFromDrive = (file) => {
    showConfirm(
      'Restore From Backup',
      `Are you sure you want to restore from ${file.name}? This will overwrite all CURRENT data. We recommend making a manual backup first.`,
      async () => {
        setIsRestoring(true)
        try {
          const data = await downloadFileFromDrive(accessToken, file.id)
          const result = await importAllDataFromObject(data)

          if (result.success) {
            showToast('Data restored successfully! The page will reload.', 'success')
            if (onDataImported) onDataImported(result.data)
            setTimeout(() => window.location.reload(), 1500)
          } else {
            showToast(result.message, 'error')
          }
        } catch (error) {
          showToast('Failed to restore: ' + error.message, 'error')
        } finally {
          setIsRestoring(false)
        }
      },
      'warning',
      'Restore Now'
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: '1.6' }}>
          Securely backup your business data to Google Drive. Requires a Google Cloud Client ID.
        </p>
        {!isConnected && (
          <p style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 500 }}>
            Note: You must connect to Google Drive to see and restore available cloud backups.
          </p>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>Google Client ID</label>
          <input
            type="text"
            className="form-input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter your OAuth 2.0 Client ID"
          />
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Authorized JavaScript Origin: <code style={{ color: 'var(--accent-primary)' }}>{window.location.origin}</code>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isAutoBackupEnabled}
                  onChange={(e) => setIsAutoBackupEnabled(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Auto-Backup
              </span>
            </div>

            {isAutoBackupEnabled && (
              <select
                className="form-input"
                value={backupFrequency}
                onChange={(e) => setBackupFrequency(e.target.value)}
                style={{ width: 'auto', padding: '0.2rem 0.5rem', height: 'auto', fontSize: '0.8125rem' }}
              >
                <option value="hourly">Hourly</option>
                <option value="6hours">6 Hours</option>
                <option value="12hours">12 Hours</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            )}
          </div>

          {lastBackup && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontSize: '0.8125rem',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Database size={14} />
              Last Backup: {new Date(lastBackup).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {isConnected && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>Available Backups on Drive</h4>
            <button
              onClick={fetchDriveFiles}
              className="btn btn-sm btn-secondary"
              disabled={isLoadingFiles}
            >
              <Search size={14} style={{ marginRight: '0.4rem' }} />
              Scan Drive
            </button>
          </div>

          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            {isLoadingFiles ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading files...</div>
            ) : driveFiles.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No backups found in 'AOF_Backups' folder.</div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Filename</th>
                    <th style={{ textAlign: 'left', padding: '0.75rem' }}>Date</th>
                    <th style={{ textAlign: 'right', padding: '0.75rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {driveFiles.map(file => (
                    <tr key={file.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem' }}>{file.name}</td>
                      <td style={{ padding: '0.75rem' }}>{new Date(file.createdTime).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRestoreFromDrive(file)}
                          className="btn btn-sm btn-success"
                          disabled={isRestoring}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-color)'
      }}>
        <button
          onClick={handleSaveSettings}
          className="btn btn-secondary"
          style={{ flex: window.innerWidth < 480 ? 1 : 'none' }}
        >
          Save Config
        </button>

        {!isConnected ? (
          <button
            onClick={handleConnect}
            className="btn btn-primary"
            disabled={!clientId}
            style={{ flex: window.innerWidth < 480 ? 1 : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
          >
            <Database size={18} />
            Connect
          </button>
        ) : (
          <button
            onClick={handleBackupNow}
            className="btn btn-primary"
            disabled={isUploading}
            style={{ flex: window.innerWidth < 480 ? 1 : 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
          >
            {isUploading ? (
              'Uploading...'
            ) : (
              <>
                <Upload size={18} />
                Backup Now
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default Settings
