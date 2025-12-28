// --- Helpers ---
const CACHE_PREFIX = 'cfx_cache_';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours for non-terminal data

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function limitConcurrency(tasks, limit, onProgress, delayMs = 100) {
    const results = [];
    let running = 0;
    let index = 0;
    const total = tasks.length;

    return new Promise((resolve) => {
        if (total === 0) return resolve([]);

        async function runNext() {
            if (index >= total && running === 0) {
                return resolve(results);
            }

            while (running < limit && index < total) {
                const currentIndex = index++;
                running++;

                // Add staggered delay to avoid burst
                await sleep(delayMs);

                tasks[currentIndex]()
                    .then((res) => {
                        results[currentIndex] = res;
                    })
                    .catch((err) => {
                        console.warn(`Task ${currentIndex} failed:`, err);
                        results[currentIndex] = null;
                    })
                    .finally(() => {
                        running--;
                        if (onProgress) onProgress(results.filter(r => r !== undefined).length, total);
                        runNext();
                    });
            }
        }
        runNext();
    });
}

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
    getTracking: async (waybill, authData, forceRefresh = false) => {
        try {
            const cacheKey = `${CACHE_PREFIX}trk_${waybill}`;
            if (!forceRefresh) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed._terminal || (Date.now() - parsed._ts < CACHE_TTL)) {
                        return parsed.data;
                    }
                }
            }

            const { tenant, token } = authData || {}
            if (!tenant || !token) return []

            const url = `${curfoxService.baseUrl}/order/tracking-info?waybill_number=${waybill}`

            // Retry logic for 429
            let response;
            let retries = 3;
            while (retries > 0) {
                response = await fetch(url, {
                    method: 'GET',
                    headers: curfoxService.getHeaders(tenant, token)
                })

                if (response.status === 429) {
                    console.warn(`Tracking 429 for ${waybill}, retrying...`);
                    await sleep(2000); // Wait 2s on rate limit
                    retries--;
                    continue;
                }
                break;
            }

            if (!response.ok && response.status === 405) {
                response = await fetch(`${curfoxService.baseUrl}/order/tracking-info`, {
                    method: 'POST',
                    headers: curfoxService.getHeaders(tenant, token),
                    body: JSON.stringify({ waybill_number: waybill })
                })
            }

            if (!response || !response.ok) return []

            const data = await response.json()
            const history = data.data || []

            const isDelivered = history.some(h => {
                const s = (h.status?.name || h.status || '').toUpperCase();
                return s === 'DELIVERED' || s === 'CANCELLED' || s === 'RETURNED';
            });

            localStorage.setItem(cacheKey, JSON.stringify({
                data: history,
                _terminal: isDelivered,
                _ts: Date.now()
            }));

            return history
        } catch (error) {
            console.error("Tracking Fetch Error:", error)
            return []
        }
    },

    // 5. Finance
    getFinanceStatus: async (waybill, authData, forceRefresh = false) => {
        try {
            const cacheKey = `${CACHE_PREFIX}fin_${waybill}`;
            if (!forceRefresh) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const isTerminal = parsed.finance_status === 'Deposited' || parsed.finance_status === 'Approved' || parsed._terminal;
                    if (isTerminal || (Date.now() - parsed._ts < CACHE_TTL)) {
                        return parsed;
                    }
                }
            }

            const { tenant, token } = authData || {}
            if (!tenant || !token) return null

            const privateUrl = `https://v1.api.curfox.com/api/merchant/order/waybill-finance-status`
            const publicUrl = `${curfoxService.baseUrl}/order/waybill-finance-status`

            let response;
            let retries = 3;

            while (retries > 0) {
                // Try private GET first
                response = await fetch(`${privateUrl}?waybill_number=${waybill}`, {
                    method: 'GET',
                    headers: curfoxService.getHeaders(tenant, token)
                })

                if (response.status === 429) {
                    console.warn(`Finance 429 for ${waybill}, retrying...`);
                    await sleep(2000);
                    retries--;
                    continue;
                }
                break;
            }

            if (!response.ok) {
                response = await fetch(privateUrl, {
                    method: 'POST',
                    headers: curfoxService.getHeaders(tenant, token),
                    body: JSON.stringify({ waybill_number: waybill })
                })
            }

            if (!response.ok) {
                response = await fetch(publicUrl, {
                    method: 'POST',
                    headers: curfoxService.getHeaders(tenant, token),
                    body: JSON.stringify({ waybill_number: waybill })
                })
            }

            if (!response || !response.ok) return null

            const data = await response.json()
            const result = data.data || null

            if (result) {
                const isTerminal = result.finance_status === 'Deposited' || result.finance_status === 'Approved';
                localStorage.setItem(cacheKey, JSON.stringify({
                    ...result,
                    _terminal: isTerminal,
                    _ts: Date.now()
                }));
            }
            return result
        } catch (error) {
            console.error("Finance Status Fetch Error:", error)
            return null
        }
    },

    // 6. Bulk Fetching
    getOrders: async (authData, params = {}) => {
        try {
            const { tenant, token } = authData || {}
            if (!tenant || !token) return []

            const queryParams = new URLSearchParams({
                ...params,
                noPagination: 1
            }).toString()

            // Try private path first (more likely to have all fields)
            const privateUrl = `https://v1.api.curfox.com/api/merchant/order?${queryParams}`
            const publicUrl = `${curfoxService.baseUrl}/order?${queryParams}`

            let response = await fetch(privateUrl, {
                method: 'GET',
                headers: curfoxService.getHeaders(tenant, token)
            })

            if (!response.ok) {
                console.warn(`Private Orders Fetch Failed (${response.status}), trying public...`)
                response = await fetch(publicUrl, {
                    method: 'GET',
                    headers: curfoxService.getHeaders(tenant, token)
                })
            }

            if (!response.ok) {
                console.error(`Orders Fetch Failed: ${response.status}`)
                return []
            }

            const data = await response.json()
            const orders = data.data || []

            if (orders.length > 0) {
                console.log('Sample Curfox Order Data:', JSON.stringify(orders[0], null, 2))
            }

            return orders
        } catch (error) {
            console.error("Orders Fetch Error:", error)
            return []
        }
    },

    bulkGetFinanceStatus: async (waybills, authData, onProgress, forceRefresh = false) => {
        const results = [];
        const tasks = [];

        waybills.forEach(wb => {
            let cached = null;
            if (!forceRefresh) {
                const stored = localStorage.getItem(`${CACHE_PREFIX}fin_${wb}`);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const isTerminal = parsed.finance_status === 'Deposited' || parsed.finance_status === 'Approved' || parsed._terminal;
                    if (isTerminal || (Date.now() - parsed._ts < CACHE_TTL)) {
                        cached = parsed;
                    }
                }
            }

            if (cached) {
                results.push(cached);
            } else {
                tasks.push(async () => {
                    const res = await curfoxService.getFinanceStatus(wb, authData, forceRefresh);
                    return res;
                });
            }
        });

        const cachedCount = results.length;
        if (onProgress) onProgress(cachedCount, waybills.length);

        if (tasks.length > 0) {
            const fetched = await limitConcurrency(tasks, 1, (done, total) => {
                if (onProgress) onProgress(cachedCount + done, waybills.length);
            }, 1000); // 1 request / 1 sec
            return [...results, ...fetched.filter(Boolean)];
        }

        return results;
    },

    bulkGetTracking: async (waybills, authData, onProgress, forceRefresh = false) => {
        const results = [];
        const tasks = [];

        waybills.forEach(wb => {
            let cached = null;
            if (!forceRefresh) {
                const stored = localStorage.getItem(`${CACHE_PREFIX}trk_${wb}`);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed._terminal || (Date.now() - parsed._ts < CACHE_TTL)) {
                        cached = { waybill_number: wb, history: parsed.data };
                    }
                }
            }

            if (cached) {
                results.push(cached);
            } else {
                tasks.push(async () => {
                    const history = await curfoxService.getTracking(wb, authData, forceRefresh)
                    return { waybill_number: wb, history }
                });
            }
        });

        const cachedCount = results.length;
        if (onProgress) onProgress(cachedCount, waybills.length);

        if (tasks.length > 0) {
            const fetched = await limitConcurrency(tasks, 1, (done, total) => {
                if (onProgress) onProgress(cachedCount + done, waybills.length);
            }, 1000); // 1 request / 1 sec
            return [...results, ...fetched.filter(Boolean)];
        }
        return results;
    }
}
