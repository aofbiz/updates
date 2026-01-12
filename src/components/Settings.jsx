import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Save, AlertTriangle, Plus, Trash2, Edit2, Edit, Package, Search,
  ChevronDown, ChevronUp, Download, Upload, Trash, MessageCircle, X, LogOut, Database,
  Truck, RefreshCw, CheckCircle, Crown, Sparkles, Cloud, Building2, Users, Globe, Link, ShieldCheck, Database as DB,
  Info, Eye, EyeOff, ChevronLeft, ChevronRight, CheckSquare
} from 'lucide-react'
import CustomDropdown from './Common/CustomDropdown'
import Pagination from './Common/Pagination'
import { loadGoogleScript, initTokenClient, uploadFileToDrive, listFilesFromDrive, downloadFileFromDrive } from '../utils/googleDrive'
import { curfoxService } from '../utils/curfox'

import { generateTrackingNumbersFromRange, getSettings, saveSettings, getOrders, getTrackingNumbers, saveTrackingNumbers, getProducts, getOrderCounter, saveOrderCounter, exportAllData, importAllData, clearAllData, importAllDataFromObject } from '../utils/storage'
import { toTitleCase } from '../utils/textUtils'
import ProductsManagement from './ProductsManagement'
import ExpenseManagement from './ExpenseManagement'
import InventoryManagement from './InventoryManagement'
import { useLicensing } from './LicensingContext'
import { useTheme, PALETTES } from './ThemeContext'
import { Moon, Sun, Monitor, Shield, Zap, Lock, RefreshCw as RefreshIcon, TrendingUp, Check } from 'lucide-react'
import DataHealthCheck from './DataHealthCheck'
import OrderSourcesManagement from './OrderSourcesManagement'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'
import ProFeatureLock, { ProFeatureBadge } from './ProFeatureLock'
import CollapsibleSection from './Settings/CollapsibleSection'
import CloudSyncSetup from './Settings/CloudSyncSetup'
import UpdatesSection from './Settings/UpdatesSection'

