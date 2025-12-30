import { useState, useEffect } from 'react'
import { X, Download, MessageCircle } from 'lucide-react'
import { getProducts, getSettings } from '../utils/storage'
import { formatWhatsAppNumber, generateWhatsAppMessage } from '../utils/whatsapp'
import { useToast } from './Toast/ToastContext'

const ViewQuotationModal = ({ quotation, onClose }) => {
  const { addToast } = useToast()
  const [products, setProducts] = useState({ categories: [] })
  const [settings, setSettings] = useState(null)

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

  if (!quotation) return null

  // Helper to safely extract name string
  const getSafeName = (val) => {
    if (!val) return null
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val.name) return val.name
    return String(val)
  }

  // Get values
  const orderItems = Array.isArray(quotation.orderItems) && quotation.orderItems.length > 0
    ? quotation.orderItems
    : []

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

  const deliveryCharge = Number(quotation.deliveryCharge ?? 0) || 0
  const totalPrice = (quotation.totalPrice || 0) || subtotal
  const discountType = quotation.discountType || 'Rs'
  const discount = quotation.discount || quotation.discountValue || 0

  // Calculate discount amount
  let discountAmount = 0
  if (discountType === '%') {
    discountAmount = (subtotal * discount) / 100
  } else {
    discountAmount = discount || 0
  }

  const finalPrice = Math.max(0, subtotal - discountAmount)
  const advancePayment = Number(quotation.advancePayment) || 0
  const balance = Math.max(0, finalPrice + deliveryCharge - advancePayment)

  const safeQuotation = {
    id: quotation.id || 'N/A',
    customerName: quotation.customerName || 'N/A',
    address: quotation.address || '',
    phone: quotation.phone || '',
    whatsapp: quotation.whatsapp || '',
    status: quotation.status || 'Draft',
    createdDate: quotation.createdDate || new Date().toISOString().split('T')[0],
    notes: quotation.notes || ''
  }

  const handleDownloadInvoice = () => {
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

    const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Quotation #${escapeHtml(safeQuotation.id)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; color: #333; font-size: 14px; line-height: 1.5; -webkit-print-color-adjust: exact; }
    @media print { body { margin: 0; } @page { margin: 1cm; size: A4; } .no-print { display: none; } }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid #FF2E36; padding-bottom: 20px; }
    .brand-section { display: flex; align-items: center; gap: 15px; }
    .logo svg { width: 90px; height: 90px; }
    .company-info h1 { margin: 0; font-size: 24px; font-weight: 700; color: #FF2E36; text-transform: uppercase; letter-spacing: 0.5px; }
    .company-info .tagline { margin: 2px 0 0; font-size: 14px; color: #666; font-weight: 500; letter-spacing: 1px; }
    .contact-info { text-align: right; font-size: 13px; color: #555; }
    .contact-info p { margin: 2px 0; }
    .contact-info strong { color: #333; }
    .info-grid { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 40px; }
    .info-column { flex: 1; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #999; margin-bottom: 10px; letter-spacing: 0.5px; }
    .details-table { width: 100%; border-collapse: collapse; }
    .details-table td { padding: 3px 0; vertical-align: top; }
    .label-col { width: 100px; color: #666; font-weight: 500; }
    .sep-col { width: 15px; color: #999; text-align: center; }
    .value-col { font-weight: 600; color: #333; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background-color: #f9f9f9; color: #666; font-weight: 600; text-transform: uppercase; font-size: 12px; padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
    .items-table td { padding: 12px 15px; border-bottom: 1px solid #eee; color: #333; }
    .items-table tr:last-child td { border-bottom: 1px solid #FF2E36; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals-container { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .totals-box { width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .total-row.final { border-top: 2px solid #eee; margin-top: 10px; padding-top: 10px; font-size: 16px; font-weight: 700; color: #FF2E36; }
    .total-label { color: #666; }
    .total-value { font-weight: 600; }
    .footer { text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px; }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-section">
        <div class="logo">
          <!-- SVG Logo same as order modal -->
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
            <style type="text/css">.st0{fill:#FF2E36;}.st1{fill:#000000;}</style>
            <g><g><path class="st0" d="M437.25,161l22.29,22.29h66.21v66.2l22.29,22.29V161H437.25z M525.75,450.78v66.19h-66.2l-22.29,22.29h110.77V428.49L525.75,450.78z M192.07,516.97v-66.19l-22.29-22.29v110.77h110.77l-22.29-22.29H192.07z M169.78,161v110.77l22.29-22.29v-66.2h66.21L280.57,161H169.78z"/></g><g><g><path class="st1" d="M121.9,302.47h47.3v17.69h-29.29v17.3h29.29v17.43h-29.29v42.9H121.9V302.47z"/><path class="st1" d="M186.57,302.47h19.22c10.53,0,18.03,0.94,22.49,2.82s8.06,5,10.78,9.36c2.72,4.36,4.08,9.53,4.08,15.49c0,6.26-1.5,11.5-4.5,15.71c-3,4.21-7.53,7.4-13.57,9.56l22.58,42.38h-19.83l-21.43-40.37h-1.66v40.37h-18.14V302.47z M204.72,339.73h5.69c5.77,0,9.74-0.76,11.92-2.28c2.17-1.52,3.26-4.03,3.26-7.54c0-2.08-0.54-3.89-1.62-5.43c-1.08-1.54-2.52-2.64-4.33-3.32c-1.81-0.67-5.12-1.01-9.95-1.01h-4.97V339.73z"/><path class="st1" d="M291.4,302.47h18.4l36.66,95.32h-18.86l-7.46-19.63h-38.89l-7.75,19.63h-18.86L291.4,302.47z M300.72,327.74l-12.79,32.72h25.5L300.72,327.74z"/><path class="st1" d="M369.74,302.47h17.68l22.1,66.48l22.3-66.48h17.67l15.99,95.32h-17.54l-10.22-60.2l-20.25,60.2h-15.99l-20.07-60.2l-10.47,60.2h-17.69L369.74,302.47z"/><path class="st1" d="M479.99,302.47h52.03v17.76H498v17.24h34.02v17.43H498v25.08h34.02v17.82h-52.03V302.47z"/><path class="st1" d="M598.96,315.43l-13.44,11.86c-4.72-6.57-9.52-9.85-14.41-9.85c-2.38,0-4.33,0.64-5.84,1.91c-1.51,1.28-2.27,2.71-2.27,4.31c0,1.6,0.54,3.11,1.62,4.54c1.47,1.9,5.91,5.98,13.31,12.25c6.92,5.79,11.12,9.44,12.59,10.95c3.68,3.72,6.28,7.27,7.82,10.66c1.54,3.39,2.3,7.1,2.3,11.11c0,7.82-2.7,14.28-8.11,19.37c-5.41,5.1-12.46,7.65-21.15,7.65c-6.79,0-12.7-1.66-17.74-4.99s-9.35-8.55-12.94-15.68l15.25-9.2c4.59,8.43,9.87,12.64,15.84,12.64c3.11,0,5.73-0.91,7.85-2.72c2.12-1.81,3.18-3.91,3.18-6.28c0-2.16-0.8-4.32-2.4-6.48c-1.6-2.16-5.13-5.46-10.58-9.91c-10.39-8.47-17.09-15-20.12-19.6c-3.03-4.6-4.54-9.19-4.54-13.77c0-6.61,2.52-12.28,7.56-17.01c5.04-4.73,11.26-7.1,18.65-7.1c4.76,0,9.29,1.1,13.59,3.3C589.28,305.58,593.94,309.6,598.96,315.43z"/></g><g><path class="st1" d="M245.27,217.2l28.9,61.98h-6.69l-9.75-20.39h-26.7l-9.66,20.39h-6.91l29.28-61.98H245.27z M244.49,230.37l-10.62,22.43h21.19L244.49,230.37z"/><path class="st1" d="M284.12,217.2h12.35c6.88,0,11.54,0.28,13.99,0.84c3.68,0.84,6.67,2.65,8.97,5.42c2.3,2.77,3.45,6.18,3.45,10.23c0,3.38-0.79,6.34-2.38,8.9s-3.86,4.49-6.8,5.8c-2.95,1.31-7.02,1.98-12.22,2l22.29,28.78h-7.66l-22.29-28.78h-3.5v28.78h-6.19V217.2z M290.31,223.27v21.07l10.68,0.08c4.14,0,7.2-0.39,9.18-1.18c1.98-0.79,3.53-2.04,4.64-3.77c1.11-1.73,1.67-3.66,1.67-5.79c0-2.08-0.56-3.97-1.69-5.67c-1.13-1.7-2.6-2.91-4.43-3.64c-1.83-0.73-4.87-1.1-9.12-1.1H290.31z"/><path class="st1" d="M330.51,223.27v-6.07h33.96v6.07h-13.82v55.91h-6.32v-55.91H330.51z"/><path class="st1" d="M426.81,215.64c9.39,0,17.24,3.13,23.57,9.4c6.32,6.26,9.49,13.97,9.49,23.13c0,9.07-3.16,16.77-9.47,23.09s-14,9.48-23.08,9.48c-9.19,0-16.95-3.15-23.27-9.44c-6.32-6.29-9.49-13.9-9.49-22.84c0-5.95,1.44-11.47,4.32-16.56c2.88-5.08,6.81-9.07,11.78-11.95C415.63,217.08,421.02,215.64,426.81,215.64z M427.08,221.66c-4.59,0-8.93,1.2-13.04,3.58c-4.11,2.39-7.32,5.61-9.62,9.66c-2.31,4.05-3.46,8.56-3.46,13.54c0,7.37,2.55,13.59,7.66,18.66c5.11,5.07,11.26,7.1,18.65-7.61c4.81,0,9.26-1.17,13.36-3.5c4.09-2.33,7.29-5.52,9.58-9.57c2.29-4.05,3.44-8.55,3.44-13.49c0-4.92-1.15-9.37-3.44-13.35s-5.52-7.16-9.68-9.55C436.17,222.86,431.75,221.66,427.08,221.66z"/><path class="st1" d="M472.29,217.2h31.05v6.07h-24.86v19.42h24.86v6.07h-24.86v30.42h-6.19V217.2z"/></g></g><path class="st0" d="M405.64,422.57c22.15,0,43.63,16.02,43.63,51.88c0,58.77-90.35,107.57-90.35,107.57s-90.35-48.8-90.35-107.57c0-35.87,21.47-51.89,43.63-51.88c20.45,0,41.48,13.65,46.73,37.94C364.15,436.22,385.18,422.57,405.64,422.57"/></g></svg>
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
      <h2 style="margin: 0; font-size: 24px; letter-spacing: 4px; color: #333; font-weight: 700;">QUOTATION</h2>
    </div>
    <div class="info-grid">
      <div class="info-column">
        <div class="section-title">Quotation For</div>
        <table class="details-table">
          <tr><td class="label-col">Name</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeQuotation.customerName)}</td></tr>
          <tr><td class="label-col">Address</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeQuotation.address || 'N/A')}</td></tr>
          ${safeQuotation.phone ? `<tr><td class="label-col">Phone</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeQuotation.phone)}</td></tr>` : ''}
        </table>
      </div>
      <div class="info-column">
        <div class="section-title">Quotation Details</div>
        <table class="details-table">
          <tr><td class="label-col">Quotation No.</td><td class="sep-col">:</td><td class="value-col">#${escapeHtml(safeQuotation.id)}</td></tr>
          <tr><td class="label-col">Date</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeQuotation.createdDate)}</td></tr>
          <tr><td class="label-col">Status</td><td class="sep-col">:</td><td class="value-col">${escapeHtml(safeQuotation.status)}</td></tr>
        </table>
      </div>
    </div>
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
    <div class="totals-container">
      <div class="totals-box">
        <div class="total-row">
          <span class="total-label">Subtotal</span>
          <span class="total-value">Rs. ${subtotal.toFixed(2)}</span>
        </div>
        ${discountAmount > 0 ? `
        <div class="total-row">
          <span class="total-label">Discount ${discountType === '%' ? `(${discount}%)` : ''}</span>
          <span class="total-value" style="color: #FF2E36;">- Rs. ${discountAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row">
          <span class="total-label">Delivery Charge</span>
          <span class="total-value">Rs. ${deliveryCharge.toFixed(2)}</span>
        </div>
        <div class="total-row final">
          <span>Total Estimate</span>
          <span>Rs. ${(finalPrice + deliveryCharge).toFixed(2)}</span>
        </div>
      </div>
    </div>
    ${safeQuotation.notes ? `
    <div style="margin-top: 30px; font-size: 13px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
      <strong style="color: #666; font-size: 11px; text-transform: uppercase;">Notes</strong>
      <p style="margin: 5px 0 0;">${escapeHtml(safeQuotation.notes)}</p>
    </div>
    ` : ''}
    <div class="footer">
      <p>Thank you for your interest!</p>
      <p>Art Of Frames — Art that remembers</p>
    </div>
  </div>
</body>
</html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(invoiceHTML)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
      }, 500)
    } else {
      addToast('Popup blocked. Please allow popups.', 'error')
    }
  }

  const handleSendWhatsApp = () => {
    if (!safeQuotation.whatsapp) {
      addToast('No WhatsApp number available', 'warning')
      return
    }

    const formattedNumber = formatWhatsAppNumber(safeQuotation.whatsapp)
    if (!formattedNumber) {
      addToast('Invalid WhatsApp number', 'warning')
      return
    }

    const itemDetailsString = orderItems.map(it => {
      const cName = getCategoryName(it.categoryId)
      const iName = getItemName(it)
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      return `🔸 ${cName} - ${iName} (x${qty}): Rs. ${price.toLocaleString()}`
    }).join('\n')

    const context = {
      subtotal,
      discountAmount,
      deliveryCharge,
      finalPrice: finalPrice + deliveryCharge, // Note: finalPrice in component body excl delivery, so add it
      itemDetailsString
    }

    // Use template if available, otherwise default
    let message = ''
    if (settings?.whatsappTemplates?.quotation) {
      message = generateWhatsAppMessage(settings.whatsappTemplates.quotation, safeQuotation, context)
    } else {
      // Default fallback
      message = `*QUOTATION #${safeQuotation.id}*\n\nHi ${safeQuotation.customerName},\n\nHere is the quotation you requested.\n\n${itemDetailsString}\n\n----------------------------\n*Total Estimate: Rs. ${(finalPrice + deliveryCharge).toFixed(2)}*\n----------------------------\n\nThank you for choosing Art Of Frames!\nLet us know if you would like to proceed with this order.`
    }

    const encodedMessage = encodeURIComponent(message)
    const numberForUrl = formattedNumber.replace('+', '')
    window.open(`https://wa.me/${numberForUrl}?text=${encodedMessage}`, '_blank')
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div>
            <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>Quotation #{safeQuotation.id}</h2>
            <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {safeQuotation.createdDate}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={handleDownloadInvoice} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} /> <span className="hidden-mobile">PDF</span>
            </button>
            <button onClick={handleSendWhatsApp} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#25D366', color: 'white' }}>
              <MessageCircle size={18} /> <span className="hidden-mobile">WhatsApp</span>
            </button>
            <button className="modal-close" onClick={onClose} style={{ marginLeft: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          {/* Visual Representation for Screen (Simplified) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Customer Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Name:</span> <strong>{safeQuotation.customerName}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Phone:</span> {safeQuotation.phone} / {safeQuotation.whatsapp}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Address:</span> {safeQuotation.address}</div>
              </div>
            </div>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span> <span>Rs. {subtotal.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Delivery:</span> <span>Rs. {deliveryCharge.toFixed(2)}</span></div>
                {discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}><span>Discount:</span> <span>- Rs. {discountAmount.toFixed(2)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  <span>Total:</span> <span>Rs. {(finalPrice + deliveryCharge).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Item</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div>{getCategoryName(it.categoryId)} - {getItemName(it)}</div>
                      {it.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{it.notes}</div>}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{it.quantity}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{(Number(it.unitPrice) || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ViewQuotationModal
