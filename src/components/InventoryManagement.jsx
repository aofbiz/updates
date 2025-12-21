import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Package, Tag } from 'lucide-react'
import { getInventoryCategories, saveInventoryCategories, saveInventory } from '../utils/storage'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const InventoryManagement = ({ inventory, onUpdateInventory }) => {
  const { addToast } = useToast()
  const [inventoryCategories, setInventoryCategories] = useState({ categories: [] })
  const [editingCategory, setEditingCategory] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [categoryFormData, setCategoryFormData] = useState({ name: '' })
  const [editingItem, setEditingItem] = useState(null)
  const [itemFormData, setItemFormData] = useState({
    name: '',
    reorderLevel: 0,
    unitCost: 0,
    supplier: '',
    currentStock: 0
  })

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
    loadInventoryCategories()
  }, [])

  const loadInventoryCategories = async () => {
    const data = await getInventoryCategories()
    setInventoryCategories(data)
    const expanded = {}
    if (data && data.categories) {
      data.categories.forEach(cat => {
        expanded[cat.id] = false
      })
    }
    setExpandedCategories(expanded)
  }

  const saveCategories = async (data) => {
    const success = await saveInventoryCategories(data)
    if (!success) {
      addToast('Error saving inventory categories. Please try again.', 'error')
    }
    return success
  }

  const handleAddCategory = () => {
    setCategoryFormData({ name: '' })
    setEditingCategory(null)
    setShowCategoryForm(true)
  }

  const handleEditCategory = (category) => {
    setCategoryFormData({ name: category.name })
    setEditingCategory(category)
    setShowCategoryForm(true)
  }

  const handleDeleteCategory = (categoryId) => {
    showConfirm('Delete Category', 'Are you sure you want to delete this category? This will also delete all items in this category.', async () => {
      // Remove items from inventory that belong to this category
      const category = inventoryCategories.categories.find(cat => cat.id === categoryId)
      if (category) {
        const updatedInventory = inventory.filter(item => item.category !== category.name)
        await saveInventory(updatedInventory)
        if (onUpdateInventory) {
          onUpdateInventory(updatedInventory)
        }
      }

      const updatedCategories = {
        categories: inventoryCategories.categories.filter(cat => cat.id !== categoryId)
      }
      const success = await saveCategories(updatedCategories)
      if (success) {
        setInventoryCategories(updatedCategories)
        addToast('Category deleted successfully', 'success')
      }
    }, 'danger', 'Delete')
  }

  const handleSaveCategory = async (e) => {
    e.preventDefault()
    if (!categoryFormData.name.trim()) {
      addToast('Category name is required', 'warning')
      return
    }

    let updatedCategories
    if (editingCategory) {
      // Update existing category
      const oldCategoryName = editingCategory.name
      updatedCategories = {
        categories: inventoryCategories.categories.map(cat =>
          cat.id === editingCategory.id
            ? { ...cat, name: categoryFormData.name.trim() }
            : cat
        )
      }

      // Update inventory items with old category name
      const updatedInventory = inventory.map(item =>
        item.category === oldCategoryName
          ? { ...item, category: categoryFormData.name.trim() }
          : item
      )
      await saveInventory(updatedInventory)
      if (onUpdateInventory) {
        onUpdateInventory(updatedInventory)
      }
    } else {
      // Add new category
      const newCategory = {
        id: Date.now().toString(),
        name: categoryFormData.name.trim(),
        items: []
      }
      updatedCategories = {
        categories: [...inventoryCategories.categories, newCategory]
      }
    }

    const success = await saveCategories(updatedCategories)
    if (success) {
      setInventoryCategories(updatedCategories)
      setShowCategoryForm(false)
      setCategoryFormData({ name: '' })
      setEditingCategory(null)
      addToast(editingCategory ? 'Category updated successfully' : 'Category added successfully', 'success')
    }
  }

  const handleAddItem = (categoryId) => {
    const category = inventoryCategories.categories.find(cat => cat.id === categoryId)
    setItemFormData({
      name: '',
      reorderLevel: 0,
      unitCost: 0,
      supplier: '',
      currentStock: 0
    })
    setEditingItem(null)
    setEditingCategory(category)
    setShowCategoryForm(false)
  }

  const handleEditItem = (item) => {
    setItemFormData({
      name: item.itemName,
      reorderLevel: item.reorderLevel,
      unitCost: item.unitCost,
      supplier: item.supplier || '',
      currentStock: item.currentStock
    })
    setEditingItem(item)
    const category = inventoryCategories.categories.find(cat => cat.name === item.category)
    setEditingCategory(category)
    setShowCategoryForm(false)
  }

  const handleDeleteItem = (itemId) => {
    showConfirm('Delete Item', 'Are you sure you want to delete this item?', async () => {
      const updatedInventory = inventory.filter(item => item.id !== itemId)
      const success = await saveInventory(updatedInventory)
      if (success) {
        if (onUpdateInventory) {
          onUpdateInventory(updatedInventory)
        }
        addToast('Item deleted successfully', 'success')
      } else {
        addToast('Error deleting item. Please try again.', 'error')
      }
    }, 'danger', 'Delete')
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    if (!itemFormData.name.trim()) {
      addToast('Item name is required', 'warning')
      return
    }

    if (!editingCategory) {
      addToast('Please select a category first', 'warning')
      return
    }

    const itemData = {
      id: editingItem ? editingItem.id : Date.now().toString(),
      itemName: itemFormData.name.trim(),
      category: editingCategory.name,
      currentStock: parseFloat(itemFormData.currentStock) || 0,
      reorderLevel: parseFloat(itemFormData.reorderLevel) || 0,
      unitCost: parseFloat(itemFormData.unitCost) || 0,
      supplier: itemFormData.supplier.trim() || ''
    }

    let updatedInventory
    if (editingItem) {
      updatedInventory = inventory.map(item =>
        item.id === editingItem.id ? itemData : item
      )
    } else {
      updatedInventory = [...inventory, itemData]
    }

    const success = await saveInventory(updatedInventory)
    if (success) {
      if (onUpdateInventory) {
        onUpdateInventory(updatedInventory)
      }
      setItemFormData({
        name: '',
        reorderLevel: 0,
        unitCost: 0,
        supplier: '',
        currentStock: 0
      })
      setEditingItem(null)
      setEditingCategory(null)
      addToast(editingItem ? 'Item updated successfully' : 'Item added successfully', 'success')
    } else {
      addToast('Error saving item. Please try again.', 'error')
    }
  }

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  const getCategoryItems = (categoryName) => {
    return inventory.filter(item => item.category === categoryName)
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Package size={24} />
          Inventory Management
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Manage inventory categories and items with stock details
        </p>
      </div>

      {/* Category Form */}
      {showCategoryForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h3>
            <button
              onClick={() => {
                setShowCategoryForm(false)
                setEditingCategory(null)
                setCategoryFormData({ name: '' })
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSaveCategory}>
            <div className="form-group">
              <label className="form-label">Category Name *</label>
              <input
                type="text"
                className="form-input"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ name: e.target.value })}
                placeholder="e.g., Frames, Materials, Tools"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowCategoryForm(false)
                  setEditingCategory(null)
                  setCategoryFormData({ name: '' })
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Save size={16} style={{ marginRight: '0.5rem' }} />
                {editingCategory ? 'Update' : 'Add'} Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Item Form */}
      {editingCategory && !showCategoryForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingItem ? 'Edit Item' : `Add Item to ${editingCategory.name}`}
            </h3>
            <button
              onClick={() => {
                setEditingCategory(null)
                setEditingItem(null)
                setItemFormData({
                  name: '',
                  reorderLevel: 0,
                  unitCost: 0,
                  supplier: '',
                  currentStock: 0
                })
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSaveItem}>
            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input
                type="text"
                className="form-input"
                value={itemFormData.name}
                onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                placeholder="e.g., 8x10 Frame, Glass Sheet"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input
                  type="number"
                  className="form-input"
                  value={itemFormData.currentStock}
                  onChange={(e) => setItemFormData({ ...itemFormData, currentStock: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reorder Level *</label>
                <input
                  type="number"
                  className="form-input"
                  value={itemFormData.reorderLevel}
                  onChange={(e) => setItemFormData({ ...itemFormData, reorderLevel: e.target.value })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Unit Cost (Rs.)</label>
                <input
                  type="number"
                  className="form-input"
                  value={itemFormData.unitCost}
                  onChange={(e) => setItemFormData({ ...itemFormData, unitCost: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemFormData.supplier}
                  onChange={(e) => setItemFormData({ ...itemFormData, supplier: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingCategory(null)
                  setEditingItem(null)
                  setItemFormData({
                    name: '',
                    reorderLevel: 0,
                    unitCost: 0,
                    supplier: '',
                    currentStock: 0
                  })
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Save size={16} style={{ marginRight: '0.5rem' }} />
                {editingItem ? 'Update' : 'Add'} Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleAddCategory} className="btn btn-primary">
          <Plus size={16} style={{ marginRight: '0.5rem' }} />
          Add Category
        </button>
      </div>

      {inventoryCategories.categories.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Package size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>
            No inventory categories yet. Add your first category to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {inventoryCategories.categories.map(category => {
            const categoryItems = getCategoryItems(category.name)
            const isExpanded = expandedCategories[category.id]

            return (
              <div key={category.id} className="card">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '0.5rem 0'
                }}
                  onClick={() => toggleCategory(category.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Tag size={20} color="var(--accent-primary)" />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {category.name}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddItem(category.id)
                      }}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Add Item"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditCategory(category)
                      }}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Edit Category"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCategory(category.id)
                      }}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--error)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && categoryItems.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>Item Name</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>Stock</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>Reorder Level</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>Unit Cost</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', color: 'var(--text-primary)' }}>{item.itemName}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-primary)' }}>
                              {item.currentStock.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {item.reorderLevel.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-primary)' }}>
                              Rs.{item.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleEditItem(item)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--error)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
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
            )
          })}
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

export default InventoryManagement

