import { LayoutDashboard, ShoppingBag, Package, DollarSign, Settings, Menu, X, Plus, FileText } from 'lucide-react'

const Sidebar = ({ activeView, setActiveView, sidebarOpen, setSidebarOpen, onAddOrder, onAddExpense, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'quotations', label: 'Quotations', icon: FileText },
    { id: 'reports', label: 'Reports', icon: FileText },
  ]

  const handleNavClick = (id) => {
    setActiveView(id)
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          left: 'unset',
          zIndex: 101,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '0.5rem',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-primary)'
        }}
        className="mobile-menu-btn"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '250px',
        height: '100vh',
        backgroundColor: 'var(--bg-sidebar)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-color)',
        padding: '2rem 0 0 0',
        zIndex: 100,
        transition: 'transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        <div style={{
          padding: '0 1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.1rem'
        }}>
          <img
            src="/logo.svg"
            alt="Art Of Frames Logo"
            style={{
              width: '170px',
              height: '170px',
              objectFit: 'contain'
            }}
          />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.25rem'
            }}>
              Art Of Frames
            </h1>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              Management System
            </p>
          </div>
        </div>

        <nav>
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Quick Action Buttons */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid var(--border-color)',
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <button
            onClick={() => {
              if (onAddOrder) {
                onAddOrder()
              } else {
                setActiveView('orders')
              }
              if (window.innerWidth <= 768) {
                setSidebarOpen(false)
              }
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)'
            }}
          >
            <Plus size={18} />
            <span>Add Order</span>
          </button>
          <button
            onClick={() => {
              if (onAddExpense) {
                onAddExpense()
              } else {
                setActiveView('expenses')
              }
              if (window.innerWidth <= 768) {
                setSidebarOpen(false)
              }
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)'
            }}
          >
            <Plus size={18} />
            <span>Add Expense</span>
          </button>
        </div>

        {/* Settings Button */}
        <div style={{
          padding: '0 1.5rem 1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1rem'
        }}>
          <button
            onClick={() => handleNavClick('settings')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: activeView === 'settings' ? 'var(--bg-card)' : 'transparent',
              color: activeView === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderLeft: activeView === 'settings' ? '3px solid var(--accent-primary)' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              fontSize: '0.875rem',
              fontWeight: activeView === 'settings' ? 600 : 400,
              borderRadius: 'var(--radius)'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'settings') {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'settings') {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>


      </aside>

    </>
  )
}

export default Sidebar

