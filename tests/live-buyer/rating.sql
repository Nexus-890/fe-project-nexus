DELETE FROM outbox WHERE payload->'payload'->>'orderId'='68220000-0000-4000-8000-000000000301';
DELETE FROM ratings WHERE order_id='68220000-0000-4000-8000-000000000301';
DELETE FROM rating_eligibility WHERE order_id='68220000-0000-4000-8000-000000000301';
INSERT INTO user_reputations(user_id,score,trust_level,total_transaction,successful_transaction,failed_transaction,
    rating_count,rating_score_sum,penalty_points,successful_auction_count,failed_auction_count,adjustment_offset,policy_version)
VALUES ('68000000-0000-4000-8000-000000000004',78,'TRUSTED',0,0,0,0,0,0,0,0,28,'reputation-policy-1')
ON CONFLICT (user_id) DO UPDATE SET score=78,trust_level='TRUSTED',total_transaction=0,successful_transaction=0,
    failed_transaction=0,rating_count=0,rating_score_sum=0,penalty_points=0,successful_auction_count=0,
    failed_auction_count=0,adjustment_offset=28,policy_version='reputation-policy-1';
