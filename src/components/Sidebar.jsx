import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, ShoppingBag, Package, DollarSign, Settings, Menu, X, Plus, FileText, BarChart3, Crown, Sun, Moon, LogOut, User, ChevronRight, HelpCircle, Phone, LifeBuoy, Info } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { useLicensing } from './LicensingContext'
import { ProFeatureBadge } from './ProFeatureLock'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const Sidebar = ({ activeView, setActiveView, sidebarOpen, setSidebarOpen, onAddOrder, onAddExpense, onLogout, settings }) => {
  const { effectiveTheme, setTheme, theme } = useTheme()
  const { isProUser, isFreeUser } = useLicensing()
  const isOnline = useOnlineStatus()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const menuRef = useRef(null)

  const businessName = settings?.businessName || 'AOF Biz - Management App'
  const businessTagline = settings?.businessTagline || 'From Chaos To Clarity'
  const logoSrc = settings?.businessLogo
    ? settings.businessLogo
    : (effectiveTheme === 'dark' ? './logo-dark.svg' : './logo.svg')

  // Define which menu items are Pro-only
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, proOnly: false },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, proOnly: false },
    { id: 'inventory', label: 'Inventory', icon: Package, proOnly: true },
    { id: 'expenses', label: 'Expenses', icon: DollarSign, proOnly: true },
    { id: 'quotations', label: 'Quotations', icon: FileText, proOnly: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, proOnly: true },
  ]

  const handleNavClick = (id, proOnly) => {
    setActiveView(id)
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: 'calc(1rem + var(--safe-area-top))',
          right: 'calc(1rem + var(--safe-area-right))',
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
        padding: 'calc(1.5rem + var(--safe-area-top)) 0 0 0',
        zIndex: 100,
        transition: 'transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
        className={`sidebar ${sidebarOpen ? 'open' : ''} `}
      >
        {/* Top Section */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{
            padding: '0 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.1rem'
          }}>
            <img
              src={logoSrc}
              alt="AOF Biz Logo"
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
                marginBottom: '0.5rem'
              }}>
                {businessName}
              </h1>
              {businessTagline && (
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  margin: '0.25rem 0 0.75rem 0',
                  fontStyle: 'italic',
                  opacity: 0.9
                }}>
                  {businessTagline}
                </p>
              )}
              {businessName !== 'AOF Biz' && (
                <p style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                  marginTop: businessTagline ? '0' : '-0.2rem'
                }}>
                  Powered by AOF Biz
                </p>
              )}
            </div>
          </div>

          <nav className="flex-col gap-sm px-4" style={{ flex: 1 }}>
            {menuItems.map(item => {
              const Icon = item.icon
              const isActive = activeView === item.id
              const isLocked = item.proOnly && isFreeUser

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id, item.proOnly)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} className="nav-icon" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isLocked && <ProFeatureBadge size={14} />}
                </button>
              )
            })}
          </nav>


          <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={onAddOrder}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={18} />
              New Order
            </button>

            <button
              onClick={isFreeUser ? undefined : onAddExpense}
              disabled={isFreeUser}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                backgroundColor: effectiveTheme === 'light' ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)',
                border: effectiveTheme === 'light' ? '1px solid #cbd5e1' : '1px solid var(--border-color)',
                color: effectiveTheme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: isFreeUser ? 'not-allowed' : 'pointer',
                opacity: isFreeUser ? 0.6 : 1,
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (!isFreeUser) {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isFreeUser) {
                  e.currentTarget.style.borderColor = effectiveTheme === 'light' ? '#cbd5e1' : 'var(--border-color)'
                  e.currentTarget.style.color = effectiveTheme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)'
                }
              }}
              title={isFreeUser ? 'Expense Tracking is a Pro feature' : 'Add New Expense'}
            >
              {isFreeUser ? <Crown size={18} color="#ef4444" /> : <Plus size={18} />}
              <span>Expense</span>
            </button>
          </div>
        </div>

        {/* Bottom Profile Section & Popover Menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>

          {/* Popover Menu */}
          {showProfileMenu && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '1rem',
              right: '1rem',
              marginBottom: '0.75rem',
              backgroundColor: effectiveTheme === 'dark' ? '#0a0a0a' : '#ffffff', // Solid background matching sidebar tone
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: '0 4px 25px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 200,
              animation: 'slideUp 0.15s ease-out'
            }}>
              {/* Menu Header with User Info */}
              <div
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: effectiveTheme === 'dark' ? '#141414' : '#f3f4f6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ position: 'relative' }}>
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt="Profile"
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#fff'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 600
                      }}>
                        U
                      </div>
                    )}
                    {/* Status Dot on Avatar */}
                    <div style={{
                      position: 'absolute',
                      bottom: '1px',
                      right: '1px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: isOnline ? '#22c55e' : '#94a3b8',
                      border: `2px solid ${effectiveTheme === 'dark' ? '#141414' : '#f3f4f6'}`,
                      boxShadow: isOnline ? '0 0 8px rgba(34, 197, 94, 0.4)' : 'none'
                    }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>User</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{isProUser ? 'Pro Plan' : 'Free Plan'}</p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div style={{ padding: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {/* Profile */}
                  <button onClick={() => { setActiveView('profile'); setShowProfileMenu(false); }} style={menuItemStyle}>
                    <User size={18} />
                    Profile
                  </button>

                  {/* Settings */}
                  <button onClick={() => { setActiveView('settings'); setShowProfileMenu(false); }} style={menuItemStyle} data-tab="settings">
                    <Settings size={18} />
                    Settings
                  </button>

                  {/* Appearance Toggle */}
                  <div style={{ ...menuItemStyle, justifyContent: 'space-between', cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                      Appearance
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setTheme(theme === 'dark' ? 'light' : 'dark')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          setTheme(theme === 'dark' ? 'light' : 'dark')
                        }
                      }}
                      tabIndex={0}
                      style={{
                        width: '36px',
                        height: '20px',
                        backgroundColor: theme === 'dark' ? 'var(--accent-primary)' : '#cbd5e1',
                        borderRadius: '20px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: theme === 'dark' ? '18px' : '2px',
                        transition: 'left 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>

                  {/* Contact Support */}
                  <button onClick={() => { setActiveView('contact'); setShowProfileMenu(false); }} style={menuItemStyle}>
                    <Phone size={18} />
                    Contact Support
                  </button>

                  {/* Help / Documentation */}
                  <button onClick={() => { window.open('https://aofbiz.github.io/updates/docs.html', '_blank'); setShowProfileMenu(false); }} style={menuItemStyle}>
                    <LifeBuoy size={18} />
                    Help & Docs
                  </button>

                  {/* About */}
                  <button onClick={() => { setActiveView('about'); setShowProfileMenu(false); }} style={menuItemStyle}>
                    <Info size={18} />
                    About AOF Biz
                  </button>
                </div>
              </div>

              {/* Footer / Logout */}
              <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={onLogout}
                  style={{
                    ...menuItemStyle,
                    color: 'var(--danger)',
                    hoverColor: 'var(--danger)',
                    hoverBg: 'rgba(239, 68, 68, 0.1)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <LogOut size={18} />
                  Log Out
                </button>
              </div>

            </div>
          )}

          {/* User Profile Trigger Bar (Bottom of Sidebar) */}
          <div
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShowProfileMenu(!showProfileMenu)
              }
            }}
            tabIndex={0}
            style={{
              padding: '1rem 1.5rem',
              paddingBottom: 'calc(1rem + var(--safe-area-bottom))',
              backgroundColor: showProfileMenu ? 'var(--bg-secondary)' : 'transparent',
              borderTop: '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onMouseEnter={e => {
              if (!showProfileMenu) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'
            }}
            onMouseLeave={e => {
              if (!showProfileMenu) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt="Profile"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#fff'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'
                  }}>
                    <User size={16} />
                  </div>
                )}
                {/* Status Dot on Avatar */}
                <div style={{
                  position: 'absolute',
                  bottom: '0px',
                  right: '0px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: isOnline ? '#22c55e' : '#94a3b8',
                  border: '2px solid var(--bg-sidebar)',
                  boxShadow: isOnline ? '0 0 6px rgba(34, 197, 94, 0.3)' : 'none'
                }} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>User</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{isProUser ? 'Pro Plan' : 'Free Plan'}</div>
              </div>
            </div>
            <ChevronRight
              size={16}
              color="var(--text-muted)"
              style={{
                transform: showProfileMenu ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            />
          </div>
        </div>
      </aside>
    </>
  )
}

const menuItemStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s ease'
}

export default Sidebar
