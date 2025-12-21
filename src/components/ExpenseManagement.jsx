import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, DollarSign, Tag } from 'lucide-react'
import { getExpenseCategories, saveExpenseCategories } from '../utils/storage'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const ExpenseManagement = () => {
  const { addToast } = useToast()
  const [expenseCategories, setExpenseCategories] = useState({ categories: [] })
  const [editingCategory, setEditingCategory] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [categoryFormData, setCategoryFormData] = useState({ name: '' })
  const [editingItem, setEditingItem] = useState(null) // { categoryId, itemId }
  const [itemFormData, setItemFormData] = useState({ name: '' })

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

  const showConfirm = (title, message, onConfirm, type = 'default', confirmText = 'Confirm') => {
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
    loadExpenseCategories()
  }, [])

  const loadExpenseCategories = async () => {
    const data = await getExpenseCategories()
    setExpenseCategories(data)
    // Initialize expanded state for all categories
    const expanded = {}
    if (data && data.categories) {
      data.categories.forEach(cat => {
        expanded[cat.id] = false
      })
    }
    setExpandedCategories(expanded)
  }

  const saveCategories = async (data) => {
    const success = await saveExpenseCategories(data)
    if (!success) {
      addToast('Error saving expense categories. Please try again.', 'error')
    }
    return success
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

    const updated = { ...expenseCategories }

    if (editingCategory) {
      // Edit existing category
      const categoryIndex = updated.categories.findIndex(cat => cat.id === editingCategory)
      if (categoryIndex !== -1) {
        updated.categories[categoryIndex].name = categoryFormData.name.trim()
        updated.categories[categoryIndex].items = Array.isArray(updated.categories[categoryIndex].items)
          ? updated.categories[categoryIndex].items
          : []
      }
    } else {
      // Add new category
      updated.categories.push({
        id: generateId(),
        name: categoryFormData.name.trim(),
        items: []
      })
    }

    if (await saveCategories(updated)) {
      setExpenseCategories(updated)
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
      addToast(editingCategory ? 'Category updated successfully' : 'Category added successfully', 'success')
    }
  }

  const handleDeleteCategory = (categoryId) => {
    showConfirm('Delete Category', 'Are you sure you want to delete this category?', async () => {
      const updated = { ...expenseCategories }
      updated.categories = updated.categories.filter(cat => cat.id !== categoryId)
      if (await saveCategories(updated)) {
        setExpenseCategories(updated)
        addToast('Category deleted successfully', 'success')
      } else {
        addToast('Error deleting category. Please try again.', 'error')
      }
    }, 'danger', 'Delete')
  }

  // ===== Items inside categories (e.g., Ads -> FB Ads, Google Ads) =====
  const handleAddItem = (categoryId) => {
    setEditingItem({ categoryId, itemId: null })
    setItemFormData({ name: '' })
  }

  const handleEditItem = (categoryId, item) => {
    setEditingItem({ categoryId, itemId: item.id })
    setItemFormData({ name: item.name })
  }

  const handleCancelItem = () => {
    setEditingItem(null)
    setItemFormData({ name: '' })
  }

  const handleSaveItem = async () => {
    const categoryId = editingItem?.categoryId
    if (!categoryId) return
    const name = (itemFormData.name || '').trim()
    if (!name) {
      addToast('Please enter an item name', 'warning')
      return
    }

    const updated = { ...expenseCategories }
    const categoryIndex = updated.categories.findIndex(c => c.id === categoryId)
    if (categoryIndex === -1) return
    const cat = updated.categories[categoryIndex]
    cat.items = Array.isArray(cat.items) ? cat.items : []

    const exists = cat.items.some(it =>
      (it.name || '').toLowerCase() === name.toLowerCase() && it.id !== editingItem.itemId
    )
    if (exists) {
      addToast('That item already exists in this category.', 'warning')
      return
    }

    if (editingItem.itemId) {
      cat.items = cat.items.map(it => it.id === editingItem.itemId ? { ...it, name } : it)
    } else {
      cat.items = [...cat.items, { id: generateId(), name }]
    }

    if (await saveCategories(updated)) {
      setExpenseCategories(updated)
      handleCancelItem()
      addToast(editingItem.itemId ? 'Item updated successfully' : 'Item added successfully', 'success')
    }
  }

  const handleDeleteItem = (categoryId, itemId) => {
    showConfirm('Delete Item', 'Are you sure you want to delete this item?', async () => {
      const updated = { ...expenseCategories }
      const categoryIndex = updated.categories.findIndex(c => c.id === categoryId)
      if (categoryIndex === -1) return
      const cat = updated.categories[categoryIndex]
      cat.items = (Array.isArray(cat.items) ? cat.items : []).filter(it => it.id !== itemId)
      if (await saveCategories(updated)) {
        setExpenseCategories(updated)
        addToast('Item deleted successfully', 'success')
      }
    }, 'danger', 'Delete')
  }

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
            Expense Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage expense categories
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
                placeholder="e.g., Material, Operational, Transport"
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

      {/* Categories List */}
      {expenseCategories.categories.length === 0 ? (
        <div className="card" style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <DollarSign size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No categories yet</p>
          <p style={{ fontSize: '0.875rem' }}>Click "Add Category" to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {expenseCategories.categories.map((category) => (
            <div key={category.id} className="card">
              {/* Category Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flex: 1
                }}>
                  <DollarSign size={20} color="var(--accent-primary)" />
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0
                    }}>
                      {category.name}
                    </h3>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Show/Hide Items"
                  >
                    <Tag size={16} />
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

              {expandedCategories[category.id] && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
                      Items (shown in Add Expense form)
                    </p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAddItem(category.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Plus size={16} />
                      Add Item
                    </button>
                  </div>

                  {editingItem?.categoryId === category.id && (
                    <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="form-group">
                        <label className="form-label">Item Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={itemFormData.name}
                          onChange={(e) => setItemFormData({ name: e.target.value })}
                          placeholder="e.g., FB Ads, Google Ads"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveItem()
                            if (e.key === 'Escape') handleCancelItem()
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={handleCancelItem}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSaveItem}>Save Item</button>
                      </div>
                    </div>
                  )}

                  {(Array.isArray(category.items) ? category.items : []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', padding: '0.75rem', textAlign: 'center' }}>
                      No items yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Item</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', width: '160px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Array.isArray(category.items) ? category.items : []).map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{item.name}</td>
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditItem(category.id, item)}>
                                    <Edit2 size={16} />
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteItem(category.id, item.id)}>
                                    <Trash2 size={16} />
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

export default ExpenseManagement
