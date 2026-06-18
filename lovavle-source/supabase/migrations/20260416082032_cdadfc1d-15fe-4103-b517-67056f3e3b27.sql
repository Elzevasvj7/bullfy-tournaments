
-- Cart items: public read (filtered by partner_user_id in app code)
CREATE POLICY "Public can read cart items"
ON public.portal_cart_items
FOR SELECT
USING (true);

-- Orders: public read (filtered by partner_user_id in app code)
CREATE POLICY "Public can read orders"
ON public.portal_orders
FOR SELECT
USING (true);

-- Order items: public read
CREATE POLICY "Public can read order items"
ON public.portal_order_items
FOR SELECT
USING (true);
