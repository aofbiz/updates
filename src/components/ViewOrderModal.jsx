import { useState, useEffect } from 'react'
import { X, Download, MessageCircle, Star } from 'lucide-react'
import { getProducts, getSettings } from '../utils/storage'
import { formatWhatsAppNumber, generateWhatsAppMessage } from '../utils/whatsapp'

import TrackingNumberModal from './TrackingNumberModal'
import DispatchModal from './DispatchModal'
import ConfirmationModal from './ConfirmationModal'
import { curfoxService } from '../utils/curfox'
import { useToast } from './Toast/ToastContext'

const ViewOrderModal = ({ order, customerOrderCount = 1, onClose, onSave, onRequestTrackingNumber, onRequestDispatch }) => {
  const { addToast } = useToast()
  const [products, setProducts] = useState({ categories: [] })
  const [localOrder, setLocalOrder] = useState(order)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState('Packed')
  const [settings, setSettings] = useState(null)


  const [trackingHistory, setTrackingHistory] = useState([])
  const [loadingTracking, setLoadingTracking] = useState(false)

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

  // Load Tracking History
  useEffect(() => {
    const fetchTracking = async () => {
      if (localOrder?.trackingNumber && settings?.curfox?.enabled) {
        setLoadingTracking(true)
        try {
          // Pass settings.curfox implicitly or explicitly if service needs it? 
          // Previous impl of service didn't use settings for GET, but assuming it might need auth
          // For now, service.getTracking(waybill, authData)
          const history = await curfoxService.getTracking(localOrder.trackingNumber, settings.curfox)
          if (Array.isArray(history)) {
            setTrackingHistory(history)
          }
        } catch (error) {
          console.error("Error fetching tracking:", error)
        } finally {
          setLoadingTracking(false)
        }
      }
    }
    fetchTracking()
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

    // If status changes to Dispatched and there's no tracking number, open dispatch modal (captures dispatch date + tracking)
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

    // Create invoice HTML
    const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice - Order #${escapeHtml(order.id)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      font-size: 14px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
    }
    
    @media print {
      body { margin: 0; }
      @page { margin: 1cm; size: A4; }
      .no-print { display: none; }
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #FF2E36;
      padding-bottom: 20px;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .logo svg {
      width: 90px;
      height: 90px;
    }

    .company-info h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #FF2E36;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .company-info .tagline {
      margin: 2px 0 0;
      font-size: 14px;
      color: #666;
      font-weight: 500;
      letter-spacing: 1px;
    }

    .contact-info {
      text-align: right;
      font-size: 13px;
      color: #555;
    }

    .contact-info p {
      margin: 2px 0;
    }

    .contact-info strong {
      color: #333;
    }

    /* Invoice Info Grid */
    .info-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      gap: 40px;
    }

    .info-column {
      flex: 1;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }

    .details-table {
      width: 100%;
      border-collapse: collapse;
    }

    .details-table td {
      padding: 3px 0;
      vertical-align: top;
    }

    .label-col {
      width: 100px;
      color: #666;
      font-weight: 500;
    }

    .sep-col {
      width: 15px;
      color: #999;
      text-align: center;
    }

    .value-col {
      font-weight: 600;
      color: #333;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }

    .items-table th {
      background-color: #f9f9f9;
      color: #666;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 12px;
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .items-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #eee;
      color: #333;
    }

    .items-table tr:last-child td {
      border-bottom: 1px solid #FF2E36;
    }

    .item-desc {
      font-weight: 500;
    }
    
    .item-notes {
      font-size: 12px;
      color: #777;
      margin-top: 4px;
    }

    .text-right { text-align: right; }
    .text-center { text-align: center; }

    /* Totals Section */
    .totals-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }

    .totals-box {
      width: 300px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
    }

    .total-row.final {
      border-top: 2px solid #eee;
      margin-top: 10px;
      padding-top: 10px;
      font-size: 16px;
      font-weight: 700;
      color: #FF2E36;
    }

    .total-label { color: #666; }
    .total-value { font-weight: 600; }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #888;
      font-size: 12px;
    }
    
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="brand-section">
        <div class="logo">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" xml:space="preserve">
            <style type="text/css">.st0{fill:#FF2E36;}.st1{fill:#000000;}</style>
            <g>
              <g><path class="st0" d="M437.25,161l22.29,22.29h66.21v66.2l22.29,22.29V161H437.25z M525.75,450.78v66.19h-66.2l-22.29,22.29h110.77V428.49L525.75,450.78z M192.07,516.97v-66.19l-22.29-22.29v110.77h110.77l-22.29-22.29H192.07z M169.78,161v110.77l22.29-22.29v-66.2h66.21L280.57,161H169.78z"/></g>
              <g>
                <g>
                  <path class="st1" d="M121.9,302.47h47.3v17.69h-29.29v17.3h29.29v17.43h-29.29v42.9H121.9V302.47z"/>
                  <path class="st1" d="M186.57,302.47h19.22c10.53,0,18.03,0.94,22.49,2.82s8.06,5,10.78,9.36c2.72,4.36,4.08,9.53,4.08,15.49c0,6.26-1.5,11.5-4.5,15.71c-3,4.21-7.53,7.4-13.57,9.56l22.58,42.38h-19.83l-21.43-40.37h-1.66v40.37h-18.14V302.47z M204.72,339.73h5.69c5.77,0,9.74-0.76,11.92-2.28c2.17-1.52,3.26-4.03,3.26-7.54c0-2.08-0.54-3.89-1.62-5.43c-1.08-1.54-2.52-2.64-4.33-3.32c-1.81-0.67-5.12-1.01-9.95-1.01h-4.97V339.73z"/>
                  <path class="st1" d="M291.4,302.47h18.4l36.66,95.32h-18.86l-7.46-19.63h-38.89l-7.75,19.63h-18.86L291.4,302.47z M300.72,327.74l-12.79,32.72h25.5L300.72,327.74z"/>
                  <path class="st1" d="M369.74,302.47h17.68l22.1,66.48l22.3-66.48h17.67l15.99,95.32h-17.54l-10.22-60.2l-20.25,60.2h-15.99l-20.07-60.2l-10.47,60.2h-17.69L369.74,302.47z"/>
                  <path class="st1" d="M479.99,302.47h52.03v17.76H498v17.24h34.02v17.43H498v25.08h34.02v17.82h-52.03V302.47z"/>
                  <path class="st1" d="M598.96,315.43l-13.44,11.86c-4.72-6.57-9.52-9.85-14.41-9.85c-2.38,0-4.33,0.64-5.84,1.91c-1.51,1.28-2.27,2.71-2.27,4.31c0,1.6,0.54,3.11,1.62,4.54c1.47,1.9,5.91,5.98,13.31,12.25c6.92,5.79,11.12,9.44,12.59,10.95c3.68,3.72,6.28,7.27,7.82,10.66c1.54,3.39,2.3,7.1,2.3,11.11c0,7.82-2.7,14.28-8.11,19.37c-5.41,5.1-12.46,7.65-21.15,7.65c-6.79,0-12.7-1.66-17.74-4.99s-9.35-8.55-12.94-15.68l15.25-9.2c4.59,8.43,9.87,12.64,15.84,12.64c3.11,0,5.73-0.91,7.85-2.72c2.12-1.81,3.18-3.91,3.18-6.28c0-2.16-0.8-4.32-2.4-6.48c-1.6-2.16-5.13-5.46-10.58-9.91c-10.39-8.47-17.09-15-20.12-19.6c-3.03-4.6-4.54-9.19-4.54-13.77c0-6.61,2.52-12.28,7.56-17.01c5.04-4.73,11.26-7.1,18.65-7.1c4.76,0,9.29,1.1,13.59,3.3C589.28,305.58,593.94,309.6,598.96,315.43z"/>
                </g>
                <g>
                   <path class="st1" d="M245.27,217.2l28.9,61.98h-6.69l-9.75-20.39h-26.7l-9.66,20.39h-6.91l29.28-61.98H245.27z M244.49,230.37l-10.62,22.43h21.19L244.49,230.37z"/>
                   <path class="st1" d="M284.12,217.2h12.35c6.88,0,11.54,0.28,13.99,0.84c3.68,0.84,6.67,2.65,8.97,5.42c2.3,2.77,3.45,6.18,3.45,10.23c0,3.38-0.79,6.34-2.38,8.9s-3.86,4.49-6.8,5.8c-2.95,1.31-7.02,1.98-12.22,2l22.29,28.78h-7.66l-22.29-28.78h-3.5v28.78h-6.19V217.2z M290.31,223.27v21.07l10.68,0.08c4.14,0,7.2-0.39,9.18-1.18c1.98-0.79,3.53-2.04,4.64-3.77c1.11-1.73,1.67-3.66,1.67-5.79c0-2.08-0.56-3.97-1.69-5.67c-1.13-1.7-2.6-2.91-4.43-3.64c-1.83-0.73-4.87-1.1-9.12-1.1H290.31z"/>
                   <path class="st1" d="M330.51,223.27v-6.07h33.96v6.07h-13.82v55.91h-6.32v-55.91H330.51z"/>
                   <path class="st1" d="M426.81,215.64c9.39,0,17.24,3.13,23.57,9.4c6.32,6.26,9.49,13.97,9.49,23.13c0,9.07-3.16,16.77-9.47,23.09s-14,9.48-23.08,9.48c-9.19,0-16.95-3.15-23.27-9.44c-6.32-6.29-9.49-13.9-9.49-22.84c0-5.95,1.44-11.47,4.32-16.56c2.88-5.08,6.81-9.07,11.78-11.95C415.63,217.08,421.02,215.64,426.81,215.64z M427.08,221.66c-4.59,0-8.93,1.2-13.04,3.58c-4.11,2.39-7.32,5.61-9.62,9.66c-2.31,4.05-3.46,8.56-3.46,13.54c0,7.37,2.55,13.59,7.66,18.66c5.11,5.07,11.26,7.61,18.46,7.61c4.81,0,9.26-1.17,13.36-3.5c4.09-2.33,7.29-5.52,9.58-9.57c2.29-4.05,3.44-8.55,3.44-13.49c0-4.92-1.15-9.37-3.44-13.35s-5.52-7.16-9.68-9.55C436.17,222.86,431.75,221.66,427.08,221.66z"/>
                   <path class="st1" d="M472.29,217.2h31.05v6.07h-24.86v19.42h24.86v6.07h-24.86v30.42h-6.19V217.2z"/>
                </g>
              </g>
              <path class="st0" d="M405.64,422.57c22.15,0,43.63,16.02,43.63,51.88c0,58.77-90.35,107.57-90.35,107.57s-90.35-48.8-90.35-107.57c0-35.87,21.47-51.89,43.63-51.88c20.45,0,41.48,13.65,46.73,37.94C364.15,436.22,385.18,422.57,405.64,422.57"/>
            </g>
          </svg>
        </div>
        <div class="company-info">
          <h1>Art Of Frames</h1>
          <p class="tagline">Art that remembers</p>
        </div>
      </div>
      <div class="contact-info">
        <p><strong>Hotline:</strong></p>
        <p style="font-size: 16px; font-weight: 700; color: #FF2E36;">+94 750 350 109</p>
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
          <tr><td class="label-col">Payment</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.paymentStatus)}</td></tr>
          ${safeOrder.trackingNumber ? `<tr><td class="label-col">Tracking ID</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeOrder.trackingNumber)}</td></tr>` : ''}
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
          <span>${safeOrder.paymentMethod && safeOrder.paymentMethod.toLowerCase().includes('bank') ? 'Amount' : 'Amount Due (COD)'}</span>
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
      <p>Thank you for your business!</p>
      <p>Art Of Frames — Art that remembers</p>
    </div>
  </div>
