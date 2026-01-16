import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { X, Plus, Trash2, ChevronLeft, ChevronRight, Check, AlertCircle, Paperclip } from 'lucide-react'
import CustomDropdown from './Common/CustomDropdown'
import CustomDatePicker from './Common/CustomDatePicker'
import FormValidation from './FormValidation'
import { getProducts, getQuotations, calculateNextQuotationNumber, getSettings, getTotalMonthlyRecordsCount } from '../utils/storage'
import { toTitleCase, toSentenceCase } from '../utils/textUtils'
import { useLicensing } from './LicensingContext'
import { useToast } from './Toast/ToastContext'

const QuotationForm = ({ quotation, onClose, onSave }) => {
    const { isFreeUser } = useLicensing()
    const { addToast } = useToast()
    const today = new Date().toISOString().split('T')[0]
    const [expiryDays, setExpiryDays] = useState(7)
    const defaultExpiry = (() => {
        const d = new Date()
        d.setDate(d.getDate() + expiryDays)
        return d.toISOString().split('T')[0]
    })()

    const [products, setProducts] = useState({ categories: [] })
    const [isSaving, setIsSaving] = useState(false)
    const [discountType, setDiscountType] = useState(quotation?.discountType || 'Rs')
    const [quotationId, setQuotationId] = useState(quotation?.id || '')
    const [validationErrors, setValidationErrors] = useState({})

    // Mobile Wizard State
    const [currentStep, setCurrentStep] = useState(1)
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

    const WIZARD_STEPS = [
        { id: 1, name: 'Customer', shortName: 'Customer' },
        { id: 2, name: 'Items', shortName: 'Items' },
        { id: 3, name: 'Pricing', shortName: 'Pricing' }
    ]

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    useEffect(() => {
        if (!quotation) {
            getQuotations().then(qs => {
                const nextId = calculateNextQuotationNumber(qs)
                setQuotationId(nextId)
            })
            getSettings().then(settings => {
                if (settings?.general?.defaultDeliveryCharge) {
                    setFormData(prev => ({ ...prev, deliveryCharge: settings.general.defaultDeliveryCharge }))
                }
                if (settings?.general?.quotationExpiryDays) {
                    const days = Number(settings.general.quotationExpiryDays)
                    setExpiryDays(days)
                    // Also update expiry if we just started
                    setFormData(prev => {
                        const d = new Date(prev.createdDate)
                        d.setDate(d.getDate() + days)
                        return { ...prev, expiryDate: d.toISOString().split('T')[0] }
                    })
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
                notes: it.notes || ''
            }))
        }
        return [{ id: Date.now().toString(), categoryId: '', itemId: '', customItemName: '', name: '', quantity: 1, unitPrice: 0, notes: '' }]
    })

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
        totalPrice: quotation?.totalPrice || 0,
        discount: quotation?.discount || 0,
        deliveryCharge: quotation?.deliveryCharge ?? 400,
        notes: quotation?.notes || '',
        status: quotation?.status || 'Active',
        createdDate: quotation?.createdDate || today,
        expiryDate: quotation?.expiryDate || defaultExpiry
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

    const handleChange = (e) => {
        const { name, value } = e.target
        let updatedData = { ...formData }

        if (name === 'customerName') {
            updatedData[name] = toTitleCase(value)
        } else if (name === 'address' || name === 'notes') {
            updatedData[name] = toSentenceCase(value)
        } else {
            updatedData[name] = value
        }

        if (['discount', 'deliveryCharge'].includes(name)) {
            updatedData[name] = parseFloat(value) || 0
        }
        setFormData(updatedData)
    }

    const updateItem = (id, patch) => {
        const formattedPatch = { ...patch }
        if (formattedPatch.customItemName !== undefined) {
            formattedPatch.customItemName = toTitleCase(formattedPatch.customItemName)
            // Sync name if it's being updated or if we are just updating customItemName
            if (formattedPatch.name !== undefined) {
                formattedPatch.name = formattedPatch.customItemName
            }
        }
        if (formattedPatch.notes !== undefined) formattedPatch.notes = toSentenceCase(formattedPatch.notes)
        setOrderItems(prev => prev.map(it => it.id === id ? { ...it, ...formattedPatch } : it))
    }

    const addMoreItem = () => {
        setOrderItems(prev => ([
            ...prev,
            { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), categoryId: '', itemId: '', customItemName: '', name: '', quantity: 1, unitPrice: 0, notes: '' }
        ]))
    }

    const removeItem = (id) => {
        setOrderItems(prev => {
            const next = prev.filter(it => it.id !== id)
            return next.length ? next : prev
        })
    }

    const getErrorStyle = (fieldName) => {
        if (validationErrors[fieldName]) {
            return { borderColor: 'var(--danger)', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)' }
        }
        return {}
    }

    const validateStep = (stepId) => {
        const errors = {}
        if (stepId === 1) {
            if (!formData.customerName?.trim()) errors.customerName = 'Customer Name is required'
            if (!formData.address?.trim()) errors.address = 'Address is required'
            if (!formData.whatsapp?.trim()) errors.whatsapp = 'WhatsApp is required'
        } else if (stepId === 2) {
            const hasValidItem = orderItems.some(it => it.categoryId && (it.quantity > 0 || it.unitPrice > 0))
            if (!hasValidItem) errors.orderItems = 'At least one item with category is required'
        }
        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 3))
        }
    }

    const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    // Expiry date 7 days from creating date auto-updates but stays editable
    useEffect(() => {
        if (!quotation && formData.createdDate) {
            const date = new Date(formData.createdDate);
            date.setDate(date.getDate() + expiryDays);
            const expiry = date.toISOString().split('T')[0];
            setFormData(prev => ({ ...prev, expiryDate: expiry }));
        }
    }, [formData.createdDate, quotation, expiryDays]);

    const handleSubmit = async () => {
        if (!validateStep(1) || !validateStep(2)) return

        // Check Monthly Limit for Free Users
        if (isFreeUser && !quotation?.id) {
            const recordsCount = await getTotalMonthlyRecordsCount()
            if (recordsCount >= 30) {
                addToast('Free plan limit: 30 records/month reached. Upgrade to Pro for unlimited access! 🚀', 'error')
                return
            }
        }

        setIsSaving(true)
        try {
            const cleanedItems = (orderItems || []).map(it => ({
                id: it.id,
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
                totalPrice: computedTotal,
                createdDate: formData.createdDate
            }

            await onSave(finalData)
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const renderCustomerSection = () => (
        <div className="form-section">
            <h3 className="section-title">Customer Details</h3>

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Quotation ID</label>
                    <input className="form-input" value={quotationId} onChange={e => setQuotationId(e.target.value)} placeholder="Auto-filled" />
                </div>
                <div className="form-group">
                    <label className="form-label">Date *</label>
                    <CustomDatePicker
                        value={formData.createdDate}
                        onChange={(val) => setFormData(p => ({ ...p, createdDate: val }))}
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input className="form-input" name="customerName" style={getErrorStyle('customerName')} value={formData.customerName} onChange={handleChange} />
                <FormValidation message={validationErrors.customerName} />
            </div>

            <div className="form-group">
                <label className="form-label">Address *</label>
                <textarea className="form-input" name="address" style={getErrorStyle('address')} value={formData.address} onChange={handleChange} rows={3} />
                <FormValidation message={validationErrors.address} />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">WhatsApp *</label>
                    <input className="form-input" name="whatsapp" style={getErrorStyle('whatsapp')} value={formData.whatsapp} onChange={handleChange} placeholder="0771234567" />
                    <FormValidation message={validationErrors.whatsapp} />
                </div>
                <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" name="phone" value={formData.phone} onChange={handleChange} placeholder="Optional" />
                </div>
            </div>
        </div>
    )

    const renderItemsSection = () => (
        <div className="form-section">
            <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Quotation Items
                <span className="count-badge">{orderItems.length}</span>
            </h3>

            <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <CustomDatePicker
                    value={formData.expiryDate || ''}
                    onChange={(val) => setFormData(p => ({ ...p, expiryDate: val }))}
                    placeholder="Select expiry date"
                />
            </div>

            {orderItems.map((it, idx) => {
                const cat = getCategoryById(it.categoryId)
                const items = cat?.items || []
                const custom = isCustomCategory(it.categoryId)
                return (
                    <div key={it.id} className={isMobile ? '' : 'card'} style={{
                        marginBottom: '0.75rem',
                        backgroundColor: isMobile ? 'transparent' : 'var(--bg-card)',
                        borderBottom: isMobile ? '1px solid var(--border-color)' : '1px solid var(--border-color)',
                        padding: isMobile ? '0 0 1rem 0' : '1rem',
                        borderRadius: isMobile ? 0 : 'var(--radius)'
                    }}>
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
                                <CustomDropdown
                                    options={products.categories.map(c => ({ value: c.id, label: c.name }))}
                                    value={it.categoryId}
                                    onChange={val => updateItem(it.id, { categoryId: val, itemId: '', unitPrice: 0 })}
                                    placeholder="Select category"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{custom ? 'Custom Product *' : 'Product *'}</label>
                                {custom ? (
                                    <input className="form-input" value={it.customItemName} onChange={e => updateItem(it.id, { customItemName: e.target.value, name: e.target.value })} placeholder="Item Name" />
                                ) : (
                                    <CustomDropdown
                                        options={items.map(i => ({ value: i.id, label: i.name, sublabel: `Rs. ${i.price}` }))}
                                        value={it.itemId}
                                        onChange={val => {
                                            const p = items.find(x => x.id === val)
                                            updateItem(it.id, { itemId: val, unitPrice: p?.price ?? 0, name: p?.name || '' })
                                        }}
                                        placeholder="Product"
                                        searchable={items.length > 5}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="form-row" style={{ gridTemplateColumns: 'minmax(80px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)', gap: '0.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">Qty *</label>
                                <input type="number" className="form-input" value={it.quantity} onChange={e => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} min="0" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Price *</label>
                                <input type="number" className="form-input" value={it.unitPrice} onChange={e => updateItem(it.id, { unitPrice: parseFloat(e.target.value) || 0 })} min="0" step="0.01" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Total</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)).toFixed(2)}
                                    readOnly
                                    style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.8 }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Item Notes</label>
                            <textarea
                                className="form-input"
                                value={it.notes}
                                onChange={e => updateItem(it.id, { notes: e.target.value })}
                                placeholder="e.g. Engraving details..."
                                rows={isMobile ? 1 : 2}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center' }}
                            >
                                <Paperclip size={14} /> Attach Image
                            </button>
                        </div>
                    </div>
                )
            })}
            <FormValidation message={validationErrors.orderItems} />
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addMoreItem}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center' }}
                >
                    <Plus size={16} /> Add Another Item
                </button>
            </div>
        </div>
    )

    const renderPricingSection = () => (
        <div className="form-section">
            <h3 className="section-title">Payment Details</h3>

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Subtotal</label>
                    <input className="form-input" value={subtotal.toFixed(2)} readOnly style={{ backgroundColor: 'var(--bg-primary)' }} />
                </div>
                <div className="form-group">
                    <label className="form-label">Discount</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ position: 'relative', width: '80px' }}>
                            <CustomDropdown
                                options={[{ value: 'Rs', label: 'Rs' }, { value: '%', label: '%' }]}
                                value={discountType}
                                onChange={setDiscountType}
                            />
                        </div>
                        <input className="form-input" name="discount" type="number" value={formData.discount} onChange={handleChange} style={{ flex: 1 }} />
                    </div>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Delivery Charge</label>
                    <input className="form-input" name="deliveryCharge" type="number" value={formData.deliveryCharge} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label className="form-label">Total Price</label>
                    <input
                        className="form-input"
                        value={computedTotal.toFixed(2)}
                        readOnly
                        style={{ backgroundColor: 'var(--bg-primary)', fontWeight: 'bold' }}
                    />
                </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Quotation Total</label>
                <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255, 46, 54, 0.05)',
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                    border: '1px solid rgba(255, 46, 54, 0.1)'
                }}>
                    Rs. {computedTotal.toLocaleString()}
                </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Notes for Quotation</label>
                <textarea className="form-input" name="notes" value={formData.notes} onChange={handleChange} rows={4} placeholder="Optional notes for customer..." />
            </div>
        </div>
    )


    return (
        <div className="modal-overlay full-screen modal-content-transparent" style={{ zIndex: 1000 }}>
            <div className="modal-content modal-content-transparent" style={{ width: isMobile ? '100%' : '98vw', height: isMobile ? '100%' : '98vh', maxWidth: '100%', maxHeight: '100vh', borderRadius: isMobile ? 0 : '12px', padding: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div className="modal-header">
                    <h2 className="modal-title">
                        {quotation ? 'Edit Quotation' : 'Add New Quotation'}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Mobile Stepper */}
                {isMobile && (
                    <div className="stepper" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        {WIZARD_STEPS.map(step => (
                            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', opacity: currentStep === step.id ? 1 : 0.4 }}>
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    backgroundColor: currentStep >= step.id ? 'var(--accent-primary)' : 'var(--bg-card)',
                                    color: currentStep >= step.id ? 'white' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600,
                                    border: `1.5px solid ${currentStep >= step.id ? 'var(--accent-primary)' : 'var(--border-color)'}`
                                }}>
                                    {currentStep > step.id ? <Check size={14} /> : step.id}
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{step.shortName}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Body */}
                <div className="modal-body p-0" style={{ flex: 1, overflowY: 'auto', backgroundColor: isMobile ? 'var(--bg-card)' : 'transparent' }}>
                    {isMobile ? (
                        <div style={{ padding: '1rem' }}>
                            {currentStep === 1 && renderCustomerSection()}
                            {currentStep === 2 && renderItemsSection()}
                            {currentStep === 3 && renderPricingSection()}
                        </div>
                    ) : (
                        <div className="desktop-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', padding: '1rem', height: '100%', overflow: 'hidden' }}>
                            <div className="column scrollable" style={{ paddingRight: '1rem', borderRight: '1px solid var(--border-color)' }}>
                                {renderCustomerSection()}
                            </div>
                            <div className="column scrollable" style={{ paddingRight: '1rem', paddingLeft: '0.5rem', borderRight: '1px solid var(--border-color)' }}>
                                {renderItemsSection()}
                            </div>
                            <div className="column scrollable" style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                                {renderPricingSection()}

                                {/* Save Button for Desktop */}
                                <div style={{ marginTop: 'auto', paddingTop: '1rem', position: 'sticky', bottom: 0 }}>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                                        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSaving} style={{ flex: 2, justifyContent: 'center' }}>
                                            {isSaving ? 'Saving...' : (quotation ? 'Update Quotation' : 'Create Quotation')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {isMobile && (
                    <div className="modal-footer border-t" style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                                {currentStep === 1 ? (
                                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
                                ) : (
                                    <button type="button" className="btn btn-secondary" onClick={handlePrev}><ChevronLeft size={18} /> Back</button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {currentStep < 3 ? (
                                    <button type="button" className="btn btn-primary" onClick={handleNext}>Next <ChevronRight size={18} /></button>
                                ) : (
                                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : (quotation ? 'Update' : 'Confirm')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .modal-overlay.full-screen {
                    background: rgba(0,0,0,0.5);
                    backdrop-filter: blur(4px);
                }
                .column.scrollable {
                    flex: 1;
                    height: 100%;
                    overflow-y: auto;
                    padding-bottom: 2rem;
                    scrollbar-width: thin;
                    scrollbar-color: var(--border-color) transparent;
                }
                .column.scrollable::-webkit-scrollbar { width: 6px; }
                .column.scrollable::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
                
                .section-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin-bottom: 1.25rem;
                    color: var(--text-primary);
                }
                .count-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 24px;
                    height: 24px;
                    font-size: 0.8rem;
                    background-color: var(--bg-secondary);
                    color: var(--text-primary);
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    fontWeight: 600;
                }
                .item-card {
                    padding: 1rem;
                    background-color: var(--bg-card);
                    border-radius: var(--radius);
                    transition: border-color 0.2s;
                }
                .item-card:hover { border-color: var(--accent-primary) !important; }
                .read-only {
                    background-color: var(--bg-secondary);
                    color: var(--text-secondary);
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                }
                .p-row.total span { color: var(--accent-primary); }
                .w-full { width: 100%; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-4 { margin-top: 1rem; }
                .mt-6 { margin-top: 1.5rem; }
                .sm { padding: 0.2rem; }
                @media (max-width: 768px) {
                    .column.scrollable { height: auto; overflow: visible; padding-bottom: 0; }
                }
            `}</style>
        </div>
    )
}

export default QuotationForm
