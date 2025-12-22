import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import OrderManagement from './components/OrderManagement'
import Inventory from './components/Inventory'
import ExpenseTracker from './components/ExpenseTracker'
import Reports from './components/Reports'
import Settings from './components/Settings'
import Login from './components/Login'
import { getOrders, getExpenses, getInventory, getSettings, getTrackingNumbers, getOrderCounter, getProducts, saveSettings } from './utils/storage'
import { loadGoogleScript, initTokenClient, uploadFileToDrive } from './utils/googleDrive'
import { supabase } from './utils/supabase'
import { Loader2 } from 'lucide-react'

import { ToastProvider } from './components/Toast/ToastContext'
import ToastContainer from './components/Toast/ToastContainer'
import AutoBackupHandler from './components/AutoBackupHandler'

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [inventory, setInventory] = useState([])
  const [expenses, setExpenses] = useState([])
  const [products, setProducts] = useState({ categories: [] })
  const [triggerOrderForm, setTriggerOrderForm] = useState(0)
  const [triggerExpenseForm, setTriggerExpenseForm] = useState(0)
  const [initialFilters, setInitialFilters] = useState({})

  // Handle Authentication
  useEffect(() => {
    // Check active sessions and sets the session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load data from Supabase on mount or session change
  useEffect(() => {
    if (!session) return

    const loadData = async () => {
      setDataLoading(true)
      try {
        const [ordersData, expensesData, inventoryData, productsData] = await Promise.all([
          getOrders(),
          getExpenses(),
          getInventory(),
          getProducts()
        ])
        setOrders(ordersData)
        setExpenses(expensesData)
        setInventory(inventoryData)
        setProducts(productsData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [session])


  // Live-sync: if Order Sources were renamed in Settings, update current in-memory orders immediately
  useEffect(() => {
    if (!session) return

    const handler = (e) => {
      const detail = e?.detail
      if (detail?.type === 'orderSourceRenamed' && detail.oldName && detail.newName) {
        setOrders(prev => (prev || []).map(o =>
          (o?.orderSource === detail.oldName ? { ...o, orderSource: detail.newName } : o)
        ))
      }
    }
    window.addEventListener('ordersUpdated', handler)
    return () => window.removeEventListener('ordersUpdated', handler)
  }, [session])

  const handleLogout = async () => {
    console.log('App: handleLogout called')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      console.log('App: Logout successful')
    } catch (error) {
      console.error('App: Logout error:', error)
    }
  }

  const updateOrders = (newOrders) => {
    setOrders(newOrders)
  }

  const updateExpenses = (newExpenses) => {
    setExpenses(newExpenses)
  }

  const updateInventory = (newInventory) => {
    setInventory(newInventory)
  }

  const handleAddOrder = () => {
    setActiveView('orders')
    // Use setTimeout to ensure view changes first, then trigger form
    setTimeout(() => {
      setTriggerOrderForm(prev => prev + 1)
    }, 0)
  }

  const handleAddExpense = () => {
    setActiveView('expenses')
    // Use setTimeout to ensure view changes first, then trigger form
    setTimeout(() => {
      setTriggerExpenseForm(prev => prev + 1)
    }, 0)
  }

  const handleViewChange = (view) => {
    // Reset form triggers when navigating via sidebar menu
    setTriggerOrderForm(0)
    setTriggerExpenseForm(0)
    setInitialFilters({}) // Clear filters when navigating via sidebar
    setActiveView(view)
  }

  const handleNavigate = (view, filters = {}) => {
    setInitialFilters(filters)
    setActiveView(view)
  }

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
      case 'reports':
        return (
          <Reports
            orders={orders}
            expenses={expenses}
            inventory={inventory}
          />
        )
      case 'settings':
        return (
          <Settings
            orders={orders}
            expenses={expenses}
            inventory={inventory}
            onDataImported={(data) => {
              setOrders(data.orders || [])
              setExpenses(data.expenses || [])
              setInventory(data.inventory || [])
            }}
            onUpdateInventory={updateInventory}
            onLogout={handleLogout}
          />
        )
      default:
        return <Dashboard orders={orders} expenses={expenses} inventory={inventory} products={products} onNavigate={navigateToView} />
    }
  }

  if (authLoading || dataLoading) {
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
        <div className="bg-blob bg-blob-3"></div>
        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
        <p style={{
          fontSize: '1rem',
          fontWeight: 500,
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
          animation: 'pulse 2s infinite'
        }}>
          {authLoading ? 'Verifying Session...' : 'Loading Data...'}
        </p>
      </div>
    )
  }

  if (!session) {
    return (
      <ToastProvider>
        <ToastContainer />
        <Login onLoginSuccess={(session) => setSession(session)} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <div className="bg-blob bg-blob-3"></div>
        <ToastContainer />
        <AutoBackupHandler session={session} dataLoading={dataLoading} />
        <Sidebar
          activeView={activeView}
          setActiveView={handleViewChange}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onAddOrder={handleAddOrder}
          onAddExpense={handleAddExpense}
          onLogout={handleLogout}
        />
        <main style={{
          flex: 1,
          padding: '1rem',
          marginLeft: '0',
          backgroundColor: 'transparent',
          transition: 'margin-left 0.3s ease',
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box'
        }}
          className="main-content"
        >
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
      </div>
    </ToastProvider>
  )
}

export default App