</body>
</html>
    `

    // Open invoice in new window
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(invoiceHTML)
      printWindow.document.close()

      // Wait for content to load, then trigger print
      setTimeout(() => {
        printWindow.print()
      }, 500)
    } else {
      addToast('Popup blocked. Please allow popups for this site.', 'error')
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
      />

      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0, // Reset default padding to handle scroll area properly
          overflow: 'hidden', // Let the body scroll
          '@media print': {
            boxShadow: 'none',
            borderRadius: 0,
            maxHeight: 'none',
            overflow: 'visible'
          }
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
              className="btn"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: '#25D366', color: 'white', border: 'none'
              }}
              title="Share Invoice via WhatsApp"
            >
              <MessageCircle size={18} />
              <span className="hidden-mobile">WhatsApp</span>
            </button>
            <button className="modal-close" onClick={onClose} style={{ marginLeft: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="modal-body-scroll">
          {/* Invoice Header (Only visible in Print or heavily emphasized in view) */}
          <div className="print-only" style={{
            textAlign: 'center',
            borderBottom: '2px solid var(--accent-primary)',
            paddingBottom: '1.5rem',
            marginBottom: '2rem',
            display: 'none' // Hidden on screen, shown in print via CSS media query usually, but inline styles are tricky.
            // Better to keep a simple visual header for screen.
          }}>
            <h1 style={{ color: 'var(--accent-primary)', fontSize: '2rem', marginBottom: '0.5rem' }}>Art Of Frames</h1>
            <p style={{ color: 'var(--text-muted)' }}>Art that remembers</p>
          </div>

          {/* Invoice Info & Customer Details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Order Details Card */}
            <div className="card" style={{ padding: '1.5rem', height: '100%' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Order Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Status:</span>
                  <select
                    value={safeOrder.status}
                    onChange={(e) => handleStatusChange('status', e.target.value)}
                    className="form-input"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.875rem',
                      width: 'auto',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="New Order" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>New Order</option>
                    <option value="Pending" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Pending</option>
                    <option value="Packed" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Packed</option>
                    <option value="Dispatched" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Dispatched</option>
                    <option value="Delivered" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Delivered</option>
                    <option value="Cancelled" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Cancelled</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Payment:</span>
                  <select
                    value={safeOrder.paymentStatus}
                    onChange={(e) => handleStatusChange('paymentStatus', e.target.value)}
                    className="form-input"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.875rem',
                      width: 'auto',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="Pending" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Pending</option>
                    <option value="Paid" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Paid</option>
                  </select>
                </div>

                {safeOrder.scheduledDeliveryDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Scheduled Delivery:</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{safeOrder.scheduledDeliveryDate}</span>
                  </div>
                )}

                {safeOrder.dispatchDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dispatched Date:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{safeOrder.dispatchDate.includes('T') ? safeOrder.dispatchDate.split('T')[0] : safeOrder.dispatchDate}</span>
                  </div>
                )}

                <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Tracking Number</label>
                  <input
                    type="text"
                    value={safeOrder.trackingNumber}
                    onChange={(e) => setLocalOrder(prev => ({ ...prev, trackingNumber: e.target.value }))}
                    placeholder="No Tracking ID"
                    style={{
                      width: '100%',
                      padding: '0.2rem 0',
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      letterSpacing: '0.5px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-color)',
                      borderRadius: 0,
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-color)'
                      if (onSave) onSave(localOrder)
                    }}
                  />
                </div>

                {safeOrder.courierFinanceStatus && (
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Courier Finance Info</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Status:</span>
                        <span style={{
                          fontWeight: 600,
                          color: safeOrder.courierFinanceStatus === 'Deposited' || safeOrder.courierFinanceStatus === 'Approved' ? '#10b981' : 'var(--accent-secondary)'
                        }}>
                          {getSafeName(safeOrder.courierFinanceStatus)}
                        </span>
                      </div>
                      {safeOrder.courierInvoiceNo && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span>Invoice:</span>
                          <span style={{ fontWeight: 500 }}>{safeOrder.courierInvoiceNo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Details Card */}
            <div className="card" style={{ padding: '1.5rem', height: '100%' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Customer Information
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {safeOrder.customerName}
                  {customerOrderCount > 1 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        padding: '0.1rem 0.4rem',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        marginLeft: '0.5rem',
                        verticalAlign: 'middle'
                      }}
                      title={`${customerOrderCount} orders placed`}
                    >
                      <Star size={12} fill="currentColor" /> {customerOrderCount}
                    </span>
                  )}
                </div>

                {safeOrder.address && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {safeOrder.address}
                  </div>
                )}

                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
                  {(safeOrder.nearestCity || safeOrder.district) && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {safeOrder.nearestCity}{safeOrder.nearestCity && safeOrder.district ? ', ' : ''}{safeOrder.district}
                    </span>
                  )}

                  {safeOrder.whatsapp && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                      <MessageCircle size={14} />
                      <span>{formatWhatsAppNumber(safeOrder.whatsapp)}</span>
                    </div>
                  )}
                  {safeOrder.phone && safeOrder.phone !== safeOrder.whatsapp && (
                    <div style={{ color: 'var(--text-muted)' }}>Phone: {safeOrder.phone}</div>
                  )}
                </div>
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
                <span>Total (COD):</span>
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

          {/* Tracking History */}
          <div className="items-card-mobile">
            {(loadingTracking || trackingHistory.length > 0) && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Tracking History</h4>
                {loadingTracking ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading updates...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {trackingHistory.map((event, idx) => (
                      <div key={idx} style={{ position: 'relative', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
                        <div style={{ position: 'absolute', left: '-5px', top: '2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: idx === 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}></div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: idx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {getSafeName(event.status) || getSafeName(event.status_code) || 'Update'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(event.updated_at || event.create_at || event.date).toLocaleString()}
                        </div>
                        {event.comment && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{event.comment}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tracking History Desktop View */}
          {(loadingTracking || trackingHistory.length > 0) && (
            <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }} className="items-table-desktop">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Tracking History
              </h3>
              {loadingTracking ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading tracking updates...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {trackingHistory.map((event, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: '140px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(event.updated_at || event.create_at || event.date).toLocaleString()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: idx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {getSafeName(event.status) || getSafeName(event.status_code) || 'Update'}
                        </div>
                        {event.comment && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{event.comment}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Simple Footer (Screen Only) */}
          <div className="no-print" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <p>Viewing Order Details</p>
          </div>
          <style>{`
        .modal-body-scroll {
          overflow-y: auto;
          padding: 2rem;
          flex: 1;
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
          borderRadius: var(--radius);
        }

        @media (max-width: 600px) {
          .modal-body-scroll {
            padding: 1rem !important;
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
            position: absolute; /* Reset fixed */
            background: white !important;
            padding: 0 !important;
            display: block !important;
          }
          .modal-content {
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
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          /* Override dark theme for print */
          .modal-content * {
            color: #000 !important;
            background-color: transparent !important;
            border-color: #ddd !important;
          }
          /* Specific overrides for clarity */
          .modal-content table th {
            background-color: #f3f4f6 !important;
            font-weight: bold !important;
          }
          /* Hide card backgrounds */
          .card {
            border: 1px solid #ddd !important;
            padding: 10px !important;
            background: none !important;
          }
          .modal-body-scroll {
            padding: 0 !important;
            overflow: visible !important;
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
