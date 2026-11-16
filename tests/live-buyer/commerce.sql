DELETE FROM order_status_history WHERE order_id='68220000-0000-4000-8000-000000000301';
DELETE FROM order_items WHERE order_id='68220000-0000-4000-8000-000000000301';
DELETE FROM outbox WHERE aggregate_id='68220000-0000-4000-8000-000000000301';
DELETE FROM orders WHERE id='68220000-0000-4000-8000-000000000301';
DELETE FROM order_groups WHERE id='68220000-0000-4000-8000-000000000302';
INSERT INTO order_groups(id,buyer_id,idempotency_key,status,total_amount,currency,paid_at)
VALUES ('68220000-0000-4000-8000-000000000302','68000000-0000-4000-8000-000000000003','nexus220-live-group','PAID',110000,'VND',now()-interval '2 days');
INSERT INTO orders(id,order_group_id,user_id,seller_id,order_number,order_type,status,subtotal,total_amount,
    idempotency_key,paid_at,delivered_at,auto_complete_at,shipping_info)
VALUES ('68220000-0000-4000-8000-000000000301','68220000-0000-4000-8000-000000000302',
    '68000000-0000-4000-8000-000000000003','68000000-0000-4000-8000-000000000004','NX-LIVE-220','STANDARD',
    'DELIVERED',110000,110000,'nexus220-live-order',now()-interval '2 days',now(),now()+interval '7 days',
    '{"recipient":{"name":"Live Test Buyer","phone":"0901234567"}}');
INSERT INTO order_items(id,order_id,product_id,sku_id,product_name,sku_code,quantity,unit_price,total_price)
VALUES ('68220000-0000-4000-8000-000000000303','68220000-0000-4000-8000-000000000301',
    '68220000-0000-4000-8000-000000000101','68220000-0000-4000-8000-000000000201','Nexus220 Tablet 01',
    'NEXUS220-TABLET-1',1,110000,110000);
