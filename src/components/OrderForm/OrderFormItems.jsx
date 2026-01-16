import React from 'react'
import { Trash2, Plus, RefreshCw, Paperclip, Loader, Crown, AlertCircle } from 'lucide-react'
import CustomDropdown from '../Common/CustomDropdown'
import CustomDatePicker from '../Common/CustomDatePicker'
import FormValidation from '../FormValidation'

const OrderFormItems = ({
    orderItems,
    updateItem,
    removeItem,
    addMoreItem,
    handleUploadClick,
    handleRemoveImage,
    uploadingItemIds,
    products,
    validationErrors,
    isFreeUser,
    isMobile,
    today,
    formData,
    handleChange
}) => {
    const getCategoryById = (categoryId) => products.categories.find(cat => cat.id === categoryId)
    const isCustomCategory = (categoryId) => {
        if (!categoryId) return false
        const category = getCategoryById(categoryId)
        return category?.name?.toLowerCase() === 'custom'
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!isMobile && (
                <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Order Items
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '24px',
                        height: '24px',
                        fontSize: '0.8rem',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontWeight: 600
                    }}>
                        {orderItems.length}
                    </span>
                </h3>
            )}

            {/* Scheduled Delivery Date - Placed here as it relates to fulfillment */}
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Scheduled Delivery Date</label>
                    <CustomDatePicker
                        type="date"
                        name="scheduledDeliveryDate"
                        value={formData.scheduledDeliveryDate}
                        onChange={(val) => handleChange({ target: { name: 'scheduledDeliveryDate', value: val } })}
                        min={today}
                        isLocked={isFreeUser}
                        placeholder="Select delivery date"
                    />
                    {!isMobile && (
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            For scheduling ahead.
                        </small>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: isMobile ? 'visible' : 'auto', paddingRight: isMobile ? 0 : '0.5rem' }}>
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
                                        onChange={(val) => {
                                            updateItem(it.id, { categoryId: val, itemId: '', customItemName: '', unitPrice: 0 })
                                        }}
                                        placeholder="Select category"
                                    />
                                    <FormValidation message={idx === 0 ? validationErrors.orderItems : null} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{custom ? 'Custom Product *' : 'Product *'}</label>
                                    {custom ? (
                                        <input
                                            className="form-input"
                                            value={it.customItemName}
                                            onChange={(e) => updateItem(it.id, { customItemName: e.target.value, name: e.target.value })}
                                            placeholder="Name"
                                            required
                                        />
                                    ) : (
                                        <CustomDropdown
                                            options={items.map(p => ({
                                                value: p.id,
                                                label: p.name,
                                                sublabel: `Rs. ${p.price}`
                                            }))}
                                            value={it.itemId || ''}
                                            onChange={(selectedId) => {
                                                const p = items.find(item => item.id === selectedId)
                                                if (p) {
                                                    updateItem(it.id, { itemId: p.id, unitPrice: p.price ?? 0, name: p.name || '' })
                                                } else {
                                                    updateItem(it.id, { itemId: '', unitPrice: 0, name: '' })
                                                }
                                            }}
                                            disabled={!it.categoryId}
                                            placeholder="Product"
                                            searchable={items.length > 5}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="form-row" style={{ gridTemplateColumns: 'minmax(80px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr)', gap: '0.5rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Qty *</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={it.quantity}
                                        onChange={(e) => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })}
                                        min="0"
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
                                    />
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
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Item Notes
                                    {isFreeUser && <Crown size={12} color="var(--accent-primary)" />}
                                </label>
                                <textarea
                                    className="form-input"
                                    value={it.notes || ''}
                                    onChange={(e) => updateItem(it.id, { notes: e.target.value })}
                                    rows="2"
                                    placeholder={isFreeUser ? "Pro feature" : "e.g. Engraving"}
                                    disabled={isFreeUser}
                                    style={isFreeUser ? { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', opacity: 0.7 } : {}}
                                />
                            </div>

                            {/* Image Upload UI */}
                            <div className="form-group" style={{ marginTop: '0.75rem' }}>
                                {it.image ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                                        <a href={it.image} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                            <img
                                                src={it.image}
                                                alt="Item"
                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                                            />
                                        </a>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleUploadClick(it.id)}
                                                title="Replace"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleRemoveImage(it.id, it.image)}
                                                title="Remove"
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
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center', ...(isFreeUser ? { opacity: 0.7, cursor: 'not-allowed' } : {}) }}
                                            disabled={uploadingItemIds.has(it.id) || isFreeUser}
                                        >
                                            {isFreeUser ? <Crown size={14} color="var(--accent-primary)" /> : (uploadingItemIds.has(it.id) ? <Loader size={14} className="spin" /> : <Paperclip size={14} />)}
                                            {uploadingItemIds.has(it.id) ? 'Uploading...' : 'Attach Image'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addMoreItem}
                    disabled={isFreeUser}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center', ...(isFreeUser ? { opacity: 0.7, cursor: 'not-allowed' } : {}) }}
                >
                    {isFreeUser ? <Crown size={16} color="var(--accent-primary)" /> : <Plus size={16} />} Add Another Item
                </button>
            </div>
        </div>
    )
}

export default OrderFormItems
