import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, MessageCircle, Edit, Trash2, Eye, Download, ChevronUp, ChevronDown, Paperclip, Star, Repeat, Truck, X, Loader, Crown, Calendar } from 'lucide-react'
import CustomDropdown from './Common/CustomDropdown'
import CollapsibleDateFilter from './Common/CollapsibleDateFilter'
import Pagination from './Common/Pagination'
import OrderForm from './OrderForm'
import DispatchModal from './DispatchModal'
import ViewOrderModal from './ViewOrderModal'
import TrackingNumberModal from './TrackingNumberModal'
import CurfoxTrackingModal from './CurfoxTrackingModal'
import ConfirmationModal from './ConfirmationModal'
import { saveOrders, getProducts, getSettings } from '../utils/storage'
import { deleteOrderItemImage } from '../utils/fileStorage'
import { formatWhatsAppNumber, generateWhatsAppMessage } from '../utils/whatsapp'
import * as XLSX from 'xlsx'
import { useToast } from './Toast/ToastContext'
import { curfoxService } from '../utils/curfox'
import { format, startOfMonth, endOfMonth, isWithinInterval, parse } from 'date-fns'

// Dropdown Options Constants
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pendingDispatch', label: 'Pending Dispatch' },
  { value: 'New Order', label: 'New Order' },
  { value: 'Packed', label: 'Packed' },
  { value: 'Dispatched', label: 'Dispatched' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'refund', label: 'Refund' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PAYMENT_OPTIONS = [
  { value: 'all', label: 'All Payment' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Pending', label: 'Pending' },
]

const SORT_OPTIONS = [
  { value: 'orderNumber', label: 'Order Number' },
  { value: 'date', label: 'Date' },
  { value: 'totalPrice', label: 'Total Price' },
  { value: 'status', label: 'Order Status' },
  { value: 'paymentStatus', label: 'Payment Status' },
  { value: 'trackingNumber', label: 'Tracking Number' },
]

const BULK_STATUS_OPTIONS = [
  { value: 'New Order', label: 'New Order' },
  { value: 'Packed', label: 'Packed' },
  { value: 'Dispatched', label: 'Dispatched' },
  { value: 'returned', label: 'Returned' },
  { value: 'refund', label: 'Refund' },
  { value: 'cancelled', label: 'Cancelled' },
]

const OrderManagement = ({ orders, onUpdateOrders, triggerFormOpen, initialFilters = {}, prefilledOrder, onClearPrefilled }) => {
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [viewingOrder, setViewingOrder] = useState(null)
  const [editingOrder, setEditingOrder] = useState(null)
  const [trackingOrder, setTrackingOrder] = useState(null)
  const [trackingTargetStatus, setTrackingTargetStatus] = useState('Packed')
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('allset_orders_search') || '')
  const [statusFilter, setStatusFilter] = useState(() => initialFilters.statusFilter || 'all')
  const [paymentFilter, setPaymentFilter] = useState(() => initialFilters.paymentFilter || 'all')
  const [scheduledDeliveriesOnly, setScheduledDeliveriesOnly] = useState(() => {
    if (initialFilters.scheduledDeliveries !== undefined) return !!initialFilters.scheduledDeliveries
    return false
  })
  const [editingStatus, setEditingStatus] = useState(null) // { orderId, field: 'status' | 'paymentStatus' }
  const [products, setProducts] = useState({ categories: [] })
  const [selectedOrders, setSelectedOrders] = useState(new Set()) // Set of order IDs
  const [manuallyDeselectedOrders, setManuallyDeselectedOrders] = useState(new Set()) // Set of order IDs manually deselected in status mode
  const [isSelectModeActive, setIsSelectModeActive] = useState(false) // Toggle for select mode
  const [selectMode, setSelectMode] = useState('manual') // 'manual' or 'status'
  const [orderStatusSelectFilter, setOrderStatusSelectFilter] = useState('all') // Order status filter for selection
  const [paymentStatusSelectFilter, setPaymentStatusSelectFilter] = useState('all') // Payment status filter for selection
  const [sortField, setSortField] = useState('status') // Sort field: orderNumber, date, totalPrice, status, paymentStatus, trackingNumber
  const [sortDirection, setSortDirection] = useState('asc') // Sort direction: 'asc' or 'desc'

  const [settings, setSettings] = useState(null)

  const [showWaybillModal, setShowWaybillModal] = useState(false)
  const [waybillTargetOrder, setWaybillTargetOrder] = useState(null)
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchProgress, setDispatchProgress] = useState({ current: 0, total: 0 })
  const [showTrackingStatusModal, setShowTrackingStatusModal] = useState(false)
  const [trackingStatusOrder, setTrackingStatusOrder] = useState(null)

  // Date Filter State
  const [filterType, setFilterType] = useState(() => localStorage.getItem('allset_orders_filter_type') || 'month')
  const [selectedMonth, setSelectedMonth] = useState(() => localStorage.getItem('allset_orders_selected_month') || format(new Date(), 'yyyy-MM'))
  const [startDate, setStartDate] = useState(() => localStorage.getItem('allset_orders_start_date') || format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => localStorage.getItem('allset_orders_end_date') || format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [isDateFilterExpanded, setIsDateFilterExpanded] = useState(() => localStorage.getItem('allset_orders_date_filter_expanded') === 'true')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('allset_orders_page')
    const parsed = parseInt(saved, 10)
    return isNaN(parsed) ? 1 : parsed
  })
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('allset_orders_search', searchTerm)
  }, [searchTerm])

  useEffect(() => {
    localStorage.setItem('allset_orders_status_filter', statusFilter)
  }, [statusFilter])

  useEffect(() => {
    localStorage.setItem('allset_orders_payment_filter', paymentFilter)
  }, [paymentFilter])

  useEffect(() => {
    localStorage.setItem('allset_orders_scheduled_only', scheduledDeliveriesOnly.toString())
  }, [scheduledDeliveriesOnly])

  useEffect(() => {
    localStorage.setItem('allset_orders_page', currentPage.toString())
  }, [currentPage])

  useEffect(() => {
    localStorage.setItem('allset_orders_filter_type', filterType)
  }, [filterType])

  useEffect(() => {
    localStorage.setItem('allset_orders_selected_month', selectedMonth)
  }, [selectedMonth])

  useEffect(() => {
    localStorage.setItem('allset_orders_start_date', startDate)
  }, [startDate])

  useEffect(() => {
    localStorage.setItem('allset_orders_end_date', endDate)
  }, [endDate])

  useEffect(() => {
    localStorage.setItem('allset_orders_date_filter_expanded', isDateFilterExpanded.toString())
  }, [isDateFilterExpanded])

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'default',
    title: '',
    message: '',
    onConfirm: null,
    isAlert: false,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    extraButtonText: null,
    onExtraButtonClick: null,
    extraButtonDisabled: false,
    confirmDisabled: false
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

  const showConfirm = (title, message, onConfirm, type = 'default', confirmText = 'Confirm', options = {}) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      isAlert: false,
      confirmText,
      cancelText: options.cancelText || 'Cancel',
      extraButtonText: options.extraButtonText,
      onExtraButtonClick: options.onExtraButtonClick,
      extraButtonDisabled: options.extraButtonDisabled,
      confirmDisabled: options.confirmDisabled
    })
  }

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }))
  }

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      const [productsData, settingsData] = await Promise.all([
        getProducts(),
        getSettings()
      ])
      setProducts(productsData)
      setSettings(settingsData)
    }
    loadData()

  }, [])



  // Sync filters when navigation passes new initialFilters (e.g., dashboard cards)
  useEffect(() => {
    if (initialFilters?.statusFilter !== undefined) {
      setStatusFilter(initialFilters.statusFilter || 'all')
    }
    if (initialFilters?.paymentFilter !== undefined) {
      setPaymentFilter(initialFilters.paymentFilter || 'all')
    }
    setScheduledDeliveriesOnly(!!initialFilters?.scheduledDeliveries)
  }, [initialFilters])

  // Handle external form trigger (only when triggerFormOpen > 0)
  useEffect(() => {
    if (triggerFormOpen > 0) {
      if (prefilledOrder) {
        setEditingOrder(prefilledOrder)
      } else {
        setEditingOrder(null)
      }
      setShowForm(true)
    }
  }, [triggerFormOpen, prefilledOrder])

  const isWithinNextDays = (dateStr, days) => {
    if (!dateStr) return false
    const dt = new Date(dateStr)
    if (Number.isNaN(dt.getTime())) return false

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + days)
    end.setHours(23, 59, 59, 999)

    return dt >= start && dt <= end
  }

  const filteredOrders = useMemo(() => {
    let filtered = orders.filter(order => {
      // Get all item and category names for comprehensive search
      const items = Array.isArray(order.orderItems) && order.orderItems.length > 0
        ? order.orderItems
        : [{ categoryId: order.categoryId, itemId: order.itemId, customItemName: order.customItemName }]

      const allItemSearchString = items.map(it => {
        const cat = products.categories.find(c => c.id === it.categoryId)
        const product = cat?.items.find(p => p.id === it.itemId)
        return `${cat?.name || ''} ${it.customItemName || product?.name || ''}`
      }).join(' ').toLowerCase()

      const matchesSearch =
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.phone?.includes(searchTerm) ||
        order.whatsapp?.includes(searchTerm) ||
        order.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        allItemSearchString.includes(searchTerm.toLowerCase())

      // Handle special "pendingDispatch" filter
      let matchesStatus = true
      if (statusFilter === 'pendingDispatch') {
        matchesStatus = order.status !== 'Dispatched' &&
          order.status !== 'Delivered' &&
          order.status !== 'returned' &&
          order.status !== 'refund' &&
          order.status !== 'cancelled'
      } else if (statusFilter !== 'all') {
        matchesStatus = order.status === statusFilter
      }

      let matchesPayment = true
      if (paymentFilter === 'all') {
        matchesPayment = true
      } else if (paymentFilter === 'Pending') {
        matchesPayment = order.paymentStatus !== 'Paid'
      } else {
        matchesPayment = order.paymentStatus === paymentFilter
      }

      const matchesScheduled = scheduledDeliveriesOnly
        ? isWithinNextDays(order.deliveryDate, 3) && !['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(order.status)
        : true

      // Date filtering
      let matchesDate = true
      if (order.orderDate) {
        try {
          const orderDate = parse(order.orderDate, 'yyyy-MM-dd', new Date())

          if (filterType === 'month') {
            // Filter by selected month
            const monthStart = startOfMonth(parse(selectedMonth, 'yyyy-MM', new Date()))
            const monthEnd = endOfMonth(parse(selectedMonth, 'yyyy-MM', new Date()))
            matchesDate = isWithinInterval(orderDate, { start: monthStart, end: monthEnd })
          } else {
            // Filter by custom date range
            const rangeStart = parse(startDate, 'yyyy-MM-dd', new Date())
            const rangeEnd = parse(endDate, 'yyyy-MM-dd', new Date())
            matchesDate = isWithinInterval(orderDate, { start: rangeStart, end: rangeEnd })
          }
        } catch (error) {
          // If date parsing fails, include the order
          matchesDate = true
        }
      }

      return matchesSearch && matchesStatus && matchesPayment && matchesScheduled && matchesDate
    })

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortField) {
        case 'orderNumber':
          // Parse order number as integer for numeric sorting
          aValue = parseInt(a.id) || 0
          bValue = parseInt(b.id) || 0
          break
        case 'date':
          // Sort by created date
          aValue = new Date(a.createdDate || a.orderDate || 0).getTime()
          bValue = new Date(b.createdDate || b.orderDate || 0).getTime()
          break
        case 'totalPrice':
          aValue = parseFloat(a.totalPrice || a.totalAmount || 0)
          bValue = parseFloat(b.totalPrice || b.totalAmount || 0)
          break
        case 'status':
          // Custom status order: New Order, Packed, Dispatched, then others
          const statusOrder = ['New Order', 'Packed', 'Dispatched', 'Delivered', 'returned', 'refund', 'cancelled']
          const aStatus = a.status || ''
          const bStatus = b.status || ''
          const aIndex = statusOrder.indexOf(aStatus) !== -1 ? statusOrder.indexOf(aStatus) : statusOrder.length
          const bIndex = statusOrder.indexOf(bStatus) !== -1 ? statusOrder.indexOf(bStatus) : statusOrder.length

          // If both are in the main priority group (first 3), sort by index
          // If both are in the "others" group (index >= 3), sort alphabetically
          // If one is in main and one is in others, main comes first (handled by index comparison)
          if (aIndex < 3 && bIndex < 3) {
            // Both in main group - sort by index
            aValue = aIndex
            bValue = bIndex
          } else if (aIndex >= 3 && bIndex >= 3) {
            // Both in others group - sort alphabetically
            aValue = aStatus.toLowerCase()
            bValue = bStatus.toLowerCase()
          } else {
            // One in main, one in others - use index (main will have lower index)
            aValue = aIndex
            bValue = bIndex
          }
          break
        case 'paymentStatus':
          aValue = (a.paymentStatus || '').toLowerCase()
          bValue = (b.paymentStatus || '').toLowerCase()
          break
        case 'trackingNumber':
          aValue = (a.trackingNumber || '').toLowerCase()
          bValue = (b.trackingNumber || '').toLowerCase()
          break
        default:
          return 0
      }

      // Handle comparison
      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1
      }
      // Tie breaker: Last added (by ID) on top when primary sort is equal
      const aIdNum = parseInt(a.id) || 0
      const bIdNum = parseInt(b.id) || 0
      return bIdNum - aIdNum
    })

    return filtered
  }, [orders, searchTerm, statusFilter, paymentFilter, scheduledDeliveriesOnly, products, sortField, sortDirection, filterType, selectedMonth, startDate, endDate])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, paymentFilter, scheduledDeliveriesOnly, sortField, sortDirection, filterType, selectedMonth, startDate, endDate])

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const paginatedOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber)
    // Scroll to top of list
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Calculate customer statistics for repeat buyer recognition
  const customerStats = useMemo(() => {
    const stats = {}

    orders.forEach(order => {
      // Use WhatsApp number as primary identifier, fallback to phone
      // Normalize by removing spaces and non-digit chars (except +)
      const identifier = (order.whatsapp || order.phone || '').replace(/\s+/g, '').trim()

      if (identifier && identifier.length > 5) { // Basic length check to avoid garbage
        if (!stats[identifier]) {
          stats[identifier] = { count: 0, totalSpend: 0 }
        }
        stats[identifier].count += 1
        stats[identifier].totalSpend += (Number(order.totalPrice) || 0)
      }
    })

    return stats
  }, [orders])

  const getCustomerOrderCount = (order) => {
    const identifier = (order.whatsapp || order.phone || '').replace(/\s+/g, '').trim()
    return (identifier && customerStats[identifier]) ? customerStats[identifier].count : 1
  }

  // NOTE: In status mode we do NOT write filter-matching IDs into `selectedOrders`.
  // `selectedOrders` is reserved for manual extra selections (outside current filters),
  // while filter-matching selection is derived from `getStatusMatchingOrders()`.

  const handleSaveOrder = async (orderData) => {
    let updatedOrders
    if (editingOrder) {
      updatedOrders = orders.map(order =>
        order.id === orderData.id ? orderData : order
      )
    } else {
      // Prevent duplicate IDs in memory (breaks DB upsert + UI rendering)
      const exists = orders.some(o => o.id === orderData.id)
      updatedOrders = exists
        ? orders.map(o => (o.id === orderData.id ? orderData : o))
        : [...orders, orderData]
    }
    const success = await saveOrders(updatedOrders)
    if (success) {
      onUpdateOrders(updatedOrders)
      setEditingOrder(null)
      addToast(editingOrder ? 'Order updated successfully' : 'Order added successfully', 'success')
      return true
    } else {
      addToast('Failed to save order. Please try again.', 'error')
      return false
    }
  }

  const handleDeleteOrder = (orderId) => {
    showConfirm('Delete Order', 'Are you sure you want to delete this order?', async () => {
      try {
        const orderToDelete = orders.find(o => o.id === orderId)
        // Cleanup images
        if (orderToDelete && Array.isArray(orderToDelete.orderItems)) {
          const imagesToDelete = orderToDelete.orderItems
            .map(it => it.image)
            .filter(Boolean)

          if (imagesToDelete.length > 0) {
            await Promise.all(imagesToDelete.map(url => deleteOrderItemImage(url)))
          }
        }

        const updatedOrders = orders.filter(order => order.id !== orderId)
        const saveSuccess = await saveOrders(updatedOrders)
        if (saveSuccess) {
          onUpdateOrders(updatedOrders)
          addToast('Order deleted successfully', 'success')
        } else {
          addToast('Failed to delete order. Please try again.', 'error')
          console.error('Failed to delete order from Supabase')
        }
      } catch (error) {
        console.error('Error deleting order:', error)
        addToast('Error deleting order: ' + error.message, 'error')
      }
    }, 'danger', 'Delete')
  }

  const handleStatusChange = async (orderId, field, newValue) => {
    const order = orders.find(o => o.id === orderId)
    const today = new Date().toISOString().split('T')[0]

    // If status changed to Packed and tracking number isn't set, prompt for tracking number
    if (field === 'status' && newValue === 'Packed' && order) {
      if (!order.trackingNumber) {
        setTrackingOrder(order)
        setTrackingTargetStatus('Packed')
        setShowTrackingModal(true)
        setEditingStatus(null)
        return
      }
    }

    // If status changed to Dispatched and Curfox is enabled, trigger choice modal
    if (field === 'status' && newValue === 'Dispatched' && settings?.curfox?.enabled && order) {
      const isCurfoxConnected = settings.curfox.email && settings.curfox.password && settings.curfox.tenant;

      showConfirm(
        'Dispatch Order',
        'How would you like to handle this dispatch?',
        () => handleCurfoxDispatch(order), // Confirm = Send to Courier
        'default',
        'Send to Courier',
        {
          cancelText: 'Cancel',
          extraButtonText: 'Dispatch Locally',
          onExtraButtonClick: async () => {
            const updatedOrders = orders.map(o => {
              if (o.id === orderId) {
                return { ...o, status: 'Dispatched', dispatchDate: today }
              }
              return o
            })
            await saveOrders(updatedOrders)
            onUpdateOrders(updatedOrders)
            addToast('Order marked as Dispatched locally', 'success')
          },
          confirmDisabled: !isCurfoxConnected
        }
      )
      setEditingStatus(null)
      return
    }

    // If status changed to Dispatched and tracking number isn't set (Curfox is DISABLED here)
    if (field === 'status' && newValue === 'Dispatched' && order && !order.trackingNumber) {
      setEditingOrder({ ...order, status: 'Dispatched' })
      setShowDispatchModal(true)
      setEditingStatus(null)
      return
    }

    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const updated = { ...order, [field]: newValue }
        // If marking as Dispatched and dispatchDate isn't set (e.g., tracking already exists), set it automatically.
        if (field === 'status' && newValue === 'Dispatched' && !updated.dispatchDate) {
          updated.dispatchDate = today
        }
        // If marking as Delivered and deliveredDate isn't set, set it automatically.
        if (field === 'status' && newValue === 'Delivered' && !updated.deliveredDate) {
          updated.deliveredDate = today
        }
        return updated
      }
      return order
    })
    await saveOrders(updatedOrders)
    onUpdateOrders(updatedOrders)
    setEditingStatus(null)
  }

  // Curfox Dispatch Logic
  const handleCurfoxDispatch = async (order) => {
    if (!order.trackingNumber) {
      addToast('Order must have a Waybill ID (Packed status) before dispatching.', 'error')
      return
    }

    try {
      setIsDispatching(true)
      setWaybillTargetOrder(order)
      const currentSettings = await getSettings()
      const { email, password, tenant } = currentSettings?.curfox || {}

      if (!email || !password || !tenant) {
        addToast('Curfox credentials missing. Please check Settings.', 'error')
        return
      }

      if (!currentSettings.curfox.originCity || !currentSettings.curfox.originDistrict) {
        addToast('Missing Origin Location. Please go to Settings > Curfox and set Pickup City/District.', 'error')
        return
      }

      // Authenticate to get fresh token
      const authResponse = await curfoxService.login(email, password, tenant)
      if (!authResponse || !authResponse.token) {
        addToast('Curfox Authentication Failed', 'error')
        return
      }

      const authPayload = {
        ...currentSettings.curfox, // email, password, tenant, businessId, originCity, originDistrict
        token: authResponse.token,
        // prefer stored ID, fallback to login response
        businessId: currentSettings.curfox.businessId || authResponse.businessId,
        merchantRefNo: authResponse.user?.merchant?.ref_no,
        user: authResponse.user
      }

      console.log("Dispatching with AuthPayload:", { ...authPayload, token: '***' })

      // Call API
      await curfoxService.createOrder(order, order.trackingNumber, authPayload)

      // Update Order Status
      const today = new Date().toISOString().split('T')[0]
      const updatedOrder = { ...order, status: 'Dispatched', dispatchDate: today }

      const updatedOrders = orders.map(o => o.id === order.id ? updatedOrder : o)
      await saveOrders(updatedOrders)
      onUpdateOrders(updatedOrders)

      addToast('Order dispatched to Curfox successfully!', 'success')
    } catch (error) {
      console.error(error)
      addToast('Curfox Dispatch Failed: ' + error.message, 'error')
    } finally {
      setIsDispatching(false)
      setWaybillTargetOrder(null)
    }
  }

  const handleBulkCurfoxDispatch = async () => {
    const selected = getAllSelectedOrders()
    const packedWithWaybill = selected.filter(o => o.status === 'Packed' && o.trackingNumber)

    if (packedWithWaybill.length === 0) {
      addToast('No "Packed" orders with Waybill IDs selected for dispatch.', 'warning')
      return
    }

    try {
      const currentSettings = await getSettings()
      const { email, password, tenant } = currentSettings?.curfox || {}

      if (!email || !password || !tenant) {
        addToast('Curfox credentials missing. Please check Settings.', 'error')
        return
      }

      if (!currentSettings.curfox.originCity || !currentSettings.curfox.originDistrict) {
        addToast('Missing Origin Location. Please go to Settings > Curfox and set Pickup City/District.', 'error')
        return
      }

      // Authenticate ONCE
      setIsDispatching(true)
      const authResponse = await curfoxService.login(email, password, tenant)
      if (!authResponse || !authResponse.token) {
        addToast('Curfox Authentication Failed', 'error')
        setIsDispatching(false)
        return
      }

      const authPayload = {
        ...currentSettings.curfox,
        token: authResponse.token,
        businessId: currentSettings.curfox.businessId || authResponse.businessId,
        merchantRefNo: authResponse.user?.merchant?.ref_no,
        user: authResponse.user
      }

      showConfirm('Confirm Bulk Dispatch', `Dispatch ${packedWithWaybill.length} orders to Curfox?`, async () => {
        setDispatchProgress({ current: 0, total: packedWithWaybill.length })

        let successCount = 0
        let failedCount = 0
        const today = new Date().toISOString().split('T')[0]
        const updates = {}

        for (const order of packedWithWaybill) {
          try {
            await curfoxService.createOrder(order, order.trackingNumber, authPayload)
            updates[order.id] = { status: 'Dispatched', dispatchDate: today }
            successCount++
          } catch (error) {
            console.error(`Failed to dispatch order ${order.id}`, error)
            failedCount++
          }
          setDispatchProgress(prev => ({ ...prev, current: prev.current + 1 }))
        }

        if (successCount > 0) {
          const updatedOrdersList = orders.map(o => updates[o.id] ? { ...o, ...updates[o.id] } : o)
          await saveOrders(updatedOrdersList)
          onUpdateOrders(updatedOrdersList)

          // Clear successful selections
          const remainingSelection = new Set([...selectedOrders].filter(id => !updates[id]))
          setSelectedOrders(remainingSelection)
        }

        setIsDispatching(false)
        setDispatchProgress({ current: 0, total: 0 })

        if (failedCount === 0) {
          addToast(`Successfully dispatched ${successCount} orders to Curfox!`, 'success')
        } else {
          addToast(`Dispatched ${successCount} orders. ${failedCount} failed to send.`, 'warning')
        }
      }, 'primary', 'Dispatch Orders')

    } catch (error) {
      console.error(error)
      addToast('Bulk Dispatch Error: ' + error.message, 'error')
      setIsDispatching(false)
    }
  }

  const handleStatusClick = (orderId, field, e) => {
    e.stopPropagation()
    setEditingStatus({ orderId, field })
  }

  const handleDispatch = (order) => {
    setEditingOrder(order)
    setShowDispatchModal(true)
  }

  const handleEdit = (order) => {
    setEditingOrder(order)
    setShowForm(true)
  }

  const handleView = (order) => {
    setViewingOrder(order)
    setShowViewModal(true)
  }

  const openTrackingModalForOrder = (order, targetStatus = 'Packed') => {
    setTrackingOrder(order)
    setTrackingTargetStatus(targetStatus)
    setShowTrackingModal(true)
  }

  // Helper function to get category and item names
  const getCategoryItemNames = (order) => {
    const items = Array.isArray(order.orderItems) && order.orderItems.length > 0
      ? order.orderItems
      : [{
        categoryId: order.categoryId,
        itemId: order.itemId,
        customItemName: order.customItemName,
        quantity: Number(order.quantity) || 1,
        notes: order.notes // Fallback for single legacy items
      }]

    const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)

    if (items.length > 1) {
      // Map all items to their names
      const itemNames = []
      const itemNotesList = []

      items.forEach(it => {
        const category = products.categories.find(cat => cat.id === it.categoryId)
        const item = category?.items.find(i => i.id === it.itemId)
        const name = it.customItemName || item?.name || 'N/A'

        itemNames.push(`${name} (x${it.quantity})`)
        if (it.notes && it.notes.trim()) {
          itemNotesList.push(it.notes.trim())
        }
      })

      return {
        categoryName: 'Multi-Item',
        itemName: itemNames.join(', '),
        itemNotes: itemNotesList.join(' | '),
        totalQuantity: totalQty,
        isMulti: true
      }
    }

    const first = items[0]
    const category = products.categories.find(cat => cat.id === first.categoryId)
    const item = category?.items.find(i => i.id === first.itemId)

    return {
      categoryName: category?.name || 'N/A',
      itemName: first.customItemName || item?.name || 'N/A',
      itemNotes: first.notes || '',
      totalQuantity: totalQty,
      isMulti: false
    }
  }

  // Handle order selection
  const handleOrderSelect = (orderId, e) => {
    // Prevent selection if select mode is not active
    if (!isSelectModeActive) return

    // Prevent event bubbling if clicking on interactive elements
    if (e && (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.closest('button') || e.target.closest('select'))) {
      return
    }

    const newSelected = new Set(selectedOrders) // manual selections only (in status mode: selections outside filter)
    const newManuallyDeselected = new Set(manuallyDeselectedOrders) // manual deselections of filter-matching orders

    // In status mode, check if order matches status filters
    if (selectMode === 'status') {
      const order = filteredOrders.find(o => o.id === orderId)
      if (order) {
        const matchesOrderStatus = orderStatusSelectFilter === 'all' || order.status === orderStatusSelectFilter
        const matchesPaymentStatus = paymentStatusSelectFilter === 'all' || order.paymentStatus === paymentStatusSelectFilter
        const matchesStatus = matchesOrderStatus && matchesPaymentStatus

        if (matchesStatus) {
          // This order is auto-selected by the current filters.
          // Clicking toggles manual deselection only (does NOT persist as selected across filter changes).
          if (newManuallyDeselected.has(orderId)) {
            newManuallyDeselected.delete(orderId)
          } else {
            newManuallyDeselected.add(orderId)
          }
          // Ensure it's not in manual-selected set
          newSelected.delete(orderId)
        } else {
          // This order is NOT selected by filters.
          // Clicking toggles manual selection (extra include).
          if (newSelected.has(orderId)) {
            newSelected.delete(orderId)
          } else {
            newSelected.add(orderId)
          }
          // Not relevant for manual-deselected set
          newManuallyDeselected.delete(orderId)
        }
      }
    } else {
      // Manual mode: simple toggle
      if (newSelected.has(orderId)) {
        newSelected.delete(orderId)
      } else {
        newSelected.add(orderId)
      }
    }

    setSelectedOrders(newSelected)
    setManuallyDeselectedOrders(newManuallyDeselected)
  }

  // Handle select all
  const handleSelectAll = () => {
    if (!isSelectModeActive) return

    const allSelected = getAllSelectedOrders()
    const allSelectedIds = new Set(allSelected.map(o => o.id))

    if (allSelectedIds.size === filteredOrders.length) {
      // Deselect all
      setSelectedOrders(new Set())
    } else {
      // Select all filtered orders
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)))
    }
  }

  // Toggle select mode
  const handleToggleSelectMode = () => {
    const newState = !isSelectModeActive
    setIsSelectModeActive(newState)
    if (!newState) {
      // Clear selection when turning off select mode
      setSelectedOrders(new Set())
      setManuallyDeselectedOrders(new Set())
    }
  }

  // Get orders that match status filters (excluding manually deselected)
  const getStatusMatchingOrders = () => {
    return filteredOrders.filter(order => {
      if (manuallyDeselectedOrders.has(order.id)) return false
      const matchesOrderStatus = orderStatusSelectFilter === 'all' || order.status === orderStatusSelectFilter
      const matchesPaymentStatus = paymentStatusSelectFilter === 'all' || order.paymentStatus === paymentStatusSelectFilter
      return matchesOrderStatus && matchesPaymentStatus
    })
  }

  // Get all selected orders (status-based + manual overrides)
  const getAllSelectedOrders = () => {
    if (selectMode === 'status') {
      // In status mode: orders matching filters OR manually selected
      const statusMatching = getStatusMatchingOrders()
      const statusMatchingIds = new Set(statusMatching.map(o => o.id))

      // Combine: status matching orders + manual extra selections
      const allSelected = new Set(statusMatchingIds)
      selectedOrders.forEach(id => allSelected.add(id))

      return filteredOrders.filter(order => allSelected.has(order.id))
    } else {
      // Manual mode: only manually selected
      return filteredOrders.filter(order => selectedOrders.has(order.id))
    }
  }

  // Get orders to export based on mode
  const getOrdersToExport = () => {
    return getAllSelectedOrders()
  }

  // Get orders selected by status filter (for display count)
  const getStatusSelectedOrders = () => {
    return getAllSelectedOrders()
  }

  // Handle bulk order status change for selected orders
  const handleBulkOrderStatusChange = async (newStatus) => {
    const ordersToUpdate = getAllSelectedOrders()

    if (ordersToUpdate.length === 0) {
      addToast('No orders selected. Please select orders first.', 'warning')
      return
    }

    // Special handling for Dispatched status when Curfox is enabled
    if (newStatus === 'Dispatched' && settings.curfox?.enabled) {
      const isCurfoxConnected = settings.curfox.email && settings.curfox.password && settings.curfox.tenant;
      const packedWithWaybill = ordersToUpdate.filter(o => o.status === 'Packed' && o.trackingNumber)

      showConfirm(
        'Bulk Dispatch Orders',
        `How would you like to handle dispatch for these ${ordersToUpdate.length} orders?`,
        () => handleBulkCurfoxDispatch(), // Confirm = Sync with Curfox
        'default',
        'Sync with Curfox',
        {
          cancelText: 'Cancel',
          extraButtonText: 'Mark All as Locally Dispatched',
          onExtraButtonClick: async () => {
            const today = new Date().toISOString().split('T')[0]
            const orderIdsToUpdate = new Set(ordersToUpdate.map(o => o.id))
            const updatedOrders = orders.map(order => {
              if (orderIdsToUpdate.has(order.id)) {
                return { ...order, status: 'Dispatched', dispatchDate: today }
              }
              return order
            })
            await saveOrders(updatedOrders)
            onUpdateOrders(updatedOrders)
            setSelectedOrders(new Set())
            addToast(`Marked ${ordersToUpdate.length} orders as Dispatched locally`, 'success')
          },
          confirmDisabled: !isCurfoxConnected || packedWithWaybill.length === 0
        }
      )
      return
    }

    showConfirm('Confirm Status Change', `Are you sure you want to change order status to "${newStatus}" for ${ordersToUpdate.length} order(s)?`, async () => {
      try {
        const orderIdsToUpdate = new Set(ordersToUpdate.map(o => o.id))
        const today = new Date().toISOString()

        const updatedOrders = orders.map(order => {
          if (orderIdsToUpdate.has(order.id)) {
            const updates = { status: newStatus }
            // Auto-generate dispatch date if setting status to Dispatched
            if (newStatus === 'Dispatched') {
              updates.dispatchDate = today
            }
            // Auto-generate delivered date if setting status to Delivered
            if (newStatus === 'Delivered') {
              updates.deliveredDate = today
            }
            return { ...order, ...updates }
          }
          return order
        })

        const saveSuccess = await saveOrders(updatedOrders)
        if (saveSuccess) {
          onUpdateOrders(updatedOrders)
          setSelectedOrders(new Set()) // Clear selection after update
          addToast(`Successfully updated ${ordersToUpdate.length} order(s) status to "${newStatus}"`, 'success')
        } else {
          addToast('Failed to update orders. Please try again.', 'error')
        }
      } catch (error) {
        console.error('Error updating orders:', error)
        addToast('Error updating orders: ' + error.message, 'error')
      }
    }, 'warning', 'Update Status')
  }

  // Handle bulk payment status change for selected orders
  const handleBulkPaymentStatusChange = async (newPaymentStatus) => {
    const ordersToUpdate = getAllSelectedOrders()

    if (ordersToUpdate.length === 0) {
      addToast('No orders selected. Please select orders first.', 'warning')
      return
    }

    showConfirm('Confirm Payment Status Change', `Are you sure you want to change payment status to "${newPaymentStatus}" for ${ordersToUpdate.length} order(s)?`, async () => {
      try {
        const orderIdsToUpdate = new Set(ordersToUpdate.map(o => o.id))
        const updatedOrders = orders.map(order => {
          if (orderIdsToUpdate.has(order.id)) {
            return { ...order, paymentStatus: newPaymentStatus }
          }
          return order
        })

        const saveSuccess = await saveOrders(updatedOrders)
        if (saveSuccess) {
          onUpdateOrders(updatedOrders)
          setSelectedOrders(new Set()) // Clear selection after update
          addToast(`Successfully updated ${ordersToUpdate.length} order(s) payment status to "${newPaymentStatus}"`, 'success')
        } else {
          addToast('Failed to update orders. Please try again.', 'error')
        }
      } catch (error) {
        console.error('Error updating orders:', error)
        addToast('Error updating orders: ' + error.message, 'error')
      }
    }, 'warning', 'Update Status')
  }

  // Export orders to XLSX
  const handleExport = () => {
    const ordersToExport = getOrdersToExport()

    if (ordersToExport.length === 0) {
      addToast('No orders selected. Please select orders first.', 'warning')
      return
    }

    // Map orders to XLSX format
    const exportData = ordersToExport.map(order => {
      const { categoryName, itemName } = getCategoryItemNames(order)

      // Build description: Category - Item (or just Item if no category, or just Category if no item)
      let description = ''
      if (categoryName && categoryName !== 'N/A' && itemName && itemName !== 'N/A') {
        description = `${categoryName} - ${itemName}`
      } else if (itemName && itemName !== 'N/A') {
        description = itemName
      } else if (categoryName && categoryName !== 'N/A') {
        description = categoryName
      }

      return {
        waybill_number: order.trackingNumber || '',
        order_no: order.id || '',
        customer_name: order.customerName || '',
        customer_phone: order.phone || order.whatsapp || '',
        customer_secondary_phone: order.whatsapp || '',
        customer_address: order.address || '',
        customer_email: '', // Always blank
        cod: order.codAmount || 0,
        destination_city: order.nearestCity || order.district || '',
        weight: 1, // Always 1
        description: description,
        remark: '' // Always blank
      }
    })

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Orders')

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `orders_export_${timestamp}.xlsx`

    // Write file
    XLSX.writeFile(wb, filename)

    // Clear selection after export
    setSelectedOrders(new Set())
    addToast(`Exported ${ordersToExport.length} order(s) to ${filename}`, 'success')

  }

  const handleWhatsApp = (order) => {
    const phone = order.whatsapp || order.phone
    if (!phone) {
      addToast('No WhatsApp number available for this order', 'warning')
      return
    }

    // Format the number for WhatsApp
    const formattedNumber = formatWhatsAppNumber(phone)
    if (!formattedNumber) {
      addToast('Invalid phone number format', 'warning')
      return
    }

    // Build item details string for template
    const orderItems = Array.isArray(order.orderItems) && order.orderItems.length > 0
      ? order.orderItems
      : [{
        categoryId: order.categoryId || null,
        itemId: order.itemId || null,
        customItemName: order.customItemName || '',
        quantity: Number(order.quantity) || 1,
        unitPrice: Number(order.unitPrice) || 0,
        notes: ''
      }]

    // Calculate subtotal from items
    const subtotal = orderItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)

    // Get financial details
    const discount = Number(order.discount || order.discountValue || 0)
    const discountType = order.discountType || 'Rs'
    const deliveryCharge = Number(order.deliveryCharge ?? 400) || 0

    let discountAmount = 0
    if (discountType === '%') {
      discountAmount = (subtotal * discount) / 100
    } else {
      discountAmount = discount
    }

    const finalPrice = Math.max(0, subtotal - discountAmount)
    const codAmount = order.codAmount || (finalPrice + deliveryCharge)

    const itemDetailsString = orderItems.map(it => {
      const c = products.categories.find(cat => cat.id === it.categoryId)
      const catName = c?.name || 'N/A'
      const itName = it.name || it.itemName || it.customItemName || c?.items?.find(x => x.id === it.itemId)?.name || 'N/A'
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      return `🔸ITEM: ${catName} - ${itName}\n🔸 QTY: ${qty}\n🔸PRICE: Rs. ${price.toFixed(2)}`
    }).join('\n\n')

    // Get category and item names
    const { categoryName, itemName, totalQuantity } = getCategoryItemNames(order)
    const template = settings?.whatsappTemplates?.quickAction || ''

    const message = generateWhatsAppMessage(template, order, {
      itemDetailsString,
      subtotal,
      discountAmount,
      finalPrice,
      deliveryCharge,
      codAmount,
      totalQuantity,
      totalItems: orderItems.length
    })

    if (!message) {
      addToast('Message is empty', 'error')
      return
    }

    const encodedMessage = encodeURIComponent(message)

    // Remove + from the number for wa.me URL
    const numberForUrl = formattedNumber.replace('+', '')
    window.open(`https://wa.me/${numberForUrl}?text=${encodedMessage}`, '_blank')
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Dispatched': return 'var(--success)'
      case 'New Order': return 'var(--accent-primary)'
      case 'Packed': return 'var(--warning)'
      case 'returned':
      case 'refund':
      case 'cancelled': return 'var(--danger)'
      default: return 'var(--bg-secondary)'
    }
  }

  const getPaymentColor = (status) => {
    switch (status) {
      case 'Paid': return 'var(--success)'
      case 'Pending': return 'var(--danger)'
      default: return 'var(--bg-secondary)'
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Order Management</h1>
          <p>Manage all customer orders</p>
        </div>
        <div className="page-header-actions">
          <button
            className={`btn ${isSelectModeActive ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleToggleSelectMode}
          >
            {isSelectModeActive ? 'Exit Select Mode' : 'Select'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingOrder(null)
              setShowForm(true)
            }}
          >
            <Plus size={18} />
            Add New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1rem'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} />
          <input
            type="text"
            placeholder="Search by order #, customer, phone, or tracking..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.5rem'
            }}
          />
        </div>
        <CustomDropdown
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 'auto', minWidth: '150px' }}
        />
        <CustomDropdown
          options={PAYMENT_OPTIONS}
          value={paymentFilter}
          onChange={setPaymentFilter}
          style={{ width: 'auto', minWidth: '150px' }}
        />
        <CustomDropdown
          options={SORT_OPTIONS}
          value={sortField}
          onChange={setSortField}
          style={{ width: 'auto', minWidth: '180px' }}
          placeholder="Sort by..."
        />
        <button
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '40px',
            padding: '0.5rem',
            cursor: 'pointer'
          }}
          title={sortDirection === 'asc' ? 'Ascending (Click to change to Descending)' : 'Descending (Click to change to Ascending)'}
        >
          {sortDirection === 'asc' ? (
            <ChevronUp size={20} />
          ) : (
            <ChevronDown size={20} />
          )}
        </button>


        {/* Date Filter Button with Dropdown */}
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

        {(searchTerm !== '' || statusFilter !== 'all' || paymentFilter !== 'all' || scheduledDeliveriesOnly || sortField !== 'status' || sortDirection !== 'asc' || filterType !== 'month' || selectedMonth !== format(new Date(), 'yyyy-MM')) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setStatusFilter('all')
              setPaymentFilter('all')
              setScheduledDeliveriesOnly(false)
              setSortField('status')
              setSortDirection('asc')
              setFilterType('month')
              setSelectedMonth(format(new Date(), 'yyyy-MM'))
              setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
              setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            title="Clear all filters"
          >
            <X size={16} /> Clear Filters
          </button>
        )}
      </div>

      {/* Select Mode Selection */}
      {isSelectModeActive && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)'
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Selection Mode Active:
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="selectMode"
              value="manual"
              checked={selectMode === 'manual'}
              onChange={(e) => {
                setSelectMode(e.target.value)
                setSelectedOrders(new Set())
              }}
            />
            <span style={{ fontSize: '0.875rem' }}>Manual</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="selectMode"
              value="status"
              checked={selectMode === 'status'}
              onChange={(e) => {
                setSelectMode(e.target.value)
                if (e.target.value === 'status') {
                  // In status mode: selection is derived from filters; clear manual overrides
                  setSelectedOrders(new Set())
                  setManuallyDeselectedOrders(new Set())
                }
              }}
            />
            <span style={{ fontSize: '0.875rem' }}>By Status:</span>
          </label>
          {selectMode === 'status' && (
            <>
              <CustomDropdown
                options={STATUS_OPTIONS.filter(o => o.value !== 'pendingDispatch')}
                value={orderStatusSelectFilter}
                onChange={(val) => {
                  setOrderStatusSelectFilter(val)
                  setSelectedOrders(new Set())
                  setManuallyDeselectedOrders(new Set())
                }}
                style={{ width: 'auto', minWidth: '150px' }}
              />
              <CustomDropdown
                options={PAYMENT_OPTIONS}
                value={paymentStatusSelectFilter}
                onChange={(val) => {
                  setPaymentStatusSelectFilter(val)
                  setSelectedOrders(new Set())
                  setManuallyDeselectedOrders(new Set())
                }}
                style={{ width: 'auto', minWidth: '150px' }}
              />
            </>
          )}
          {isSelectModeActive && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {getAllSelectedOrders().length} order(s) selected
            </span>
          )}
          {(selectedOrders.size > 0 || (selectMode === 'status' && getStatusSelectedOrders().length > 0)) && (
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              <button
                className="btn btn-secondary"
                onClick={handleExport}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Download size={18} />
                Export to XLSX
              </button>
              <CustomDropdown
                options={BULK_STATUS_OPTIONS}
                value=""
                onChange={handleBulkOrderStatusChange}
                style={{ width: 'auto', minWidth: '150px' }}
                placeholder="Change Order Status..."
              />
              <CustomDropdown
                options={[
                  { value: 'Pending', label: 'Pending' },
                  { value: 'Paid', label: 'Paid' },
                  ...(settings?.curfox?.enabled ? [{ value: 'curfox_dispatch', label: 'Dispatch (Curfox)' }] : [])
                ]}
                value=""
                onChange={(val) => {
                  val === 'curfox_dispatch'
                    ? handleBulkCurfoxDispatch()
                    : handleBulkPaymentStatusChange(val)
                }}
                style={{ width: 'auto', minWidth: '150px' }}
                placeholder="Change Payment Status..."
              />
            </div>
          )}
        </div>
      )}

      {/* Selection Helper Text */}
      {isSelectModeActive && selectMode === 'manual' && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          color: 'var(--text-muted)'
        }}>
          {selectMode === 'status' ? (
            <>Orders matching the selected status filters are auto-selected. You can manually select or deselect any order. {getAllSelectedOrders().length} order(s) selected.</>
          ) : (
            <>Click on rows to select. {selectedOrders.size} order(s) selected.</>
          )}
        </div>
      )}

      {/* Orders Table (Desktop) */}
      <div className="card desktop-view" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No orders found. Create your first order to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {isSelectModeActive && (
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={getAllSelectedOrders().length === filteredOrders.length && filteredOrders.length > 0}
                        onChange={handleSelectAll}
                        title="Select All"
                      />
                    </th>
                  )}
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Category</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Total Price</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Tracking</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => {
                  // Check if order is selected (status match OR manually selected)
                  const matchesStatus = selectMode === 'status' && !manuallyDeselectedOrders.has(order.id) && (
                    (orderStatusSelectFilter === 'all' || order.status === orderStatusSelectFilter) &&
                    (paymentStatusSelectFilter === 'all' || order.paymentStatus === paymentStatusSelectFilter)
                  )
                  const isManuallySelected = selectedOrders.has(order.id)
                  const isSelected = isSelectModeActive && (matchesStatus || isManuallySelected)

                  return (
                    <tr
                      key={order.id}
                      onClick={(e) => handleOrderSelect(order.id, e)}
                      style={{
                        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        transition: 'background-color 0.2s ease',
                        cursor: isSelectModeActive ? 'pointer' : 'default'
                      }}
                    >
                      {isSelectModeActive && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleOrderSelect(order.id)}
                          />
                        </td>
                      )}
                      <td>
                        <div>
                          <div style={{
                            fontWeight: 600,
                            color: 'var(--accent-primary)',
                            fontSize: '0.875rem'
                          }}>
                            #{order.id}
                            {order.scheduledDeliveryDate && !['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(order.status) && (
                              (() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const deliveryDate = new Date(order.scheduledDeliveryDate);
                                const isOverdue = deliveryDate < today && !['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(order.status);

                                return (
                                  <Calendar
                                    size={14}
                                    style={{
                                      marginLeft: '0.4rem',
                                      color: isOverdue ? 'var(--danger)' : '#ebb434',
                                      display: 'inline'
                                    }}
                                    title={isOverdue ? `Overdue: Scheduled for ${order.scheduledDeliveryDate}` : `Scheduled for ${order.scheduledDeliveryDate}`}
                                  />
                                );
                              })()
                            )}
                            {Array.isArray(order.orderItems) && order.orderItems.some(it => it.image) && (
                              <Paperclip
                                size={14}
                                style={{ marginLeft: '0.4rem', color: 'var(--text-muted)', display: 'inline' }}
                              />
                            )}
                            {order.courierInvoiceNo && (
                              <span
                                title={`Invoiced: ${order.courierInvoiceNo} (${order.courierFinanceStatus})`}
                                style={{
                                  marginLeft: '0.4rem',
                                  color: order.courierFinanceStatus === 'Deposited' ? 'var(--success)' : 'var(--accent-secondary)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  padding: '1px 4px',
                                  borderRadius: '4px'
                                }}
                              >
                                INV
                              </span>
                            )}
                          </div>
                          {(order.createdDate || order.orderDate) && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              {order.createdDate || order.orderDate}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {order.customerName}
                            {getCustomerOrderCount(order) > 1 && (
                              <span
                                title={`${getCustomerOrderCount(order)} orders placed`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  padding: '0.1rem 0.4rem',
                                  backgroundColor: 'var(--accent-primary)',
                                  color: '#fff',
                                  borderRadius: '12px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Star size={10} fill="currentColor" /> {getCustomerOrderCount(order)}
                              </span>
                            )}
                          </div>

                          {order.whatsapp && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--whatsapp-brand)', marginTop: '0.25rem' }}>
                              {formatWhatsAppNumber(order.whatsapp)}
                            </div>
                          )}
                          {order.phone && !order.whatsapp && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {order.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      {(() => {
                        const names = getCategoryItemNames(order)
                        return (
                          <>
                            <td>{names.categoryName}</td>
                            <td style={{ maxWidth: '250px' }}>
                              <div style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.85rem'
                              }} title={names.itemName}>
                                {names.itemName}
                              </div>
                              {names.itemNotes && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                  marginTop: '2px',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  lineHeight: '1.2'
                                }} title={names.itemNotes}>
                                  {names.itemNotes}
                                </div>
                              )}
                            </td>
                            <td>{names.totalQuantity}</td>
                          </>
                        )
                      })()}
                      <td>Rs.{order.totalPrice?.toLocaleString('en-IN') || 0}</td>
                      <td>
                        {editingStatus?.orderId === order.id && editingStatus?.field === 'status' ? (
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, 'status', e.target.value)}
                            onBlur={() => setEditingStatus(null)}
                            autoFocus
                            className="form-input"
                          >
                            <option value="New Order">New Order</option>
                            <option value="Packed">Packed</option>
                            <option value="Dispatched">Dispatched</option>
                            <option value="Delivered">Delivered</option>
                            <option value="returned">Returned</option>
                            <option value="refund">Refund</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <div>
                            <span
                              onClick={(e) => handleStatusClick(order.id, 'status', e)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius)',
                                fontSize: '0.75rem',
                                backgroundColor: getStatusColor(order.status),
                                color: 'white',
                                cursor: 'pointer',
                                display: 'inline-block',
                                transition: 'opacity 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              title="Click to edit status"
                            >
                              {order.status}
                            </span>
                            {order.status?.toLowerCase() === 'dispatched' && order.dispatchDate ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {order.dispatchDate.includes('T') ? order.dispatchDate.split('T')[0] : order.dispatchDate}
                              </div>
                            ) : null}
                            {order.status === 'Delivered' && order.deliveredDate ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {order.deliveredDate.includes('T') ? order.deliveredDate.split('T')[0] : order.deliveredDate}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td>
                        {editingStatus?.orderId === order.id && editingStatus?.field === 'paymentStatus' ? (
                          <select
                            value={order.paymentStatus}
                            onChange={(e) => handleStatusChange(order.id, 'paymentStatus', e.target.value)}
                            onBlur={() => setEditingStatus(null)}
                            autoFocus
                            className="form-input"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Paid">Paid</option>
                          </select>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                            <span
                              onClick={(e) => handleStatusClick(order.id, 'paymentStatus', e)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius)',
                                fontSize: '0.75rem',
                                backgroundColor: getPaymentColor(order.paymentStatus),
                                color: 'white',
                                cursor: 'pointer',
                                display: 'inline-block',
                                transition: 'opacity 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                              title="Click to edit payment status"
                            >
                              {order.paymentStatus}
                            </span>
                            {order.paymentMethod && (
                              <span style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-muted)',
                                fontWeight: 500,
                                padding: '0px 4px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px'
                              }}>
                                {order.paymentMethod === 'Bank Deposit' ? 'Bank' : 'COD'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        {order.trackingNumber ? (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            alignItems: 'flex-start'
                          }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                              {order.trackingNumber}
                            </span>
                            {settings?.curfox?.enabled && order.status === 'Dispatched' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setTrackingStatusOrder(order)
                                  setShowTrackingStatusModal(true)
                                }}
                                className="btn-link"
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  height: 'auto',
                                  backgroundColor: 'var(--accent-primary)',
                                  color: 'white',
                                  borderRadius: '4px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                Track Order
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleView(order)}
                            title="View Order"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-whatsapp"
                            onClick={() => handleWhatsApp(order)}
                            title="Send WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(order)}
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteOrder(order.id)}
                            title="Delete"
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
        )}
      </div>

      {/* Orders List (Mobile) */}
      <div className="mobile-view" style={{ display: 'none', flexDirection: 'column', gap: '1rem' }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No orders found.</p>
          </div>
        ) : (
          paginatedOrders.map(order => {
            // Helper logic for mobile view
            const { categoryName, itemName, totalQuantity, itemNotes } = getCategoryItemNames(order)
            const statusColor = getStatusColor(order.status)
            const paymentColor = getPaymentColor(order.paymentStatus)
            const totalPrice = order.totalPrice || order.totalAmount || 0

            const matchesStatus = selectMode === 'status' && !manuallyDeselectedOrders.has(order.id) && (
              (orderStatusSelectFilter === 'all' || order.status === orderStatusSelectFilter) &&
              (paymentStatusSelectFilter === 'all' || order.paymentStatus === paymentStatusSelectFilter)
            )
            const isManuallySelected = selectedOrders.has(order.id)
            const isSelected = isSelectModeActive && (matchesStatus || isManuallySelected)

            return (
              <div
                key={order.id}
                className="card"
                style={{
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  backgroundColor: 'var(--bg-card)',
                  position: 'relative'
                }}
                onClick={(e) => handleOrderSelect(order.id, e)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isSelectModeActive && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleOrderSelect(order.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '1.25rem', height: '1.25rem' }}
                      />
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '1.1rem' }}>#{order.id}</span>
                        {order.scheduledDeliveryDate && !['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(order.status) && (
                          (() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const deliveryDate = new Date(order.scheduledDeliveryDate);
                            const isOverdue = deliveryDate < today && !['Dispatched', 'Delivered', 'returned', 'refund', 'cancelled'].includes(order.status);

                            return (
                              <Calendar
                                size={16}
                                style={{
                                  color: isOverdue ? 'var(--danger)' : '#ebb434',
                                }}
                              />
                            );
                          })()
                        )}
                        {getCustomerOrderCount(order) > 1 && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              padding: '0.1rem 0.4rem',
                              backgroundColor: 'var(--accent-primary)',
                              color: '#fff',
                              borderRadius: '12px',
                              fontSize: '0.65rem',
                              fontWeight: 700
                            }}
                          >
                            <Star size={10} fill="currentColor" /> {getCustomerOrderCount(order)}
                          </span>
                        )}
                        {Array.isArray(order.orderItems) && order.orderItems.some(it => it.image) && (
                          <Paperclip size={14} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {order.createdDate || order.orderDate}
                      </div>
                      {order.trackingNumber && (
                        <div style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          marginTop: '0.5rem',
                          fontFamily: 'monospace',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px' }}>
                            {order.trackingNumber}
                          </span>
                          {settings?.curfox?.enabled && order.status === 'Dispatched' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setTrackingStatusOrder(order)
                                setShowTrackingStatusModal(true)
                              }}
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '4px 10px',
                                backgroundColor: 'var(--accent-primary)',
                                color: 'white',
                                borderRadius: '6px',
                                border: 'none',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                            >
                              Track Order
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Order Status */}
                    {editingStatus?.orderId === order.id && editingStatus?.field === 'status' ? (
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, 'status', e.target.value)}
                        onBlur={() => setEditingStatus(null)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="form-input"
                      >
                        <option value="New Order">New Order</option>
                        <option value="Packed">Packed</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="returned">Returned</option>
                        <option value="refund">Refund</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span
                          className="badge"
                          onClick={(e) => { e.stopPropagation(); handleStatusClick(order.id, 'status', e); }}
                          style={{
                            backgroundColor: getStatusColor(order.status),
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          {order.status}
                        </span>
                        {order.status?.toLowerCase() === 'dispatched' && order.dispatchDate && (
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                            {order.dispatchDate.includes('T') ? order.dispatchDate.split('T')[0] : order.dispatchDate}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Status */}
                    {editingStatus?.orderId === order.id && editingStatus?.field === 'paymentStatus' ? (
                      <select
                        value={order.paymentStatus}
                        onChange={(e) => handleStatusChange(order.id, 'paymentStatus', e.target.value)}
                        onBlur={() => setEditingStatus(null)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="form-input"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          className="badge"
                          onClick={(e) => { e.stopPropagation(); handleStatusClick(order.id, 'paymentStatus', e); }}
                          style={{
                            backgroundColor: getPaymentColor(order.paymentStatus),
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          {order.paymentStatus}
                        </span>
                        {order.paymentMethod && (
                          <span style={{
                            fontSize: '0.6rem',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            {order.paymentMethod === 'Bank Deposit' ? 'Bank' : 'COD'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                  {/* Customer Info */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{order.customerName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{order.phone || order.whatsapp}</div>
                  </div>

                  {/* Item Info */}
                  <div style={{ wordBreak: 'break-word', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {categoryName} - {itemName} (x{totalQuantity})
                    {itemNotes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                        {itemNotes}
                      </div>
                    )}
                  </div>

                  {/* Pricing Info */}
                  <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '1.05rem' }}>
                    Rs. {totalPrice.toLocaleString()}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '0.5rem' }}>
                  <div className="action-buttons" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleWhatsApp(order); }} className="btn-icon btn-icon-ghost whatsapp"><MessageCircle size={22} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleView(order); }} className="btn-icon btn-icon-ghost primary"><Eye size={22} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(order); }} className="btn-icon btn-icon-ghost muted"><Edit size={22} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }} className="btn-icon btn-icon-ghost danger"><Trash2 size={22} /></button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination Controls */}
      {
        filteredOrders.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredOrders.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={filteredOrders.length}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )
      }


      <style>{`
        @media (max-width: 768px) {
          .desktop-view {
            display: none !important;
          }
          .mobile-view {
            display: flex !important;
          }
          /* Adjust modal padding for mobile */
          .modal-content {
             padding: 1rem !important;
             max-width: 95vw !important;
          }
        }
        
        @media (max-width: 400px) {
          .mobile-view .card {
            padding: 0.75rem !important;
          }
          .action-buttons button {
            padding: 0.4rem !important;
          }
        }
        
        @media (min-width: 769px) {
          .desktop-view {
            display: block !important;
          }
          .mobile-view {
            display: none !important;
          }
        }
      `}</style>

      {
        showForm && (
          <OrderForm
            order={editingOrder}
            onClose={() => {
              setShowForm(false)
              setEditingOrder(null)
            }}
            onSave={handleSaveOrder}
            checkIsBlacklisted={(number) => {
              if (!number) return 0
              const cleanNumber = (number || '').replace(/\D/g, '')
              if (cleanNumber.length < 5) return 0

              return orders.filter(o => {
                const last9 = cleanNumber.slice(-9)
                const oPhone = (o.phone || '').replace(/\D/g, '')
                const oWhatsapp = (o.whatsapp || '').replace(/\D/g, '')
                const match = oPhone.endsWith(last9) || oWhatsapp.endsWith(last9)
                return match && o.status === 'returned'
              }).length
            }}
            onBlacklistWarning={(number, count) => {
              showConfirm(
                '⚠️ High Return Risk',
                `This client has ${count} previously returned order(s). Do you want to check them?`,
                () => {
                  // On Confirm: Close form and view returned orders
                  setShowForm(false)
                  setEditingOrder(null)
                  const cleanNumber = (number || '').replace(/\D/g, '')
                  const searchKey = cleanNumber.length >= 9 ? cleanNumber.slice(-9) : cleanNumber
                  setSearchTerm(searchKey)
                  setStatusFilter('returned')
                  addToast(`Filtering returned orders for ${number}`, 'info')
                },
                'warning', // Type
                'View Returned Orders' // Confirm Button Text
              )
            }}
          />
        )
      }

      {
        showDispatchModal && editingOrder && (
          <DispatchModal
            order={editingOrder}
            onClose={() => {
              setShowDispatchModal(false)
              setEditingOrder(null)
            }}
            onSave={handleSaveOrder}
          />
        )
      }

      {
        showViewModal && viewingOrder && (
          <ViewOrderModal
            order={viewingOrder}
            customerOrderCount={getCustomerOrderCount(viewingOrder)}
            onClose={() => {
              setShowViewModal(false)
              setViewingOrder(null)
            }}
            onSave={handleSaveOrder}
            onRequestTrackingNumber={(orderForTracking, targetStatus = 'Packed') => {
              openTrackingModalForOrder(orderForTracking, targetStatus)
            }}
            onRequestDispatch={(orderForDispatch) => {
              setEditingOrder(orderForDispatch)
              setShowDispatchModal(true)
            }}
          />
        )
      }

      {
        showTrackingModal && trackingOrder && (
          <TrackingNumberModal
            order={trackingOrder}
            targetStatus={trackingTargetStatus}
            onClose={() => {
              setShowTrackingModal(false)
              setTrackingOrder(null)
              setTrackingTargetStatus('Packed')
            }}
            onSave={handleSaveOrder}
          />
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
        cancelText={modalConfig.cancelText}
        extraButtonText={modalConfig.extraButtonText}
        onExtraButtonClick={modalConfig.onExtraButtonClick}
        extraButtonDisabled={modalConfig.extraButtonDisabled}
        confirmDisabled={modalConfig.confirmDisabled}
      />


      {/* Waybill Entry Modal */}
      {
        showWaybillModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h2 className="modal-title">Enter Waybill ID</h2>
                <button className="modal-close" onClick={() => setShowWaybillModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault()
                const trackingNumber = e.target.trackingNumber.value
                if (trackingNumber && waybillTargetOrder) {
                  const updated = { ...waybillTargetOrder, status: 'Packed', trackingNumber }
                  const updatedOrders = orders.map(o => o.id === updated.id ? updated : o)
                  await saveOrders(updatedOrders)
                  onUpdateOrders(updatedOrders)
                  setShowWaybillModal(false)
                  setWaybillTargetOrder(null)
                  addToast('Order Packed & Waybill Saved', 'success')
                }
              }}>
                <div className="form-group">
                  <label className="form-label">Waybill / Sticker ID *</label>
                  <input
                    name="trackingNumber"
                    className="form-input"
                    required
                    autoFocus
                    placeholder="Scan or type Waybill ID..."
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Scan the barcode on the physical sticker.</small>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary">Save & Pack</button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Dispatch Progress Overlay */}
      {
        isDispatching && (dispatchProgress.total > 0) && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
              <Loader size={32} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
              <h3>Dispatching to Curfox...</h3>
              <p>{dispatchProgress.current} / {dispatchProgress.total}</p>
            </div>
          </div>
        )
      }
      {/* Curfox Tracking Modal */}
      {
        showTrackingStatusModal && trackingStatusOrder && (
          <CurfoxTrackingModal
            order={trackingStatusOrder}
            onSave={handleSaveOrder}
            onClose={() => {
              setShowTrackingStatusModal(false)
              setTrackingStatusOrder(null)
            }}
          />
        )
      }
    </div >
  )
}

export default OrderManagement

