import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2, Edit2, X, Tag } from 'lucide-react'
import { getOrderSources, saveOrderSources, renameOrderSourceInOrders } from '../utils/storage'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const normalizeName = (name) => (name || '').trim()

const makeIdFromName = (name) => {
  const n = normalizeName(name)
  if (!n) return Date.now().toString()
  // stable-ish id: keep it readable
  return n
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 60) || Date.now().toString()
}

const OrderSourcesManagement = () => {
  const { addToast } = useToast()
  const [sources, setSources] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingOriginalName, setEditingOriginalName] = useState(null)
  const [formName, setFormName] = useState('')
  const [showForm, setShowForm] = useState(false)

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
    const load = async () => {
      const data = await getOrderSources()
      setSources(Array.isArray(data) ? data : [])
    }
    load()
  }, [])

  const sortedSources = useMemo(() => {
    return [...(sources || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [sources])

  const startAdd = () => {
    setEditingId(null)
    setFormName('')
    setShowForm(true)
  }

  const startEdit = (src) => {
    setEditingId(src.id)
    setFormName(src.name || '')
    setEditingOriginalName(src.name || '')
    setShowForm(true)
  }

  const cancel = () => {
    setEditingId(null)
    setEditingOriginalName(null)
    setFormName('')
    setShowForm(false)
  }

  const persist = async (next) => {
    const ok = await saveOrderSources(next)
    if (!ok) {
      addToast('Failed to save order sources. Please try again.', 'error')
      return false
    }
    setSources(next)
    // notify other screens to refresh their source lists
    window.dispatchEvent(new CustomEvent('orderSourcesUpdated'))
    return true
  }

  const save = async () => {
    const name = normalizeName(formName)
    if (!name) {
      addToast('Please enter a source name', 'warning')
      return
    }

    // prevent duplicates by name (case-insensitive)
    const existsByName = sources.some(s => (s.name || '').toLowerCase() === name.toLowerCase() && s.id !== editingId)
    if (existsByName) {
      addToast('That source already exists.', 'warning')
      return
    }

    let next
    if (editingId) {
      next = sources.map(s => (s.id === editingId ? { ...s, name } : s))
    } else {
      next = [...sources, { id: makeIdFromName(name), name }]
    }

    // If renaming an existing source, update existing orders to keep them consistent
    if (editingId && editingOriginalName && editingOriginalName !== name) {
      await renameOrderSourceInOrders(editingOriginalName, name)
      // also notify that orders data may need refresh
      window.dispatchEvent(new CustomEvent('ordersUpdated', { detail: { type: 'orderSourceRenamed', oldName: editingOriginalName, newName: name } }))
    }

    const ok = await persist(next)
    if (ok) cancel()
  }

  const remove = (src) => {
    showConfirm('Delete Source', `Delete order source "${src.name}"?`, async () => {
      const next = sources.filter(s => s.id !== src.id)
      const ok = await persist(next)
      if (ok) {
        addToast('Order source deleted successfully', 'success')
      }
    }, 'danger', 'Delete')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Manage the list of order sources used in the New Order form and future reports.
        </div>
        <button className="btn btn-primary" onClick={startAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} />
          Add Source
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Tag size={18} color="var(--text-muted)" />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingId ? 'Edit Source' : 'New Source'}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source Name</label>
            <input
              className="form-input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Ads, Organic, Marketplace, Referral"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={cancel} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <X size={18} />
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={18} />
              Save
            </button>
          </div>
        </div>
      )}

      {sortedSources.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          No order sources yet. Click “Add Source” to create one.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.9rem 1rem', textAlign: 'left' }}>Source</th>
                <th style={{ padding: '0.9rem 1rem', textAlign: 'right', width: '160px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSources.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => startEdit(s)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Edit2 size={16} />
                        Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => remove(s)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default OrderSourcesManagement


