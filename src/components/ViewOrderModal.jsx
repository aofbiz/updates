import { useState, useEffect } from 'react'
import { X, Download, MessageCircle, Star, Crown, Truck, RefreshCw, MapPin, CheckCircle } from 'lucide-react'
import CustomDropdown from './Common/CustomDropdown'
import { getProducts, getSettings } from '../utils/storage'
import { formatWhatsAppNumber, generateWhatsAppMessage } from '../utils/whatsapp'
import { getPrintStyles } from './PrintStyles'

import TrackingNumberModal from './TrackingNumberModal'
import DispatchModal from './DispatchModal'
import ConfirmationModal from './ConfirmationModal'
import { curfoxService } from '../utils/curfox'
import { useToast } from './Toast/ToastContext'
import { useLicensing } from './LicensingContext'

const ViewOrderModal = ({ order, customerOrderCount = 1, onClose, onSave, onRequestTrackingNumber, onRequestDispatch }) => {
  const { addToast } = useToast()
  const { isFreeUser } = useLicensing()
  const [products, setProducts] = useState({ categories: [] })
  const [localOrder, setLocalOrder] = useState(order)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState('Packed')
  const [settings, setSettings] = useState(null)


  const [trackingHistory, setTrackingHistory] = useState([])
  const [loadingTracking, setLoadingTracking] = useState(false)
  const [financeData, setFinanceData] = useState(null)
  const [financeLoading, setFinanceLoading] = useState(false)

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

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }))
  }

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

  // Handle Esc key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Update local order when prop changes

  useEffect(() => {
    if (order) {
      setLocalOrder(order)
      setTrackingHistory([]) // Reset on new order
    }
  }, [order])

  // Load Tracking & Finance Data
  useEffect(() => {
    const fetchTrackingAndFinance = async () => {
      if (localOrder?.trackingNumber && settings?.curfox?.enabled) {
        setLoadingTracking(true)
        setFinanceLoading(true)
        try {
          const authData = {
            tenant: settings.curfox.tenant,
            token: (await curfoxService.login(settings.curfox.email, settings.curfox.password, settings.curfox.tenant))?.token
          }
          if (!authData.token) throw new Error("Could not authenticate with Curfox")

          let hasChanges = false
          let updatedOrder = { ...localOrder }

          // Fetch tracking
          const history = await curfoxService.getTracking(localOrder.trackingNumber, authData)
          if (Array.isArray(history)) {
            setTrackingHistory(history)
            if (history.length > 0) {
              const latest = history[0]
              const courierStatus = (latest.status?.name || latest.status || '').toUpperCase()
              let mappedStatus = null

              if (courierStatus === 'DELIVERED') mappedStatus = 'Delivered'
              else if (courierStatus === 'CANCELLED' || courierStatus === 'RETURNED') mappedStatus = 'Cancelled'

              if (mappedStatus && mappedStatus !== updatedOrder.status) {
                updatedOrder.status = mappedStatus
                hasChanges = true
              }
            }
          }

          // Fetch finance
          const fData = await curfoxService.getFinanceStatus(localOrder.trackingNumber, authData)
          setFinanceData(fData)
          if (fData) {
            const hasStatusChange = fData.finance_status !== updatedOrder.courierFinanceStatus
            const hasInvoiceChange = fData.invoice_no !== updatedOrder.courierInvoiceNo || fData.invoice_ref_no !== updatedOrder.courierInvoiceRef

            if (hasStatusChange || hasInvoiceChange) {
              updatedOrder = {
                ...updatedOrder,
                courierFinanceStatus: fData.finance_status,
                courierInvoiceNo: fData.invoice_no,
                courierInvoiceRef: fData.invoice_ref_no
              }

              if (fData.finance_status === 'Deposited' || fData.finance_status === 'Approved') {
                updatedOrder.paymentStatus = 'Paid'
              }
              hasChanges = true
            }
          }

          if (hasChanges) {
            setLocalOrder(updatedOrder)
            if (onSave) await onSave(updatedOrder)
            addToast('Order details auto-synced with Courier', 'info')
          }
        } catch (error) {
          console.error("Error fetching tracking/finance:", error)
        } finally {
          setLoadingTracking(false)
          setFinanceLoading(false)
        }
      }
    }
    fetchTrackingAndFinance()
  }, [localOrder?.trackingNumber, settings])



  // Safety check
  if (!localOrder) {
    return null
  }

  // Helper to safely extract name string from potential object values
  const getSafeName = (val) => {
    if (!val) return null
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val.name) return val.name
    return String(val)
  }

  // Helper to safely format dates
  const formatSafeDate = (dateVal) => {
    if (!dateVal) return 'N/A'
    try {
      const d = new Date(dateVal)
      if (isNaN(d.getTime())) return 'N/A'
      return d.toLocaleString()
    } catch {
      return 'N/A'
    }
  }

  // Get category and item names with safety checks
  const category = localOrder.categoryId ? products.categories.find(cat => cat.id === localOrder.categoryId) : null
  const item = category && localOrder.itemId ? category.items.find(item => item.id === localOrder.itemId) : null
  const categoryName = getSafeName(category?.name) || 'N/A'
  const itemName = getSafeName(localOrder.customItemName || item?.name) || 'N/A'

  // Get values - handle both camelCase (from form) and transformed (from DB) formats
  const orderItems = Array.isArray(localOrder.orderItems) && localOrder.orderItems.length > 0
    ? localOrder.orderItems
    : [{
      categoryId: localOrder.categoryId || null,
      itemId: localOrder.itemId || null,
      customItemName: localOrder.customItemName || '',
      quantity: localOrder.quantity || 1,
      unitPrice: localOrder.unitPrice || 0,
      notes: ''
    }]

  const getCategoryName = (categoryId) => {
    const c = products.categories.find(cat => cat.id === categoryId)
    return getSafeName(c?.name) || 'N/A'
  }

  const getItemName = (item) => {
    if (item.name || item.itemName) return getSafeName(item.name || item.itemName)
    if (item.customItemName) return getSafeName(item.customItemName)
    const c = products.categories.find(cat => cat.id === item.categoryId)
    const it = c?.items?.find(x => x.id === item.itemId)
    return getSafeName(it?.name) || 'N/A'
  }

  const subtotal = orderItems.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0
    const price = Number(it.unitPrice) || 0
    return sum + qty * price
  }, 0)

  const deliveryCharge = Number(localOrder.deliveryCharge ?? 400) || 0

  // Keep compatibility if older orders stored only totalPrice/totalAmount
  const totalPrice = (localOrder.totalPrice || localOrder.totalAmount || 0) || subtotal
  const discountType = localOrder.discountType || 'Rs'
  const discount = localOrder.discount || localOrder.discountValue || 0

  // Safe defaults for all order properties
  const safeOrder = {
    id: localOrder.id || 'N/A',
    customerName: localOrder.customerName || localOrder.customer_name || 'N/A',
    address: localOrder.address || localOrder.customer_address || '',
    phone: localOrder.phone || localOrder.customer_phone || '',
    whatsapp: localOrder.whatsapp || localOrder.customer_whatsapp || '',
    nearestCity: localOrder.nearestCity || localOrder.nearest_city || localOrder.destination_city_name || '',
    district: localOrder.district || localOrder.district_name || localOrder.destination_state_name || '',
    status: localOrder.status || 'Pending',
    paymentStatus: localOrder.paymentStatus || localOrder.payment_status || 'Pending',
    orderDate: localOrder.orderDate || localOrder.order_date || localOrder.createdDate || localOrder.created_date || new Date().toLocaleDateString(),
    createdDate: localOrder.createdDate || localOrder.created_date || localOrder.orderDate || '',
    dispatchDate: localOrder.dispatchDate || localOrder.dispatch_date || '',
    trackingNumber: localOrder.trackingNumber || localOrder.tracking_number || localOrder.waybill_number || '',
    notes: localOrder.notes || localOrder.remark || '',
    scheduledDeliveryDate: localOrder.scheduledDeliveryDate || localOrder.deliveryDate || localOrder.delivery_date || '',
    paymentMethod: localOrder.paymentMethod || localOrder.payment_method || 'COD'
  }

  // Handle status changes
  const handleStatusChange = async (field, newValue) => {
    // If status changes to Packed and there's no tracking number, prompt for tracking number
    if (field === 'status' && newValue === 'Packed' && !localOrder?.trackingNumber) {
      if (onRequestTrackingNumber) {
        onRequestTrackingNumber({ ...localOrder, status: 'Packed' }, 'Packed')
        return
      }
      setPendingStatus('Packed')
      setShowTrackingModal(true)
      return
    }

    // If status changes to Dispatched and Curfox is enabled, trigger choice modal
    if (field === 'status' && newValue === 'Dispatched' && settings?.curfox?.enabled) {
      const isCurfoxConnected = settings.curfox.email && settings.curfox.password && settings.curfox.tenant;
      const today = new Date().toISOString().split('T')[0]

      showConfirm(
        'Dispatch Order',
        'How would you like to handle this dispatch?',
        async () => { // Confirm = Send to Courier
          // Logic to handle Curfox dispatch (similar to OrderManagement but locally managed or via prop)
          // For simplicity, within ViewOrderModal, we can just call handleCurfoxDispatch logic if we had it, 
          // or reuse the same logic pattern.
          try {
            const authResponse = await curfoxService.login(settings.curfox.email, settings.curfox.password, settings.curfox.tenant)
            const authPayload = { ...settings.curfox, token: authResponse.token, businessId: settings.curfox.businessId || authResponse.businessId }
            await curfoxService.createOrder(localOrder, localOrder.trackingNumber, authPayload)

            const updatedOrder = { ...localOrder, status: 'Dispatched', dispatchDate: today }
            setLocalOrder(updatedOrder)
            if (onSave) await onSave(updatedOrder)
            addToast('Order dispatched to Curfox successfully', 'success')
          } catch (error) {
            addToast('Curfox Dispatch Failed: ' + error.message, 'error')
          }
        },
        'default',
        'Send to Courier',
        {
          cancelText: 'Cancel',
          extraButtonText: 'Dispatch Locally',
          onExtraButtonClick: async () => {
            const updatedOrder = { ...localOrder, status: 'Dispatched', dispatchDate: today }
            setLocalOrder(updatedOrder)
            if (onSave) await onSave(updatedOrder)
            addToast('Order marked as Dispatched locally', 'success')
          },
          confirmDisabled: !isCurfoxConnected || !localOrder?.trackingNumber
        }
      )
      return
    }

    // If status changes to Dispatched and there's no tracking number (and NOT handled by Curfox above)
    if (field === 'status' && newValue === 'Dispatched' && !localOrder?.trackingNumber) {
      if (onRequestDispatch) {
        onRequestDispatch({ ...localOrder, status: 'Dispatched' })
        return
      }
      setPendingStatus('Dispatched')
      setShowDispatchModal(true)
      return
    }

    const updatedOrder = { ...localOrder, [field]: newValue }
    if (field === 'status' && newValue === 'Dispatched' && !updatedOrder.dispatchDate) {
      updatedOrder.dispatchDate = new Date().toISOString().split('T')[0]
    }
    setLocalOrder(updatedOrder)
    if (onSave) {
      await onSave(updatedOrder)
    }
  }

  // Sync Finance Data to Order
  const handleSyncFinance = async () => {
    if (!financeData || !onSave) return
    try {
      setFinanceLoading(true)
      const updatedOrder = {
        ...localOrder,
        courierFinanceStatus: financeData.finance_status,
        courierInvoiceNo: financeData.invoice_no,
        courierInvoiceRef: financeData.invoice_ref_no
      }

      // Auto-mark as paid if deposited or approved
      if (financeData.finance_status === 'Deposited' || financeData.finance_status === 'Approved') {
        updatedOrder.paymentStatus = 'Paid'
      }

      setLocalOrder(updatedOrder)
      await onSave(updatedOrder)
      addToast('Finance data synced to order', 'success')
    } catch (err) {
      console.error("Sync Finance Error:", err)
      addToast('Failed to sync finance data', 'error')
    } finally {
      setFinanceLoading(false)
    }
  }

  // Calculate discount amount based on subtotal (base price before order-level discount)
  let discountAmount = 0
  if (discountType === '%') {
    discountAmount = (subtotal * discount) / 100
  } else {
    discountAmount = discount || 0
  }

  const finalPrice = Math.max(0, subtotal - discountAmount)
  const advancePayment = Number(localOrder.advancePayment) || 0
  const codAmount = localOrder.codAmount || Math.max(0, finalPrice + deliveryCharge - advancePayment)

  const handleDownloadInvoice = () => {
    // Basic HTML escaping to prevent XSS in the generated invoice window
    const escapeHtml = (unsafe) => {
      if (unsafe === null || unsafe === undefined) return ''
      return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    }

    // Default logo as inline SVG data URI (works in Blob URL context)
    const defaultLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" width="90" height="90">
      <style>.st0{fill:#FF2E36;}</style>
      <g><g><path class="st0" d="M445.85,161l22.29,22.29h66.21v66.2l22.29,22.29V161H445.85z M534.35,450.78v66.19h-66.2l-22.29,22.29h110.77V428.49L534.35,450.78z M200.66,516.97v-66.19l-22.29-22.29v110.77h110.77l-22.29-22.29H200.66z M178.38,161v110.77l22.29-22.29v-66.2h66.21L289.17,161H178.38z"/></g><path class="st0" d="M414.24,422.57c22.15,0,43.63,16.02,43.63,51.88c0,58.77-90.35,107.57-90.35,107.57s-90.35-48.8-90.35-107.57c0-35.87,21.47-51.89,43.63-51.88c20.45,0,41.48,13.65,46.73,37.94C372.75,436.22,393.78,422.57,414.24,422.57"/></g><g><path d="M257.13,290.04h21.23l42.29,109.97H298.9l-8.6-22.65h-44.87l-8.95,22.65h-21.75L257.13,290.04z M267.88,319.2l-14.75,37.75h29.42L267.88,319.2z"/><path d="M388.76,287.28c15.56,0,28.94,5.63,40.13,16.89c11.2,11.26,16.79,24.99,16.79,41.19c0,16.05-5.52,29.63-16.57,40.74c-11.05,11.11-24.45,16.67-40.21,16.67c-16.51,0-30.22-5.71-41.14-17.12c-10.92-11.41-16.38-24.97-16.38-40.67c0-10.51,2.54-20.18,7.63-29.01c5.09-8.82,12.08-15.81,20.98-20.97C368.9,289.86,378.48,287.28,388.76,287.28z M388.53,307.76c-10.18,0-18.74,3.54-25.67,10.62c-6.93,7.08-10.4,16.07-10.4,26.99c0,12.16,4.36,21.78,13.1,28.86c6.78,5.53,14.57,8.3,23.35,8.3c9.93,0,18.38-3.59,25.37-10.76c6.98-7.18,10.48-16.02,10.48-26.54c0-10.47-3.52-19.32-10.55-26.58C407.17,311.39,398.61,307.76,388.53,307.76z"/><path d="M465.72,290.04h54.57v20.41H486.5v19.96h33.79v20.11H486.5v49.49h-20.78V290.04z"/></g><g><path d="M307.91,186.2h15.23c6.13,0,10.84,0.73,14.13,2.18c3.29,1.45,5.89,3.69,7.8,6.7c1.91,3.01,2.86,6.36,2.86,10.03c0,3.43-0.84,6.56-2.51,9.38c-1.67,2.82-4.13,5.1-7.37,6.86c4.02,1.37,7.11,2.97,9.27,4.81c2.16,1.84,3.85,4.06,5.05,6.67c1.21,2.61,1.81,5.44,1.81,8.48c0,6.2-2.27,11.44-6.8,15.73c-4.54,4.29-10.62,6.44-18.26,6.44h-21.22V186.2z M315.47,193.76v24.74h4.42c5.37,0,9.32-0.5,11.85-1.5c2.53-1,4.53-2.57,6-4.73c1.47-2.15,2.21-4.54,2.21-7.17c0-3.54-1.24-6.31-3.71-8.33c-2.47-2.01-6.41-3.02-11.82-3.02H315.47z M315.47,226.28v29.63h9.58c5.65,0,9.79-0.55,12.42-1.65c2.63-1.1,4.74-2.83,6.34-5.17c1.6-2.35,2.39-4.89,2.39-7.62c0-3.43-1.12-6.43-3.37-8.98c-2.24-2.56-5.33-4.31-9.26-5.25c-2.63-0.63-7.21-0.95-13.74-0.95H315.47z"/><path d="M370.82,182.78c1.67,0,3.1,0.6,4.29,1.79c1.19,1.19,1.78,2.63,1.78,4.31c0,1.65-0.59,3.06-1.78,4.26c-1.19,1.19-2.62,1.79-4.29,1.79c-1.64,0-3.05-0.6-4.24-1.79c-1.19-1.19-1.78-2.61-1.78-4.26c0-1.68,0.59-3.12,1.78-4.31C367.77,183.38,369.18,182.78,370.82,182.78z M367.17,206.32h7.36v57.16h-7.36V206.32z"/><path d="M385.13,206.32h41.98l-32.36,50.64h31.31v6.51h-43.97l32.33-50.7h-29.29V206.32z"/></g>
    </svg>`

    // Business Info Logic
    const defaultName = 'AllSet'
    const defaultTagline = 'From Chaos to Clarity.'

    const bizName = isFreeUser ? defaultName : (settings?.businessName || defaultName)
    const bizTagline = isFreeUser ? defaultTagline : (settings?.businessTagline || defaultTagline)
    const bizLogo = (!isFreeUser && settings?.businessLogo) ? settings.businessLogo : null

    // Contact Info HTML
    let contactHtml = ''
    if (!isFreeUser) {
      if (settings?.businessAddress) contactHtml += `<p>${escapeHtml(settings.businessAddress)}</p>`
      if (settings?.businessPhone) contactHtml += `<p><strong>Tel:</strong> ${escapeHtml(settings.businessPhone)}</p>`
      if (settings?.businessEmail) contactHtml += `<p><strong>Email:</strong> ${escapeHtml(settings.businessEmail)}</p>`
      if (settings?.businessWebsite) contactHtml += `<p><strong>Web:</strong> ${escapeHtml(settings.businessWebsite)}</p>`
    }

    const invoiceRows = orderItems.map((it, idx) => {
      const catName = escapeHtml(getCategoryName(it.categoryId))
      const itName = escapeHtml(getItemName(it))
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      const amount = qty * price
      const rawNotes = (it.notes || '').toString().trim()
      const notes = rawNotes ? escapeHtml(rawNotes) : ''

      return `
        <tr>
          <td style="color: #888; text-align: center;">${idx + 1}</td>
          <td>
            <strong>${catName} - ${itName}</strong>
            ${notes ? `<div style="margin-top:4px; color: #444; font-size: 0.9em; font-style: italic;">${notes}</div>` : ''}
          </td>
          <td class="text-right">${qty}</td>
          <td class="text-right">Rs. ${price.toFixed(2)}</td>
          <td class="text-right">Rs. ${amount.toFixed(2)}</td>
        </tr>
      `
    }).join('')

    const pageSize = settings?.general?.defaultPageSize || 'A4'
    // Create invoice HTML
    const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice - Order #${escapeHtml(order.id)}</title>
  <style>
    ${getPrintStyles(pageSize)}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="brand-section">
        <div class="logo">
          ${bizLogo ? `<img src="${bizLogo}" alt="Logo" style="width: 90px; height: 90px; object-fit: contain;">` : defaultLogoSvg}
        </div>
        <div class="company-info">
          <h1>${escapeHtml(bizName)}</h1>
          <p class="tagline">${escapeHtml(bizTagline)}</p>
        </div>
      </div>
      <div class="contact-info">
        ${contactHtml}
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="margin: 0; font-size: 24px; letter-spacing: 4px; color: #333; font-weight: 700;">INVOICE</h2>
    </div>

    <!-- Info Grid -->
    <div class="info-grid">
      <div class="info-column">
        <div class="section-title">Bill To</div>
        <table class="details-table">
          <tr><td class="label-col">Name</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.customerName)}</td></tr>
          <tr><td class="label-col">Address</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.address || 'N/A')}</td></tr>
          ${safeOrder.phone ? `<tr><td class="label-col">Phone</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.phone)}</td></tr>` : ''}
          ${safeOrder.whatsapp ? `<tr><td class="label-col">WhatsApp</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(formatWhatsAppNumber(safeOrder.whatsapp))}</td></tr>` : ''}
        </table>
      </div>
      <div class="info-column">
        <div class="section-title">Invoice Details</div>
        <table class="details-table">
          <tr><td class="label-col">Invoice No.</td><td class="sep-col">:</td><td class="value-col">#${escapeHtml(safeOrder.id)}</td></tr>
          <tr><td class="label-col">Date</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.orderDate)}</td></tr>
          <tr><td class="label-col">Status</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.status)}</td></tr>
          ${!isFreeUser ? `<tr><td class="label-col">Payment</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.paymentStatus)}</td></tr>` : ''}
          ${!isFreeUser && safeOrder.trackingNumber ? `<tr><td class="label-col">Tracking ID</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.trackingNumber)}</td></tr>` : ''}
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 50%;">Description</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-container">
      <div class="totals-box">
        <div class="total-row">
          <span class="total-label">Subtotal</span>
          <span class="total-value">Rs. ${totalPrice.toFixed(2)}</span>
        </div>
        ${discountAmount > 0 ? `
        <div class="total-row">
          <span class="total-label">Discount (${discountType === '%' ? discount + '%' : 'Rs. ' + discount.toFixed(2)})</span>
          <span class="total-value" style="color: #FF2E36;">- Rs. ${discountAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row">
          <span class="total-label">Delivery Charge</span>
          <span class="total-value">Rs. ${deliveryCharge.toFixed(2)}</span>
        </div>
        ${advancePayment > 0 ? `
        <div class="total-row">
          <span class="total-label">Advance Payment</span>
          <span class="total-value" style="color: #10b981;">- Rs. ${advancePayment.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row final">
          <span>${isFreeUser ? 'Total' : (safeOrder.paymentMethod && safeOrder.paymentMethod.toLowerCase().includes('bank') ? 'Amount' : 'Amount Due (COD)')}</span>
          <span>Rs. ${codAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${order.notes ? `
    <div style="margin-top: 30px; font-size: 13px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
      <strong style="color: #666; font-size: 11px; text-transform: uppercase;">Notes</strong>
      <p style="margin: 5px 0 0;">${escapeHtml(order.notes)}</p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Powered by AllSet – A Professional Business Management App</p>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `

    // Open invoice in new window using a Blob URL for better isolation
    try {
      const blob = new Blob([invoiceHTML], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')

      // Cleanup the URL after some time to ensure the window has loaded
      setTimeout(() => URL.revokeObjectURL(url), 60000)

      if (!printWindow) {
        addToast('Popup blocked. Please allow popups for this site.', 'error')
      }
    } catch (error) {
      console.error('Failed to generate preview:', error)
      addToast('Failed to generate invoice preview', 'error')
    }
  }

  const handleSendInvoiceWhatsApp = () => {
    if (!safeOrder.whatsapp) {
      showAlert('Missing Information', 'No WhatsApp number available for this order', 'warning')
      return
    }

    const formattedNumber = formatWhatsAppNumber(safeOrder.whatsapp)
    if (!formattedNumber) {
      showAlert('Invalid Format', 'Invalid WhatsApp number format', 'warning')
      return
    }

    // Build item details string for template
    const itemDetailsString = orderItems.map(it => {
      const cName = getCategoryName(it.categoryId)
      const iName = getItemName(it)
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      return `🔸ITEM: ${cName} - ${iName}\n🔸 QTY: ${qty}\n🔸PRICE: Rs. ${price.toFixed(2)}`
    }).join('\n\n')

    // Use template from settings or fallback to default
    const template = settings?.whatsappTemplates?.viewOrder || ''

    const totalQuantity = orderItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    const invoiceMessage = generateWhatsAppMessage(template, safeOrder, {
      itemDetailsString,
      subtotal,
      discountAmount,
      finalPrice,
      deliveryCharge,
      codAmount,
      totalQuantity,
      totalItems: orderItems.length
    })

    if (!invoiceMessage) {
      showAlert('Template Error', 'Template error: Message is empty', 'danger')
      return
    }

    const encodedMessage = encodeURIComponent(invoiceMessage)
    const numberForUrl = formattedNumber.replace('+', '')
    window.open(`https://wa.me/${numberForUrl}?text=${encodedMessage}`, '_blank')
  }


  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      {/* Confirmation Modal Rendered on top of this if needed */}
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

      <div
        className="modal-content view-order-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1200px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {/* Modal Header / Action Bar */}
        <div className="modal-header" style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div>
            <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>Order #{safeOrder.id}</h2>
            <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {safeOrder.orderDate}
            </div>
          </div>

          <div className="no-print" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleDownloadInvoice}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              title="Download PDF Invoice"
            >
              <Download size={18} />
              <span className="hidden-mobile">PDF</span>
            </button>
            <button
              onClick={handleSendInvoiceWhatsApp}
              className="btn btn-whatsapp"
              disabled={isFreeUser}
              title={isFreeUser ? "WhatsApp is a Pro feature" : "Share Invoice via WhatsApp"}
            >
              <MessageCircle size={18} />
              <span className="hidden-mobile">WhatsApp</span>
              {isFreeUser && <Crown size={14} color="var(--danger)" />}
            </button>
            <button className="modal-close" onClick={onClose} style={{ marginLeft: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body - Split Layout */}
        <div className="modal-body-scroll view-order-split-layout">
          {/* LEFT COLUMN - Order Details */}
          <div className="view-order-left-column">
            {/* Invoice Header (Only visible in Print) */}
            <div className="print-only" style={{
              textAlign: 'center',
              borderBottom: '2px solid var(--accent-primary)',
              paddingBottom: '1.5rem',
              marginBottom: '2rem',
              display: 'none'
            }}>
              <h1 style={{ color: 'var(--accent-primary)', fontSize: '2rem', marginBottom: '0.5rem' }}>AllSet</h1>
              <p style={{ color: 'var(--text-muted)' }}>From Chaos to Clarity.</p>
            </div>


            {/* Unified Order & Customer Card */}
            <div className="glass-card" style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)'
            }}>
              {/* Header Row: Customer Name + Order Status Badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {safeOrder.customerName}
                    {customerOrderCount > 1 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: '0.15rem 0.5rem',
                          backgroundColor: 'var(--accent-primary)',
                          color: '#fff',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700
                        }}
                        title={`${customerOrderCount} orders placed`}
                      >
                        <Star size={10} fill="currentColor" /> {customerOrderCount}
                      </span>
                    )}
                  </div>
                  {safeOrder.whatsapp && (
                    <a href={`https://wa.me/${safeOrder.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#25D366', fontSize: '0.85rem', marginTop: '0.25rem', textDecoration: 'none' }}>
                      <MessageCircle size={14} />
                      {formatWhatsAppNumber(safeOrder.whatsapp)}
                    </a>
                  )}
                  {safeOrder.phone && safeOrder.phone !== safeOrder.whatsapp && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                      📞 {safeOrder.phone}
                    </div>
                  )}
                </div>

                {/* Status Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <CustomDropdown
                    options={[
                      { value: 'New Order', label: 'New Order' },
                      { value: 'Pending', label: 'Pending' },
                      { value: 'Packed', label: 'Packed' },
                      { value: 'Dispatched', label: 'Dispatched' },
                      { value: 'Delivered', label: 'Delivered' },
                      { value: 'Cancelled', label: 'Cancelled' }
                    ]}
                    value={safeOrder.status}
                    onChange={(val) => handleStatusChange('status', val)}
                    style={{ minWidth: '120px' }}
                  />
                  {!isFreeUser && (
                    <CustomDropdown
                      options={[
                        { value: 'Pending', label: 'Pending' },
                        { value: 'Paid', label: 'Paid' }
                      ]}
                      value={safeOrder.paymentStatus}
                      onChange={(val) => handleStatusChange('paymentStatus', val)}
                      style={{ minWidth: '100px' }}
                    />
                  )}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', margin: '1rem 0' }}></div>

              {/* Info Grid: 2 columns on Desktop, 1 on Mobile */}
              <div className="order-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {/* Delivery Info */}
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    📍 Delivery Address
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {safeOrder.address || 'No address provided'}
                  </div>
                  {(safeOrder.nearestCity || safeOrder.district) && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {safeOrder.nearestCity}{safeOrder.nearestCity && safeOrder.district ? ', ' : ''}{safeOrder.district}
                    </div>
                  )}
                </div>

                {/* Dates & Tracking */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {safeOrder.scheduledDeliveryDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scheduled:</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{safeOrder.scheduledDeliveryDate}</span>
                    </div>
                  )}
                  {safeOrder.dispatchDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dispatched:</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{safeOrder.dispatchDate.includes('T') ? safeOrder.dispatchDate.split('T')[0] : safeOrder.dispatchDate}</span>
                    </div>
                  )}
                  {!isFreeUser && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tracking:</span>
                      <input
                        type="text"
                        value={safeOrder.trackingNumber || ''}
                        onChange={(e) => setLocalOrder(prev => ({ ...prev, trackingNumber: e.target.value }))}
                        placeholder="—"
                        style={{
                          textAlign: 'right',
                          width: '140px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          fontFamily: 'monospace',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'var(--border-color)'
                          if (onSave) onSave(localOrder)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            {/* Items Table */}
            {/* Items Table - Desktop */}
            <div className="items-table-desktop" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '2px solid var(--border-color)',
                    color: 'var(--text-muted)'
                  }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>DESCRIPTION</th>
                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>QTY</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>UNIT PRICE</th>
                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((it, idx) => {
                    const catName = getCategoryName(it.categoryId)
                    const itName = getItemName(it)
                    const qty = Number(it.quantity) || 0
                    const price = Number(it.unitPrice) || 0
                    const amount = qty * price
                    const notes = (it.notes || '').toString().trim()
                    return (
                      <tr key={`${idx}-${it.itemId || it.customItemName || 'item'}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                          <div style={{ fontWeight: 500 }}>{catName} - {itName}</div>
                          {it.image && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <a href={it.image} target="_blank" rel="noopener noreferrer">
                                <img src={it.image} alt="Ref" style={{ height: '50px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                              </a>
                            </div>
                          )}
                          {notes && (
                            <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{qty}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Rs. {price.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>Rs. {amount.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Items List - Mobile */}
            <div className="items-card-mobile">
              {orderItems.map((it, idx) => {
                const catName = getCategoryName(it.categoryId)
                const itName = getItemName(it)
                const qty = Number(it.quantity) || 0
                const price = Number(it.unitPrice) || 0
                const amount = qty * price
                const notes = (it.notes || '').toString().trim()
                return (
                  <div key={`${idx}-mobile`} className="item-mobile-row">
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      {catName} - {itName}
                    </div>

                    {it.image && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <img src={it.image} alt="Ref" style={{ width: '100%', maxWidth: '200px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span>Quantity:</span>
                      <span>{qty}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span>Unit Price:</span>
                      <span>Rs. {price.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span>Total:</span>
                      <span>Rs. {amount.toFixed(2)}</span>
                    </div>

                    {notes && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong>Notes:</strong> {notes}
                      </div>
                    )}


                  </div>
                )
              })}
            </div>



            {/* Totals Section */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '2rem'
            }}>
              <div className="totals-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Rs. {totalPrice.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--success)' }}>
                    <span>Discount ({discountType === '%' ? discount + '%' : 'Rs. ' + discount.toFixed(2)}):</span>
                    <span>- Rs. {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>Delivery Charge:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Rs. {deliveryCharge.toFixed(2)}</span>
                </div>
                {advancePayment > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'var(--success)' }}>
                    <span>Advance Payment:</span>
                    <span style={{ fontWeight: 500 }}>- Rs. {advancePayment.toFixed(2)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-color)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--accent-primary)'
                }}>
                  <span>{isFreeUser ? 'Total:' : 'Total (COD):'}</span>
                  <span>Rs. {codAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {safeOrder.notes && (
              <div style={{
                marginBottom: '2rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius)',
                borderLeft: '4px solid var(--accent-primary)'
              }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Order Notes
                </h4>
                <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.9rem' }}>
                  {safeOrder.notes}
                </p>
              </div>
            )}

          </div>
          {/* END LEFT COLUMN */}

          {/* RIGHT COLUMN - Tracking & Finance */}
          <div className="view-order-right-column">
            {/* Tracking Section */}
            <div className="tracking-finance-panel glass-card" style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              position: 'sticky',
              top: '0',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{
                  padding: '0.5rem',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
                  color: 'var(--accent-primary)'
                }}>
                  <Truck size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Shipment Status</h3>
                  {safeOrder.trackingNumber && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Waybill: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{safeOrder.trackingNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {!safeOrder.trackingNumber ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <Truck size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                  <p style={{ margin: 0 }}>No tracking number assigned yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Mark order as "Packed" to generate a waybill.</p>
                </div>
              ) : loadingTracking ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem' }} />
                  <p>Fetching updates...</p>
                </div>
              ) : (
                <>
                  {/* Current Status Hero */}
                  <div style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.1) 0%, rgba(var(--accent-rgb), 0.05) 100%)',
                    border: '1px solid rgba(var(--accent-rgb), 0.2)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        Current Status
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {(() => {
                          if (trackingHistory.length === 0) return 'Awaiting Update'
                          const latest = trackingHistory[0]
                          return getSafeName(latest.status) || getSafeName(latest.status_code) || 'Update'
                        })()}
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem', background: 'rgba(var(--accent-rgb), 0.2)', borderRadius: '50%', color: 'var(--accent-primary)' }}>
                      <Truck size={24} />
                    </div>
                  </div>

                  {/* Timeline */}
                  {trackingHistory.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Shipment History</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {trackingHistory.slice(0, 5).map((event, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '0.75rem', position: 'relative', paddingBottom: idx === Math.min(4, trackingHistory.length - 1) ? 0 : '1rem' }}>
                            {idx !== Math.min(4, trackingHistory.length - 1) && (
                              <div style={{ position: 'absolute', left: '5px', top: '18px', bottom: '0', width: '2px', backgroundColor: 'var(--border-color)' }}></div>
                            )}
                            <div style={{
                              width: '12px', height: '12px', borderRadius: '50%',
                              backgroundColor: idx === 0 ? 'var(--accent-primary)' : 'var(--bg-card)',
                              border: idx === 0 ? '3px solid rgba(var(--accent-rgb), 0.3)' : '2px solid var(--text-muted)',
                              flexShrink: 0, marginTop: '3px', zIndex: 1
                            }}></div>
                            <div>
                              <div style={{ fontWeight: idx === 0 ? 600 : 400, color: idx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {getSafeName(event.status) || getSafeName(event.status_code) || 'Update'}
                              </div>
                            </div>
                          </div>
                        ))}
                        {trackingHistory.length > 5 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1.5rem' }}>
                            +{trackingHistory.length - 5} more updates
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Finance Section */}
              {safeOrder.trackingNumber && settings?.curfox?.enabled && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Finance Status</h4>

                  {financeLoading ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                      <RefreshCw className="animate-spin" size={20} />
                    </div>
                  ) : financeData ? (
                    <>
                      <div style={{
                        padding: '1rem',
                        borderRadius: '10px',
                        background: financeData.finance_status === 'Deposited'
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)',
                        border: `1px solid ${financeData.finance_status === 'Deposited' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`,
                        textAlign: 'center',
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}>
                          {financeData.finance_status || 'Pending'}
                          {financeData.finance_status === 'Deposited' && <CheckCircle size={20} fill="#10b981" color="black" />}
                        </div>
                      </div>

                      {/* Invoice details */}
                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        {financeData.invoice_ref_no && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Invoice Ref:</span>
                            <span style={{ fontWeight: 500 }}>{financeData.invoice_ref_no}</span>
                          </div>
                        )}
                        {financeData.invoice_no && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Invoice No:</span>
                            <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{financeData.invoice_no}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleSyncFinance}
                        disabled={financeLoading}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                      >
                        {financeLoading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        Sync to Order
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <p>No finance record yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* END RIGHT COLUMN */}

          <style>{`
            .view-order-split-layout {
              display: grid;
              grid-template-columns: 1.6fr 1fr;
              gap: 2rem;
              overflow-y: auto;
              padding: 2rem;
              flex: 1;
            }
            .view-order-left-column {
              min-width: 0;
            }
            .view-order-right-column {
              min-width: 0;
            }
            .tracking-finance-panel {
              position: sticky;
              top: 0;
            }

            .items-card-mobile {
              display: none;
              flex-direction: column;
              gap: 1rem;
              margin-bottom: 2rem;
            }

            .item-mobile-row {
              background: var(--bg-secondary);
              padding: 1rem;
              border-radius: 8px;
              border: 1px solid var(--border-color);
            }

            .totals-container {
              width: 300px;
              padding: 1rem;
              background-color: var(--bg-secondary);
              border-radius: var(--radius);
            }

            @media (max-width: 1024px) {
              .view-order-split-layout {
                grid-template-columns: 1fr;
                padding: 1rem;
              }
              .view-order-right-column {
                order: 2;
              }
              .tracking-finance-panel {
                position: static;
              }
            }

            @media (max-width: 600px) {
              .view-order-split-layout {
                padding: 1rem;
                gap: 1rem;
              }
              .items-table-desktop {
                display: none !important;
              }
              .items-card-mobile {
                display: flex !important;
              }
              .totals-container {
                width: 100% !important;
              }
              .modal-header {
                padding: 1rem !important;
              }
              .modal-header h2 {
                font-size: 1.1rem !important;
              }
            }

            @media print {
              .modal-overlay {
                position: absolute;
                background: white !important;
                padding: 0 !important;
                display: block !important;
              }
              .view-order-modal {
                box-shadow: none !important;
                border-radius: 0 !important;
                max-height: none !important;
                max-width: 100% !important;
                height: auto !important;
                background: white !important;
                padding: 0 !important;
                overflow: visible !important;
                display: block !important;
              }
              .view-order-split-layout {
                display: block !important;
              }
              .view-order-right-column {
                display: none !important;
              }
              .no-print {
                display: none !important;
              }
              .print-only {
                display: block !important;
              }
              .view-order-modal * {
                color: #000 !important;
                background-color: transparent !important;
                border-color: #ddd !important;
              }
              .view-order-modal table th {
                background-color: #f3f4f6 !important;
                font-weight: bold !important;
              }
              .card {
                border: 1px solid #ddd !important;
                padding: 10px !important;
                background: none !important;
              }
              .items-table-desktop {
                display: table !important;
              }
              .items-card-mobile {
                display: none !important;
              }
            }
          `}</style>

          {/* Local fallbacks if parent doesn't provide handlers */}
          {showTrackingModal && (
            <TrackingNumberModal
              order={{ ...localOrder, status: pendingStatus }}
              targetStatus={pendingStatus}
              onClose={() => {
                setShowTrackingModal(false)
                setPendingStatus('Packed')
              }}
              onSave={async (updatedOrder) => {
                setLocalOrder(updatedOrder)
                if (onSave) {
                  await onSave(updatedOrder)
                }
              }}
            />
          )}

          {showDispatchModal && (
            <DispatchModal
              order={{ ...localOrder, status: 'Dispatched' }}
              onClose={() => {
                setShowDispatchModal(false)
                setPendingStatus('Packed')
              }}
              onSave={async (updatedOrder) => {
                setLocalOrder(updatedOrder)
                if (onSave) {
                  await onSave(updatedOrder)
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ViewOrderModal
