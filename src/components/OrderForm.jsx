import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Plus, Trash2, Paperclip, Image as ImageIcon, Loader, RefreshCw } from 'lucide-react'
import { calculateNextOrderNumber, markTrackingNumberAsUsed, getProducts, getOrders, getOrderSources } from '../utils/storage'
import { uploadOrderItemImage, deleteOrderItemImage } from '../utils/fileStorage'
import { formatWhatsAppForStorage } from '../utils/whatsapp'
import TrackingNumberInput from './TrackingNumberInput'

// Sri Lankan Districts
const SRI_LANKAN_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
  'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
  'Matale', 'Matara', 'Moneragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const OrderForm = ({ order, onClose, onSave }) => {
  const [products, setProducts] = useState({ categories: [] })
  const [orderSources, setOrderSources] = useState([])
  const [codManuallyEdited, setCodManuallyEdited] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [discountType, setDiscountType] = useState(order?.discountType || 'Rs')
  const [orderItems, setOrderItems] = useState(() => {
    if (Array.isArray(order?.orderItems) && order.orderItems.length > 0) {
      return order.orderItems.map(it => ({
        id: it.id || (Date.now().toString() + Math.random().toString(36).slice(2, 7)),
        categoryId: it.categoryId || '',
        itemId: it.itemId || '',
        customItemName: it.customItemName || '',
        name: it.name || it.itemName || it.customItemName || '',
        quantity: it.quantity ?? 1,
        unitPrice: it.unitPrice ?? 0,
        notes: it.notes || '',
        image: it.image || null
      }))
    }
    return [{
      id: Date.now().toString(),
      categoryId: order?.categoryId || '',
      itemId: order?.itemId || '',
      customItemName: order?.customItemName || '',
      name: order?.name || order?.customItemName || '',
      quantity: order?.quantity ?? 1,
      unitPrice: order?.unitPrice ?? 0,
      notes: '',
      image: null
    }]
  })

  const getCategoryById = (categoryId) => products.categories.find(cat => cat.id === categoryId)
  const isCustomCategory = (categoryId) => {
    if (!categoryId) return false
    const category = getCategoryById(categoryId)
    return category?.name?.toLowerCase() === 'custom'
  }

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

  // Load products and get order number
  useEffect(() => {
    const loadData = async () => {
      const productsData = await getProducts()
      setProducts(productsData)

      const sourcesData = await getOrderSources()
      setOrderSources(Array.isArray(sourcesData) ? sourcesData : [])

      // Get order number if creating new order (calculate based on last saved order)
      if (!order?.id) {
        const ordersData = await getOrders()
        // Calculate next number based on last saved order
        const nextOrderNumber = calculateNextOrderNumber(ordersData)
        setOrderNumber(nextOrderNumber)
      } else {
        setOrderNumber(order.id)
      }

    }
    loadData()
  }, [])

  // Refresh sources in real-time when settings change
  useEffect(() => {
    const handler = async () => {
      const sourcesData = await getOrderSources()
      setOrderSources(Array.isArray(sourcesData) ? sourcesData : [])
    }
    window.addEventListener('orderSourcesUpdated', handler)
    return () => window.removeEventListener('orderSourcesUpdated', handler)
  }, [])

  const deliveryChargeDefault = 400

  const today = new Date().toISOString().split('T')[0]
  const [orderNumber, setOrderNumber] = useState(order?.id || '')

  const [formData, setFormData] = useState({
    customerName: order?.customerName || '',
    address: order?.address || '',
    phone: order?.phone || '',
    whatsapp: order?.whatsapp || '',
    nearestCity: order?.nearestCity || '',
    district: order?.district || '',
    // legacy fields are derived from orderItems on submit
    totalPrice: order?.totalPrice || 0,
    discount: order?.discount || 0,
    codAmount: order?.codAmount || 0,
    deliveryCharge: order?.deliveryCharge ?? deliveryChargeDefault,
    notes: order?.notes || '',
    status: order?.status || 'New Order',
    paymentStatus: order?.paymentStatus || 'Pending',
    dispatchDate: order?.dispatchDate || '',
    trackingNumber: order?.trackingNumber || '',
    orderDate: order?.orderDate || today,
    deliveryDate: order?.deliveryDate || '',
    orderSource: order?.orderSource || 'Ad' // Default to 'Ad'
  })

  const subtotal = useMemo(() => {
    return (orderItems || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
  }, [orderItems])

  const discountAmount = useMemo(() => {
    let discountAmount = 0
    if (discountType === '%') {
      discountAmount = (subtotal * (Number(formData.discount) || 0)) / 100
    } else {
      discountAmount = Number(formData.discount) || 0
    }
    return Math.max(0, discountAmount)
  }, [discountType, subtotal, formData.discount])

  const computedTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount)
  }, [subtotal, discountAmount])

  // --- Image Upload Logic ---
  const fileInputRef = useRef(null)
  const [activeItemForUpload, setActiveItemForUpload] = useState(null)
  const [uploadingItemIds, setUploadingItemIds] = useState(new Set())

  const handleUploadClick = (itemId) => {
    setActiveItemForUpload(itemId)
    if (fileInputRef.current) {
      fileInputRef.current.value = '' // Reset
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeItemForUpload) return

    // Mark item as uploading
    setUploadingItemIds(prev => new Set(prev).add(activeItemForUpload))

    try {
      // Use current order ID or a temp one if new
      const oid = orderNumber || 'temp_' + Date.now()
      const url = await uploadOrderItemImage(file, oid, activeItemForUpload)

      if (url) {
        updateItem(activeItemForUpload, { image: url })
      } else {
        alert("Failed to upload image. Please check your internet or try again.")
      }
    } catch (err) {
      console.error(err)
      alert("Error uploading image")
    } finally {
      setUploadingItemIds(prev => {
        const next = new Set(prev)
        next.delete(activeItemForUpload)
        return next
      })
      setActiveItemForUpload(null)
    }
  }

  const handleRemoveImage = async (itemId, imageUrl) => {
    if (!confirm("Are you sure you want to remove this image?")) return

    // Optimistic update
    updateItem(itemId, { image: null })

    // Background delete
    await deleteOrderItemImage(imageUrl)
  }
  // --------------------------

  const computedCod = useMemo(() => {
    const delivery = Number(formData.deliveryCharge) || 0
    return Math.max(0, computedTotal + delivery)
  }, [computedTotal, formData.deliveryCharge])

  useEffect(() => {
    // keep total/cod in sync unless user manually edited COD
    setFormData(prev => ({
      ...prev,
      totalPrice: computedTotal,
      codAmount: codManuallyEdited ? prev.codAmount : computedCod
    }))
  }, [computedTotal, computedCod, codManuallyEdited])

  const handleChange = (e) => {
    const { name, value } = e.target
    let updatedData = { ...formData, [name]: value }

    // Handle discount type change
    if (name === 'discountType') {
      setDiscountType(value)
    }

    // Handle numeric fields
    if (name === 'discount' || name === 'deliveryCharge') {
      updatedData[name] = parseFloat(value) || 0
    }

    // Handle COD amount (manual override)
    if (name === 'codAmount') {
      updatedData.codAmount = parseFloat(value) || 0
      setCodManuallyEdited(true)
    }

    setFormData(updatedData)
  }

  const updateItem = (id, patch) => {
    setOrderItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
    setCodManuallyEdited(false)
  }

  const addMoreItem = () => {
    setOrderItems(prev => ([
      ...prev,
      { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), categoryId: '', itemId: '', customItemName: '', quantity: 1, unitPrice: 0, notes: '' }
    ]))
    setCodManuallyEdited(false)
  }

  const removeItem = async (id) => {
    const itemToRemove = orderItems.find(it => it.id === id)

    if (itemToRemove?.image) {
      if (confirm('This item has an attached image. Removing the item will permanently delete the image. Continue?')) {
        await deleteOrderItemImage(itemToRemove.image)
        setOrderItems(prev => {
          const next = prev.filter(it => it.id !== id)
          return next.length ? next : prev
        })
        setCodManuallyEdited(false)
      }
    } else {
      setOrderItems(prev => {
        const next = prev.filter(it => it.id !== id)
        return next.length ? next : prev
      })
      setCodManuallyEdited(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    try {
      // Use the order number from the form (user can edit it)
      // If creating new order and number is empty, calculate next number
      let finalOrderNumber = orderNumber
      if (!order?.id && !finalOrderNumber) {
        const ordersData = await getOrders()
        finalOrderNumber = calculateNextOrderNumber(ordersData)
      }

      const cleanedItems = (orderItems || []).map(it => ({
        categoryId: it.categoryId || null,
        itemId: isCustomCategory(it.categoryId) ? null : (it.itemId || null),
        customItemName: isCustomCategory(it.categoryId) ? (it.customItemName || '') : null,
        name: it.name || it.customItemName || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        notes: (it.notes || '').toString(),
        image: it.image || null
      }))

      const first = cleanedItems[0] || {}

      const orderData = {
        ...formData,
        whatsapp: formatWhatsAppForStorage(formData.whatsapp),
        id: finalOrderNumber,
        // legacy single-item fields for compatibility
        categoryId: first.categoryId || null,
        itemId: first.itemId || null,
        customItemName: first.customItemName || null,
        quantity: first.quantity || 1,
        unitPrice: first.unitPrice || 0,
        // new multi-item fields
        orderItems: cleanedItems,
        deliveryCharge: Number(formData.deliveryCharge) || 0,
        discountType: discountType,
        totalPrice: computedTotal,
        totalAmount: computedTotal,
        codAmount: formData.codAmount,
        deliveryDate: formData.deliveryDate || '',
        createdDate: order?.createdDate || today
      }

      // 1. Save the order first
      const success = await onSave(orderData)

      if (success) {
        // 2. ONLY if save was successful, mark tracking number as used
        if (orderData.trackingNumber && (!order || order.trackingNumber !== orderData.trackingNumber)) {
          try {
            await markTrackingNumberAsUsed(orderData.trackingNumber)
          } catch (error) {
            console.error('Error marking tracking number as used:', error)
            // We don't block the whole process if this small metadata update fails, 
            // but the order is already safe.
          }
        }
        onClose()
      }
    } catch (error) {
      console.error('Submit Error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {order ? 'Edit Order' : 'Add New Order'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Order Number and Date */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Order Number</label>
              <input
                type="text"
                name="orderNumber"
                className="form-input"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Auto-filled with next number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                type="date"
                name="orderDate"
                className="form-input"
                value={formData.orderDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
            <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Customer Details</h3>

            {/* Customer Name */}
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input
                type="text"
                name="customerName"
                className="form-input"
                value={formData.customerName}
                onChange={handleChange}
                required
              />
            </div>

            {/* Address */}
            <div className="form-group">
              <label className="form-label">Address *</label>
              <textarea
                name="address"
                className="form-input"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                required
              />
            </div>

            {/* WhatsApp Number and Phone Number */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">WhatsApp Number *</label>
                <input
                  type="tel"
                  name="whatsapp"
                  className="form-input"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  onBlur={() => {
                    if (formData.whatsapp) {
                      setFormData(prev => ({ ...prev, whatsapp: formatWhatsAppForStorage(prev.whatsapp) }))
                    }
                  }}
                  placeholder="e.g., 0771234567"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Nearest City and District */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nearest City</label>
                <input
                  type="text"
                  name="nearestCity"
                  className="form-input"
                  value={formData.nearestCity}
                  onChange={handleChange}
                  placeholder="e.g., Colombo"
                />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <select
                  name="district"
                  className="form-input"
                  value={formData.district}
                  onChange={handleChange}
                >
                  <option value="">Select District</option>
                  {SRI_LANKAN_DISTRICTS.map(district => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
            <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Order Details</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Delivery Date</label>
                <input
                  type="date"
                  name="deliveryDate"
                  className="form-input"
                  value={formData.deliveryDate}
                  onChange={handleChange}
                  min={today}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  If set to a future date, this order will be counted as a scheduled delivery.
                </small>
              </div>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Items</div>
            </div>

            {orderItems.map((it, idx) => {
              const cat = getCategoryById(it.categoryId)
              const items = cat?.items || []
              const custom = isCustomCategory(it.categoryId)
              return (
                <div key={it.id} className="card" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Item #{idx + 1}</div>
                    {orderItems.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(it.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Trash2 size={16} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Category *</label>
                      <select
                        className="form-input"
                        value={it.categoryId}
                        onChange={(e) => updateItem(it.id, { categoryId: e.target.value, itemId: '', customItemName: '', unitPrice: 0 })}
                        required
                      >
                        <option value="">Select category</option>
                        {products.categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{custom ? 'Custom Product *' : 'Product *'}</label>
                      {custom ? (
                        <input
                          className="form-input"
                          value={it.customItemName}
                          onChange={(e) => updateItem(it.id, { customItemName: e.target.value, name: e.target.value })}
                          placeholder="Enter custom product name"
                          required
                        />
                      ) : (
                        <select
                          className="form-input"
                          value={it.itemId}
                          onChange={(e) => {
                            const itemObj = items.find(x => x.id === e.target.value)
                            updateItem(it.id, { itemId: e.target.value, unitPrice: itemObj?.price ?? 0, name: itemObj?.name || '' })
                          }}
                          required
                          disabled={!it.categoryId}
                        >
                          <option value="">Select product</option>
                          {items.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Quantity *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="1"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={it.unitPrice}
                        onChange={(e) => updateItem(it.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-input"
                      value={it.notes || ''}
                      onChange={(e) => updateItem(it.id, { notes: e.target.value })}
                      rows="2"
                      placeholder="Item-specific instructions (e.g., engraving text, packaging notes)"
                    />
                  </div>

                  {/* Image Upload UI */}
                  <div className="form-group" style={{ marginTop: '0.75rem' }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                      Image Reference
                    </label>

                    {it.image ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                        <a href={it.image} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                          <img
                            src={it.image}
                            alt="Item"
                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.5)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                          />
                        </a>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attached</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUploadClick(it.id)}
                            title="Replace Image"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRemoveImage(it.id, it.image)}
                            title="Remove Image"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleUploadClick(it.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          disabled={uploadingItemIds.has(it.id)}
                        >
                          {uploadingItemIds.has(it.id) ? <Loader size={16} className="spin" /> : <Paperclip size={16} />}
                          {uploadingItemIds.has(it.id) ? 'Uploading...' : 'Attach Image'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addMoreItem}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Plus size={16} /> Add More
              </button>
            </div>

            {/* Totals */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subtotal</label>
                <input className="form-input" value={subtotal.toFixed(2)} readOnly style={{ backgroundColor: 'var(--bg-card)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Discount</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select name="discountType" className="form-input" value={discountType} onChange={handleChange} style={{ width: '110px' }}>
                    <option value="Rs">Rs</option>
                    <option value="%">%</option>
                  </select>
                  <input
                    type="number"
                    name="discount"
                    className="form-input"
                    value={formData.discount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Total Price</label>
                <input className="form-input" value={computedTotal.toFixed(2)} readOnly style={{ backgroundColor: 'var(--bg-card)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Charge</label>
                <input
                  type="number"
                  name="deliveryCharge"
                  className="form-input"
                  value={formData.deliveryCharge}
                  onChange={handleChange}
                  min="0"
                  step="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">COD Amount</label>
              <input
                type="number"
                name="codAmount"
                className="form-input"
                value={formData.codAmount}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Auto-calculated as Total + Delivery. You can edit manually if needed.
              </small>
            </div>
          </div>

          {/* Order Details */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-input"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Special instructions or notes..."
            />
          </div>

          {/* Status */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status *</label>
              <select
                name="status"
                className="form-input"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="New Order">New Order</option>
                <option value="Packed">Packed</option>
                <option value="Dispatched">Dispatched</option>
                <option value="returned">Returned</option>
                <option value="refund">Refund</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Status *</label>
              <select
                name="paymentStatus"
                className="form-input"
                value={formData.paymentStatus}
                onChange={handleChange}
                required
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {(formData.status === 'Packed' || formData.status === 'Dispatched') && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Dispatch Date</label>
                <input
                  type="date"
                  name="dispatchDate"
                  className="form-input"
                  value={formData.dispatchDate}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tracking Number</label>
                <TrackingNumberInput
                  value={formData.trackingNumber}
                  onChange={handleChange}
                  required={formData.status === 'Dispatched'}
                />
              </div>
            </div>
          )}

          {/* Order Source - Stored internally, not displayed in reports/views */}
          <div className="form-group">
            <label className="form-label">Order Source</label>
            <select
              name="orderSource"
              className="form-input"
              value={formData.orderSource}
              onChange={handleChange}
            >
              {(orderSources.length > 0 ? orderSources : [{ id: 'Ad', name: 'Ad' }, { id: 'Organic', name: 'Organic' }]).map(src => (
                <option key={src.id} value={src.name}>{src.name}</option>
              ))}
            </select>
          </div>



          {/* Hidden File Input for Item Images */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="image/*"
          />

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw size={18} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                  Saving...
                </>
              ) : (
                order ? 'Update Order' : 'Create Order'
              )}
            </button>
          </div>
        </form>
      </div >
    </div >
  )
}

export default OrderForm
