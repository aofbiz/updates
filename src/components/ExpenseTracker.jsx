import { useState, useMemo, useEffect } from 'react'
import { Plus, Edit, Trash2, Filter } from 'lucide-react'
import ExpenseForm from './ExpenseForm'
import { saveExpenses } from '../utils/storage'
import { getMonthlyExpenses, getCategoryBreakdown } from '../utils/calculations'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast/ToastContext'

const ExpenseTracker = ({ expenses, onUpdateExpenses, triggerFormOpen, inventory, onUpdateInventory }) => {
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [dateFilter, setDateFilter] = useState('all')

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

  // Handle external form trigger (only when triggerFormOpen > 0)
  useEffect(() => {
    if (triggerFormOpen && triggerFormOpen > 0) {
      setEditingExpense(null)
      setShowForm(true)
    }
  }, [triggerFormOpen])

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const monthlyExpenses = useMemo(() => {
    return getMonthlyExpenses(expenses, currentMonth, currentYear)
  }, [expenses, currentMonth, currentYear])

  const categoryBreakdown = useMemo(() => {
    return getCategoryBreakdown(monthlyExpenses)
  }, [monthlyExpenses])

  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses]

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(expense => expense.category === categoryFilter)
    }

    if (dateFilter === 'month') {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date)
        return expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear
      })
    } else if (dateFilter === 'year') {
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.date)
        return expenseDate.getFullYear() === currentYear
      })
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [expenses, categoryFilter, dateFilter, currentMonth, currentYear])

  const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)

  const pieChartData = Object.entries(categoryBreakdown).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2))
  }))

  const COLORS = ['var(--accent-primary)', 'var(--success)', 'var(--warning)', 'var(--danger)', '#8b5cf6', '#ec4899']

  const handleSaveExpense = async (expenseData) => {
    try {
      let updatedExpenses
      if (editingExpense) {
        updatedExpenses = expenses.map(expense =>
          expense.id === expenseData.id ? expenseData : expense
        )
      } else {
        updatedExpenses = [...expenses, expenseData]
      }

      const saveSuccess = await saveExpenses(updatedExpenses)
      if (saveSuccess) {
        onUpdateExpenses(updatedExpenses)
        setEditingExpense(null)
        addToast(editingExpense ? 'Expense updated successfully' : 'Expense added successfully', 'success')
      } else {
        addToast('Failed to save expense. Please try again.', 'error')
        console.error('Failed to save expense to Supabase')
      }
    } catch (error) {
      console.error('Error saving expense:', error)
      addToast('Error saving expense: ' + error.message, 'error')
    }
  }

  const handleDelete = (expenseId) => {
    showConfirm('Delete Expense', 'Are you sure you want to delete this expense?', async () => {
      try {
        // Find the expense being deleted
        const expenseToDelete = expenses.find(expense => expense.id === expenseId)

        // If expense is linked to inventory, deduct the quantity from inventory stock
        if (expenseToDelete?.inventoryItemId && expenseToDelete?.quantity && inventory && onUpdateInventory) {
          const item = inventory.find(inv => inv.id === expenseToDelete.inventoryItemId)
          if (item) {
            const quantity = parseFloat(expenseToDelete.quantity) || 0
            const updatedInventory = inventory.map(inv =>
              inv.id === expenseToDelete.inventoryItemId
                ? { ...inv, currentStock: Math.max(0, inv.currentStock - quantity) } // Ensure stock doesn't go below 0
                : inv
            )
            const { saveInventory } = await import('../utils/storage')
            const inventorySaveSuccess = await saveInventory(updatedInventory)
            if (inventorySaveSuccess) {
              onUpdateInventory(updatedInventory)
            } else {
              console.error('Failed to update inventory stock')
              // Continue with expense deletion even if inventory update fails
            }
          }
        }

        // Delete the expense
        const updatedExpenses = expenses.filter(expense => expense.id !== expenseId)
        const saveSuccess = await saveExpenses(updatedExpenses)
        if (saveSuccess) {
          onUpdateExpenses(updatedExpenses)
          addToast('Expense deleted successfully', 'success')
        } else {
          addToast('Failed to delete expense. Please try again.', 'error')
          console.error('Failed to delete expense from Supabase')
        }
      } catch (error) {
        console.error('Error deleting expense:', error)
        addToast('Error deleting expense: ' + error.message, 'error')
      }
    }, 'danger', 'Delete')
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Expense Tracker
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Track and manage business expenses
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingExpense(null)
              setShowForm(true)
            }}
          >
            <Plus size={18} />
            Add Expense
          </button>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} color="var(--text-muted)" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Categories</option>
              <option value="Material">Material</option>
              <option value="Operational">Operational</option>
              <option value="Transport">Transport</option>
              <option value="Utilities">Utilities</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="card">
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem'
          }}>
            Monthly Total
          </p>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            Rs.{monthlyTotal.toLocaleString('en-IN')}
          </h3>
        </div>
        <div className="card">
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem'
          }}>
            Total Expenses
          </p>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            Rs.{expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0).toLocaleString('en-IN')}
          </h3>
        </div>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Category Breakdown Pie Chart */}
        <div className="card">
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: 'var(--text-primary)'
          }}>
            Category Breakdown (This Month)
          </h3>
          {pieChartData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No expenses this month
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) => `${name} ${(percent * 100).toFixed(0)}% (Rs.${value.toLocaleString('en-IN')})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-primary)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredExpenses.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No expenses found. Add your first expense to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{new Date(expense.date).toLocaleDateString('en-IN')}</td>
                    <td>{expense.item || expense.description}</td>
                    <td>
                      {expense.category && (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius)',
                          fontSize: '0.75rem',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)'
                        }}>
                          {expense.category}
                        </span>
                      )}
                    </td>
                    <td>{expense.quantity || '-'}</td>
                    <td>{expense.unitCost ? `Rs.${expense.unitCost.toLocaleString('en-IN')}` : '-'}</td>
                    <td style={{ fontWeight: 600 }}>
                      Rs.{(expense.total || expense.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(expense)}
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(expense.id)}
                          title="Delete"
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

      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          onClose={() => {
            setShowForm(false)
            setEditingExpense(null)
          }}
          onSave={handleSaveExpense}
          inventory={inventory}
          onUpdateInventory={onUpdateInventory}
        />
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

export default ExpenseTracker

