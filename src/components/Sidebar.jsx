import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, ShoppingBag, Package, DollarSign, Settings, Menu, X, Plus, Pencil, FileText, BarChart3, Crown, Sun, Moon, LogOut, User, ChevronRight, ChevronLeft, HelpCircle, Phone, LifeBuoy, Info, Bell, MessageSquare, Check, Circle, AlertTriangle, Trash2, Clock, ArrowDown } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { useLicensing } from './LicensingContext'
import { ProFeatureBadge } from './ProFeatureLock'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { getOrders, getInventory } from '../utils/storage'
import { masterClient } from '../utils/licenseServer'
import { useUpdateManager } from '../hooks/useUpdateManager'
import CustomDropdown from './Common/CustomDropdown'
import CustomDateTimePicker from './Common/CustomDateTimePicker'
import { format, isToday, isTomorrow, isThisYear } from 'date-fns'
import pkg from '../../package.json'

const Sidebar = ({ activeView, setActiveView, sidebarOpen, setSidebarOpen, sidebarExpanded, setSidebarExpanded, onAddOrder, onAddExpense, onLogout, settings }) => {
  const { effectiveTheme, setTheme, theme } = useTheme()
  const { isProUser, isFreeUser, isTrialActive, timeLeft } = useLicensing()
  const isOnline = useOnlineStatus()
  const updateManager = useUpdateManager()
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Status Bar States
  const [showReminders, setShowReminders] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)

  // Reminders Logic
  // Reminders Logic
  // Fix: Initialize state lazily from localStorage to prevent overwriting with [] on mount
  const [reminders, setReminders] = useState(() => {
    try {
      const saved = localStorage.getItem('user_reminders')
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      console.warn('Failed to load reminders', e)
      return []
    }
  })
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [editingReminderId, setEditingReminderId] = useState(null)

  // Reminder Form State
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderNotes, setReminderNotes] = useState('')
  const [reminderImportance, setReminderImportance] = useState('Medium')
  const [reminderDateTime, setReminderDateTime] = useState(new Date().toISOString())

  // Messages & Alerts State
  const [messages, setMessages] = useState([])
  const [alerts, setAlerts] = useState([])

  // Load reminders validation / Pro Upsell injection
  useEffect(() => {
    // Only handle Upsell injection here, since loading is done in useState
    if (isFreeUser) {
      const lastUpsell = localStorage.getItem('last_pro_upsell')
      const today = new Date().toDateString()

      if (lastUpsell !== today) {
        setReminders(prev => {
          // Double check to avoid duplicates in strict mode
          if (prev.some(r => r.isUpsell && new Date(r.id.split('-').pop() * 1).toDateString() === today)) {
            return prev
          }

          const upsellReminder = {
            id: 'pro-upsell-' + Date.now(),
            title: 'Upgrade to Pro',
            text: 'Get unlimited access to Inventory, Reports, and more! Upgrade to AllSet Pro today.',
            time: 'Daily Tip',
            read: false,
            isUpsell: true,
            importance: 'High'
          }
          localStorage.setItem('last_pro_upsell', today)
          return [upsellReminder, ...prev]
        })
      }
    }
  }, [isFreeUser])

  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip initial mount to prevent overwriting with [] if lazily loaded state was []
    // This is a safety check: if we started with [], we don't want to save [] immediately unless user intentionally deleted all.
    // However, since we initialize FROM localStorage, if it's [], it's fine.
    // The issue was initializing with [] THEN reading. Now we read FIRST.
    // But to be safe, let's keep isInitialMount check for one tick.
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    // Persist reminders (excluding the transient upsell one if we want to re-generate it)
    const toSave = reminders.filter(r => !r.isUpsell)
    localStorage.setItem('user_reminders', JSON.stringify(toSave))
  }, [reminders])

  // Fetch Messages from Supabase
  useEffect(() => {
    const fetchMessages = async () => {
      try {

        const { data, error } = await masterClient
          .from('app_messages')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          // Sync read status with local storage
          const readMessageIds = JSON.parse(localStorage.getItem('read_app_messages') || '[]')
          const processed = data.map(msg => ({
            id: msg.id,
            sender: msg.sender || 'Developer',
            title: msg.title || 'Message',
            text: msg.text,
            time: new Date(msg.created_at).toLocaleDateString(),
            read: readMessageIds.includes(msg.id)
          }))
          setMessages(processed)
        }
      } catch (err) {
        console.error('Error fetching messages:', err)
      }
    }

    fetchMessages()
  }, [isOnline])

  const [lastDataUpdate, setLastDataUpdate] = useState(Date.now())

  // Listen for data updates to refresh alerts
  useEffect(() => {
    const handleSyncUpdate = () => {
      setLastDataUpdate(Date.now())
    }

    const events = ['ordersUpdated', 'sync:orders', 'sync:inventory']
    events.forEach(ev => window.addEventListener(ev, handleSyncUpdate))

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handleSyncUpdate))
    }
  }, [])

  // Generate Alerts
  useEffect(() => {
    const generateAlerts = async () => {
      const newAlerts = []

      // 1. Trial Ending Alert
      if (isTrialActive && timeLeft > 0) {
        const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60))
        if (hoursLeft <= 48) {
          newAlerts.push({
            id: 'trial-ending',
            title: 'Trial Ending Soon',
            text: `Your trial expires in ${hoursLeft} hours. Upgrade to Pro for continued access.`,
            time: `${hoursLeft}h left`,
            read: false,
            type: 'warning'
          })
        }
      }

      // 2. Update Alert
      if (updateManager.status === 'available') {
        newAlerts.push({
          id: 'update-available',
          title: 'Update Available',
          text: `A new version (v${updateManager.updateInfo?.version}) is available. Update now for the latest features.`,
          time: 'New',
          read: false,
          type: 'info'
        })
      }

      // 3. Low Stock Alert
      try {
        const inv = await getInventory()
        const lowStockItems = inv.filter(item => item.currentStock < item.reorderLevel)
        if (lowStockItems.length > 0) {
          newAlerts.push({
            id: 'low-stock',
            title: 'Low Stock Alert',
            text: `${lowStockItems.length} items are below their reorder levels.`,
            time: 'Inventory',
            read: false,
            type: 'error'
          })
        }
      } catch (err) {
        console.error('Error checking stock level for alerts:', err)
      }

      // 4. Scheduled Orders Alert
      try {
        const allOrders = await getOrders()
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const in3Days = new Date(today)
        in3Days.setDate(today.getDate() + 3)

        const scheduled = allOrders.filter(order => {
          if (!order.deliveryDate || ['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(order.status)) return false
          const dDate = new Date(order.deliveryDate)
          return dDate >= today && dDate <= in3Days
        })

        if (scheduled.length > 0) {
          newAlerts.push({
            id: 'scheduled-orders',
            title: 'Upcoming Deliveries',
            text: `You have ${scheduled.length} orders scheduled for delivery in the next 3 days.`,
            time: 'Orders',
            read: false,
            type: 'info'
          })
        }
        const readAlertIds = JSON.parse(localStorage.getItem('read_app_alerts') || '[]')
        const processedAlerts = newAlerts.map(a => ({
          ...a,
          read: readAlertIds.includes(a.id)
        }))

        setAlerts(processedAlerts)
      } catch (err) {
        console.error('Error in generateAlerts:', err)
      }
    }

    generateAlerts()
  }, [isTrialActive, timeLeft, updateManager.status, isOnline, lastDataUpdate])

  // Reminder Notification Logic
  // Reminder Notification Logic
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date().getTime()

      // Find the FIRST due reminder that hasn't been notified
      // This creates a natural queue: if multiple are due, they will pop up one by one every 5 seconds
      // This logic naturally handles "missed" reminders because 'scheduledTime <= now' is true for ANY past date.
      // So if I set a reminder for 5:00 PM, close the app, and open it at 8:00 PM, 
      // 5:00 PM <= 8:00 PM is true, and notified is false, so it triggers.
      const dueReminder = reminders.find(r => {
        if (r.read || !r.scheduledFor || r.notified) return false
        const scheduledTime = new Date(r.scheduledFor).getTime()
        return scheduledTime <= now
      })

      if (dueReminder) {
        // Trigger Sidebar Popup / Toast
        setSelectedItem({ ...dueReminder, type: 'reminder' })

        // Mark as notified in state to prevent it from triggering again
        // This state update triggers the persistence useEffect, saving 'notified: true' to localStorage
        setReminders(prev => prev.map(rem => rem.id === dueReminder.id ? { ...rem, notified: true } : rem))
      }
    }

    // Run check immediately on mount/update to catch missed reminders from when app was closed
    checkReminders()

    const interval = setInterval(checkReminders, 5000) // Check every 5 seconds for responsiveness
    return () => clearInterval(interval)
  }, [reminders])

  const formatReminderTime = (dateStr) => {
    if (!dateStr) return 'No time set'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return 'No time set'

      if (isToday(d)) return `Today, ${format(d, 'hh:mm a')}`
      if (isTomorrow(d)) return `Tomorrow, ${format(d, 'hh:mm a')}`
      if (isThisYear(d)) return format(d, 'MMM d, hh:mm a')
      return format(d, 'MMM d, yyyy')
    } catch (e) {
      return 'Just now'
    }
  }

  const formatTrialTimeLeft = (ms) => {
    const totalSeconds = Math.floor(ms / 1000)
    const days = Math.floor(totalSeconds / (24 * 3600))
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h left`
    if (hours > 0) return `${hours}h ${minutes}m left`
    return `${minutes}m left`
  }

  const menuRef = useRef(null)
  const reminderRef = useRef(null)
  const msgRef = useRef(null)
  const alertRef = useRef(null)

  const currentVersion = pkg.version
  const unreadReminders = reminders.filter(r => !r.read).length
  const unreadMessages = messages.filter(m => !m.read).length
  const unreadAlerts = alerts.filter(a => !a.read).length

  const businessName = settings?.businessName || 'AllSet'
  const businessTagline = settings?.businessTagline || 'From Chaos to Clarity'
  const logoSrc = settings?.businessLogo
    ? settings.businessLogo
    : (effectiveTheme === 'dark' ? './logo-dark.png' : './logo-light.png')

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Profile Menu
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      // Reminders
      if (reminderRef.current && !reminderRef.current.contains(event.target) && !event.target.closest('.status-icon-btn')) {
        setShowReminders(false)
      }
      // Messages
      if (msgRef.current && !msgRef.current.contains(event.target) && !event.target.closest('.status-icon-btn')) {
        setShowMessages(false)
      }
      // Alerts
      if (alertRef.current && !alertRef.current.contains(event.target) && !event.target.closest('.status-icon-btn')) {
        setShowAlerts(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const markAllRemindersRead = () => {
    setReminders(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markReminderRead = (id) => {
    setReminders(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n))
  }

  const markAllMessagesRead = () => {
    const readMessageIds = JSON.parse(localStorage.getItem('read_app_messages') || '[]')
    messages.forEach(m => {
      if (!readMessageIds.includes(m.id)) readMessageIds.push(m.id)
    })
    localStorage.setItem('read_app_messages', JSON.stringify(readMessageIds))
    setMessages(prev => prev.map(m => ({ ...m, read: true })))
  }

  const markMessageRead = (id) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id) {
        const newReadStatus = !m.read
        const readMessageIds = JSON.parse(localStorage.getItem('read_app_messages') || '[]')
        if (newReadStatus) {
          if (!readMessageIds.includes(id)) readMessageIds.push(id)
        } else {
          const index = readMessageIds.indexOf(id)
          if (index > -1) readMessageIds.splice(index, 1)
        }
        localStorage.setItem('read_app_messages', JSON.stringify(readMessageIds))
        return { ...m, read: newReadStatus }
      }
      return m
    }))
  }

  const markAllAlertsRead = () => {
    const readAlertIds = JSON.parse(localStorage.getItem('read_app_alerts') || '[]')
    alerts.forEach(a => {
      if (!readAlertIds.includes(a.id)) readAlertIds.push(a.id)
    })
    localStorage.setItem('read_app_alerts', JSON.stringify(readAlertIds))
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }

  const markAlertRead = (id) => {
    setAlerts(prev => prev.map(a => {
      if (a.id === id) {
        const newReadStatus = !a.read
        const readAlertIds = JSON.parse(localStorage.getItem('read_app_alerts') || '[]')
        if (newReadStatus) {
          if (!readAlertIds.includes(id)) readAlertIds.push(id)
        } else {
          const index = readAlertIds.indexOf(id)
          if (index > -1) readAlertIds.splice(index, 1)
        }
        localStorage.setItem('read_app_alerts', JSON.stringify(readAlertIds))
        return { ...a, read: newReadStatus }
      }
      return a
    }))
  }

  const [selectedItem, setSelectedItem] = useState(null)

  const handleItemClick = (item, type, e) => {
    e.stopPropagation()
    // Mark as read when opening if it's currently unread
    if (type === 'reminder' && !item.read) markReminderRead(item.id)
    if (type === 'message' && !item.read) markMessageRead(item.id)
    if (type === 'alert' && !item.read) markAlertRead(item.id)

    setSelectedItem({ ...item, type })
    setShowReminders(false)
    setShowMessages(false)
    setShowAlerts(false)
  }

  const handleToggleRead = (id, type, e) => {
    e.stopPropagation() // Prevent opening the modal
    if (type === 'reminder') markReminderRead(id)
    if (type === 'message') markMessageRead(id)
    if (type === 'alert') markAlertRead(id)
  }

  const addReminder = (reminderData) => {
    if (editingReminderId) {
      setReminders(prev => prev.map(r => r.id === editingReminderId ? { ...r, ...reminderData } : r))
      setEditingReminderId(null)
    } else {
      const newReminder = {
        id: Date.now(),
        ...reminderData,
        read: false,
        time: 'Just now'
      }
      setReminders(prev => [newReminder, ...prev])
    }
  }

  const editReminder = (reminder, e) => {
    e.stopPropagation()
    setReminderTitle(reminder.title)
    setReminderNotes(reminder.text)
    setReminderImportance(reminder.importance)
    setReminderDateTime(reminder.scheduledFor || new Date().toISOString())
    setEditingReminderId(reminder.id)
    setShowReminderForm(true)
    setShowReminders(false)
  }

  const deleteReminder = (id, e) => {
    if (e) e.stopPropagation()
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  const snoozeReminder = (id, minutes) => {
    const newTime = new Date(Date.now() + minutes * 60000).toISOString()
    setReminders(prev => prev.map(r =>
      r.id === id ? { ...r, scheduledFor: newTime, notified: false, read: false } : r
    ))
    setSelectedItem(null)
  }

  return (
    <>
      {/* Detail Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)'
        }} onClick={() => setSelectedItem(null)}>
          <div style={{
            width: '90%', maxWidth: '400px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '24px', padding: '2rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            animation: 'premiumFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              {selectedItem.type === 'reminder' && (
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <Bell size={24} />
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>
                    {selectedItem.type === 'reminder' ? (selectedItem.title || 'Reminder') : (selectedItem.type === 'alert' ? selectedItem.title : selectedItem.sender)}
                  </h3>
                  {selectedItem.type === 'reminder' && selectedItem.importance && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      backgroundColor: selectedItem.importance === 'High' ? 'rgba(239, 68, 68, 0.15)' : selectedItem.importance === 'Medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: selectedItem.importance === 'High' ? '#ef4444' : selectedItem.importance === 'Medium' ? '#f59e0b' : '#22c55e',
                      border: `1px solid ${selectedItem.importance === 'High' ? 'rgba(239, 68, 68, 0.2)' : selectedItem.importance === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
                    }}>
                      {selectedItem.importance}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {selectedItem.type === 'reminder' && selectedItem.scheduledFor ? formatReminderTime(selectedItem.scheduledFor) : selectedItem.time}
                </p>
              </div>
            </div>

            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '1rem', marginBottom: '2rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px' }}>
              {selectedItem.text}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {selectedItem.type === 'reminder' && (
                <>
                  <button
                    onClick={() => snoozeReminder(selectedItem.id, 10)}
                    style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Clock size={16} /> Snooze 10m
                  </button>
                  <button
                    onClick={() => {
                      deleteReminder(selectedItem.id)
                      setSelectedItem(null)
                    }}
                    style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Check size={16} /> Done
                  </button>
                </>
              )}
              {selectedItem.type !== 'reminder' && (
                <>
                  <button
                    onClick={(e) => {
                      handleToggleRead(selectedItem.id, selectedItem.type, e)
                      setSelectedItem(null)
                    }}
                    style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Circle size={16} /> Mark as Unread
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: 'none', backgroundColor: 'var(--accent-primary)', color: 'white', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Check size={16} /> Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Button - Only visible on mobile/overlay mode */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: 'calc(1.25rem + var(--safe-area-top))',
          right: 'calc(1rem + var(--safe-area-right))',
          left: 'unset',
          zIndex: 101,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '0.5rem',
          display: 'none', // Managed by CSS media queries usually, but kept inline for now
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          backdropFilter: 'blur(8px)'
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
        paddingTop: 'calc(0.5rem + var(--safe-area-top))', // Reduced padding for status bar
        zIndex: 100,
        transition: 'width 0.3s ease, transform 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start', // Changed from space-between to allow scrollable middle
        overflow: 'visible' // Allow popovers to fly out
      }}
        className={`sidebar ${sidebarOpen ? 'open' : ''} expanded`}
      >
        {/* Fixed Top Section: Status Bar - OUTSIDE scrollable area */}
        <div style={{
          padding: '1.25rem 1.5rem 0.5rem 1.5rem',
          marginBottom: '0.5rem',
          display: 'flex',
          justifyContent: 'flex-start', // Aligned to left
          gap: '1.25rem',
          flexShrink: 0,
          position: 'relative' // Anchor for popovers
        }}>
          {/* Alerts Icon */}
          <div style={{ position: 'relative' }}>
            <button
              className="status-icon-btn"
              onClick={() => { setShowAlerts(!showAlerts); setShowReminders(false); setShowMessages(false); }}
              style={{
                color: showAlerts ? 'var(--warning)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={20} />
              {unreadAlerts > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px', backgroundColor: 'var(--warning)', color: 'white',
                  fontSize: '10px', fontWeight: '800', borderRadius: '50%', minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-sidebar)',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
                }}>{unreadAlerts}</span>
              )}
            </button>

            {/* Alerts Popover */}
            {showAlerts && (
              <div ref={alertRef} style={{
                position: 'absolute', top: '100%', left: window.innerWidth <= 768 ? '-1.5rem' : '-1rem', right: 'auto',
                width: window.innerWidth <= 768 ? 'calc(100vw - 2rem)' : '320px',
                backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                backdropFilter: 'blur(20px)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                zIndex: 210, marginTop: '15px', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out'
              }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Alerts</span>
                  <button onClick={markAllAlertsRead} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No alerts</div>
                  ) : (
                    alerts.map(a => (
                      <div key={a.id} onClick={(e) => handleItemClick(a, 'alert', e)} style={{
                        padding: '1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                        backgroundColor: a.read ? 'transparent' : 'rgba(245, 158, 11, 0.05)', transition: 'background 0.2s',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                      }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = a.read ? 'transparent' : 'rgba(245, 158, 11, 0.05)'}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: a.read ? 600 : 800, fontSize: '0.9rem', color: a.read ? 'var(--text-primary)' : 'var(--warning)' }}>{a.title}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.time}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.text}</p>
                        </div>
                        <button
                          onClick={(e) => handleToggleRead(a.id, 'alert', e)}
                          style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: a.read ? 'var(--text-muted)' : 'var(--warning)', display: 'flex' }}
                          title={a.read ? "Mark as unread" : "Mark as read"}
                        >
                          {a.read ? <Check size={18} /> : <Circle size={18} />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages Icon */}
          <div style={{ position: 'relative' }}>
            <button
              className="status-icon-btn"
              onClick={() => { setShowMessages(!showMessages); setShowReminders(false); setShowAlerts(false); }}
              style={{
                color: showMessages ? 'var(--accent-primary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MessageSquare size={20} />
              {unreadMessages > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px', backgroundColor: 'var(--accent-primary)', color: 'white',
                  fontSize: '10px', fontWeight: '800', borderRadius: '50%', minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-sidebar)',
                  boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.4)'
                }}>{unreadMessages}</span>
              )}
            </button>

            {/* Messages Popover */}
            {showMessages && (
              <div ref={msgRef} style={{
                position: 'absolute', top: '100%', left: window.innerWidth <= 768 ? '-5.5rem' : '-1rem', right: 'auto',
                width: window.innerWidth <= 768 ? 'calc(100vw - 2rem)' : '320px',
                backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                backdropFilter: 'blur(20px)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                zIndex: 210, marginTop: '15px', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out'
              }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Messages</span>
                  <button onClick={markAllMessagesRead} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {messages.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No messages</div>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} onClick={(e) => handleItemClick(m, 'message', e)} style={{
                        padding: '1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                        backgroundColor: m.read ? 'transparent' : 'rgba(var(--accent-rgb), 0.05)', transition: 'background 0.2s',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                      }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = m.read ? 'transparent' : 'rgba(var(--accent-rgb), 0.05)'}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: m.read ? 600 : 800, fontSize: '0.9rem', color: m.read ? 'var(--text-primary)' : 'var(--accent-primary)' }}>{m.sender}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.time}</span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.text}</p>
                        </div>
                        <button
                          onClick={(e) => handleToggleRead(m.id, 'message', e)}
                          style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: m.read ? 'var(--text-muted)' : 'var(--accent-primary)', display: 'flex' }}
                          title={m.read ? "Mark as unread" : "Mark as read"}
                        >
                          {m.read ? <Check size={18} /> : <Circle size={18} />}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reminders Icon */}
          <div style={{ position: 'relative' }}>
            <button
              className="status-icon-btn"
              onClick={() => { setShowReminders(!showReminders); setShowMessages(false); setShowAlerts(false); }}
              style={{
                color: showReminders ? 'var(--accent-primary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bell size={20} />
              {unreadReminders > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px', backgroundColor: 'var(--accent-primary)', color: 'white',
                  fontSize: '10px', fontWeight: '800', borderRadius: '50%', minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-sidebar)',
                  boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.4)'
                }}>{unreadReminders}</span>
              )}
            </button>

            {/* Reminders Popover */}
            {showReminders && (
              <div ref={reminderRef} style={{
                position: 'absolute', top: '100%', left: window.innerWidth <= 768 ? '-9.5rem' : '-1rem', right: 'auto',
                width: window.innerWidth <= 768 ? 'calc(100vw - 2rem)' : '320px',
                backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                backdropFilter: 'blur(20px)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                zIndex: 210, marginTop: '15px', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out'
              }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Reminders</span>
                    <button
                      onClick={() => setShowReminderForm(true)}
                      style={{
                        backgroundColor: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid rgba(var(--accent-rgb), 0.2)',
                        borderRadius: '6px', color: 'var(--accent-primary)', cursor: 'pointer', padding: '4px 8px',
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600
                      }}
                    >
                      <Plus size={14} /> Reminder
                    </button>
                  </div>
                  <button onClick={markAllRemindersRead} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Mark all read</button>
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {reminders.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No reminders</div>
                  ) : (
                    reminders.map(r => (
                      <div key={r.id} onClick={(e) => handleItemClick(r, 'reminder', e)} style={{
                        padding: '1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer',
                        backgroundColor: r.read ? 'transparent' : 'rgba(var(--accent-rgb), 0.05)', transition: 'background 0.2s',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                      }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = r.read ? 'transparent' : 'rgba(var(--accent-rgb), 0.05)'}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {r.importance === 'High' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} />}
                              <span style={{ fontWeight: r.read ? 600 : 800, fontSize: '0.9rem', color: r.read ? 'var(--text-primary)' : 'var(--accent-primary)' }}>{r.title}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {r.scheduledFor ? formatReminderTime(r.scheduledFor) : (r.time || 'Just now')}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.text}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button
                            onClick={(e) => editReminder(r, e)}
                            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                            title="Edit"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={(e) => handleToggleRead(r.id, 'reminder', e)}
                            style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: r.read ? 'var(--text-muted)' : 'var(--accent-primary)', display: 'flex' }}
                            title={r.read ? "Mark as unread" : "Mark as read"}
                          >
                            {r.read ? <Check size={18} /> : <Circle size={18} />}
                          </button>
                          {!r.isUpsell && (
                            <button
                              onClick={(e) => deleteReminder(r.id, e)}
                              style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                              title="Delete reminder"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content: Logo, Nav, Buttons */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>

          {/* Logo & Info Section */}
          <div style={{
            padding: '0 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.1rem',
            transition: 'all 0.3s ease'
          }}>
            <img
              src={logoSrc}
              alt="AllSet Logo"
              style={{
                width: '110px',
                height: '110px',
                objectFit: 'contain',
                transition: 'all 0.3s ease'
              }}
            />

            <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
              <h1 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
                whiteSpace: 'nowrap'
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
                  opacity: 0.9,
                  whiteSpace: 'nowrap'
                }}>
                  {businessTagline}
                </p>
              )}
              {businessName !== 'AllSet' && (
                <p style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                  marginTop: businessTagline ? '0' : '-0.2rem'
                }}>
                  Powered by AllSet
                </p>
              )}
              <div style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--accent-primary)',
                marginTop: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                opacity: 0.8
              }}>
                <span>v{currentVersion}</span>
              </div>

              {isTrialActive && (
                <div style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  animation: 'pulse 2s infinite ease-in-out'
                }}>
                  <div style={{
                    padding: '0.2rem 0.6rem',
                    backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
                    border: '1px solid rgba(var(--accent-rgb), 0.3)',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--accent-primary)',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <Zap size={10} fill="var(--accent-primary)" /> Trial Active
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    fontWeight: 600
                  }}>
                    {formatTrialTimeLeft(timeLeft)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-col gap-sm px-4" style={{ flex: 1, padding: '0 1rem', overflowX: 'hidden' }}>
            {menuItems.map(item => {
              const Icon = item.icon
              const isActive = activeView === item.id
              const isLocked = item.proOnly && isFreeUser

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id, item.proOnly)}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  title={item.label} // Tooltip on collapse
                  style={{
                    justifyContent: 'flex-start',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <Icon size={20} className="nav-icon" />
                  <span className="flex-1 text-left" style={{ animation: 'fadeIn 0.2s' }}>{item.label}</span>

                  {isLocked && <ProFeatureBadge size={14} />}
                </button>
              )
            })}
          </nav>


          {/* Add Actions (New Order / Expense) */}
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
                transition: 'all 0.2s ease',
              }}
              title={"New Order"}
            >
              <Plus size={18} />
              <span style={{ marginLeft: '0.5rem' }}>New Order</span>
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
              title={isFreeUser ? 'Pro feature' : 'New Expense'}
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
              left: '0.5rem',
              right: '0.5rem',
              marginBottom: '0',
              width: 'auto',
              marginLeft: 0,
              backgroundColor: 'var(--bg-card)',
              border: `1px solid var(--border-color)`,
              borderRadius: '16px 16px 0 0',
              boxShadow: effectiveTheme === 'dark' ? '0 8px 32px rgba(0,0,0,0.6)' : '0 4px 25px rgba(0,0,0,0.1)',
              borderBottom: 'none',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
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
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
                          borderRadius: '8px',
                          objectFit: 'contain',
                          border: '1px solid var(--border-color)',
                          backgroundColor: effectiveTheme === 'dark' ? '#000' : '#fff',
                          padding: '5px'
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
                      border: `2px solid var(--bg-card)`,
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
                  <button onClick={() => { setActiveView('profile'); setShowProfileMenu(false); if (window.innerWidth <= 768) setSidebarOpen(false); }} style={menuItemStyle}>
                    <User size={18} />
                    Profile
                  </button>

                  {/* Settings */}
                  <button onClick={() => { setActiveView('settings'); setShowProfileMenu(false); if (window.innerWidth <= 768) setSidebarOpen(false); }} style={menuItemStyle} data-tab="settings">
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
                  <button onClick={() => { setActiveView('contact'); setShowProfileMenu(false); if (window.innerWidth <= 768) setSidebarOpen(false); }} style={menuItemStyle}>
                    <Phone size={18} />
                    Contact Support
                  </button>

                  {/* Help / Documentation */}
                  <button onClick={() => { window.open('https://AllSet.github.io/docs.html', '_blank'); setShowProfileMenu(false); }} style={menuItemStyle}>
                    <LifeBuoy size={18} />
                    Help & Docs
                  </button>

                  {/* About */}
                  <button onClick={() => { setActiveView('about'); setShowProfileMenu(false); if (window.innerWidth <= 768) setSidebarOpen(false); }} style={menuItemStyle}>
                    <Info size={18} />
                    About AllSet
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
            style={{
              padding: '1rem 1.5rem',
              paddingBottom: 'calc(1rem + var(--safe-area-bottom))',
              backgroundColor: showProfileMenu ? `rgba(var(--accent-rgb), ${effectiveTheme === 'dark' ? '0.15' : '0.1'})` : 'transparent',
              borderTop: showProfileMenu ? `1px solid rgba(var(--accent-rgb), ${effectiveTheme === 'dark' ? '0.2' : '0.1'})` : '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', width: '100%' }}>
              <div style={{ position: 'relative' }}>
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt="Profile"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      objectFit: 'contain',
                      border: '1px solid var(--border-color)',
                      backgroundColor: effectiveTheme === 'dark' ? '#000' : '#fff',
                      padding: '3px'
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

              <div style={{ animation: 'fadeIn 0.2s' }}>
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
      </aside >

      {/* Reminder Creation Modal */}
      {
        showReminderForm && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)'
          }} onClick={() => setShowReminderForm(false)}>
            <div style={{
              width: '90%', maxWidth: '450px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '24px', padding: '2rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              animation: 'slideUp 0.3s ease-out'
            }} onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowReminderForm(false); setEditingReminderId(null); }} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 800 }}>
                {editingReminderId ? 'Edit Reminder' : 'Create Reminder'}
              </h3>

              <form onSubmit={e => {
                e.preventDefault()
                addReminder({
                  title: reminderTitle,
                  text: reminderNotes,
                  importance: reminderImportance,
                  scheduledFor: reminderDateTime
                })
                // Reset and close
                setReminderTitle('')
                setReminderNotes('')
                setReminderImportance('Medium')
                setReminderDateTime(new Date().toISOString())
                setShowReminderForm(false)
                setShowReminders(true)
              }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    required
                    value={reminderTitle}
                    onChange={e => setReminderTitle(e.target.value)}
                    type="text"
                    placeholder="e.g. Call customer for delivery"
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</label>
                  <textarea
                    value={reminderNotes}
                    onChange={e => setReminderNotes(e.target.value)}
                    placeholder="Any additional details..."
                    rows="3"
                    style={{
                      width: '100%', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', outline: 'none', resize: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Importance <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', padding: '4px', background: 'var(--bg-secondary)', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                      {[
                        { value: 'Low', color: '#22c55e', icon: ArrowDown },
                        { value: 'Medium', color: '#f59e0b', icon: Clock },
                        { value: 'High', color: '#ef4444', icon: AlertTriangle }
                      ].map((opt) => {
                        const isSelected = reminderImportance === opt.value
                        const Icon = opt.icon
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setReminderImportance(opt.value)}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              padding: '0.7rem',
                              borderRadius: '10px',
                              border: 'none',
                              backgroundColor: isSelected ? opt.color : 'transparent',
                              color: isSelected ? '#fff' : 'var(--text-muted)',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? `0 4px 12px ${opt.color}40` : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            <Icon size={16} />
                            <span style={{ fontSize: '0.85rem' }}>{opt.value}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Date & Time <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <CustomDateTimePicker
                      value={reminderDateTime}
                      onChange={setReminderDateTime}
                      placeholder="Pick time"
                      minDate={new Date()}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" onClick={() => setShowReminderForm(false)} style={{
                    flex: 1, padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600
                  }}>Cancel</button>
                  <button type="submit" style={{
                    flex: 2, padding: '1rem', borderRadius: '14px', border: 'none',
                    backgroundColor: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontWeight: 700,
                    boxShadow: '0 10px 20px -5px rgba(var(--accent-rgb), 0.3)'
                  }}>Save Reminder</button>
                </div>
              </form>
            </div>
          </div>
        )
      }
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
