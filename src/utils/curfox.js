export const curfoxService = {
    baseUrl: 'https://v1.api.curfox.com/api/public/merchant',

    // Helpers
    getHeaders: (tenant, token = null) => {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-tenant': tenant
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        return headers
    },

    // 1. Authentication
    login: async (email, password, tenant) => {
        try {
            console.log('Logging in to Curfox:', { email, tenant })
            const response = await fetch(`${curfoxService.baseUrl}/login`, {
                method: 'POST',
                headers: curfoxService.getHeaders(tenant),
                body: JSON.stringify({ email, password })
            })

            if (!response.ok) {
                const err = await response.text()
                console.error('Curfox Login Failed:', response.status, err)
                throw new Error('Login failed: ' + response.statusText)
            }

            const data = await response.json()
            console.log('Curfox Login Success:', JSON.stringify(data, null, 2))

            // Return token and potentially business_id if available in response
            // Adjust based on actua response structure. common: { token: '...', user: { business_id: ... } }
            return {
                token: data.token || data.access_token,
                businessId: data.user?.business_id || data.business_id || data.merchant_business_id
            }
        } catch (error) {
            console.error('Curfox Login Error:', error)
            return null
        }
    },

    getUserDetails: async (authData) => {
        try {
            const { tenant, token } = authData
            const response = await fetch(`${curfoxService.baseUrl}/user/get-current`, {
                method: 'GET',
                headers: curfoxService.getHeaders(tenant, token)
            })
            if (!response.ok) return null
            const json = await response.json()
            console.log("Curfox User Details:", JSON.stringify(json.data, null, 2))
            return json.data || null
        } catch (e) {
            console.error("Fetch User Details Error", e)
            return null
        }
    },

    getBusinesses: async (authData) => {
        try {
            const { tenant, token } = authData
            const response = await fetch(`${curfoxService.baseUrl}/business`, {
                method: 'GET',
                headers: curfoxService.getHeaders(tenant, token)
            })
            if (!response.ok) return []
            const json = await response.json()
            console.log("Curfox Businesses List:", JSON.stringify(json.data, null, 2))
            return json.data || []
        } catch (e) {
            console.error("Fetch Businesses Error", e)
            return []
        }
    },

    // 2. Location Services
    // Endpoint: /api/public/merchant/city
    // Endpoint: /api/public/merchant/state (assumed for districts)



    getDistricts: async (authData) => {
        try {
            const { tenant, token } = authData || {}
            if (!tenant || !token) return []

            // Fetch States (Districts)
            // Docs: noPagination - Ignores pagination
            const response = await fetch(`${curfoxService.baseUrl}/state?noPagination=1`, {
                method: 'GET',
                headers: curfoxService.getHeaders(tenant, token)
            })

            if (!response.ok) {
                console.error("Curfox State Fetch Failed:", response.status)
                return []
            }

            const data = await response.json()
            return data.data || []
        } catch (error) {
            console.error('Curfox Districts Error:', error)
            return []
        }
    },

    getCities: async (authData) => {
        try {
            const { tenant, token } = authData || {}
            if (!tenant || !token) {
                console.warn("Curfox Cities: Missing auth data")
                return []
            }

            // Get all cities
            // Docs say "noPagination" ignores pagination.
            // Also need to map nested 'state' object to 'district_name' for frontend filtering.
            const url = `${curfoxService.baseUrl}/city?noPagination=1`
            console.log('Fetching Cities URL:', url)

            const response = await fetch(url, {
                method: 'GET',
                headers: curfoxService.getHeaders(tenant, token)
            })

            if (!response.ok) {
                console.error("Curfox City Fetch Failed:", response.status, response.statusText)
                return []
            }

            const res = await response.json()
            const rawCities = res.data || []
            console.log(`Loaded ${rawCities.length} cities from Curfox`)

            if (rawCities.length > 0) {
                // Map to flattened structure for easier filtering
                return rawCities.map(city => ({
                    ...city,
                    district_name: city.state?.name || city.district_name || '',
                    name: city.name // Ensure name is top level
                }))
            }

            return []
        } catch (error) {
            console.error('Curfox Cities Error:', error)
            return []
        }
    },

    // 3. Create Order
    createOrder: async (order, trackingNumber, authData) => {
        try {
            const { email, password, tenant, token, businessId, originCity, originDistrict } = authData

            if (!businessId) {
                throw new Error("Missing Merchant Business ID. Please configure it in Settings.")
            }

            const payload = {
                general_data: {
                    merchant_business_id: businessId,
                    origin_city_name: originCity || "Colombo",
                    origin_state_name: originDistrict || "Colombo"
                },
                order_data: [{
                    waybill_number: trackingNumber,
                    customer_name: order.customerName,
                    customer_address: order.address,
                    customer_phone: (order.phone || order.whatsapp || "").replace(/\D/g, ''), // Clean phone
                    destination_city_name: order.nearestCity,
                    destination_state_name: order.district,
                    cod: order.paymentStatus === 'Paid' ? 0 : Math.round(order.totalPrice || 0), // Integer
                    description: `Order #${order.id}`,
                    weight: 1,
                    remark: order.notes || ""
                }]
            }

            console.log('Pushing to Curfox:', JSON.stringify(payload, null, 2))

            let response = await fetch(`${curfoxService.baseUrl}/order/bulk`, {
                method: 'POST',
                headers: curfoxService.getHeaders(tenant, token),
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                const errText = await response.text()

                // Content-aware Retry Logic
                // If "Business not found" and we have a Ref No, try that instead of the numeric ID.
                const shouldRetry = response.status === 422 && errText.includes("Business not found") && authData.merchantRefNo

                if (shouldRetry) {
                    console.warn(`Curfox: Retrying with Merchant Ref No (${authData.merchantRefNo})...`)
                    payload.general_data.merchant_business_id = authData.merchantRefNo

                    response = await fetch(`${curfoxService.baseUrl}/order/bulk`, {
                        method: 'POST',
                        headers: curfoxService.getHeaders(tenant, token),
                        body: JSON.stringify(payload)
                    })

                    if (!response.ok) {
                        const errText2 = await response.text()
                        await curfoxService.handleDispatchError(response, errText2)
                    }
                } else {
                    await curfoxService.handleDispatchError(response, errText)
                }
            }

            const data = await response.json()
            return data
        } catch (error) {
            console.error('Create Order Error:', error)
            throw error
        }
    },

    // Helper for error parsing
    handleDispatchError: async (response, errText) => {
        console.error("Curfox API Error Body:", errText)
        let errorMessage = `Curfox Dispatch Failed: ${response.status}`
        try {
            const errorJson = JSON.parse(errText)
            const errors = errorJson.errors || {}

            if (errors['rate_card.destination_city_id']) {
                errorMessage = `Delivery Coverage Error: ${errors['rate_card.destination_city_id'][0]}`
            } else if (errors['order_data.0.waybill_number']) {
                errorMessage = `Duplicate Waybill: ${errors['order_data.0.waybill_number'][0]}`
            } else if (errorJson.message) {
                errorMessage = `Curfox Error: ${errorJson.message}`
                if (Object.keys(errors).length > 0) {
                    errorMessage += ` (${JSON.stringify(errors)})`
                }
            }
        } catch (e) {
            errorMessage += ` - ${errText}`
        }
        throw new Error(errorMessage)
    },

    // 4. Tracking
    getTracking: async (waybill, authData) => {
        try {
            const { tenant, token } = authData || {}
            if (!tenant || !token) return []

            console.log('Fetching tracking for', waybill)

            // Docs say GET with body, which is invalid in browsers. 
            // Trying with Query String first.
            const url = `${curfoxService.baseUrl}/order/tracking-info?waybill_number=${waybill}`

            const response = await fetch(url, {
                method: 'GET', // Standard GET
                headers: curfoxService.getHeaders(tenant, token)
            })

            console.log(`Tracking Response Status: ${response.status} for ${waybill}`)

            if (!response.ok) {
                // If 405 Method Not Allowed, maybe it IS a POST?
                if (response.status === 405) {
                    console.warn("GET tracking failed, trying POST...")
                    const postResp = await fetch(`${curfoxService.baseUrl}/order/tracking-info`, {
                        method: 'POST',
                        headers: curfoxService.getHeaders(tenant, token),
                        body: JSON.stringify({ waybill_number: waybill })
                    })
                    if (postResp.ok) {
                        const postData = await postResp.json()
                        console.log('Post Tracking Data:', postData)
                        return postData.data || []
                    }
                }
                return []
            }

            const data = await response.json()
            console.log('Tracking JSON:', data)
            return data.data || [] // Returns array of history
        } catch (error) {
            console.error("Tracking Fetch Error:", error)
            return []
        }
    },

    // 5. Finance
    getFinanceStatus: async (waybill, authData) => {
        try {
            const { tenant, token } = authData || {}
            if (!tenant || !token) return null

            console.log('Fetching finance status for', waybill)

            // Documentation says GET with body. We'll try POST first as it's more standard for body-reqs, 
            // then fallback to GET with body if that fails.
            const url = `${curfoxService.baseUrl}/order/waybill-finance-status`

            // Try POST first (common workaround for GET with body)
            let response = await fetch(url, {
                method: 'POST',
                headers: curfoxService.getHeaders(tenant, token),
                body: JSON.stringify({ waybill_number: waybill })
            })

            if (!response.ok) {
                // Try GET with body if POST failed
                response = await fetch(url, {
                    method: 'GET',
                    headers: curfoxService.getHeaders(tenant, token),
                    body: JSON.stringify({ waybill_number: waybill })
                })
            }

            if (!response.ok) {
                console.error(`Finance Status Fetch Failed: ${response.status}`)
                return null
            }

            const data = await response.json()
            console.log('Finance Status JSON:', data)
            return data.data || null
        } catch (error) {
            console.error("Finance Status Fetch Error:", error)
            return null
        }
    }
}
