import { useState, useEffect, useMemo, useRef } from 'react'
import { X, Plus, Trash2, Paperclip, Image as ImageIcon, Loader, RefreshCw, Crown, ChevronLeft, ChevronRight, Check, ChevronDown } from 'lucide-react'
import CustomDropdown from './Common/CustomDropdown'
import CustomDatePicker from './Common/CustomDatePicker'
import FormValidation from './FormValidation'
import { useLicensing } from './LicensingContext'
import { useToast } from './Toast/ToastContext'
import { calculateNextOrderNumber, markTrackingNumberAsUsed, getProducts, getOrders, getOrderSources, getSettings, getTotalMonthlyRecordsCount } from '../utils/storage'
import { uploadOrderItemImage, deleteOrderItemImage } from '../utils/fileStorage'
import { formatWhatsAppForStorage } from '../utils/whatsapp'
import { toTitleCase, toSentenceCase } from '../utils/textUtils'
import TrackingNumberInput from './TrackingNumberInput'
import { curfoxService } from '../utils/curfox'
import OrderFormCustomer from './OrderForm/OrderFormCustomer'
import OrderFormItems from './OrderForm/OrderFormItems'
import OrderFormPricing from './OrderForm/OrderFormPricing'
import OrderFormLogistics from './OrderForm/OrderFormLogistics'

