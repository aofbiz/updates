import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { markTrackingNumberAsUsed } from '../utils/storage'
import TrackingNumberInput from './TrackingNumberInput'
import { useToast } from './Toast/ToastContext'

const TrackingNumberModal = ({ order, targetStatus = 'Packed', onClose, onSave }) => {
  const { addToast } = useToast()
  // Handle Esc key press
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const [trackingNumber, setTrackingNumber] = useState(order?.trackingNumber || '')

  const handleChange = (e) => {
    const { value } = e.target
    setTrackingNumber(value)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const updatedOrder = {
      ...order,
      status: targetStatus,
      trackingNumber: trackingNumber || ''
    }

    // Mark tracking number as used if provided and changed
    // Only mark as used if it changed from blank to something, or changed value
    if (updatedOrder.trackingNumber && (!order?.trackingNumber || order.trackingNumber !== updatedOrder.trackingNumber)) {
      try {
        await markTrackingNumberAsUsed(updatedOrder.trackingNumber)
      } catch (error) {
        console.error('Error marking tracking number as used:', error)
      }
    }

    onSave(updatedOrder)
    addToast('Order updated successfully', 'success')
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Enter Tracking Number</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Order ID</label>
            <input
              type="text"
              className="form-input"
              value={order?.id || ''}
              readOnly
              style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <input
              type="text"
              className="form-input"
              value={targetStatus}
              readOnly
              style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tracking Number *</label>
            <TrackingNumberInput
              value={trackingNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Tracking
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TrackingNumberModal


