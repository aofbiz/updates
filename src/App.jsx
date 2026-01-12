import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import OrderManagement from './components/OrderManagement'
import Inventory from './components/Inventory'
import ExpenseTracker from './components/ExpenseTracker'
import Reports from './components/Reports'
import Settings from './components/Settings'
import Contact from './components/Contact'
import Profile from './components/Profile'
import ModeSelectionScreen from './components/ModeSelectionScreen'
import About from './components/About'
import { getOrders, getExpenses, getInventory, getProducts, getQuotations, getSettings } from './utils/storage'
import { Loader2 } from 'lucide-react'

import { ToastProvider } from './components/Toast/ToastContext'
import ToastContainer from './components/Toast/ToastContainer'
import AutoBackupHandler from './components/AutoBackupHandler'
import CurfoxAuthHandler from './components/CurfoxAuthHandler'
import QuotationManagement from './components/QuotationManagement'
import { ThemeProvider, useTheme } from './components/ThemeContext'
import { LicensingProvider, useLicensing } from './components/LicensingContext'
import { SyncProvider } from './components/SyncContext'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts'
import KeyboardShortcutsModal from './components/Common/KeyboardShortcutsModal'
import ErrorBoundary from './components/ErrorBoundary'
import TrialCountdownBar from './components/Common/TrialCountdownBar'
import { useToast } from './components/Toast/ToastContext'
import { useUpdateManager } from './hooks/useUpdateManager'
import UpdateNotification from './components/UpdateNotification'

