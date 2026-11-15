DELETE FROM outbox WHERE payload->'payload'->>'orderId'='68220000-0000-4000-8000-000000000301';
DELETE FROM ratings WHERE order_id='68220000-0000-4000-8000-000000000301';
DELETE FROM rating_eligibility WHERE order_id='68220000-0000-4000-8000-000000000301';
INSERT INTO user_reputations(user_id,score,trust_level,total_transaction,successful_transaction,failed_transaction)
VALUES ('68000000-0000-4000-8000-000000000004',78,'TRUSTED',42,40,2)
ON CONFLICT (user_id) DO UPDATE SET score=78,trust_level='TRUSTED',total_transaction=42,successful_transaction=40,failed_transaction=2;
