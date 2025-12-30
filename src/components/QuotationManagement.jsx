import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Repeat, Loader, MessageCircle, FileText, Eye } from 'lucide-react' // Using available icons
import { saveQuotations, getQuotations, deleteQuotation, getProducts, getSettings } from '../utils/storage'
import { formatWhatsAppNumber, generateWhatsAppMessage } from '../utils/whatsapp'
import { useToast } from './Toast/ToastContext'
import QuotationForm from './QuotationForm'
import ViewQuotationModal from './ViewQuotationModal'
import ConfirmationModal from './ConfirmationModal'

const QuotationManagement = ({ quotations, onUpdateQuotations, orders, onUpdateOrders }) => {
    const { addToast } = useToast()
    const [showForm, setShowForm] = useState(false)
    const [viewingQuotation, setViewingQuotation] = useState(null)
    const [viewingDetails, setViewingDetails] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [products, setProducts] = useState({ categories: [] })
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'default',
        onConfirm: null,
        confirmText: 'Confirm'
    })
    const [settings, setSettings] = useState(null)

    useEffect(() => {
        getProducts().then(setProducts)
        getSettings().then(setSettings)
    }, [])

    // Filter Logic
    const filteredQuotations = useMemo(() => {
        return (quotations || []).filter(q => {
            const searchLower = searchTerm.toLowerCase()
            // Search logic (Customer, ID, Items)
            const matchesSearch =
                (q.id?.toString().toLowerCase().includes(searchLower)) ||
                (q.customerName?.toLowerCase().includes(searchLower)) ||
                (q.phone?.toLowerCase().includes(searchLower))

            return matchesSearch
        })
    }, [quotations, searchTerm])

    const handleSaveQuotation = async (quotationData) => {
        setIsProcessing(true)
        try {
            // Determine if new or update
            const existingIndex = (quotations || []).findIndex(q => q.id === quotationData.id)
            let updatedQuotations = [...(quotations || [])]

            if (existingIndex >= 0) {
                updatedQuotations[existingIndex] = quotationData
            } else {
                updatedQuotations = [quotationData, ...updatedQuotations]
            }

            // Save to storage
            const success = await saveQuotations(updatedQuotations)
            if (success) {
                onUpdateQuotations(updatedQuotations)
                addToast(`Quotation ${quotationData.id} saved successfully`, 'success')
                return true
            } else {
                addToast('Failed to save quotation', 'error')
                return false
            }
        } catch (error) {
            console.error(error)
            addToast('Error saving quotation', 'error')
            return false
        } finally {
            setIsProcessing(false)
        }
    }

    const executeDeleteQuotation = async (id) => {
        setIsProcessing(true)
        try {
            const success = await deleteQuotation(id)
            if (success) {
                const updatedQuotations = quotations.filter(q => q.id !== id)
                onUpdateQuotations(updatedQuotations)
                addToast('Quotation deleted successfully', 'success')
            } else {
                addToast('Failed to delete quotation', 'error')
            }
        } catch (error) {
            console.error(error)
            addToast('Error deleting quotation', 'error')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteQuotation = (id) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Quotation',
            message: 'Are you sure you want to delete this quotation? This action cannot be undone.',
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: () => executeDeleteQuotation(id)
        })
    }

    const executeConvertToOrder = async (quotation) => {
        setIsProcessing(true)
        try {
            // 1. Create new order object
            // We need to generate a new Order ID.
            // Ideally we check basic logic or let the backend/storage logic handle it if simplified.
            // But OrderForm handles ID generation. 
            // Here we need to grab the latest Order ID from 'orders' prop to generate the next one.

            const lastOrder = (orders || []).sort((a, b) => b.createdDate.localeCompare(a.createdDate) || String(b.id).localeCompare(String(a.id)))[0]
            // Simple parse logic similar to OrderForm/storage
            let nextId = 1000
            if (lastOrder && !isNaN(parseInt(lastOrder.id))) {
                nextId = parseInt(lastOrder.id) + 1
            }

            const newOrder = {
                ...quotation,
                id: nextId.toString(),
                status: 'New Order',
                trackingNumber: '', // Clear tracking
                dispatchDate: '',
                createdDate: new Date().toISOString().split('T')[0],
                orderDate: new Date().toISOString().split('T')[0],
                paymentStatus: 'Pending',
                isFromQuotation: true, // Optional flag
                quotationId: quotation.id
            }

            // 2. Save new order
            // We need to import saveOrders from storage or use a prop if available.
            // But 'onUpdateOrders' just updates state. We need to actually persist it.
            // I should import saveOrders.

            // I need to import saveOrders at the top.
            const { saveOrders } = await import('../utils/storage')

            // We need to merge with existing orders to save
            // Actually saveOrders takes the full list or single? 
            // storage.js saveOrders takes the FULL array of orders.
            const updatedOrders = [newOrder, ...orders]
            const successOrder = await saveOrders(updatedOrders)

            if (successOrder) {
                onUpdateOrders(updatedOrders)

                // 3. Update Quotation Status
                const updatedQuotation = { ...quotation, status: 'Order Received' }
                await handleSaveQuotation(updatedQuotation)

                addToast(`Quotation converted to Order #${newOrder.id}`, 'success')
            } else {
                addToast('Failed to create order', 'error')
            }

        } catch (error) {
            console.error(error)
            addToast('Error converting quotation', 'error')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleConvertToOrder = (quotation) => {
        setModalConfig({
            isOpen: true,
            title: 'Convert to Order',
            message: 'Convert this quotation to a new order? This will create a new order with the same details.',
            type: 'default', // Blue/Info
            confirmText: 'OK',
            onConfirm: () => executeConvertToOrder(quotation)
        })
    }

    const handleSendWhatsApp = (quotation) => {
        if (!quotation.whatsapp && !quotation.phone) {
            addToast('No phone number available for this quotation.', 'error');
            return;
        }

        const formattedNumber = formatWhatsAppNumber(quotation.whatsapp || quotation.phone)
        if (!formattedNumber) {
            addToast('Invalid phone number format.', 'error')
            return
        }

        // Calculate item details string for template context
        const itemDetailsString = (quotation.orderItems || []).map(it => {
            const category = products.categories.find(c => c.id === it.categoryId)
            const catName = category ? category.name : 'Item'
            const itemName = it.name || it.customItemName || 'N/A'
            const qty = it.quantity || 1
            const price = Number(it.unitPrice) || 0
            return `🔸 ${catName} - ${itemName} (x${qty}): Rs. ${price.toLocaleString()}`
        }).join('\n')

        // Calculate financials for context
        const subtotal = (quotation.orderItems || []).reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0)
        const discount = Number(quotation.discount || quotation.discountValue || 0)
        let discountAmount = 0
        if (quotation.discountType === '%') {
            discountAmount = (subtotal * discount) / 100
        } else {
            discountAmount = discount
        }
        const deliveryCharge = Number(quotation.deliveryCharge ?? 0)
        const finalPrice = Math.max(0, subtotal - discountAmount + deliveryCharge)

        const context = {
            subtotal,
            discountAmount,
            deliveryCharge,
            finalPrice,
            itemDetailsString
        }

        // Use template if available, otherwise default
        let message = ''
        if (settings?.whatsappTemplates?.quotation) {
            message = generateWhatsAppMessage(settings.whatsappTemplates.quotation, quotation, context)
        } else {
            // Default fallback
            message = `Hello ${quotation.customerName},\n\nHere is your quotation details:\nQuotation ID: ${quotation.id}\nTotal Price: Rs. ${finalPrice.toLocaleString()}\n\nFor more details, please visit our website or contact us.\n\nThank you!`
        }

        const encodedMessage = encodeURIComponent(message);
        const numberForUrl = formattedNumber.replace('+', '')
        const whatsappUrl = `https://wa.me/${numberForUrl}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
        addToast('WhatsApp message initiated.', 'info');
    };

    return (
        <div className="quotation-management">
            <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Quotations</h1>
                <button className="btn btn-primary" onClick={() => { setViewingQuotation(null); setShowForm(true); }}>
                    <Plus size={18} /> Add Quotation
                </button>
            </div>

            <div className="filters-bar" style={{ marginBottom: '1rem' }}>
                <div className="search-box" style={{ position: 'relative', maxWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search quotations..."
                        style={{
                            width: '100%',
                            padding: '0.5rem 0.5rem 0.5rem 2.2rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Quotations Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>ID & Date</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Item Details</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Qty</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Total</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredQuotations.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No quotations found.
                                    </td>
                                </tr>
                            ) : (
                                filteredQuotations.map(q => {
                                    // Item Summary Logic
                                    const firstItem = q.orderItems?.[0] || {}
                                    const moreCount = (q.orderItems?.length || 0) - 1

                                    const itemName = firstItem.name || firstItem.customItemName || 'Unknown Item'

                                    // Get Category Name
                                    const categoryId = firstItem.categoryId
                                    const category = products.categories.find(c => c.id === categoryId)
                                    const categoryName = category ? category.name : 'N/A'

                                    return (
                                        <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s ease' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.875rem' }}>
                                                    #{q.id}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                    {q.createdDate}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{q.customerName}</div>
                                                {q.whatsapp && (
                                                    <div style={{ fontSize: '0.75rem', color: '#25D366', marginTop: '0.25rem' }}>
                                                        {q.whatsapp}
                                                    </div>
                                                )}
                                                {q.phone && !q.whatsapp && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {q.phone}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                                    {categoryName}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>
                                                    {itemName}
                                                    {moreCount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>+{moreCount} more</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    Rs. {(Number(firstItem.unitPrice) || 0).toLocaleString()}
                                                </div>
                                                {firstItem.notes && (
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-muted)',
                                                        marginTop: '2px',
                                                        fontStyle: 'italic',
                                                        maxWidth: '250px',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {firstItem.notes}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{ fontWeight: 600 }}>{firstItem.quantity || 1}</span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                                                Rs. {(Number(q.totalPrice) || 0).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: 'var(--radius)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500,
                                                    backgroundColor: q.status === 'Order Received' ? '#10b981' : 'var(--bg-secondary)', // Green for converted, Gray for Draft
                                                    color: q.status === 'Order Received' ? 'white' : 'var(--text-secondary)',
                                                    border: '1px solid var(--border-color)'
                                                }}>
                                                    {q.status || 'Draft'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => setViewingDetails(q)}
                                                        title="View Quotation"
                                                        style={{
                                                            backgroundColor: '#3b82f6',
                                                            color: 'white',
                                                            padding: '0.4rem',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'transform 0.1s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <Eye size={16} />
                                                    </button>

                                                    <button
                                                        className="btn-icon"
                                                        title="WhatsApp"
                                                        onClick={() => handleSendWhatsApp(q)}
                                                        style={{
                                                            backgroundColor: '#22c55e',
                                                            color: 'white',
                                                            padding: '0.4rem',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'transform 0.1s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <MessageCircle size={16} />
                                                    </button>

                                                    {q.status !== 'Order Received' && (
                                                        <button
                                                            className="btn-icon"
                                                            title="Convert to Order"
                                                            onClick={() => handleConvertToOrder(q)}
                                                            style={{
                                                                backgroundColor: '#8b5cf6',
                                                                color: 'white',
                                                                padding: '0.4rem',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'transform 0.1s',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                        >
                                                            <Repeat size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => { setViewingQuotation(q); setShowForm(true); }}
                                                        title="Edit Quotation"
                                                        style={{
                                                            backgroundColor: '#27272a',
                                                            color: 'white',
                                                            padding: '0.4rem',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'transform 0.1s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon danger"
                                                        onClick={() => handleDeleteQuotation(q.id)}
                                                        title="Delete Quotation"
                                                        style={{
                                                            backgroundColor: '#ef4444',
                                                            color: 'white',
                                                            padding: '0.4rem',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'transform 0.1s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && (
                <QuotationForm
                    quotation={viewingQuotation}
                    onClose={() => { setShowForm(false); setViewingQuotation(null); }}
                    onSave={handleSaveQuotation}
                />
            )}

            {viewingDetails && (
                <ViewQuotationModal
                    quotation={viewingDetails}
                    onClose={() => setViewingDetails(null)}
                />
            )}

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                confirmText={modalConfig.confirmText}
                onConfirm={modalConfig.onConfirm}
            />
        </div>
    )
}

export default QuotationManagement
