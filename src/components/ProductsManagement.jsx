import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Package, Tag } from 'lucide-react'
import FormValidation from './FormValidation'
import { getProducts, saveProducts } from '../utils/storage'
import { toTitleCase } from '../utils/textUtils'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'
import { useLicensing } from './LicensingContext'
import Pagination from './Common/Pagination'

const ProductsManagement = () => {
  const { addToast } = useToast()
  const { isFreeUser } = useLicensing()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [products, setProducts] = useState({ categories: [] })
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [categoryFormData, setCategoryFormData] = useState({ name: '' })
  const [itemFormData, setItemFormData] = useState({ name: '', price: '' })
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})

  const getErrorStyle = (fieldName) => {
    if (validationErrors[fieldName]) {
      return {
        borderColor: 'var(--danger)',
        boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)'
      }
    }
    return {}
  }

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

  const showConfirm = (title, message, onConfirm, type = 'danger', confirmText = 'Confirm') => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      isAlert: false,
      confirmText
    })
  }

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }))
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    const data = await getProducts()
    const validData = data || { categories: [] }
    setProducts(validData)
    // Initialize expanded state for all categories
    const expanded = {}
    if (validData.categories) {
      validData.categories.forEach(cat => {
        expanded[cat.id] = false
      })
    }
    setExpandedCategories(expanded)
  }

  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9)
  }

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  const handleAddCategory = () => {
    if (isFreeUser && products.categories.length >= 1) {
      addToast('Free plan limit: Maximum 1 category allowed. Upgrade to Pro for unlimited categories.', 'error')
      return
    }
    setCategoryFormData({ name: '' })
    setEditingCategory(null)
    setValidationErrors({})
    setShowCategoryForm(true)
  }

  const handleEditCategory = (category) => {
    setCategoryFormData({ name: category.name })
    setEditingCategory(category.id)
    setValidationErrors({})
    setShowCategoryForm(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      setValidationErrors({ name: 'Category name is required' })
      return
    }
    setValidationErrors({})

    const updated = { ...products }

    if (editingCategory) {
      // Edit existing category
      const categoryIndex = updated.categories.findIndex(cat => cat.id === editingCategory)
      if (categoryIndex !== -1) {
        updated.categories[categoryIndex].name = toTitleCase(categoryFormData.name.trim())
      }
    } else {
      // Add new category
      updated.categories.push({
        id: generateId(),
        name: toTitleCase(categoryFormData.name.trim()),
        items: []
      })
    }

    await saveProducts(updated)
    setProducts(updated)
    // Auto-expand newly added category
    if (!editingCategory) {
      const newCategory = updated.categories[updated.categories.length - 1]
      setExpandedCategories(prev => ({
        ...prev,
        [newCategory.id]: true
      }))
    }
    setShowCategoryForm(false)
    setCategoryFormData({ name: '' })
    setEditingCategory(null)
  }

  const handleDeleteCategory = (categoryId) => {
    showConfirm('Delete Category', 'Are you sure you want to delete this category? All items in this category will also be deleted.', async () => {
      const updated = { ...products }
      updated.categories = updated.categories.filter(cat => cat.id !== categoryId)
      await saveProducts(updated)
      setProducts(updated)
      addToast('Category deleted successfully', 'success')
    }, 'danger', 'Delete')
  }

  const handleAddItem = (categoryId) => {
    if (isFreeUser) {
      const totalItems = products.categories.reduce((acc, cat) => acc + cat.items.length, 0)
      if (totalItems >= 10) {
        addToast('Free plan limit: Maximum 10 items allowed. Upgrade to Pro for unlimited items.', 'error')
        return
      }
    }
    setItemFormData({ name: '', price: '' })
    setEditingItem(null)
    setSelectedCategoryId(categoryId)
    setValidationErrors({})
    setShowItemForm(true)
  }

  const handleEditItem = (categoryId, item) => {
    setItemFormData({ name: item.name, price: item.price.toString() })
    setEditingItem(item.id)
    setSelectedCategoryId(categoryId)
    setValidationErrors({})
    setShowItemForm(true)
  }

  const handleSaveItem = async () => {
    const errors = {}
    if (!itemFormData.name.trim()) {
      errors.name = 'Item name is required'
    }

    const price = parseFloat(itemFormData.price)
    if (isNaN(price) || price < 0) {
      errors.price = 'Please enter a valid price'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors({})

    const updated = { ...products }
    const categoryIndex = updated.categories.findIndex(cat => cat.id === selectedCategoryId)

    if (categoryIndex === -1) return

    if (editingItem) {
      // Edit existing item
      if (itemIndex !== -1) {
        updated.categories[categoryIndex].items[itemIndex].name = toTitleCase(itemFormData.name.trim())
        updated.categories[categoryIndex].items[itemIndex].price = price
      }
    } else {
      // Add new item
      updated.categories[categoryIndex].items.push({
        id: generateId(),
        name: toTitleCase(itemFormData.name.trim()),
        price: price
      })
    }

    await saveProducts(updated)
    setProducts(updated)
    // Auto-expand category after adding item
    if (!editingItem) {
      setExpandedCategories(prev => ({
        ...prev,
        [selectedCategoryId]: true
      }))
    }
    setShowItemForm(false)
    setItemFormData({ name: '', price: '' })
    setEditingItem(null)
    setSelectedCategoryId(null)
  }

  const handleDeleteItem = (categoryId, itemId) => {
    showConfirm('Delete Item', 'Are you sure you want to delete this item?', async () => {
      const updated = { ...products }
      const categoryIndex = updated.categories.findIndex(cat => cat.id === categoryId)

      if (categoryIndex !== -1) {
        updated.categories[categoryIndex].items = updated.categories[categoryIndex].items.filter(item => item.id !== itemId)
        await saveProducts(updated)
        setProducts(updated)
        addToast('Item deleted successfully', 'success')
      }
    }, 'danger', 'Delete')
  }

  const selectedCategory = (selectedCategoryId && products?.categories)
    ? products.categories.find(cat => cat.id === selectedCategoryId)
    : null

  return (
    <div>
      <style>{`
        @media (max-width: 600px) {
          .products-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
          .products-header div {
            width: 100%;
          }
          .products-header .btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .category-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
          .category-actions {
            width: 100% !important;
            display: flex !important;
            gap: 0.5rem !important;
          }
          .category-actions .btn {
            flex: 1 !important;
            justify-content: center !important;
            font-size: 0.7rem !important;
            padding: 0.5rem !important;
          }
        }

        @media (max-width: 480px) {
          .product-mobile-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 0.5rem !important;
            padding: 1rem !important;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
          }
          .product-table-desktop {
            display: none !important;
          }
        }
        
        @media (min-width: 481px) {
          .product-mobile-list {
            display: none !important;
          }
        }
      `}</style>

      {/* Header with Add Category Button */}
      <div className="header-container products-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Product Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage categories and items with their prices
          </p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleAddCategory}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} />
            Add Category
          </button>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                onClick={() => {
                  setShowCategoryForm(false)
                  setCategoryFormData({ name: '' })
                  setEditingCategory(null)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '0.25rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Category Name *</label>
              <input
                type="text"
                value={categoryFormData.name}
                onChange={(e) => {
                  setCategoryFormData({ name: e.target.value })
                  if (validationErrors.name) setValidationErrors({})
                }}
                placeholder="e.g., Mommy Frames, Plymount"
                className="form-input"
                style={getErrorStyle('name')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCategory()
                  if (e.key === 'Escape') {
                    setShowCategoryForm(false)
                    setCategoryFormData({ name: '' })
                    setEditingCategory(null)
                  }
                }}
              />
              <FormValidation message={validationErrors.name} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setShowCategoryForm(false)
                  setCategoryFormData({ name: '' })
                  setEditingCategory(null)
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Save size={18} />
                {editingCategory ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && selectedCategory && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={() => {
                  setShowItemForm(false)
                  setItemFormData({ name: '', price: '' })
                  setEditingItem(null)
                  setSelectedCategoryId(null)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '0.25rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input
                type="text"
                value={itemFormData.name}
                onChange={(e) => {
                  setItemFormData({ ...itemFormData, name: e.target.value })
                  if (validationErrors.name) setValidationErrors(p => ({ ...p, name: null }))
                }}
                placeholder="e.g., Wall Frame Couple, 4x6"
                className="form-input"
                style={getErrorStyle('name')}
                autoFocus
              />
              <FormValidation message={validationErrors.name} />
            </div>

            <div className="form-group">
              <label className="form-label">Price (Rs.) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemFormData.price}
                onChange={(e) => {
                  setItemFormData({ ...itemFormData, price: e.target.value })
                  if (validationErrors.price) setValidationErrors(p => ({ ...p, price: null }))
                }}
                placeholder="e.g., 1590"
                className="form-input"
                style={getErrorStyle('price')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveItem()
                  if (e.key === 'Escape') {
                    setShowItemForm(false)
                    setItemFormData({ name: '', price: '' })
                    setEditingItem(null)
                    setSelectedCategoryId(null)
                  }
                }}
              />
              <FormValidation message={validationErrors.price} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setShowItemForm(false)
                  setItemFormData({ name: '', price: '' })
                  setEditingItem(null)
                  setSelectedCategoryId(null)
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Save size={18} />
                {editingItem ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories List */}
      {(!products || !products.categories || products.categories.length === 0) ? (
        <div className="card" style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No categories yet</p>
          <p style={{ fontSize: '0.875rem' }}>Click "Add Category" to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {products.categories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((category) => (
            <div key={category.id} className="card">
              {/* Category Header */}
              <div className="category-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: expandedCategories[category.id] ? '1rem' : 0
              }}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0
                  }}
                >
                  <div style={{ padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                    <Package size={20} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0
                    }}>
                      {category.name}
                    </h3>
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      margin: '0.25rem 0 0 0'
                    }}>
                      {category.items.length} item{category.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
                <div className="category-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => handleAddItem(category.id)}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '0.4rem' }}
                    title="Add Item"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem' }}
                    title="Edit Category"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '0.4rem' }}
                    title="Delete Category"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Category Items */}
              {expandedCategories[category.id] && (
                <div style={{ animation: 'fadeIn 0.2s ease', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  {category.items.length === 0 ? (
                    <div style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)'
                    }}>
                      <Tag size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p style={{ fontSize: '0.875rem' }}>No items in this category</p>
                      <button
                        onClick={() => handleAddItem(category.id)}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem auto 0' }}
                      >
                        <Plus size={16} />
                        Add First Item
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="product-table-desktop" style={{ overflowX: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: '50%' }}>Item</th>
                              <th style={{ width: '30%' }}>Price (Rs.)</th>
                              <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.items.map((item) => (
                              <tr key={item.id}>
                                <td style={{ fontWeight: 500 }}>{item.name}</td>
                                <td>{item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => handleEditItem(category.id, item)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '0.25rem 0.5rem' }}
                                      title="Edit Item"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(category.id, item.id)}
                                      className="btn btn-danger btn-sm"
                                      style={{ padding: '0.25rem 0.5rem' }}
                                      title="Delete Item"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View for Items */}
                      <div className="product-mobile-list">
                        {category.items.map((item) => (
                          <div key={item.id + '-mobile'} className="product-mobile-row">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{item.name}</div>
                              <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                                Rs. {item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleEditItem(category.id, item)}
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1, justifyContent: 'center' }}
                              >
                                <Edit2 size={14} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteItem(category.id, item.id)}
                                className="btn btn-danger btn-sm"
                                style={{ flex: 1, justifyContent: 'center' }}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(products.categories.length / itemsPerPage)}
            onPageChange={setCurrentPage}
            totalItems={products.categories.length}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      )}
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
    </div>
  )
}

export default ProductsManagement

