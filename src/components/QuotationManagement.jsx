import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Repeat, Loader, MessageCircle, FileText } from 'lucide-react' // Using available icons
import { saveQuotations, getQuotations } from '../utils/storage'
import { useToast } from './Toast/ToastContext'
import QuotationForm from './QuotationForm'

const QuotationManagement = ({ quotations, onUpdateQuotations, orders, onUpdateOrders }) => {
    const { addToast } = useToast()
    const [showForm, setShowForm] = useState(false)
    const [viewingQuotation, setViewingQuotation] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)

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

    const handleDeleteQuotation = async (id) => {
        if (!confirm('Are you sure you want to delete this quotation?')) return

        setIsProcessing(true)
        try {
            const updatedQuotations = quotations.filter(q => q.id !== id)
            const success = await saveQuotations(updatedQuotations)
            if (success) {
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

    const handleConvertToOrder = async (quotation) => {
        if (!confirm('Convert this quotation to a new order? This will create a new order with the same details.')) return

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

            <div className="table-container" style={{ overflowX: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>ID</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Items</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Total</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredQuotations.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No quotations found.
                                </td>
                            </tr>
                        ) : (
                            filteredQuotations.map(q => (
                                <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>#{q.id}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{q.createdDate}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div>{q.customerName}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.phone}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        {/* Simplified item display */}
                                        {(q.orderItems || []).length} Item(s)
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>Rs. {(Number(q.totalPrice) || 0).toLocaleString()}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            backgroundColor: q.status === 'Converted' ? 'var(--success-bg)' : 'var(--bg-secondary)',
                                            color: q.status === 'Converted' ? 'var(--success)' : 'var(--text-secondary)'
                                        }}>
                                            {q.status || 'Draft'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            {q.status !== 'Converted' && (
                                                <button
                                                    className="btn-icon"
                                                    title="Convert to Order"
                                                    onClick={() => handleConvertToOrder(q)}
                                                    style={{ color: 'var(--accent-primary)' }}
                                                >
                                                    <Repeat size={18} />
                                                </button>
                                            )}
                                            <button className="btn-icon" onClick={() => { setViewingQuotation(q); setShowForm(true); }}>
                                                <Edit size={18} />
                                            </button>
                                            <button className="btn-icon danger" onClick={() => handleDeleteQuotation(q.id)}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <QuotationForm
                    quotation={viewingQuotation}
                    onClose={() => { setShowForm(false); setViewingQuotation(null); }}
                    onSave={handleSaveQuotation}
                />
            )}
        </div>
    )
}

export default QuotationManagement
