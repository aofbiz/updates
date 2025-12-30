// WhatsApp utility functions

/**
 * Formats a phone number for WhatsApp with Sri Lanka country code (+94)
 * Takes the last 9 digits and prefixes with +94
 * 
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} - Formatted number in format +94XXXXXXXXX
 * 
 * @example
 * formatWhatsAppNumber('0771234567') // Returns '+94771234567'
 * formatWhatsAppNumber('+94771234567') // Returns '+94771234567'
 * formatWhatsAppNumber('077 123 4567') // Returns '+94771234567'
 */
export const formatWhatsAppNumber = (phoneNumber) => {
  if (!phoneNumber) return ''

  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '')

  // If it's already a full international number starting with 94
  if (digitsOnly.startsWith('94') && digitsOnly.length === 11) {
    return `+${digitsOnly}`
  }

  // If it's a local number with 0 (e.g., 0771234567)
  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    return `+94${digitsOnly.slice(1)}`
  }

  // If it's a local number without 0 (e.g., 771234567)
  if (digitsOnly.length === 9 && !digitsOnly.startsWith('0')) {
    return `+94${digitsOnly}`
  }

  // If it's already formatted with +94
  if (phoneNumber.startsWith('+94') && digitsOnly.length === 11) {
    return `+${digitsOnly}`
  }

  // While typing or for other formats, return the digits or the original
  // But if it's already longer than 11, it might be a different international number
  // For now, let's keep it simple for the primary market (SL)

  // If it's a partial number starting with 0, don't prepend +94 yet
  if (digitsOnly.startsWith('0')) {
    return digitsOnly
  }

  return phoneNumber
}

/**
 * Formats WhatsApp number for storage (keeps in international format)
 * This ensures consistency when saving to database
 */
export const formatWhatsAppForStorage = (phoneNumber) => {
  return formatWhatsAppNumber(phoneNumber)
}

export const generateWhatsAppMessage = (template, order, context = {}) => {
  if (!template) return ''

  // Support for both camelCase and snake_case mapping from raw data to placeholders
  const getVal = (keys, fallback = 'N/A') => {
    for (const k of keys) {
      if (order[k] !== undefined && order[k] !== null && order[k] !== '') return order[k]
      if (context[k] !== undefined && context[k] !== null && context[k] !== '') return context[k]
    }
    return fallback
  }

  // Pre-calculate formatted values
  const subtotalStr = (context.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const totalStr = (context.finalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const discountStr = (context.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const deliveryStr = (context.deliveryCharge ?? 400).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const codStr = (context.codAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Define lookup map for a more flexible replacement
  const lookup = {
    order_id: getVal(['id', 'orderId', 'order_id']),
    orderid: getVal(['id', 'orderId', 'order_id']),
    quotation_number: getVal(['id', 'quotationId', 'quotation_id']),
    quotationnumber: getVal(['id', 'quotationId', 'quotation_id']),
    tracking_number: getVal(['trackingNumber', 'tracking_number']),
    trackingnumber: getVal(['trackingNumber', 'tracking_number']),
    customer_name: getVal(['customerName', 'customer_name']),
    customername: getVal(['customerName', 'customer_name']),
    address: getVal(['address', 'customer_address']),
    customer_address: getVal(['address', 'customer_address']),
    phone: getVal(['phone', 'customer_phone']),
    customer_phone: getVal(['phone', 'customer_phone']),
    whatsapp: getVal(['whatsapp', 'customer_whatsapp', 'phone']),
    customer_whatsapp: getVal(['whatsapp', 'customer_whatsapp', 'phone']),
    city: getVal(['nearestCity', 'nearest_city', 'city']),
    nearest_city: getVal(['nearestCity', 'nearest_city', 'city']),
    nearestcity: getVal(['nearestCity', 'nearest_city', 'city']),
    district: getVal(['district', 'district_name']),
    district_name: getVal(['district', 'district_name']),
    item_details: context.itemDetailsString || '',
    itemdetails: context.itemDetailsString || '',
    subtotal: subtotalStr,
    total_price: totalStr,
    totalprice: totalStr,
    discount: discountStr,
    delivery_charge: deliveryStr,
    deliverycharge: deliveryStr,
    cod_amount: codStr,
    codamount: codStr,
    order_date: getVal(['orderDate', 'order_date', 'createdDate', 'created_date']),
    orderdate: getVal(['orderDate', 'order_date', 'createdDate', 'created_date']),
    delivery_date: getVal(['deliveryDate', 'delivery_date']),
    deliverydate: getVal(['deliveryDate', 'delivery_date']),
    dispatch_date: getVal(['dispatchDate', 'dispatch_date']),
    dispatchdate: getVal(['dispatchDate', 'dispatch_date']),
    status: getVal(['status', 'order_status']),
    order_status: getVal(['status', 'order_status']),
    orderstatus: getVal(['status', 'order_status']),
    payment_status: getVal(['paymentStatus', 'payment_status']),
    paymentstatus: getVal(['paymentStatus', 'payment_status']),
    notes: getVal(['notes']),
    source: getVal(['orderSource', 'order_source', 'source']),
    order_source: getVal(['orderSource', 'order_source', 'source']),
    ordersource: getVal(['orderSource', 'order_source', 'source']),
    total_quantity: context.totalQuantity || 0,
    total_items: context.totalItems || 0,
    totalquantity: context.totalQuantity || 0,
    totalitems: context.totalItems || 0
  }

  // Regex to match {{ placeholder }} with optional spaces
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/gi, (match, p1) => {
    const key = p1.toLowerCase()
    return lookup[key] !== undefined ? lookup[key] : match
  })
}
