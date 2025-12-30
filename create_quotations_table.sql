-- Create Quotations Table
CREATE TABLE public.quotations (
    id text NOT NULL PRIMARY KEY,
    customer_name text,
    address text,
    customer_phone text,
    customer_whatsapp text,
    customer_email text,
    nearest_city text,
    district text,
    category_id text,
    item_id text,
    custom_item_name text,
    quantity numeric,
    unit_price numeric,
    discount_type text,
    discount_value numeric,
    total_amount numeric,
    cod_amount numeric,
    advance_payment numeric,
    delivery_charge numeric,
    order_items jsonb,
    delivery_date text,
    status text,
    payment_status text,
    tracking_number text,
    notes text,
    created_date text,
    order_date text,
    dispatch_date text,
    order_source text,
    courier_finance_status text,
    courier_invoice_no text,
    courier_invoice_ref text,
    payment_method text
);

-- Enable RLS (Row Level Security) - Optional, depends on your project settings
-- ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Create Policy to allow all access (Adjust based on your Auth requirements)
-- CREATE POLICY "Enable all access for all users" ON public.quotations FOR ALL USING (true) WITH CHECK (true);