// Sri Lankan Districts
const SRI_LANKAN_DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
  'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
  'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
  'Matale', 'Matara', 'Moneragala', 'Mullaitivu', 'Nuwara Eliya',
  'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const OrderForm = ({ order, onClose, onSave, checkIsBlacklisted, onBlacklistWarning }) => {
  const { isFreeUser } = useLicensing()
  const { addToast } = useToast()
  const [products, setProducts] = useState({ categories: [] })
  const [orderSources, setOrderSources] = useState([])
  const [districts, setDistricts] = useState(SRI_LANKAN_DISTRICTS)
  const [isCurfoxEnabled, setIsCurfoxEnabled] = useState(false)
  const [curfoxCities, setCurfoxCities] = useState([]) // All cities
  const [availableCities, setAvailableCities] = useState([]) // Filtered by district

  const [codManuallyEdited, setCodManuallyEdited] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [discountType, setDiscountType] = useState(order?.discountType || 'Rs')

  // Mobile Wizard State
  const [currentStep, setCurrentStep] = useState(1)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [validationErrors, setValidationErrors] = useState({})


  const WIZARD_STEPS = [
    { id: 1, name: 'Customer', shortName: 'Customer' },
    { id: 2, name: 'Items', shortName: 'Items' },
    { id: 3, name: 'Pricing', shortName: 'Pricing' },
    { id: 4, name: 'Details', shortName: 'Details' }
  ]

  // Detect mobile viewport
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [orderItems, setOrderItems] = useState(() => {
    if (Array.isArray(order?.orderItems) && order.orderItems.length > 0) {
      return order.orderItems.map(it => ({
        id: it.id || (Date.now().toString() + Math.random().toString(36).slice(2, 7)),
        categoryId: it.categoryId || '',
        itemId: it.itemId || '',
        customItemName: it.customItemName || '',
        name: it.name || it.itemName || it.customItemName || '',
        quantity: it.quantity ?? 1,
        unitPrice: it.unitPrice ?? 0,
        notes: it.notes || '',
        image: it.image || null
      }))
    }
    return [{
      id: Date.now().toString(),
      categoryId: order?.categoryId || '',
      itemId: order?.itemId || '',
      customItemName: order?.customItemName || '',
      name: order?.name || order?.customItemName || '',
      quantity: order?.quantity ?? 1,
      unitPrice: order?.unitPrice ?? 0,
      notes: '',
      image: null
    }]
  })

  // Handle search queries initialization


  const getCategoryById = (categoryId) => products.categories.find(cat => cat.id === categoryId)
  const isCustomCategory = (categoryId) => {
    if (!categoryId) return false
    const category = getCategoryById(categoryId)
    return category?.name?.toLowerCase() === 'custom'
  }

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

  // Load products and get order number
  useEffect(() => {
    const loadData = async () => {
      const productsData = await getProducts()
      setProducts(productsData)

      const sourcesData = await getOrderSources()
      setOrderSources(Array.isArray(sourcesData) ? sourcesData : [])

      // Get order number if creating new order (calculate based on last saved order)
      if (!order?.id) {
        const ordersData = await getOrders()
        // Calculate next number based on last saved order
        const nextOrderNumber = calculateNextOrderNumber(ordersData)
        setOrderNumber(nextOrderNumber)
      } else {
        setOrderNumber(order.id)
      }

      // Load specific settings like default delivery charge
      const settings = await getSettings()
      if (!order && settings?.general?.defaultDeliveryCharge) {
        setFormData(prev => ({ ...prev, deliveryCharge: settings.general.defaultDeliveryCharge }))
      }
    }


    const applyCurfoxData = (districtsData, citiesData) => {
      if (districtsData && districtsData.length > 0) {
        const districtNames = districtsData.map(d => d.name || d.state_name).filter(Boolean)
        if (districtNames.length > 0) setDistricts(districtNames.sort())
      }
      if (citiesData && citiesData.length > 0) {
        setCurfoxCities(citiesData)
        // Initial filter if editing an order
        if (formData.district) {
          const dist = formData.district.toLowerCase()
          const filtered = citiesData.filter(c =>
            (c.district_name?.toLowerCase() === dist) ||
            (c.district?.toLowerCase() === dist) ||
            (c.state_name?.toLowerCase() === dist)
          ).map(c => c.name || c.city_name || c)
          setAvailableCities(filtered.sort())
        }
      }
    }

    const handleCurfoxDataUpdate = (e) => {
      const { districts, cities } = e.detail || {}
      applyCurfoxData(districts, cities)
    }

    const loadCurfoxData = async () => {
      const settings = await getSettings()
      if (!settings?.curfox?.enabled) return

      setIsCurfoxEnabled(true)

      // 1. Try Cache
      try {
        const cachedD = localStorage.getItem('curfox_cache_districts')
        const cachedC = localStorage.getItem('curfox_cache_cities')
        if (cachedD && cachedC) {
          applyCurfoxData(JSON.parse(cachedD), JSON.parse(cachedC))
        }
      } catch (e) {
        console.error("Error reading Curfox cache", e)
      }
    }

    loadData()
    loadCurfoxData()

    // 2. Listen for updates (in case OrderForm opened before AuthHandler finished)
    window.addEventListener('curfoxDataUpdated', handleCurfoxDataUpdate)

    // Cleanup event listener
    return () => {
      window.removeEventListener('curfoxDataUpdated', handleCurfoxDataUpdate)
    }
  }, [])

  // Refresh sources in real-time when settings change
  useEffect(() => {
    const handler = async () => {
      const sourcesData = await getOrderSources()
      setOrderSources(Array.isArray(sourcesData) ? sourcesData : [])
    }
    window.addEventListener('orderSourcesUpdated', handler)
    return () => window.removeEventListener('orderSourcesUpdated', handler)
  }, [])

  const deliveryChargeDefault = 400

  const today = new Date().toISOString().split('T')[0]
  const [orderNumber, setOrderNumber] = useState(order?.id || '')

  const [formData, setFormData] = useState(() => {
    // Attempt to restore drafted data for new orders
    if (!order) {
      try {
        const draft = sessionStorage.getItem('allset_order_form_draft')
        if (draft) return JSON.parse(draft)
      } catch (e) {
        console.warn('Failed to restore order draft', e)
      }
    }

    return {
      customerName: order?.customerName || '',
      address: order?.address || '',
      phone: order?.phone || '',
      whatsapp: order?.whatsapp || '',
      nearestCity: order?.nearestCity || '',
      district: order?.district || '',
      // legacy fields are derived from orderItems on submit
      totalPrice: order?.totalPrice || 0,
      discount: order?.discount || 0,
      codAmount: order?.codAmount || 0,
      deliveryCharge: order?.deliveryCharge ?? deliveryChargeDefault,
      notes: order?.notes || '',
      status: order?.status || 'New Order',
      paymentStatus: order?.paymentStatus || 'Pending',
      dispatchDate: order?.dispatchDate || '',
      trackingNumber: order?.trackingNumber || '',
      orderDate: order?.orderDate || today,
      scheduledDeliveryDate: order?.scheduledDeliveryDate || order?.deliveryDate || '',
      orderSource: order?.orderSource || 'Ad', // Default to 'Ad'
      advancePayment: order?.advancePayment || 0,
      paymentMethod: order?.paymentMethod || 'COD'
    }
  })

  // Draft persistence logic
  useEffect(() => {
    if (!order) {
      sessionStorage.setItem('allset_order_form_draft', JSON.stringify(formData))
    }
  }, [formData, order])

  // Clear draft on successful save or close
  const clearDraft = () => sessionStorage.removeItem('allset_order_form_draft')

  const subtotal = useMemo(() => {
    return (orderItems || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
  }, [orderItems])

  const discountAmount = useMemo(() => {
    let discountAmount = 0
    if (discountType === '%') {
      discountAmount = (subtotal * (Number(formData.discount) || 0)) / 100
    } else {
      discountAmount = Number(formData.discount) || 0
    }
    return Math.max(0, discountAmount)
  }, [discountType, subtotal, formData.discount])

  const computedTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount)
  }, [subtotal, discountAmount])

  // --- Image Upload Logic ---
  const fileInputRef = useRef(null)
  const [activeItemForUpload, setActiveItemForUpload] = useState(null)
  const [uploadingItemIds, setUploadingItemIds] = useState(new Set())

  const handleUploadClick = (itemId) => {
    setActiveItemForUpload(itemId)
    if (fileInputRef.current) {
      fileInputRef.current.value = '' // Reset
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeItemForUpload) return

    // Mark item as uploading
    setUploadingItemIds(prev => new Set(prev).add(activeItemForUpload))

    try {
      // Use current order ID or a temp one if new
      const oid = orderNumber || 'temp_' + Date.now()
      const url = await uploadOrderItemImage(file, oid, activeItemForUpload)

      if (url) {
        updateItem(activeItemForUpload, { image: url })
      } else {
        alert("Failed to upload image. Please check your internet or try again.")
      }
    } catch (err) {
      console.error(err)
      alert("Error uploading image")
    } finally {
      setUploadingItemIds(prev => {
        const next = new Set(prev)
        next.delete(activeItemForUpload)
        return next
      })
      setActiveItemForUpload(null)
    }
  }

  const handleRemoveImage = async (itemId, imageUrl) => {
    if (!confirm("Are you sure you want to remove this image?")) return

    // Optimistic update
    updateItem(itemId, { image: null })

    // Background delete
    await deleteOrderItemImage(imageUrl)
  }
  // --------------------------

  const computedCod = useMemo(() => {
    const delivery = Number(formData.deliveryCharge) || 0
    const advance = Number(formData.advancePayment) || 0
    return Math.max(0, computedTotal + delivery - advance) // COD still includes delivery
  }, [computedTotal, formData.deliveryCharge, formData.advancePayment])

  const computedBalance = useMemo(() => {
    const advance = Number(formData.advancePayment) || 0
    return Math.max(0, computedTotal - advance)
  }, [computedTotal, formData.advancePayment])

  useEffect(() => {
    // keep total/cod in sync unless user manually edited COD
    setFormData(prev => ({
      ...prev,
      totalPrice: computedTotal,
      codAmount: codManuallyEdited ? prev.codAmount : computedCod
    }))
  }, [computedTotal, computedCod, codManuallyEdited])


  // Filter cities when district changes
  useEffect(() => {
    if (isCurfoxEnabled && formData.district) {
      // Assuming curfoxCities is array of objects { name, district_name, ... } or similar
      // Adjust matching logic based on actual data structure. 
      // For now, assuming simple string matching or object structure
      const filtered = curfoxCities.filter(c =>
        (c.district_name && c.district_name.toLowerCase() === formData.district.toLowerCase()) ||
        (c.district && c.district.toLowerCase() === formData.district.toLowerCase())
      ).map(c => c.name || c.city_name || c)

      setAvailableCities(filtered.sort())
    } else {
      setAvailableCities([])
    }
  }, [formData.district, curfoxCities, isCurfoxEnabled])

  const handleChange = (e) => {
    const { name, value } = e.target
    let updatedData = { ...formData }

    // Apply Capitalization Rules
    if (name === 'customerName' || name === 'nearestCity' || name === 'district') {
      updatedData[name] = toTitleCase(value)
    } else if (name === 'address' || name === 'notes') {
      updatedData[name] = toSentenceCase(value)
    } else {
      updatedData[name] = value
    }

    // Handle discount type change
    if (name === 'discountType') {
      setDiscountType(value)
    }

    // Handle numeric fields
    if (name === 'discount' || name === 'deliveryCharge' || name === 'advancePayment') {
      updatedData[name] = parseFloat(value) || 0
    }

    // Handle COD amount (manual override)
    if (name === 'codAmount') {
      updatedData.codAmount = parseFloat(value) || 0
      setCodManuallyEdited(true)
    }

    // Handle Payment Method
    if (name === 'paymentMethod') {
      updatedData.paymentMethod = value
      updatedData.paymentStatus = value === 'COD' ? 'Pending' : 'Paid'
    }

    // Update available cities when district changes
    if (name === 'district') {
      const newDistrict = value
      if (isCurfoxEnabled && curfoxCities.length > 0) {
        console.log('Filtering cities for district:', newDistrict)
        const dist = newDistrict.toLowerCase()
        const filtered = curfoxCities.filter(c =>
          (c.district_name && c.district_name.toLowerCase() === dist) ||
          (c.district && c.district.toLowerCase() === dist) ||
          // Fallback: check map provided earlier or fuzzy match
          (c.state_name && c.state_name.toLowerCase() === dist)
        ).map(c => c.name || c.city_name || c)

        console.log('Found cities:', filtered.length)
        setAvailableCities(filtered.sort())
      } else if (isCurfoxEnabled) {
        console.warn('Clearing available cities - Curfox enabled but cities list empty/loading.')
        setAvailableCities([])
      }
    }

    // Handle Status change for auto-generating dispatchDate
    if (name === 'status') {
      if (value === 'Dispatched') {
        updatedData.dispatchDate = new Date().toISOString()
      } else if (value !== 'Dispatched' && !order?.dispatchDate) {
        // Only clear it if it wasn't already set on an existing order
        updatedData.dispatchDate = ''
      }
    }

    setFormData(updatedData)
  }

  // Effect to re-filter cities if curfoxCities loads AFTER district is selected
  useEffect(() => {
    if (isCurfoxEnabled && formData.district && curfoxCities.length > 0) {
      console.log('Refiltering cities effect (data loaded/changed). District:', formData.district)
      const dist = formData.district.toLowerCase()
      const filtered = curfoxCities.filter(c =>
        (c.district_name?.toLowerCase() === dist) ||
        (c.district?.toLowerCase() === dist) ||
        (c.state_name?.toLowerCase() === dist)
      ).map(c => c.name || c.city_name || c)

      // Only update if changed to avoid loop (simple length check is usually enough here)
      if (filtered.length !== availableCities.length) {
        console.log(`Updated available cities from ${availableCities.length} to ${filtered.length}`)
        setAvailableCities(filtered.sort())
      }
    }
  }, [curfoxCities, isCurfoxEnabled, formData.district])



  const updateItem = (id, patch) => {
    // Apply Capitalization Rules for patches
    const formattedPatch = { ...patch }
    if (formattedPatch.customItemName !== undefined) {
      formattedPatch.customItemName = toTitleCase(formattedPatch.customItemName)
      // Sync name if it's being updated alongside customItemName
      if (formattedPatch.name !== undefined) {
        formattedPatch.name = formattedPatch.customItemName
      }
    }
    if (formattedPatch.notes !== undefined) {
      formattedPatch.notes = toSentenceCase(formattedPatch.notes)
    }

    setOrderItems(prev => prev.map(it => it.id === id ? { ...it, ...formattedPatch } : it))
    setCodManuallyEdited(false)
  }

  const addMoreItem = () => {
    setOrderItems(prev => ([
      ...prev,
      { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), categoryId: '', itemId: '', customItemName: '', quantity: 1, unitPrice: 0, notes: '' }
    ]))
    setCodManuallyEdited(false)
  }

  const removeItem = async (id) => {
    const itemToRemove = orderItems.find(it => it.id === id)

    if (itemToRemove?.image) {
      if (confirm('This item has an attached image. Removing the item will permanently delete the image. Continue?')) {
        await deleteOrderItemImage(itemToRemove.image)
        setOrderItems(prev => {
          const next = prev.filter(it => it.id !== id)
          return next.length ? next : prev
        })
        setCodManuallyEdited(false)
      }
    } else {
      setOrderItems(prev => {
        const next = prev.filter(it => it.id !== id)
        return next.length ? next : prev
      })
      setCodManuallyEdited(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSaving) return

    // Validate all steps
    let allErrors = {}
    let firstInvalidStep = null

    for (let i = 1; i <= WIZARD_STEPS.length; i++) {
      const { valid, errors } = validateStep(i)
      if (!valid) {
        allErrors = { ...allErrors, ...errors }
        if (firstInvalidStep === null) firstInvalidStep = i
      }
    }

    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(allErrors)
      if (firstInvalidStep) setCurrentStep(firstInvalidStep)
      addToast('Please correct the highlighted errors.', 'warning')
      return
    }

    // Check Monthly Limit for Free Users
    if (isFreeUser && !order?.id) {
      const recordsCount = await getTotalMonthlyRecordsCount()
      if (recordsCount >= 30) {
        addToast('Free plan limit: 30 orders/month reached. Upgrade to Pro for unlimited orders! 🚀', 'error')
        setIsSaving(false)
        return
      }
    }

    setIsSaving(true)
    try {
      // Use the order number from the form (user can edit it)
      // If creating new order and number is empty, calculate next number
      let finalOrderNumber = orderNumber
      if (!order?.id && !finalOrderNumber) {
        const ordersData = await getOrders()
        finalOrderNumber = calculateNextOrderNumber(ordersData)
      }

      const cleanedItems = (orderItems || []).map(it => ({
        categoryId: it.categoryId || null,
        itemId: isCustomCategory(it.categoryId) ? null : (it.itemId || null),
        customItemName: isCustomCategory(it.categoryId) ? (it.customItemName || '') : null,
        name: it.name || it.customItemName || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        notes: (it.notes || '').toString(),
        image: it.image || null
      }))

      const first = cleanedItems[0] || {}

      const orderData = {
        ...formData,
        whatsapp: formatWhatsAppForStorage(formData.whatsapp),
        id: finalOrderNumber,
        // legacy single-item fields for compatibility
        categoryId: first.categoryId || null,
        itemId: first.itemId || null,
        customItemName: first.customItemName || null,
        quantity: first.quantity || 1,
        unitPrice: first.unitPrice || 0,
        // new multi-item fields
        orderItems: cleanedItems,
        deliveryCharge: Number(formData.deliveryCharge) || 0,
        discountType: discountType,
        totalPrice: computedTotal,
        totalAmount: computedTotal,
        codAmount: formData.codAmount,
        paymentMethod: formData.paymentMethod,
        scheduledDeliveryDate: formData.scheduledDeliveryDate || '',
        createdDate: order?.createdDate || today
      }

      // 1. Save the order first
      const success = await onSave(orderData)

      if (success) {
        // 2. ONLY if save was successful, mark tracking number as used
        if (orderData.trackingNumber && (!order || order.trackingNumber !== orderData.trackingNumber)) {
          try {
            await markTrackingNumberAsUsed(orderData.trackingNumber)
          } catch (error) {
            console.error('Error marking tracking number as used:', error)
          }
        }
        clearDraft()
        onClose()
      }
    } catch (error) {
      console.error('Submit Error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Validation for each wizard step - returns { valid: boolean, errors: {field: message}, firstError: string }
  const validateStep = (step) => {
    const errors = {}

    switch (step) {
      case 1:
        // Customer Details: Name, Address, WhatsApp, Date are required
        if (!formData.customerName?.trim()) errors.customerName = 'Customer Name is required'
        if (!formData.address?.trim()) errors.address = 'Address is required'
        if (!formData.whatsapp?.trim()) errors.whatsapp = 'WhatsApp Number is required'
        if (!formData.orderDate) errors.orderDate = 'Order Date is required'
        break
      case 2:
        // Items: At least one item with category and valid quantity/price
        const validItem = orderItems.some(it =>
          it.categoryId && (it.quantity > 0 || it.unitPrice > 0)
        )
        if (!validItem) errors.orderItems = 'Please add at least one item with category selected'
        break
      case 3:
        // Pricing: No strict validation needed
        break
      case 4:
        // Final step: Order Source is required (only for non-free users)
        if (!isFreeUser && !formData.orderSource) errors.orderSource = 'Order Source is required'
        break
      default:
        break
    }

    const errorKeys = Object.keys(errors)
    return {
      valid: errorKeys.length === 0,
      errors,
      firstError: errorKeys.length > 0 ? errors[errorKeys[0]] : null
    }
  }

  const handleNextStep = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const validation = validateStep(currentStep)
    if (!validation.valid) {
      setValidationErrors(validation.errors)
      addToast(validation.firstError, 'warning')
      return
    }

    // Clear errors and proceed
    setValidationErrors({})
    setCurrentStep(prev => prev + 1)
    document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePrevStep = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setValidationErrors({}) // Clear errors when going back
    setCurrentStep(prev => prev - 1)
    document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Helper to get error styling for input fields
  const getErrorStyle = (fieldName) => {
    if (validationErrors[fieldName]) {
      return {
        borderColor: 'var(--danger)',
        boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)'
      }
    }
    return {}
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="modal-content modal-content-transparent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', width: isMobile ? '100%' : '98vw', height: isMobile ? '100%' : '98vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={isMobile ? { flexDirection: 'column', alignItems: 'stretch', padding: '0.75rem 1rem' } : {}}>
          {isMobile ? (
            <>
              {/* Mobile: Title and Close */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {order ? 'Edit Order' : 'Add New Order'}
                </span>
                <button
                  className="modal-close"
                  onClick={onClose}
                  style={{ position: 'static', color: 'var(--text-primary)', background: 'var(--bg-secondary)', borderRadius: '50%', padding: '0.35rem' }}
                >
                  <X size={18} />
                </button>
              </div>
              {/* Step Name */}
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>
                Step {currentStep} of {WIZARD_STEPS.length}: <strong style={{ color: 'var(--accent-primary)' }}>{WIZARD_STEPS[currentStep - 1]?.name}</strong>
              </div>
              {/* Progress Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                {WIZARD_STEPS.map((step, idx) => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        transition: 'all 0.2s ease',
                        backgroundColor: currentStep === step.id
                          ? 'var(--accent-primary)'
                          : currentStep > step.id
                            ? 'var(--success)'
                            : 'var(--bg-secondary)',
                        color: currentStep >= step.id ? 'white' : 'var(--text-muted)'
                      }}
                    >
                      {currentStep > step.id ? <Check size={12} /> : step.id}
                    </div>
                    {idx < WIZARD_STEPS.length - 1 && (
                      <div style={{
                        flex: 1,
                        height: '2px',
                        backgroundColor: currentStep > step.id ? 'var(--success)' : 'var(--border-color)',
                        margin: '0 0.25rem'
                      }} />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="modal-title">
                {order ? 'Edit Order' : 'Add New Order'}
              </h2>
              <button className="modal-close" onClick={onClose}>
                <X size={20} />
              </button>
            </>
          )}
        </div>

        <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Hidden File Input for Image Uploads - Kept in Parent for Ref management */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="image/*"
          />

          <div className="modal-body" style={!isMobile ? {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1rem',
            padding: '1rem',
            overflow: 'hidden', // Columns scroll independently
            flex: 1,
            height: '100%'
          } : { overflowY: 'auto' }}>

            {/* --- DESKTOP VIEW --- */}
            {!isMobile && (
              <>
                {/* Left Column: Customer & Logistics */}
                <div style={{ overflowY: 'auto', paddingRight: '1rem', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="custom-scrollbar">
                  <OrderFormCustomer
                    formData={formData}
                    handleChange={handleChange}
                    setFormData={setFormData}
                    validationErrors={validationErrors}
                    getErrorStyle={getErrorStyle}
                    districts={districts}
                    availableCities={availableCities}
                    isFreeUser={isFreeUser}
                    isCurfoxEnabled={isCurfoxEnabled}
                    checkIsBlacklisted={checkIsBlacklisted}
                    onBlacklistWarning={onBlacklistWarning}
                    orderNumber={orderNumber}
                    setOrderNumber={setOrderNumber}
                    isMobile={false}
                  />
                  <OrderFormLogistics
                    formData={formData}
                    handleChange={handleChange}
                    validationErrors={validationErrors}
                    isFreeUser={isFreeUser}
                    isCurfoxEnabled={isCurfoxEnabled}
                    orderSources={orderSources}
                    isMobile={false}
                  />
                </div>

                {/* Middle Column: Items */}
                <div style={{ overflowY: 'auto', paddingRight: '1rem', paddingLeft: '0.5rem', borderRight: '1px solid var(--border-color)' }} className="custom-scrollbar">
                  <OrderFormItems
                    orderItems={orderItems}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    addMoreItem={addMoreItem}
                    handleUploadClick={handleUploadClick}
                    handleRemoveImage={handleRemoveImage}
                    uploadingItemIds={uploadingItemIds}
                    products={products}
                    validationErrors={validationErrors}
                    isFreeUser={isFreeUser}
                    isMobile={false}
                    today={today}
                    formData={formData}
                    handleChange={handleChange}
                  />
                </div>

                {/* Right Column: Pricing */}
                <div style={{ overflowY: 'auto', paddingLeft: '0.5rem' }} className="custom-scrollbar">
                  <OrderFormPricing
                    formData={formData}
                    handleChange={handleChange}
                    subtotal={subtotal}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    computedTotal={computedTotal}
                    computedBalance={computedBalance}
                    isFreeUser={isFreeUser}
                    isMobile={false}
                  />
                  {/* Save Buttons for Desktop */}
                  <div style={{ marginTop: 'auto', paddingTop: '1rem', position: 'sticky', bottom: 0 }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        style={{ flex: 1, justifyContent: 'center', padding: '0.75rem', fontSize: '1rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSaving}
                        style={{ flex: 2, justifyContent: 'center', padding: '0.75rem', fontSize: '1rem' }}
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                            Saving...
                          </>
                        ) : (
                          order ? 'Update Order' : 'Create Order'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* --- MOBILE WIZARD VIEW --- */}
            {isMobile && (
              <>
                {currentStep === 1 && (
                  <OrderFormCustomer
                    formData={formData}
                    handleChange={handleChange}
                    setFormData={setFormData}
                    validationErrors={validationErrors}
                    getErrorStyle={getErrorStyle}
                    districts={districts}
                    availableCities={availableCities}
                    isFreeUser={isFreeUser}
                    isCurfoxEnabled={isCurfoxEnabled}
                    checkIsBlacklisted={checkIsBlacklisted}
                    onBlacklistWarning={onBlacklistWarning}
                    orderNumber={orderNumber}
                    setOrderNumber={setOrderNumber}
                    isMobile={true}
                  />
                )}

                {currentStep === 2 && (
                  <OrderFormItems
                    orderItems={orderItems}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    addMoreItem={addMoreItem}
                    handleUploadClick={handleUploadClick}
                    handleRemoveImage={handleRemoveImage}
                    uploadingItemIds={uploadingItemIds}
                    products={products}
                    validationErrors={validationErrors}
                    isFreeUser={isFreeUser}
                    isMobile={true}
                    today={today}
                    formData={formData}
                    handleChange={handleChange}
                  />
                )}

                {currentStep === 3 && (
                  <OrderFormPricing
                    formData={formData}
                    handleChange={handleChange}
                    subtotal={subtotal}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    computedTotal={computedTotal}
                    computedBalance={computedBalance}
                    isFreeUser={isFreeUser}
                    isMobile={true}
                  />
                )}

                {currentStep === 4 && (
                  <OrderFormLogistics
                    formData={formData}
                    handleChange={handleChange}
                    validationErrors={validationErrors}
                    isFreeUser={isFreeUser}
                    isCurfoxEnabled={isCurfoxEnabled}
                    orderSources={orderSources}
                    isMobile={true}
                  />
                )}
              </>
            )}
          </div>

          {/* Mobile Footer (Nav) / Desktop Footer (Cancel but Save is in Right Col) */}
          {/* Note: Desktop Save is now in Right Column for better UX, but we can keep standard footer if preferred. 
              The Grid design benefits from "Submit" being near "Total". 
              I added Submit to Right Column above. I will hide standard footer for Desktop or use it for Cancel only.
          */}

          {isMobile ? (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total:</span>
                <span style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--accent-primary)'
                }}>
                  Rs. {(formData.codAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem', padding: 0, marginTop: 0 }}>
                {currentStep > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePrevStep}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <ChevronLeft size={18} /> Back
                  </button>
                )}

                {currentStep < 4 ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleNextStep}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    Next <ChevronRight size={18} />
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ flex: 1 }}>
                    {isSaving ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                        Saving...
                      </>
                    ) : (
                      order ? 'Update Order' : 'Create Order'
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Desktop Footer - Optional, as I put Save in the right column. 
            // But purely for "Cancel" or consistency, we can have it.
            // Actually, putting Save in the right column is better for specific context, 
            // but visually a bottom bar is more standard.
            // I'll keep the bottom bar for "Cancel" and maybe "Save Draft" if requested, 
            // or just a secondary Save button.
            null
            // I decided to hide the footer on desktop and put the primary action in the right column as implemented above.
            // Wait, does "Cancel" exist in desktop? Yes, the specific button in Grid Right Column is 'Create Order'. 
            // 'Cancel' is top right 'X'. 
            // Maybe adding a 'Cancel' button in the right column too?
            // I added it in the Right Column card area? No just Submit.
          )}
        </form>
      </div>
    </div>
  )
}

export default OrderForm
