import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { getProducts, getQuotations, calculateNextQuotationNumber, getSettings } from '../utils/storage'

const QuotationForm = ({ quotation, onClose, onSave }) => {
    const [products, setProducts] = useState({ categories: [] })

    const [isSaving, setIsSaving] = useState(false)
    const [discountType, setDiscountType] = useState(quotation?.discountType || 'Rs')

    // Quotations ID generation
    const [quotationId, setQuotationId] = useState(quotation?.id || '')

    // Fetch next ID if new quotation
    useEffect(() => {
        if (!quotation) {
            getQuotations().then(qs => {
                const nextId = calculateNextQuotationNumber(qs)
                setQuotationId(nextId)
            })
        }
    }, [quotation])

    // Load Default Delivery Charge for new quotations
    useEffect(() => {
        if (!quotation) {
            getSettings().then(settings => {
                if (settings?.general?.defaultDeliveryCharge) {
                    setFormData(prev => ({ ...prev, deliveryCharge: settings.general.defaultDeliveryCharge }))
                }
            })
        }
    }, [quotation])

    const [orderItems, setOrderItems] = useState(() => {
        if (Array.isArray(quotation?.orderItems) && quotation.orderItems.length > 0) {
            return quotation.orderItems.map(it => ({
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
            categoryId: '',
            itemId: '',
            customItemName: '',
            name: '',
            quantity: 1,
            unitPrice: 0,
            notes: '',
            image: null
        }]
    })

    // Load products
    useEffect(() => {
        getProducts().then(setProducts)
    }, [])

    const getCategoryById = (categoryId) => products.categories.find(cat => cat.id === categoryId)
    const isCustomCategory = (categoryId) => {
        if (!categoryId) return false
        const category = getCategoryById(categoryId)
        return category?.name?.toLowerCase() === 'custom'
    }

    const [formData, setFormData] = useState({
        customerName: quotation?.customerName || '',
        address: quotation?.address || '',
        phone: quotation?.phone || '',
        whatsapp: quotation?.whatsapp || '',
        nearestCity: quotation?.nearestCity || '',
        district: quotation?.district || '',
        totalPrice: quotation?.totalPrice || 0,
        discount: quotation?.discount || 0,
        deliveryCharge: quotation?.deliveryCharge ?? 400,
        notes: quotation?.notes || '',
        status: quotation?.status || 'Draft',
        createdDate: quotation?.createdDate || new Date().toISOString().split('T')[0],
        advancePayment: quotation?.advancePayment || 0
    })

    const subtotal = useMemo(() => {
        return (orderItems || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
    }, [orderItems])

    const discountAmount = useMemo(() => {
        let amt = 0
        if (discountType === '%') {
            amt = (subtotal * (Number(formData.discount) || 0)) / 100
        } else {
            amt = Number(formData.discount) || 0
        }
        return Math.max(0, amt)
    }, [discountType, subtotal, formData.discount])

    const computedTotal = useMemo(() => {
        return Math.max(0, subtotal - discountAmount + (Number(formData.deliveryCharge) || 0))
    }, [subtotal, discountAmount, formData.deliveryCharge])

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            totalPrice: computedTotal
        }))
    }, [computedTotal])

    const handleChange = (e) => {
        const { name, value } = e.target
        let updatedData = { ...formData, [name]: value }

        if (name === 'discount' || name === 'deliveryCharge' || name === 'advancePayment') {
            updatedData[name] = parseFloat(value) || 0
        }

        setFormData(updatedData)
    }

    const updateItem = (id, patch) => {
        setOrderItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
    }

    const addMoreItem = () => {
        setOrderItems(prev => ([
            ...prev,
            { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), categoryId: '', itemId: '', customItemName: '', quantity: 1, unitPrice: 0, notes: '' }
        ]))
    }

    const removeItem = (id) => {
        setOrderItems(prev => {
            const next = prev.filter(it => it.id !== id)
            return next.length ? next : prev
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (isSaving) return

        setIsSaving(true)
        try {
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

            const finalData = {
                ...formData,
                id: quotationId,
                orderItems: cleanedItems,
                discountType,
                totalPrice: computedTotal
            }

            await onSave(finalData)
            onClose()
        } catch (error) {
            console.error(error)
            alert("Error saving quotation")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <h2 className="modal-title">{quotation ? 'Edit Quotation' : 'New Quotation'}</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Quotation ID</label>
                            <input className="form-input" value={quotationId} onChange={e => setQuotationId(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input type="date" className="form-input" name="createdDate" value={formData.createdDate} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
                        <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)' }}>Customer Details</h3>

                        <div className="form-group">
                            <label className="form-label">Customer Name *</label>
                            <input className="form-input" name="customerName" value={formData.customerName} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Address *</label>
                            <textarea className="form-input" name="address" value={formData.address} onChange={handleChange} rows={2} required />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">WhatsApp Number *</label>
                                <input className="form-input" name="whatsapp" value={formData.whatsapp} onChange={handleChange} placeholder="e.g., 0771234567" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="form-input" name="phone" value={formData.phone} onChange={handleChange} placeholder="Optional" />
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3>Items</h3>
                        </div>

                        {orderItems.map((it, idx) => {
                            const cat = getCategoryById(it.categoryId)
                            const items = cat?.items || []
                            const custom = isCustomCategory(it.categoryId)
                            return (
                                <div key={it.id} className="card" style={{ marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 600 }}>Item #{idx + 1}</span>
                                        {orderItems.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(it.id)}><Trash2 size={14} /></button>}
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Category</label>
                                            <select className="form-input" value={it.categoryId} onChange={e => updateItem(it.id, { categoryId: e.target.value, itemId: '', unitPrice: 0 })}>
                                                <option value="">Select</option>
                                                {products.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Item</label>
                                            {custom ? (
                                                <input className="form-input" value={it.customItemName} onChange={e => updateItem(it.id, { customItemName: e.target.value, name: e.target.value })} placeholder="Item Name" />
                                            ) : (
                                                <select className="form-input" value={it.itemId} onChange={e => {
                                                    const p = items.find(x => x.id === e.target.value)
                                                    updateItem(it.id, { itemId: e.target.value, unitPrice: p?.price ?? 0, name: p?.name || '' })
                                                }}>
                                                    <option value="">Select</option>
                                                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                        <div className="form-group">
                                            <label className="form-label">Qty</label>
                                            <input type="number" className="form-input" value={it.quantity} onChange={e => updateItem(it.id, { quantity: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">UnitPrice</label>
                                            <input type="number" className="form-input" value={it.unitPrice} onChange={e => updateItem(it.id, { unitPrice: e.target.value })} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Total</label>
                                            <input
                                                className="form-input"
                                                value={((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2)}
                                                readOnly
                                                style={{ backgroundColor: 'var(--bg-card)' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <input className="form-input" value={it.notes} onChange={e => updateItem(it.id, { notes: e.target.value })} placeholder="Notes..." />
                                    </div>
                                </div>
                            )
                        })}

                        <button type="button" className="btn btn-secondary" onClick={addMoreItem} style={{ width: '100%' }}>
                            <Plus size={16} /> Add Item
                        </button>
                    </div>

                    <div className="card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {/* Row 1: Subtotal and Discount */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Subtotal</label>
                                <input
                                    className="form-input"
                                    value={subtotal.toFixed(2)}
                                    readOnly
                                    style={{ backgroundColor: 'var(--bg-card)' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Discount</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <select
                                        className="form-input"
                                        style={{ width: '80px' }}
                                        value={discountType}
                                        onChange={e => setDiscountType(e.target.value)}
                                    >
                                        <option value="Rs">Rs</option>
                                        <option value="%">%</option>
                                    </select>
                                    <input
                                        type="number"
                                        className="form-input"
                                        name="discount"
                                        value={formData.discount}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Delivery Charge and Total Price (Swapped) */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Delivery Charge</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    name="deliveryCharge"
                                    value={formData.deliveryCharge}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Total Price</label>
                                <input
                                    className="form-input"
                                    value={computedTotal.toFixed(2)}
                                    readOnly
                                    style={{ backgroundColor: 'var(--bg-card)' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{ marginTop: '1rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Quotation'}</button>
                    </div>

                </form>
            </div>
        </div>
    )
}

export default QuotationForm
