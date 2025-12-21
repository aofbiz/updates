import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Package, Tag } from 'lucide-react'
import { getProducts, saveProducts } from '../utils/storage'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const ProductsManagement = () => {
  const { addToast } = useToast()
  const [products, setProducts] = useState({ categories: [] })
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [categoryFormData, setCategoryFormData] = useState({ name: '' })
  const [itemFormData, setItemFormData] = useState({ name: '', price: '' })
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)

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
    setProducts(data)
    // Initialize expanded state for all categories
    const expanded = {}
    if (data && data.categories) {
      data.categories.forEach(cat => {
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
    setCategoryFormData({ name: '' })
    setEditingCategory(null)
    setShowCategoryForm(true)
  }

  const handleEditCategory = (category) => {
    setCategoryFormData({ name: category.name })
    setEditingCategory(category.id)
    setShowCategoryForm(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      addToast('Please enter a category name', 'warning')
      return
    }

    const updated = { ...products }

    if (editingCategory) {
      // Edit existing category
      const categoryIndex = updated.categories.findIndex(cat => cat.id === editingCategory)
      if (categoryIndex !== -1) {
        updated.categories[categoryIndex].name = categoryFormData.name.trim()
      }
    } else {
      // Add new category
      updated.categories.push({
        id: generateId(),
        name: categoryFormData.name.trim(),
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
    setItemFormData({ name: '', price: '' })
    setEditingItem(null)
    setSelectedCategoryId(categoryId)
    setShowItemForm(true)
  }

  const handleEditItem = (categoryId, item) => {
    setItemFormData({ name: item.name, price: item.price.toString() })
    setEditingItem(item.id)
    setSelectedCategoryId(categoryId)
    setShowItemForm(true)
  }

  const handleSaveItem = async () => {
    if (!itemFormData.name.trim()) {
      addToast('Please enter an item name', 'warning')
      return
    }

    const price = parseFloat(itemFormData.price)
    if (isNaN(price) || price < 0) {
      addToast('Please enter a valid price', 'warning')
      return
    }

    const updated = { ...products }
    const categoryIndex = updated.categories.findIndex(cat => cat.id === selectedCategoryId)

    if (categoryIndex === -1) return

    if (editingItem) {
      // Edit existing item
      const itemIndex = updated.categories[categoryIndex].items.findIndex(item => item.id === editingItem)
      if (itemIndex !== -1) {
        updated.categories[categoryIndex].items[itemIndex].name = itemFormData.name.trim()
        updated.categories[categoryIndex].items[itemIndex].price = price
      }
    } else {
      // Add new item
      updated.categories[categoryIndex].items.push({
        id: generateId(),
        name: itemFormData.name.trim(),
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

  const selectedCategory = selectedCategoryId
    ? products.categories.find(cat => cat.id === selectedCategoryId)
    : null

  return (
    <div>
      {/* Header with Add Category Button */}
      <div style={{
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
        <button
          onClick={handleAddCategory}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} />
          Add Category
        </button>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                onChange={(e) => setCategoryFormData({ name: e.target.value })}
                placeholder="e.g., Mommy Frames, Plymount"
                className="form-input"
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
                {editingCategory ? 'Update' : 'Add'} Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && selectedCategory && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingItem ? 'Edit Item' : 'Add New Item'} - {selectedCategory.name}
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
                onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                placeholder="e.g., Wall Frame Couple, 4x6"
                className="form-input"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Price (Rs.) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemFormData.price}
                onChange={(e) => setItemFormData({ ...itemFormData, price: e.target.value })}
                placeholder="e.g., 1590"
                className="form-input"
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
                {editingItem ? 'Update' : 'Add'} Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories List */}
      {products.categories.length === 0 ? (
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
          {products.categories.map((category) => (
            <div key={category.id} className="card">
              {/* Category Header */}
              <div style={{
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
                  <Package size={20} color="var(--accent-primary)" />
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => handleAddItem(category.id)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Add Item"
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Edit Category"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="btn btn-danger btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Delete Category"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Category Items */}
              {expandedCategories[category.id] && (
                <div style={{ animation: 'fadeIn 0.2s ease', marginTop: '1rem' }}>
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
                    <div style={{ overflowX: 'auto' }}>
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
                  )}
                </div>
              )}
            </div>
          ))}
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