const Settings = ({ orders = [], expenses = [], inventory = [], onDataImported, onUpdateInventory, onLogout }) => {
  const { addToast } = useToast()
  const { userMode, setUserMode, resetSelection, isProUser, isFreeUser } = useLicensing()
  const { theme, setTheme, fontFamily, setFontFamily, fontSize, setFontSize, effectiveTheme, paletteId, setPalette } = useTheme()
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('aof_settings_active_tab') || 'general'
  })

  // Persistence for active tab
  useEffect(() => {
    localStorage.setItem('aof_settings_active_tab', activeTab)
  }, [activeTab])
  const [settings, setSettings] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    trackingNumbers: false,
    dataManagement: false,
    dataHealth: false,
    orderSources: false,
    googleDrive: false,
    whatsappTemplates: false,
    curfoxIntegration: false,
    generalConfig: false,
    licensing: false,
    appearance: false,
    dangerZone: false,
    deviceSync: false,
    businessManagement: false,
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
      setProducts(productsData || { categories: [] })
      setTrackingNumbers(trackingNumbersData || [])
      setOrderCounter(counter ?? null)
    }
    loadData()
  }, [])



  return (
    <div>
      <div className="header-container settings-header flex-between mb-8">
        <div>
          <h1>
            Settings
          </h1>
          <p className="text-muted text-sm">
            Configure your application settings
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="settings-tabs flex gap-sm mb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {[
          { id: 'general', label: 'General', pro: false },
          { id: 'backup', label: 'Backup & Data', pro: false },
          { id: 'products', label: 'Products', pro: false },
          { id: 'expenses', label: 'Expenses', pro: true },
          { id: 'inventory', label: 'Inventory', pro: true },
          { id: 'premium', label: 'Premium', pro: true },
          { id: 'updates', label: 'Updates', pro: false },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
            {tab.pro && isFreeUser && <ProFeatureBadge size={14} />}
          </button>
        ))}
      </div>


      {/* Tab Content */}

      {activeTab === 'premium' && (
        <div className="animate-fade-in">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Premium Features</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Advanced capabilities for growing businesses</p>
          </div>

          <CollapsibleSection
            title="Multi-Device Cloud Sync"
            icon={Cloud}
            isExpanded={expandedSections.deviceSync}
            onToggle={() => toggleSection('deviceSync')}
          >
            <CloudSyncSetup />
          </CollapsibleSection>

          <CollapsibleSection
            title="Multi-Business Management"
            icon={Building2}
            isExpanded={expandedSections.businessManagement}
            onToggle={() => toggleSection('businessManagement')}
          >
            <div style={{ padding: '1rem' }}>
              <div style={{
                padding: '2rem',
                backgroundColor: 'rgba(var(--accent-rgb), 0.03)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-color)',
                textAlign: 'center'
              }}>
                <Users size={40} color="var(--accent-primary)" style={{ marginBottom: '1rem', opacity: 0.6 }} />
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Manage Multiple Entities</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 1.5rem' }}>
                  Switch between different businesses, inventories, and accounting books with a single click.
                </p>
                <div className="badge badge-info" style={{ padding: '0.5rem 1rem' }}>In Development</div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}


      {activeTab === 'updates' && (
        <UpdatesSection />
      )}

      {activeTab === 'general' && (
        <>
          {/* Appearance Section */}


          <CollapsibleSection
            title="General Configuration"
            icon={SettingsIcon}
            isExpanded={expandedSections.generalConfig}
            onToggle={() => toggleSection('generalConfig')}
          >
            <GeneralConfiguration
              settings={settings}
              setSettings={setSettings}
              showToast={addToast}
            />

          </CollapsibleSection>

          <div id="appearance-section">
            <CollapsibleSection
              title={<>Appearance {isFreeUser && <ProFeatureBadge size={16} />}</>}
              icon={Sun}
              isExpanded={expandedSections.appearance}
              onToggle={() => toggleSection('appearance')}
            >
              <ProFeatureLock featureName="Appearance Customization" showContent={true}>
                <>
                  <div style={{ marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Monitor size={16} /> Theme Mode
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                      {[
                        { id: 'light', label: 'Light', icon: Sun },
                        { id: 'dark', label: 'Dark', icon: Moon },
                        { id: 'system', label: 'System', icon: Monitor }
                      ].map((t) => {
                        const Icon = t.icon
                        const isActive = theme === t.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '1.25rem',
                              borderRadius: '12px',
                              border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isActive ? 'rgba(255, 46, 54, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
                            }}
                          >
                            <Icon size={24} color={isActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                            <span style={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}>
                              {t.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Edit size={16} /> Font Personality
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                      {[
                        { id: 'modern', label: 'Modern', description: 'Clean & Tech-focused', font: "'Inter', sans-serif" },
                        { id: 'professional', label: 'Professional', description: 'Balanced & Friendly', font: "'Poppins', sans-serif" },
                        { id: 'elegant', label: 'Elegant', description: 'Sophisticated & Classic', font: "'Playfair Display', serif" },
                        { id: 'system', label: 'System', description: 'Native OS Feel', font: 'system-ui' }
                      ].map((f) => {
                        const isActive = fontFamily === f.id
                        return (
                          <button
                            key={f.id}
                            onClick={() => setFontFamily(f.id)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: '0.4rem',
                              padding: '1.25rem',
                              borderRadius: '12px',
                              border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isActive ? 'rgba(255, 46, 54, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              textAlign: 'left',
                              width: '100%'
                            }}
                          >
                            <span style={{
                              fontSize: '1.125rem',
                              fontWeight: 700,
                              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontFamily: f.font
                            }}>
                              {f.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {f.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ marginTop: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingUp size={16} /> Font Size Scale
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      {[
                        { id: 'small', label: 'Small', percentage: '88%' },
                        { id: 'normal', label: 'Normal', percentage: '100%' },
                        { id: 'large', label: 'Large', percentage: '112%' }
                      ].map((s) => {
                        const isActive = fontSize === s.id
                        return (
                          <button
                            key={s.id}
                            onClick={() => setFontSize(s.id)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.75rem',
                              borderRadius: '12px',
                              border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isActive ? 'rgba(255, 46, 54, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
                            }}
                          >
                            <span style={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}>{s.label}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{s.percentage}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Color Palette Section */}
                  <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Zap size={16} /> Design Personality (Color Palette)
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      {Object.values(PALETTES).map((p) => {
                        const isActive = paletteId === p.id
                        return (
                          <button
                            key={p.id}
                            onClick={() => setPalette(p.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '1rem',
                              padding: '1rem',
                              borderRadius: '12px',
                              border: isActive ? `2px solid ${p.color}` : '1px solid var(--border-color)',
                              backgroundColor: isActive
                                ? `rgba(${parseInt(p.color.slice(1, 3), 16)}, ${parseInt(p.color.slice(3, 5), 16)}, ${parseInt(p.color.slice(5, 7), 16)}, 0.15)`
                                : 'rgba(255, 255, 255, 0.02)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: p.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              boxShadow: isActive
                                ? `0 4px 12px rgba(${parseInt(p.color.slice(1, 3), 16)}, ${parseInt(p.color.slice(3, 5), 16)}, ${parseInt(p.color.slice(5, 7), 16)}, 0.4)`
                                : '0 4px 10px rgba(0,0,0,0.1)'
                            }}>
                              {isActive && <Check size={18} />}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {p.id.charAt(0).toUpperCase() + p.id.slice(1)} accents
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                      <button
                        onClick={() => {
                          showConfirm(
                            'Reset Appearance',
                            'Are you sure you want to reset your appearance settings to defaults?',
                            () => {
                              setPalette('signature')
                              setTheme('system')
                              setFontFamily('modern')
                              setFontSize('normal')
                              addToast('Appearance settings reset', 'info')
                            }
                          )
                        }}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                      >
                        <RefreshIcon size={16} />
                        Reset to Defaults
                      </button>
                    </div>
                  </div>
                </>
              </ProFeatureLock>
            </CollapsibleSection>
          </div>

          <CollapsibleSection
            title={<>Tracking Numbers {isFreeUser && <ProFeatureBadge size={16} />}</>}
            icon={Package}
            isExpanded={expandedSections.trackingNumbers}
            onToggle={() => toggleSection('trackingNumbers')}
          >
            <ProFeatureLock featureName="Tracking Numbers" showContent={true}>
              <TrackingNumberManagement
                trackingNumbers={trackingNumbers}
                setTrackingNumbers={setTrackingNumbers}
                showAlert={showAlert}
                showConfirm={showConfirm}
                showToast={addToast} // Pass showToast
              />
            </ProFeatureLock>
          </CollapsibleSection>
          {/* Curfox Integration Section */}
          <CollapsibleSection
            title={<>Curfox Courier Integration {isFreeUser && <ProFeatureBadge size={16} />}</>}
            icon={Truck}
            isExpanded={expandedSections.curfoxIntegration}
            onToggle={() => toggleSection('curfoxIntegration')}
          >
            <ProFeatureLock featureName="Curfox Integration" showContent={true}>
              <CurfoxSettings
                settings={settings}
                setSettings={setSettings}
                showToast={addToast}
              />
            </ProFeatureLock>
          </CollapsibleSection>

          {/* WhatsApp Templates Section */}
          <CollapsibleSection
            title={<>WhatsApp Message Templates {isFreeUser && <ProFeatureBadge size={16} />}</>}
            icon={MessageCircle}
            isExpanded={expandedSections.whatsappTemplates}
            onToggle={() => toggleSection('whatsappTemplates')}
          >
            <ProFeatureLock featureName="WhatsApp Templates" showContent={true}>
              <WhatsAppTemplates
                settings={settings}
                setSettings={setSettings}
                showAlert={showAlert}
                showConfirm={showConfirm}
                showToast={addToast}
              />
            </ProFeatureLock>
          </CollapsibleSection>

          {/* Order Sources Section */}
          <CollapsibleSection
            title={<>Order Sources {isFreeUser && <ProFeatureBadge size={16} />}</>}
            icon={Package}
            isExpanded={expandedSections.orderSources}
            onToggle={() => toggleSection('orderSources')}
          >
            <ProFeatureLock featureName="Order Sources Management" showContent={true}>
              <OrderSourcesManagement />
            </ProFeatureLock>
          </CollapsibleSection>


        </>
      )}

      {/* Backup & Data Tab Content */}
      {
        activeTab === 'backup' && (
          <>
            {/* Google Drive Backup Section */}
            <CollapsibleSection
              title={<>Google Drive Cloud Backup & Restore {isFreeUser && <ProFeatureBadge size={16} />}</>}
              icon={Database}
              isExpanded={expandedSections.googleDrive}
              onToggle={() => toggleSection('googleDrive')}
            >
              <ProFeatureLock featureName="Cloud Backup" showContent={true}>
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
              </ProFeatureLock>
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

            {/* Danger Zone Section */}
            <CollapsibleSection
              title="Danger Zone"
              icon={Trash}
              isExpanded={expandedSections.dangerZone}
              onToggle={() => toggleSection('dangerZone')}
              danger={true}
            >
              <div style={{ padding: '1rem' }}>
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 style={{
                    color: 'var(--danger)',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: 600
                  }}>
                    <AlertTriangle size={18} />
                    Clear All Application Data
                  </h4>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                    lineHeight: '1.5'
                  }}>
                    This action will permanently delete ALL data including orders, expenses, inventory, and settings.
                    This cannot be undone. Please make sure you have a backup before proceeding.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => {
                        showConfirm(
                          'Delete All Data',
                          'Are you absolutely sure you want to delete ALL data? This action cannot be undone.',
                          () => {
                            clearAllData()
                            addToast('All data cleared successfully', 'success')
                            setTimeout(() => {
                              window.location.reload()
                            }, 1500)
                          },
                          'danger',
                          'Yes, Delete Everything'
                        )
                      }}
                      className="btn btn-danger"
                      style={{
                        padding: '0.75rem 1.5rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Trash size={16} />
                      Clear All Data
                    </button>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </>
        )
      }

      {/* Products Tab Content */}
      {
        activeTab === 'products' && (
          <ProductsManagement />
        )
      }

      {/* Expenses Tab Content */}
      {
        activeTab === 'expenses' && (
          <ProFeatureLock featureName="Expenses Settings">
            <ExpenseManagement />
          </ProFeatureLock>
        )
      }

      {/* Inventory Tab Content */}
      {
        activeTab === 'inventory' && (
          <ProFeatureLock featureName="Inventory Settings">
            <InventoryManagement inventory={inventory} onUpdateInventory={onUpdateInventory} />
          </ProFeatureLock>
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

// CollapsibleSection is now imported from './Settings/CollapsibleSection'

// Tracking Number Management Component
// Tracking Number Management Component
const TrackingNumberManagement = ({ trackingNumbers, setTrackingNumbers, showAlert, showConfirm, showToast }) => {
  const [showManageRanges, setShowManageRanges] = useState(false)
  const [manageTab, setManageTab] = useState('add') // 'add' | 'delete' | 'status'
  const [statusRangeStart, setStatusRangeStart] = useState('')
  const [statusRangeEnd, setStatusRangeEnd] = useState('')
  const [bulkStatusValue, setBulkStatusValue] = useState('available')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [deleteRangeStart, setDeleteRangeStart] = useState('')
  const [deleteRangeEnd, setDeleteRangeEnd] = useState('')
  const [selectedNumbers, setSelectedNumbers] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all, available, used
  const [editingNumber, setEditingNumber] = useState(null) // { id, number }
  const [editValue, setEditValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterStatus])

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
    setShowManageRanges(false)
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

  const handleBulkStatusUpdate = () => {
    if (selectedNumbers.size === 0) {
      showToast('Please select tracking numbers to update', 'warning')
      return
    }

    const statusLabel = bulkStatusValue === 'available' ? 'Available' : 'Used'

    showConfirm('Update Status', `Update status to "${statusLabel}" for ${selectedNumbers.size} tracking number(s)?`, async () => {
      const updated = trackingNumbers.map(tn =>
        selectedNumbers.has(tn.number) ? { ...tn, status: bulkStatusValue } : tn
      )
      await saveTrackingNumbers(updated)
      setTrackingNumbers(updated)
      setSelectedNumbers(new Set())
      setBulkStatusValue('available')
      setShowManageRanges(false)
      showToast(`Updated ${selectedNumbers.size} tracking number(s) to ${statusLabel}`, 'success')
    }, 'warning', 'Update')
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
      setShowManageRanges(false)
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

  // Pagination Logic
  const totalPages = Math.ceil(filteredNumbers.length / itemsPerPage)
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredNumbers.slice(indexOfFirstItem, indexOfLastItem)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  return (
    <div className="animate-fade-in">
      <style>{`
        .tn-table-desktop { display: block; }
        .tn-mobile-list { display: none; }
        @media (max-width: 600px) {
          .tn-table-desktop { display: none !important; }
          .tn-mobile-list { display: flex !important; }
        }
      `}</style>
      {/* 1. Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Numbers</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{trackingNumbers.length}</span>
        </div>
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          display: 'flex', flexDirection: 'column', gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase' }}>Available</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{availableCount}</span>
        </div>
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex', flexDirection: 'column', gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase' }}>Used</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{usedCount}</span>
        </div>
      </div>

      {/* 2. Unified Toolbar */}
      {/* 2. Unified Toolbar */}
      <style>{`
        .toolbar-container {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
          align-items: center;
          padding: 0.75rem;
          background-color: transparent;
          border-radius: 16px;
          border: 1px solid var(--border-color);
        }
        .toolbar-controls {
          flex: 1;
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }
        .toolbar-search {
          position: relative;
          min-width: 200px;
          flex: 1 1 auto;
          max-width: 300px;
        }
        .toolbar-filter-wrapper {
          flex: 0 0 auto;
        }
        
        @media (max-width: 768px) {
          .toolbar-container {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }
          .toolbar-btn-manage {
            width: 100%;
            justify-content: center;
          }
           /* On mobile, let the controls stack nicely */
          .toolbar-controls {
            width: 100%;
            flex-direction: row; /* Keep row but ensure wrapping */
            justify-content: space-between;
          }
          .toolbar-search {
            max-width: none;
            width: 100%;
            flex: 1 1 100%; /* Force full width */
            order: 1; /* Search first on mobile controls */
          }
          .toolbar-filter-wrapper {
            flex: 1 1 calc(50% - 0.5rem); /* Half width minus gap */
            order: 2;
          }
          .toolbar-div-delete {
             flex: 1 1 calc(50% - 0.5rem);
             order: 3;
          }
          /* If only filter exists (no delete), allow filter to stretch or stay auto? 
             Let's make filter full width if it's the only item besides search, 
             but here we set flex-grow so it should fill available space.
          */
        }
      `}</style>
      <div className="toolbar-container">


        {/* Controls: Search, Filter, Delete */}
        <div className="toolbar-controls">
          {/* Search */}
          <div className="toolbar-search">
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem', height: '38px', fontSize: '0.9rem', width: '100%' }}
            />
          </div>

          {/* Filter */}
          <div className="toolbar-filter-wrapper">
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'available', label: 'Available' },
                { value: 'used', label: 'Used' }
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: '100%', height: '38px' }}
            />
          </div>

          {/* Delete All Action */}
          {selectedNumbers.size > 0 && (
            <button onClick={handleBulkDelete} className="btn btn-danger animate-fade-in toolbar-div-delete" style={{ flex: '0 0 auto', height: '38px', justifyContent: 'center' }}>
              <Trash2 size={16} style={{ marginRight: '0.4rem' }} /> Delete ({selectedNumbers.size})
            </button>
          )}
        </div>
      </div>

      {/* 3. Manage Ranges Card (Always Visible) */}
      {/* 3. Manage Ranges Card (Always Visible) */}
      <div style={{
        padding: '1.5rem',
        marginBottom: '2rem',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'transparent'
      }}>
        {/* Mobile Styles */}
        <style>{`
              .manage-tabs-wrapper {
                display: flex;
                gap: 1.5rem;
                margin-bottom: 1.5rem;
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 0.5rem;
                overflow-x: auto;
                white-space: nowrap;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
              }
              .manage-tabs-wrapper::-webkit-scrollbar {
                display: none;
              }
              .manage-tab-btn {
                background: none;
                border: none;
                padding: 0.5rem 0.25rem;
                font-size: 0.95rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                flex: 0 0 auto;
              }
              .manage-label-spacer {
                 visibility: hidden;
              }
              
              @media (max-width: 768px) {
                 .manage-label-spacer {
                    display: none !important;
                 }
              }
            `}</style>

        {/* Tabs */}
        <div className="manage-tabs-wrapper">
          <button
            onClick={() => setManageTab('add')}
            className="manage-tab-btn"
            style={{
              color: manageTab === 'add' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderBottom: manageTab === 'add' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            }}
          >
            <Plus size={16} /> Add New Range
          </button>
          <button
            onClick={() => setManageTab('status')}
            className="manage-tab-btn"
            style={{
              color: manageTab === 'status' ? 'var(--warning)' : 'var(--text-secondary)',
              borderBottom: manageTab === 'status' ? '2px solid var(--warning)' : '2px solid transparent',
            }}
          >
            <RefreshCw size={16} /> Update Status
          </button>

          <button
            onClick={() => setManageTab('delete')}
            className="manage-tab-btn"
            style={{
              color: manageTab === 'delete' ? 'var(--danger)' : 'var(--text-secondary)',
              borderBottom: manageTab === 'delete' ? '2px solid var(--danger)' : '2px solid transparent',
            }}
          >
            <Trash2 size={16} /> Delete Range
          </button>
        </div>

        {/* Tab Content: ADD */}
        {/* Tab Content: ADD */}
        {manageTab === 'add' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label className="form-label">Start Number</label>
              <input type="text" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} placeholder="RM00000000" className="form-input" />
            </div>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label className="form-label">End Number</label>
              <input type="text" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} placeholder="RM00000100" className="form-input" />
            </div>
            <div className="form-group" style={{ flex: '1 1 150px' }}>
              <label className="form-label manage-label-spacer" style={{ visibility: 'hidden' }}>Action</label>
              <button onClick={handleBulkAdd} className="btn btn-primary" style={{ width: '100%', height: '38px', justifyContent: 'center' }}>Add Numbers</button>
            </div>
          </div>
        )}

        {/* Tab Content: STATUS */}
        {manageTab === 'status' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '2 1 300px' }}>
              <label className="form-label">New Status for Selected <span style={{ color: 'var(--accent-primary)' }}>({selectedNumbers.size} items)</span></label>
              <CustomDropdown
                options={[
                  { value: 'available', label: 'Available' },
                  { value: 'used', label: 'Used' }
                ]}
                value={bulkStatusValue}
                onChange={setBulkStatusValue}
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group" style={{ flex: '1 1 150px' }}>
              <label className="form-label manage-label-spacer" style={{ visibility: 'hidden' }}>Action</label>
              <button
                onClick={handleBulkStatusUpdate}
                className="btn"
                style={{
                  width: '100%',
                  height: '38px',
                  justifyContent: 'center',
                  backgroundColor: 'var(--warning)',
                  color: '#000',
                  fontWeight: 600,
                  opacity: selectedNumbers.size === 0 ? 0.5 : 1,
                  cursor: selectedNumbers.size === 0 ? 'not-allowed' : 'pointer'
                }}
                disabled={selectedNumbers.size === 0}
              >
                Update Status
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: DELETE */}
        {manageTab === 'delete' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label className="form-label">Start Number</label>
              <input type="text" value={deleteRangeStart} onChange={(e) => setDeleteRangeStart(e.target.value)} placeholder="RM00000000" className="form-input" />
            </div>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label className="form-label">End Number</label>
              <input type="text" value={deleteRangeEnd} onChange={(e) => setDeleteRangeEnd(e.target.value)} placeholder="RM00000100" className="form-input" />
            </div>
            <div className="form-group" style={{ flex: '1 1 150px' }}>
              <label className="form-label manage-label-spacer" style={{ visibility: 'hidden' }}>Action</label>
              <button onClick={handleBulkDeleteByRange} className="btn btn-danger" style={{ width: '100%', height: '38px', justifyContent: 'center' }}>Delete Numbers</button>
            </div>
          </div>
        )}


      </div>

      {/* 5. Tracking Numbers Table/List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        {filteredNumbers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No tracking numbers found. Add data using the tool above.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="tn-table-desktop" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                    <th style={{ width: '50px', padding: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={currentItems.length > 0 && currentItems.every(tn => selectedNumbers.has(tn.number))}
                        onChange={() => {
                          const allSelected = currentItems.every(tn => selectedNumbers.has(tn.number))
                          const newSelected = new Set(selectedNumbers)
                          if (allSelected) {
                            currentItems.forEach(tn => newSelected.delete(tn.number))
                          } else {
                            currentItems.forEach(tn => newSelected.add(tn.number))
                          }
                          setSelectedNumbers(newSelected)
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tracking Number</th>
                    <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((tn) => (
                    <tr
                      key={tn.number}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <td style={{ padding: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedNumbers.has(tn.number)}
                          onChange={() => toggleSelect(tn.number)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{tn.number}</td>
                      <td style={{ padding: '1rem' }}>
                        {editingNumber?.id === tn.id ? (
                          <CustomDropdown
                            options={[
                              { value: 'available', label: 'Available' },
                              { value: 'used', label: 'Used' }
                            ]}
                            value={editValue}
                            onChange={setEditValue}
                            style={{ minWidth: '120px' }}
                          />
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
                            <button onClick={handleSaveEdit} className="btn btn-sm btn-primary" title="Save"><Check size={14} /></button>
                            <button onClick={handleCancelEdit} className="btn btn-sm btn-secondary" title="Cancel"><X size={14} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => handleEdit(tn)} className="btn btn-sm btn-ghost" title="Edit"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(tn.number)} className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} title="Delete"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="tn-mobile-list" style={{ padding: '0.75rem', flexDirection: 'column', gap: '0.75rem' }}>
              {currentItems.map((tn) => (
                <div key={tn.number + '-mobile'} style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedNumbers.has(tn.number)}
                        onChange={() => toggleSelect(tn.number)}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{tn.number}</span>
                    </div>
                    {editingNumber?.id !== tn.id && (
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '50px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: tn.status === 'used' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: tn.status === 'used' ? 'var(--danger)' : 'var(--success)',
                        textTransform: 'uppercase'
                      }}>
                        {tn.status === 'used' ? 'Used' : 'Available'}
                      </span>
                    )}
                  </div>

                  {editingNumber?.id === tn.id ? (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ flex: 1 }}>
                        <CustomDropdown
                          options={[{ value: 'available', label: 'Available' }, { value: 'used', label: 'Used' }]}
                          value={editValue}
                          onChange={setEditValue}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <button onClick={handleSaveEdit} className="btn btn-sm btn-primary"><Check size={16} /></button>
                      <button onClick={handleCancelEdit} className="btn btn-sm btn-secondary"><X size={16} /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <button onClick={() => handleEdit(tn)} className="btn btn-sm btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Edit</button>
                      <button onClick={() => handleDelete(tn.number)} className="btn btn-sm btn-danger" style={{ flex: 1, justifyContent: 'center' }}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                totalItems={filteredNumbers.length}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            )}
          </>
        )}
      </div>
    </div >
  )
}

// Data Management Component
const DataManagement = ({ orders, expenses, inventory, products, settings, trackingNumbers, orderCounter, onDataImported, showAlert, showConfirm, showToast }) => {
  const [importStatus, setImportStatus] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [showSettingsPrompt, setShowSettingsPrompt] = useState(false)
  const [promptType, setPromptType] = useState(null) // 'export' or 'import'

  const handleExportPrompt = () => {
    setPromptType('export')
    setShowSettingsPrompt(true)
  }

  const handleExport = async (includeSettings) => {
    setShowSettingsPrompt(false)
    const result = await exportAllData(orders, expenses, products, settings, trackingNumbers, orderCounter, inventory, includeSettings)
    if (result.success) {
      showToast(result.message, 'success')
    } else {
      showToast(result.message, 'error')
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.json')) {
      showToast('Please select a valid JSON file', 'warning')
      return
    }

    setPendingFile(file)
    setPromptType('import')
    setShowSettingsPrompt(true)
    e.target.value = '' // Reset file input
  }

  const handleImport = async (includeSettings) => {
    setShowSettingsPrompt(false)
    if (!pendingFile) return

    try {
      setImportStatus('Importing...')

      // Read the file manually to pass includeSettings
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result)
          const result = await importAllDataFromObject(data, includeSettings)

          if (result.success) {
            setImportStatus('Import successful!')
            showToast('Data imported successfully! The page will reload.', 'success')

            if (onDataImported) {
              onDataImported(result.data)
            }

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
        }
      }
      reader.onerror = () => {
        setImportStatus('Import failed')
        showToast('Failed to read file', 'error')
      }
      reader.readAsText(pendingFile)
    } catch (error) {
      setImportStatus('Import failed')
      showToast('Failed to import data: ' + error.message, 'error')
    } finally {
      setPendingFile(null)
    }
  }

  const handleCancelPrompt = () => {
    setShowSettingsPrompt(false)
    setPendingFile(null)
    setPromptType(null)
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
          marginBottom: '0.75rem'
        }}>
          Export your data to a JSON file that can be imported in any browser or incognito mode.
        </p>
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '1.5rem',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          padding: '0.75rem',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <strong>Includes:</strong> Orders, Expenses, Inventory, Products, Quotations, Order Sources, Tracking Numbers, Expense Categories, Inventory Categories
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
              onClick={handleExportPrompt}
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
                onChange={handleFileSelect}
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

      {/* Settings Include Prompt Modal */}
      {showSettingsPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1rem',
              color: 'var(--text-primary)'
            }}>
              {promptType === 'export' ? 'Export Options' : 'Import Options'}
            </h3>
            <p style={{
              fontSize: '0.925rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              lineHeight: 1.5
            }}>
              Would you like to {promptType === 'export' ? 'include' : 'restore'} your application settings (theme, preferences, business info, etc.) {promptType === 'export' ? 'in the backup' : 'from the backup'}?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => promptType === 'export' ? handleExport(true) : handleImport(true)}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem' }}
              >
                Yes, Include Settings
              </button>
              <button
                onClick={() => promptType === 'export' ? handleExport(false) : handleImport(false)}
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem' }}
              >
                No, Data Only
              </button>
              <button
                onClick={handleCancelPrompt}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
              onChange={(e) => setOriginCity(toTitleCase(e.target.value))}
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
              onChange={(e) => setOriginDistrict(toTitleCase(e.target.value))}
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
  const [quotationTemplate, setQuotationTemplate] = useState(settings?.whatsappTemplates?.quotation || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    const updatedSettings = {
      ...settings,
      whatsappTemplates: {
        viewOrder: viewOrderTemplate,
        quickAction: quickActionTemplate,
        quotation: quotationTemplate
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
          {['order_id', 'quotation_number', 'order_date', 'tracking_number', 'customer_name', 'address', 'phone', 'whatsapp', 'city', 'district', 'item_details', 'subtotal', 'discount', 'total_price', 'delivery_charge', 'cod_amount', 'delivery_date', 'dispatch_date', 'status', 'payment_status', 'notes', 'source'].map(p => (
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
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>Quotation Template</label>
          <textarea
            className="form-input"
            value={quotationTemplate}
            onChange={(e) => setQuotationTemplate(e.target.value)}
            style={{ height: '250px', fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: '1.5' }}
            placeholder="Template for 'Send WhatsApp' in Quotations..."
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
  const [showHelp, setShowHelp] = useState(false)
  const [showClientId, setShowClientId] = useState(false)

  useEffect(() => {
    if (settings?.googleDrive) {
      setClientId(settings.googleDrive.clientId || '')
      setIsAutoBackupEnabled(settings.googleDrive.autoBackup || false)
      setBackupFrequency(settings.googleDrive.frequency || 'daily')
      setLastBackup(settings.googleDrive.lastBackup || null)
    }

    loadGoogleScript().catch(err => console.error("Failed to load Google Script", err))

    // Handle deep link callback for Google Drive Auth (Desktop Only)
    if (window.electronAPI) {
      const handleDriveAuth = (url) => {
        if (!url) return;
        const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
        const token = params.get('access_token');
        if (token) {
          setAccessToken(token);
          setIsConnected(true);
          showToast('Connected to Google Drive!', 'success');
        }
      };

      window.electronAPI.onAuthCallback(handleDriveAuth);
    }
  }, [settings, showToast])

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
    <div className="animate-fade-in">
      {/* Header & Intro */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
            Securely backup your business data to your personal Google Drive.
            <br />Requires a one-time setup of a Google Cloud Client ID.
          </p>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="btn btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Info size={16} color="var(--accent-primary)" /> Setup Guide
        </button>
      </div>

      {showHelp && (
        <div style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          backgroundColor: 'rgba(var(--accent-rgb), 0.04)',
          borderRadius: '16px',
          border: '1px solid rgba(var(--accent-rgb), 0.15)',
          animation: 'slideDown 0.3s ease'
        }}>
          <h5 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Globe size={18} color="var(--accent-primary)" /> Step-by-Step Setup Guide
          </h5>
          <ol style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li>Visit the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Google Cloud Console</a> and sign in.</li>
            <li>Create a new project (e.g., "AOF Backups") and search for "Google Drive API" to enable it.</li>
            <li>Configure the <strong>OAuth Consent Screen</strong> (External User Type).Publish the app.</li>
            <li>Create <strong>OAuth Client ID</strong> credentials for a Web Application.</li>
            <li>Add <code style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{window.location.origin}</code> to Authorized JavaScript origins.</li>
            <li>Copy the Client ID and paste it below.</li>
          </ol>
        </div>
      )}

      {/* Main Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Card 1: Credentials */}
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={20} color="var(--accent-primary)" /> Credentials
            </h4>
            {isConnected && <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Connected</span>}
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.85rem' }}>OAuth 2.0 Client ID</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showClientId ? "text" : "password"}
                className="form-input"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Ex: 123456789-abcdef..."
                style={{ paddingRight: '2.5rem', fontFamily: 'monospace', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                onClick={() => setShowClientId(!showClientId)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex'
                }}
              >
                {showClientId ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Origin constraint: ensure <code style={{ color: 'var(--text-primary)' }}>{window.location.origin}</code> is allowed in GCloud.
            </p>
          </div>
        </div>

        {/* Card 2: Automation */}
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <RefreshCw size={20} color={isAutoBackupEnabled ? "var(--success)" : "var(--text-muted)"} /> Automation
            </h4>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
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
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Auto-Backup</span>
              </div>

              <div style={{ opacity: isAutoBackupEnabled ? 1 : 0.5, pointerEvents: isAutoBackupEnabled ? 'auto' : 'none' }}>
                <CustomDropdown
                  options={[
                    { value: 'hourly', label: 'Every Hour' },
                    { value: '6hours', label: 'Every 6H' },
                    { value: '12hours', label: 'Every 12H' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' }
                  ]}
                  value={backupFrequency}
                  onChange={setBackupFrequency}
                  style={{ width: '130px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            {lastBackup ? (
              <div style={{
                padding: '0.85rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '12px',
                color: 'var(--success)',
                fontSize: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}>
                <CheckCircle size={16} />
                <span>Last synced: {new Date(lastBackup).toLocaleString()}</span>
              </div>
            ) : (
              <div style={{
                padding: '0.85rem',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}>
                <Cloud size={16} /> No backup created yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drive File Browser */}
      {isConnected && (
        <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} /> Cloud Backups
            </h4>
            <button
              onClick={fetchDriveFiles}
              className="btn btn-sm btn-secondary"
              disabled={isLoadingFiles}
            >
              <RefreshCw size={14} className={isLoadingFiles ? 'spin' : ''} style={{ marginRight: '0.4rem' }} />
              {isLoadingFiles ? 'Scanning...' : 'Refresh List'}
            </button>
          </div>

          <div style={{
            maxHeight: '220px',
            overflowY: 'auto',
            overflowX: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)'
          }}>
            {isLoadingFiles ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Checking Google Drive...</div>
            ) : driveFiles.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Cloud size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p>No AOF backups found in your Drive.</p>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 5, borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '1rem' }}>Filename</th>
                    <th style={{ textAlign: 'left', padding: '1rem' }}>Created At</th>
                    <th style={{ textAlign: 'right', padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {driveFiles.map(file => (
                    <tr key={file.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{file.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{new Date(file.createdTime).toLocaleString()}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRestoreFromDrive(file)}
                          className="btn btn-sm btn-ghost"
                          disabled={isRestoring}
                          style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
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

      {/* Footer Actions */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: '1.5rem',
        borderTop: '1px solid var(--border-color)'
      }}>
        <button
          onClick={handleSaveSettings}
          className="btn btn-secondary"
          style={{ minWidth: '120px', flex: '1 1 auto' }}
        >
          Save Config
        </button>

        {!isConnected ? (
          <button
            onClick={handleConnect}
            className="btn btn-primary"
            disabled={!clientId}
            style={{ minWidth: '140px', flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
          >
            <Database size={18} />
            Connect
          </button>
        ) : (
          <button
            onClick={handleBackupNow}
            className="btn btn-primary"
            disabled={isUploading}
            style={{ minWidth: '160px', flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
          >
            {isUploading ? (
              <><RefreshCw size={18} className="spin" /> Uploading...</>
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



// General Configuration Component
const GeneralConfiguration = ({ settings, setSettings, showToast }) => {
  const [businessName, setBusinessName] = useState(settings?.businessName || 'AOF Biz - Management App')
  const [businessTagline, setBusinessTagline] = useState(settings?.businessTagline || 'From Chaos To Clarity')
  const [businessLogo, setBusinessLogo] = useState(settings?.businessLogo || null)
  const [defaultDeliveryCharge, setDefaultDeliveryCharge] = useState(settings?.general?.defaultDeliveryCharge ?? 400)
  const [quotationExpiryDays, setQuotationExpiryDays] = useState(settings?.general?.quotationExpiryDays ?? 7)
  const [defaultPageSize, setDefaultPageSize] = useState(settings?.general?.defaultPageSize ?? 'A4')
  const [isSaving, setIsSaving] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName || 'AOF Biz - Management App')
      setBusinessTagline(settings.businessTagline || 'From Chaos To Clarity')
      setBusinessLogo(settings.businessLogo || null)
      if (settings.general) {
        setDefaultDeliveryCharge(settings.general.defaultDeliveryCharge ?? 400)
        setQuotationExpiryDays(settings.general.quotationExpiryDays ?? 7)
        setDefaultPageSize(settings.general.defaultPageSize ?? 'A4')
      }
    }
  }, [settings])

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Logo file size should be less than 2MB', 'error')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setBusinessLogo(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const updatedSettings = {
      ...settings,
      businessName: businessName.trim() || 'AOF Biz - Management App',
      businessTagline: businessTagline.trim() || 'From Chaos To Clarity',
      businessLogo: businessLogo,
      general: {
        ...settings?.general,
        defaultDeliveryCharge: Number(defaultDeliveryCharge),
        quotationExpiryDays: Number(quotationExpiryDays),
        defaultPageSize: defaultPageSize
      }
    }

    const success = await saveSettings(updatedSettings)
    if (success) {
      setSettings(updatedSettings)
      showToast('Business configuration saved successfully', 'success')
      window.dispatchEvent(new Event('settingsUpdated'))
    } else {
      showToast('Failed to save settings', 'error')
    }
    setIsSaving(false)
  }

  return (
    <div>
      {/* Business Identity Section */}
      <div style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={18} color="var(--accent-primary)" />
          Business Identity
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input
                type="text"
                className="form-input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="AOF Biz"
              />
              <small style={{ color: 'var(--text-muted)' }}>This appears at the top of your sidebar.</small>
            </div>

            <div className="form-group">
              <label className="form-label">Business Slogan / Tagline</label>
              <input
                type="text"
                className="form-input"
                value={businessTagline}
                onChange={(e) => setBusinessTagline(e.target.value)}
                placeholder="Powering your business growth"
              />
              <small style={{ color: 'var(--text-muted)' }}>Displayed elegantly below your business name.</small>
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', border: '2px dashed var(--border-color)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)' }}>
            <label className="form-label" style={{ marginBottom: '1rem', alignSelf: 'flex-start' }}>Business Logo</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '12px',
                backgroundColor: 'rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                position: 'relative',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {businessLogo ? (
                <img src={businessLogo} alt="Logo Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <Upload size={32} color="var(--text-muted)" />
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', textAlign: 'center', padding: '4px' }}>
                Change Logo
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleLogoChange}
            />
            {businessLogo && (
              <button
                className="btn btn-sm btn-ghost"
                style={{ marginTop: '0.75rem', color: 'var(--danger)', fontSize: '0.75rem' }}
                onClick={() => setBusinessLogo(null)}
              >
                Reset to Default
              </button>
            )}
            <small style={{ color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>Square PNG/SVG works best.</small>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label className="form-label">Default Delivery Charge (Rs)</label>
          <input
            type="number"
            className="form-input"
            value={defaultDeliveryCharge}
            onChange={(e) => setDefaultDeliveryCharge(e.target.value)}
            placeholder="400"
          />
          <small style={{ color: 'var(--text-muted)' }}>Applied to new orders and quotations.</small>
        </div>

        <div className="form-group">
          <label className="form-label">Quotation Expiry (Days)</label>
          <input
            type="number"
            className="form-input"
            value={quotationExpiryDays}
            onChange={(e) => setQuotationExpiryDays(e.target.value)}
            placeholder="7"
          />
          <small style={{ color: 'var(--text-muted)' }}>Default validity period for quotations.</small>
        </div>

        <div className="form-group">
          <label className="form-label">Default Print Page Size</label>
          <select
            className="form-input"
            value={defaultPageSize}
            onChange={(e) => setDefaultPageSize(e.target.value)}
            style={{ backgroundColor: 'transparent' }}
          >
            <option value="A4" style={{ color: '#000' }}>A4 (Standard)</option>
            <option value="A5" style={{ color: '#000' }}>A5 (Smaller)</option>
            <option value="Letter" style={{ color: '#000' }}>Letter</option>
          </select>
          <small style={{ color: 'var(--text-muted)' }}>Sets the default layout for PDF & Print documents.</small>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={isSaving}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {isSaving ? 'Saving...' : <><Save size={18} /> Save Configuration</>}
        </button>
      </div>
    </div>
  )
}


export default Settings
