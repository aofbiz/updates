import { useState, useEffect } from 'react'
import { X, Download, MessageCircle } from 'lucide-react'
import { getProducts, getSettings } from '../utils/storage'
import { formatWhatsAppNumber, generateWhatsAppMessage } from '../utils/whatsapp'
import TrackingNumberModal from './TrackingNumberModal'
import DispatchModal from './DispatchModal'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const ViewOrderModal = ({ order, onClose, onSave, onRequestTrackingNumber, onRequestDispatch }) => {
  const { addToast } = useToast()
  const [products, setProducts] = useState({ categories: [] })
  const [localOrder, setLocalOrder] = useState(order)
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [pendingStatus, setPendingStatus] = useState('Packed')
  const [settings, setSettings] = useState(null)

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
    }
  }, [order])

  // Safety check
  if (!localOrder) {
    return null
  }

  // Get category and item names with safety checks
  const category = localOrder.categoryId ? products.categories.find(cat => cat.id === localOrder.categoryId) : null
  const item = category && localOrder.itemId ? category.items.find(item => item.id === localOrder.itemId) : null
  const categoryName = category?.name || 'N/A'
  const itemName = localOrder.customItemName || item?.name || 'N/A'

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
    return c?.name || 'N/A'
  }

  const getItemName = (categoryId, itemId, customItemName) => {
    if (customItemName) return customItemName
    const c = products.categories.find(cat => cat.id === categoryId)
    const it = c?.items?.find(x => x.id === itemId)
    return it?.name || 'N/A'
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
    customerName: localOrder.customerName || 'N/A',
    address: localOrder.address || '',
    phone: localOrder.phone || '',
    whatsapp: localOrder.whatsapp || localOrder.phone || '',
    nearestCity: localOrder.nearestCity || '',
    district: localOrder.district || '',
    status: localOrder.status || 'Pending',
    paymentStatus: localOrder.paymentStatus || 'Pending',
    orderDate: localOrder.orderDate || localOrder.createdDate || new Date().toLocaleDateString(),
    createdDate: localOrder.createdDate || localOrder.orderDate || '',
    dispatchDate: localOrder.dispatchDate || '',
    trackingNumber: localOrder.trackingNumber || '',
    notes: localOrder.notes || ''
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
    setLocalOrder(updatedOrder)
    if (onSave) {
      await onSave(updatedOrder)
    }
  }

  // Calculate final price after discount (matching OrderForm logic)
  let discountAmount = 0
  if (discountType === '%') {
    discountAmount = (totalPrice * discount) / 100
  } else {
    discountAmount = discount || 0
  }

  const finalPrice = Math.max(0, totalPrice - discountAmount)
  const codAmount = localOrder.codAmount || Math.max(0, finalPrice + deliveryCharge)

  const handleDownloadInvoice = () => {
    const invoiceRows = orderItems.map(it => {
      const catName = getCategoryName(it.categoryId)
      const itName = getItemName(it.categoryId, it.itemId, it.customItemName)
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      const amount = qty * price
      const notes = (it.notes || '').toString().trim()
      return `
        <tr>
          <td>
            <strong>${catName} - ${itName}</strong>
            ${notes ? `<div style="margin-top:4px;color:#666;font-size:0.85em;">Notes: ${notes.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>` : ''}
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
  <title>Invoice - Order #${order.id}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #FF2E36;
    }
    .invoice-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .info-section {
      flex: 1;
    }
    .info-section h3 {
      margin-top: 0;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .text-right {
      text-align: right;
    }
    .total-section {
      margin-top: 20px;
      border-top: 2px solid #333;
      padding-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
    }
    .total-row.final {
      font-size: 1.2em;
      font-weight: bold;
      border-top: 1px solid #ddd;
      padding-top: 10px;
      margin-top: 10px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Art Of Frames</h1>
    <p>Management System</p>
  </div>

  <div class="invoice-info">
    <div class="info-section">
      <h3>Invoice Details</h3>
      <p><strong>Order Number:</strong> #${safeOrder.id}</p>
      <p><strong>Date:</strong> ${safeOrder.orderDate}</p>
      <p><strong>Status:</strong> ${safeOrder.status}</p>
      <p><strong>Payment Status:</strong> ${safeOrder.paymentStatus}</p>
      ${safeOrder.trackingNumber ? `<p><strong>Tracking Number:</strong> ${safeOrder.trackingNumber}</p>` : ''}
    </div>
    <div class="info-section">
      <h3>Customer Information</h3>
      <p><strong>Name:</strong> ${safeOrder.customerName}</p>
      ${safeOrder.whatsapp ? `<p><strong>WhatsApp:</strong> ${formatWhatsAppNumber(safeOrder.whatsapp)}</p>` : ''}
      ${safeOrder.phone ? `<p><strong>Phone:</strong> ${safeOrder.phone}</p>` : ''}
      <p><strong>Address:</strong> ${safeOrder.address || 'N/A'}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="text-right">Quantity</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${invoiceRows}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <span>Subtotal:</span>
      <span>Rs. ${totalPrice.toFixed(2)}</span>
    </div>
    ${discountAmount > 0 ? `
    <div class="total-row">
      <span>Discount (${discountType === '%' ? discount + '%' : 'Rs. ' + discount.toFixed(2)}):</span>
      <span>- Rs. ${discountAmount.toFixed(2)}</span>
    </div>
    ` : ''}
    <div class="total-row">
      <span>Delivery Charge:</span>
      <span>Rs. ${deliveryCharge.toFixed(2)}</span>
    </div>
    <div class="total-row final">
      <span>Total Amount (COD):</span>
      <span>Rs. ${codAmount.toFixed(2)}</span>
    </div>
  </div>

  ${order.notes ? `
  <div style="margin-top: 30px;">
    <h3>Notes</h3>
    <p>${order.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Art Of Frames Management System</p>
  </div>
</body>
</html>
    `

    // Open invoice in new window
    const printWindow = window.open('', '_blank')
    printWindow.document.write(invoiceHTML)
    printWindow.document.close()

    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print()
    }, 250)
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
      const iName = getItemName(it.categoryId, it.itemId, it.customItemName)
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      return `🔸ITEM: ${cName} - ${iName}\n🔸 QTY: ${qty}\n🔸PRICE: Rs. ${price.toFixed(2)}`
    }).join('\n\n')

    // Use template from settings or fallback to default
    const template = settings?.whatsappTemplates?.viewOrder || ''

    const invoiceMessage = generateWhatsAppMessage(template, safeOrder, {
      itemDetailsString,
      subtotal,
      discountAmount,
      finalPrice,
      deliveryCharge,
      codAmount
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
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      padding: '1rem',
      backdropFilter: 'blur(4px)'
    }}>
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
          maxHeight: '95vh',
          overflowY: 'auto',
          backgroundColor: '#1F2937',
          borderRadius: '8px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          '@media print': {
            boxShadow: 'none',
            borderRadius: 0,
            maxHeight: 'none'
          }
        }}
      >
        {/* Action Buttons - Hidden on Print */}
        <div style={{
          padding: '1rem 2rem',
          display: 'flex',
          gap: '1rem',
          borderBottom: '2px solid #374151',
          backgroundColor: '#111827',
          '@media print': {
            display: 'none'
          }
        }} className="no-print">
          <button
            onClick={handleDownloadInvoice}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3B82F6'
            }}
          >
            <Download size={18} />
            Download PDF
          </button>
          <button
            onClick={handleSendInvoiceWhatsApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#25D366',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              flex: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#20BA5A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#25D366'
            }}
          >
            <MessageCircle size={18} />
            Send to WhatsApp
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: '#6B7280',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Invoice Content */}
        <div style={{
          padding: '3rem',
          '@media print': {
            padding: '2rem'
          }
        }}>
          {/* Invoice Header */}
          <div style={{
            textAlign: 'center',
            borderBottom: '3px solid #FF2E36',
            paddingBottom: '2rem',
            marginBottom: '3rem'
          }}>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#FF2E36',
              margin: 0,
              marginBottom: '0.5rem',
              letterSpacing: '1px'
            }}>
              Art Of Frames
            </h1>
            <p style={{
              fontSize: '1rem',
              color: '#9CA3AF',
              margin: 0,
              fontWeight: 500
            }}>
              Professional Frame Solutions
            </p>
          </div>

          {/* Invoice Info & Customer Details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            marginBottom: '3rem',
            '@media print': {
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem'
            }
          }}>
            {/* Invoice Details */}
            <div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#F9FAFB',
                margin: 0,
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '2px solid #374151'
              }}>
                INVOICE
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Invoice #:</span>
                  <span style={{ fontWeight: 600, color: '#F9FAFB' }}>#{safeOrder.id}</span>
                </div>
                {safeOrder.createdDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Created:</span>
                    <span style={{ fontWeight: 500, color: '#D1D5DB' }}>{safeOrder.createdDate}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Date:</span>
                  <span style={{ fontWeight: 500, color: '#D1D5DB' }}>{safeOrder.orderDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Status:</span>
                  <select
                    value={safeOrder.status}
                    onChange={(e) => handleStatusChange('status', e.target.value)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      backgroundColor: safeOrder.status === 'Dispatched' ? '#065F46' :
                        safeOrder.status === 'New Order' ? '#1E40AF' :
                          safeOrder.status === 'Packed' ? '#92400E' : '#991B1B',
                      color: safeOrder.status === 'Dispatched' ? '#D1FAE5' :
                        safeOrder.status === 'New Order' ? '#DBEAFE' :
                          safeOrder.status === 'Packed' ? '#FEF3C7' : '#FEE2E2',
                      border: 'none',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="New Order">New Order</option>
                    <option value="Pending">Pending</option>
                    <option value="Packed">Packed</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                {safeOrder.status === 'Dispatched' && safeOrder.dispatchDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Dispatched:</span>
                    <span style={{ fontWeight: 500, color: '#D1D5DB' }}>{safeOrder.dispatchDate}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Payment Status:</span>
                  <select
                    value={safeOrder.paymentStatus}
                    onChange={(e) => handleStatusChange('paymentStatus', e.target.value)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      backgroundColor: safeOrder.paymentStatus === 'Paid' ? '#065F46' : '#991B1B',
                      color: safeOrder.paymentStatus === 'Paid' ? '#D1FAE5' : '#FEE2E2',
                      border: 'none',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                {safeOrder.trackingNumber && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9CA3AF', fontWeight: 500 }}>Tracking:</span>
                    <span style={{ fontWeight: 600, color: '#F9FAFB' }}>{safeOrder.trackingNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#F9FAFB',
                margin: 0,
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '2px solid #374151'
              }}>
                BILL TO
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '1.125rem', color: '#F9FAFB', marginBottom: '0.5rem' }}>
                  {safeOrder.customerName}
                </div>
                {safeOrder.address && (
                  <div style={{ color: '#D1D5DB', lineHeight: '1.6' }}>
                    {safeOrder.address}
                  </div>
                )}
                {safeOrder.nearestCity && (
                  <div style={{ color: '#D1D5DB' }}>
                    Nearest City: {safeOrder.nearestCity}
                  </div>
                )}
                {safeOrder.district && (
                  <div style={{ color: '#D1D5DB' }}>
                    District: {safeOrder.district}
                  </div>
                )}
                {safeOrder.whatsapp && (
                  <div style={{ color: '#D1D5DB' }}>
                    WhatsApp: {formatWhatsAppNumber(safeOrder.whatsapp)}
                  </div>
                )}
                {safeOrder.phone && (
                  <div style={{ color: '#D1D5DB' }}>
                    Phone: {safeOrder.phone}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '2rem'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#111827',
                borderBottom: '2px solid #374151'
              }}>
                <th style={{
                  padding: '1rem',
                  textAlign: 'left',
                  fontWeight: 700,
                  color: '#F9FAFB',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Description
                </th>
                <th style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: '#F9FAFB',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Qty
                </th>
                <th style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#F9FAFB',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Unit Price
                </th>
                <th style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#F9FAFB',
                  fontSize: '0.875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((it, idx) => {
                const catName = getCategoryName(it.categoryId)
                const itName = getItemName(it.categoryId, it.itemId, it.customItemName)
                const qty = Number(it.quantity) || 0
                const price = Number(it.unitPrice) || 0
                const amount = qty * price
                const notes = (it.notes || '').toString().trim()
                return (
                  <tr key={`${idx}-${it.itemId || it.customItemName || 'item'}`} style={{ borderBottom: '1px solid #374151' }}>
                    <td style={{
                      padding: '1.25rem 1rem',
                      fontWeight: 600,
                      color: '#F9FAFB',
                      fontSize: '1rem'
                    }}>
                      {catName} - {itName}
                      {notes && (
                        <div style={{ marginTop: '0.35rem', color: '#9CA3AF', fontWeight: 500, fontSize: '0.85rem' }}>
                          Notes: {notes}
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding: '1.25rem 1rem',
                      textAlign: 'center',
                      color: '#D1D5DB'
                    }}>
                      {qty}
                    </td>
                    <td style={{
                      padding: '1.25rem 1rem',
                      textAlign: 'right',
                      color: '#D1D5DB'
                    }}>
                      Rs. {price.toFixed(2)}
                    </td>
                    <td style={{
                      padding: '1.25rem 1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#F9FAFB'
                    }}>
                      Rs. {amount.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totals Section */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '2rem'
          }}>
            <div style={{
              width: '300px',
              borderTop: '2px solid #374151',
              paddingTop: '1rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                color: '#D1D5DB'
              }}>
                <span>Subtotal:</span>
                <span style={{ fontWeight: 500, color: '#F9FAFB' }}>Rs. {totalPrice.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  color: '#10B981'
                }}>
                  <span>Discount ({discountType === '%' ? discount + '%' : 'Rs. ' + discount.toFixed(2)}):</span>
                  <span style={{ fontWeight: 500 }}>- Rs. {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                color: '#D1D5DB'
              }}>
                <span>Delivery Charge:</span>
                <span style={{ fontWeight: 500, color: '#F9FAFB' }}>Rs. {deliveryCharge.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1rem 0',
                marginTop: '0.5rem',
                borderTop: '2px solid #FF2E36',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#FF2E36'
              }}>
                <span>Total (COD):</span>
                <span>Rs. {codAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {safeOrder.notes && (
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: '#111827',
              borderRadius: '8px',
              borderLeft: '4px solid #FF2E36'
            }}>
              <h4 style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#F9FAFB',
                margin: 0,
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Notes
              </h4>
              <p style={{
                color: '#D1D5DB',
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                {safeOrder.notes}
              </p>
            </div>
          )}

          {/* Footer */}
          <div style={{
            marginTop: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid #374151',
            textAlign: 'center',
            color: '#9CA3AF',
            fontSize: '0.875rem'
          }}>
            <p style={{ margin: 0, marginBottom: '0.5rem' }}>
              Thank you for your business!
            </p>
            <p style={{ margin: 0, fontWeight: 500 }}>
              Art Of Frames Management System
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .modal-overlay {
            background: white !important;
            padding: 0 !important;
          }
          .modal-content {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            max-width: 100% !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          /* Print in light mode for better printing */
          .modal-content * {
            color: #1F2937 !important;
            background: white !important;
          }
          .modal-content th {
            background: #F9FAFB !important;
            color: #1F2937 !important;
          }
          .modal-content tr {
            border-color: #E5E7EB !important;
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
  )
}

export default ViewOrderModal
