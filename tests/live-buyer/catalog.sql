-- Dedicated local test database only; unique IDs keep production/demo rows outside this fixture untouched.
INSERT INTO categories(id,name,slug,level,path)
VALUES ('68220000-0000-4000-8000-000000000001','Nexus220 Electronics','nexus220-electronics',1,'/nexus220-electronics/')
ON CONFLICT (id) DO NOTHING;
INSERT INTO products(id,category_id,seller_id,name,slug,status,auction_enable,description)
SELECT ('68220000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid,
       '68220000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000004',
       'Nexus220 Tablet '||lpad(i::text,2,'0'),'nexus220-tablet-'||lpad(i::text,2,'0'),
       'ACTIVE'::product_status,false,'Persisted buyer integration product'
FROM generate_series(1,14) i ON CONFLICT (id) DO NOTHING;
INSERT INTO skus(id,product_id,sku_code,price,status)
SELECT ('68220000-0000-4000-8000-0000000002'||lpad(i::text,2,'0'))::uuid,
       ('68220000-0000-4000-8000-0000000001'||lpad(i::text,2,'0'))::uuid,
       'NEXUS220-TABLET-'||i,100000+i*10000,'ACTIVE'::sku_status
FROM generate_series(1,14) i ON CONFLICT (id) DO NOTHING;
