import asyncio
import uuid
from app.db.session import AsyncSessionLocal
from app.services.rewards import credit_growth_update_reward
from sqlalchemy import text
from app.models.users import User

async def main():
    print("Testing Reward Concurrency and Append-Only guarantees...")
    
    # Generate a dummy user and plant for testing
    user_id = uuid.uuid4()
    plant_id = None
    
    async with AsyncSessionLocal() as session:
        # Create a user just for this test
        await session.execute(
            text("INSERT INTO users (id, name, email, password_hash, device_fingerprint, is_active) VALUES (:id, 'Test User', 'testreward@example.com', 'hash', 'test_fp_123', true)"),
            {"id": user_id}
        )
        await session.commit()
        
    print(f"Created test user: {user_id}")
    
    # 5 concurrent requests simulating a bug in celery dispatch or multi-submission
    async def simulate_task():
        async with AsyncSessionLocal() as session:
            return await credit_growth_update_reward(session, user_id, plant_id)
            
    print("Dispatching 5 concurrent reward requests...")
    results = await asyncio.gather(
        simulate_task(),
        simulate_task(),
        simulate_task(),
        simulate_task(),
        simulate_task()
    )
    
    print(f"Results of concurrent requests (Should only be ONE True): {results}")
    
    # Check the database for how many rows were inserted
    async with AsyncSessionLocal() as session:
        count_res = await session.execute(text(f"SELECT COUNT(*), MAX(balance_snapshot) FROM reward_transactions WHERE user_id = '{user_id}'"))
        count, balance = count_res.first()
        print(f"Total reward rows inserted: {count} (Expected: 1)")
        print(f"Final Balance Snapshot: {balance} (Expected: 10)")
        
    print("Cleaning up test user...")
    async with AsyncSessionLocal() as session:
        await session.execute(text(f"DELETE FROM users WHERE id = '{user_id}'"))
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
