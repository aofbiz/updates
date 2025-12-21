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

  const getItemName = (item) => {
    if (item.name || item.itemName) return item.name || item.itemName
    if (item.customItemName) return item.customItemName
    const c = products.categories.find(cat => cat.id === item.categoryId)
    const it = c?.items?.find(x => x.id === item.itemId)
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
    whatsapp: localOrder.whatsapp || '',
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

  // Calculate discount amount based on subtotal (base price before order-level discount)
  let discountAmount = 0
  if (discountType === '%') {
    discountAmount = (subtotal * discount) / 100
  } else {
    discountAmount = discount || 0
  }

  const finalPrice = Math.max(0, subtotal - discountAmount)
  const codAmount = localOrder.codAmount || Math.max(0, finalPrice + deliveryCharge)

  const handleDownloadInvoice = () => {
    const invoiceRows = orderItems.map(it => {
      const catName = getCategoryName(it.categoryId)
      const itName = getItemName(it)
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
            <p style={{ color: 'var(--text-muted)' }}>Professional Frame Solutions</p>
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

                {safeOrder.dispatchDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Dispatched Date:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{safeOrder.dispatchDate}</span>
                  </div>
                )}

                {safeOrder.trackingNumber && (
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Tracking Number</label>
                    <div style={{ fontWeight: 600, color: 'var(--accent-primary)', letterSpacing: '0.5px' }}>{safeOrder.trackingNumber}</div>
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
                  const itName = getItemName(it.categoryId, it.itemId, it.customItemName)
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
              const itName = getItemName(it.categoryId, it.itemId, it.customItemName)
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

          {/* Simple Footer (Screen Only) */}
          <div className="no-print" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <p>Viewing Order Details</p>
          </div>
        </div>
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
  )
}

export default ViewOrderModal