// Inner App component that uses licensing context
function AppContent() {
  const { userMode, isLoading: licensingLoading, resetSelection, isTrialActive, timeLeft } = useLicensing()
  const { effectiveTheme } = useTheme()
  const { addToast } = useToast()
  const updateManager = useUpdateManager()
  const [showUpdateToast, setShowUpdateToast] = useState(true)

  // Handle view change from update notification
  const handleGoToUpdate = () => {
    localStorage.setItem('aof_settings_active_tab', 'updates')
    setActiveView('settings')
    setShowUpdateToast(false)
  }

  // Background update check on load
  useEffect(() => {
    updateManager.checkForUpdates(true)
  }, [])

  // Local "session" for compatibility with components expecting it
  const dummySession = { user: { id: 'local-user', email: 'local@app' } }

  const [dataLoading, setDataLoading] = useState(false)
  const [activeView, setActiveView] = useState(() => {
    const savedView = localStorage.getItem('aof_active_view')
    const validViews = ['dashboard', 'orders', 'inventory', 'expenses', 'quotations', 'reports', 'settings', 'about', 'contact', 'profile']
    return validViews.includes(savedView) ? savedView : 'dashboard'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [quotations, setQuotations] = useState([])
  const [inventory, setInventory] = useState([])
  const [expenses, setExpenses] = useState([])
  const [products, setProducts] = useState({ categories: [] })
  const [settings, setSettings] = useState(null)
  const [prefilledOrder, setPrefilledOrder] = useState(null)
  const [triggerOrderForm, setTriggerOrderForm] = useState(0)
  const [triggerExpenseForm, setTriggerExpenseForm] = useState(0)
  const [initialFilters, setInitialFilters] = useState({})
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Load data - Unified for all modes
  useEffect(() => {
    if (licensingLoading || !userMode) return

    const loadData = async () => {
      console.log('App: Starting to load data...')
      setDataLoading(true)
      try {
        const [ordersData, expensesData, inventoryData, productsData, quotationsData, settingsData] = await Promise.all([
          getOrders(),
          getExpenses(),
          getInventory(),
          getProducts(),
          getQuotations(),
          getSettings()
        ])
        console.log(`App: Data loaded successfully. Orders: ${ordersData?.length}`)
        setOrders(ordersData || [])
        setExpenses(expensesData || [])
        setInventory(inventoryData || [])
        setProducts(productsData || { categories: [] })
        setQuotations(quotationsData || [])
        setSettings(settingsData || null)
      } catch (error) {
        console.error('App: Error loading data:', error)
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [userMode, licensingLoading])



  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem('aof_active_view', activeView)
  }, [activeView])

  // Trial Warning Logic (2x per day)
  useEffect(() => {
    if (!isTrialActive) return

    const TRIAL_WARNINGS_KEY = 'aof_trial_warnings'
    const today = new Date().toDateString()

    try {
      const warningsStr = localStorage.getItem(TRIAL_WARNINGS_KEY)
      let warnings = warningsStr ? JSON.parse(warningsStr) : { date: today, count: 0 }

      if (warnings.date !== today) {
        warnings = { date: today, count: 0 }
      }

      if (warnings.count < 2) {
        const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000))
        addToast(`Enjoy Pro features! ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left.`, 'info')

        warnings.count += 1
        localStorage.setItem(TRIAL_WARNINGS_KEY, JSON.stringify(warnings))
      }
    } catch (e) {
      console.warn('Failed to show trial warning:', e)
    }
  }, [isTrialActive])

  // Live-sync fallback for local events (e.g. from Settings)
  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail
      if (detail?.type === 'orderSourceRenamed' && detail.oldName && detail.newName) {
        setOrders(prev => (prev || []).map(o =>
          (o?.orderSource === detail.oldName ? { ...o, orderSource: detail.newName } : o)
        ))
      }
    }

    // Global navigation handler
    const navHandler = (e) => {
      if (e.detail) {
        if (typeof e.detail === 'string') {
          setActiveView(e.detail);
        } else if (e.detail.view) {
          setActiveView(e.detail.view);
          if (e.detail.section) {
            setTimeout(() => {
              const el = document.getElementById(e.detail.section);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // 300ms delay to ensure view is mounted
          }
        }
      }
    }

    window.addEventListener('ordersUpdated', handler)
    window.addEventListener('navigate-to-view', navHandler)

    return () => {
      window.removeEventListener('ordersUpdated', handler)
      window.removeEventListener('navigate-to-view', navHandler)
    }
  }, [])

  const handleLogout = () => {
    // For local app, "Logout" means going back to Mode Selection
    resetSelection()
  }

  const handleDataImported = (data) => {
    setOrders(data.orders || [])
    setExpenses(data.expenses || [])
    setInventory(data.inventory || [])
  }

  const updateOrders = (newOrders) => setOrders(newOrders)
  const updateExpenses = (newExpenses) => setExpenses(newExpenses)
  const updateInventory = (newInventory) => setInventory(newInventory)
  const updateQuotations = (newQuotations) => setQuotations(newQuotations)
  const updateSettings = (newSettings) => setSettings(newSettings)

  const handleAddOrder = () => {
    setActiveView('orders')
    setTimeout(() => {
      setTriggerOrderForm(prev => prev + 1)
    }, 0)
  }

  const handleAddExpense = () => {
    setActiveView('expenses')
    setTimeout(() => {
      setTriggerExpenseForm(prev => prev + 1)
    }, 0)
  }

  const handleViewChange = (view) => {
    setTriggerOrderForm(0)
    setTriggerExpenseForm(0)
    setInitialFilters({})
    setPrefilledOrder(null)
    setActiveView(view)
  }

  const handleNavigate = (view, filters = {}) => {
    setInitialFilters(filters)
    setActiveView(view)
  }

  // Keyboard shortcut handlers
  const handleKeyboardNavigate = useCallback((target) => {
    switch (target) {
      case 'orders':
        setActiveView('orders')
        break
      case 'inventory':
        setActiveView('inventory')
        break
      case 'expenses':
        setActiveView('expenses')
        break
      case 'quotations':
        setActiveView('quotations')
        break
      case 'reports':
        setActiveView('reports')
        break
      case 'settings':
        setActiveView('settings')
        break
      case 'appearance':
        setActiveView('settings')
        // Scroll to appearance section after a short delay
        setTimeout(() => {
          const el = document.getElementById('appearance-section')
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
        break
      case 'support':
        setActiveView('contact')
        break
      case 'help':
        window.open('https://aofbiz.github.io/docs.html', '_blank')
        break
      case 'about':
        setActiveView('about')
        break
      case 'shortcuts':
        setShowShortcuts(true)
        break
      default:
        break
    }
  }, [])

  const handleFocusSearch = useCallback(() => {
    // Focus the first search input on the current page
    const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[type="search"]')
    if (searchInput) {
      searchInput.focus()
      searchInput.select()
    }
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowShortcuts(false)
  }, [])

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onNewOrder: handleAddOrder,
    onNewExpense: handleAddExpense,
    onNavigate: handleKeyboardNavigate,
    onFocusSearch: handleFocusSearch,
    onCloseModal: handleCloseModal,
    enabled: userMode !== null // Only enable when user has selected a mode
  })

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            orders={orders}
            expenses={expenses}
            inventory={inventory}
            products={products}
            onNavigate={handleNavigate}
          />
        )
      case 'orders':
        return (
          <OrderManagement
            orders={orders}
            onUpdateOrders={updateOrders}
            triggerFormOpen={triggerOrderForm}
            initialFilters={initialFilters}
            prefilledOrder={prefilledOrder}
            onClearPrefilled={() => setPrefilledOrder(null)}
          />
        )
      case 'inventory':
        return (
          <Inventory
            inventory={inventory}
            onUpdateInventory={updateInventory}
            initialFilter={initialFilters.stockFilter}
            onNavigate={handleNavigate}
          />
        )
      case 'expenses':
        return (
          <ExpenseTracker
            expenses={expenses}
            onUpdateExpenses={updateExpenses}
            triggerFormOpen={triggerExpenseForm}
            inventory={inventory}
            onUpdateInventory={updateInventory}
          />
        )
      case 'quotations':
        return (
          <QuotationManagement
            quotations={quotations}
            onUpdateQuotations={updateQuotations}
            orders={orders}
            onUpdateOrders={updateOrders}
            onConvertToOrder={(orderData) => {
              setPrefilledOrder(orderData)
              setActiveView('orders')
              setTriggerOrderForm(prev => prev + 1)
            }}
          />
        )
      case 'reports':
        return (
          <Reports
            orders={orders}
            expenses={expenses}
            inventory={inventory}
            onUpdateOrders={updateOrders}
          />
        )
      case 'settings':
        return (
          <Settings
            orders={orders}
            expenses={expenses}
            inventory={inventory}
            onDataImported={handleDataImported}
            onUpdateInventory={setInventory}
            onLogout={resetSelection}
          />
        )
      case 'contact':
        return <Contact />
      case 'profile':
        return <Profile onUpdateSettings={updateSettings} />
      case 'about':
        return <About />
      default:
        return <Dashboard orders={orders} expenses={expenses} inventory={inventory} products={products} onNavigate={handleNavigate} />
    }
  }

  // Show loading while determining licensing state
  if (licensingLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        gap: '1rem'
      }}>
        <Loader2 className="animate-spin" size={32} />
        <p>Loading application...</p>
      </div>
    )
  }

  // Show mode selection if no mode is chosen
  if (!userMode) {
    return <ModeSelectionScreen />
  }

  // Check if data is loading (initial load)
  if (dataLoading && orders.length === 0 && expenses.length === 0) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        gap: '1rem'
      }}>

        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
        <p style={{
          fontSize: '1rem',
          fontWeight: 500,
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
          animation: 'pulse 2s infinite'
        }}>
          Loading Data...
        </p>
      </div>
    )
  }

  // Main App Layout
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="app-background">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>
      <ToastContainer />
      <AutoBackupHandler session={dummySession} dataLoading={dataLoading} />
      <CurfoxAuthHandler session={dummySession} />

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      <Sidebar
        activeView={activeView}
        setActiveView={handleViewChange}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onAddOrder={handleAddOrder}
        onAddExpense={handleAddExpense}
        onLogout={handleLogout}
        settings={settings}
      />
      <main style={{
        flex: 1,
        padding: '1rem',
        paddingTop: 'calc(1rem + var(--safe-area-top))',
        paddingBottom: 'calc(1rem + var(--safe-area-bottom))',
        paddingLeft: 'calc(1rem + var(--safe-area-left))',
        paddingRight: 'calc(1rem + var(--safe-area-right))',
        marginLeft: '0',
        backgroundColor: 'transparent',
        transition: 'margin-left 0.3s ease',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box'
      }}
        className="main-content"
      >
        <TrialCountdownBar />
        {renderView()}
      </main>
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {updateManager.status === 'available' && showUpdateToast && (
        <UpdateNotification
          info={updateManager.updateInfo}
          onGoToUpdate={handleGoToUpdate}
          onClose={() => setShowUpdateToast(false)}
        />
      )}
    </div>
  )
}

// Main App component with providers
function App() {
  return (
    <ThemeProvider>
      <LicensingProvider>
        <ToastProvider>
          <SyncProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </SyncProvider>
        </ToastProvider>
      </LicensingProvider>
    </ThemeProvider>
  )
}

export default App
