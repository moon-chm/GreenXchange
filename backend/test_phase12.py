import asyncio
import uuid
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
from app.models.rewards import MarketplaceItem, RewardTransaction, RedemptionTransaction, PayoutRequest
from app.services.rewards import (
    seed_default_marketplace_items,
    redeem_marketplace_item,
    request_wallet_payout
)

async def main():
    print("==================================================")
    print("Testing Phase 12: GXC Token Wallet & Marketplace Payouts")
    print("==================================================")

    user_id = uuid.uuid4()
    wallet_address = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"

    async with AsyncSessionLocal() as session:
        try:
            # 1. Create test user
            await session.execute(
                text("INSERT INTO users (id, name, email, password_hash, device_fingerprint, is_active) VALUES (:id, 'Wallet Tester', 'wallet_test@example.com', 'hash', 'test_fp_wallet', true)"),
                {"id": user_id}
            )

            # Credit user with 120 GXC balance (Append-Only)
            tx_initial = RewardTransaction(
                user_id=user_id,
                points=120,
                trigger_event="INITIAL_TEST_GRANT",
                balance_snapshot=120
            )
            session.add(tx_initial)
            await session.commit()
            print(f"1. Created test user ({user_id}) with 120 GXC balance.")

            # 2. Seed marketplace items
            await seed_default_marketplace_items(session)
            print("2. Seeded default marketplace items successfully.")

            # Fetch items
            items_res = await session.execute(text("SELECT id, title, points_cost, stock FROM marketplace_items WHERE is_active = true ORDER BY points_cost ASC"))
            items = items_res.fetchall()
            print(f"Available Marketplace Items Count: {len(items)}")
            for item in items:
                print(f"   - [{item[2]} GXC] {item[1]} (Stock: {item[3]})")

            item_to_redeem_id = items[0][0]
            item_cost = items[0][2]
            initial_stock = items[0][3]

            # 3. Test Item Redemption
            print(f"\n3. Redeeming item '{items[0][1]}' ({item_cost} GXC)...")
            redemption_res = await redeem_marketplace_item(session, user_id=user_id, item_id=item_to_redeem_id)
            print("Redemption Result:", redemption_res)

            assert redemption_res["success"] is True
            assert redemption_res["new_balance"] == 120 - item_cost
            assert redemption_res["voucher_code"].startswith("GXC-ECO-")
            print(f"SUCCESS: Item redeemed! Voucher Code: {redemption_res['voucher_code']}, New Balance: {redemption_res['new_balance']} GXC")

            # Check stock deduction
            updated_stock_res = await session.execute(text(f"SELECT stock FROM marketplace_items WHERE id = '{item_to_redeem_id}'"))
            new_stock = updated_stock_res.scalar_one()
            assert new_stock == initial_stock - 1
            print(f"SUCCESS: Marketplace stock correctly updated ({initial_stock} -> {new_stock})")

            # 4. Test Insufficient Balance Protection
            expensive_item_res = await session.execute(text("SELECT id, points_cost FROM marketplace_items WHERE points_cost > 100 LIMIT 1"))
            exp_item = expensive_item_res.fetchone()
            if exp_item:
                print(f"\n4. Testing insufficient balance protection for item costing {exp_item[1]} GXC (Current Balance: {redemption_res['new_balance']} GXC)...")
                try:
                    await redeem_marketplace_item(session, user_id=user_id, item_id=exp_item[0])
                    print("FAILURE: Expected insufficient balance error but redemption succeeded.")
                except ValueError as ve:
                    print(f"SUCCESS: Insufficient balance correctly blocked with error: {ve}")

            # 5. Test Invalid Wallet Address Payout
            print("\n5. Testing invalid crypto wallet address payout validation...")
            try:
                await request_wallet_payout(session, user_id=user_id, amount_gxc=50, wallet_address="invalid_address_123")
                print("FAILURE: Expected invalid address error but request passed.")
            except ValueError as ve:
                print(f"SUCCESS: Invalid address correctly rejected with error: {ve}")

            # 6. Test Valid Crypto Wallet Payout Request (50 GXC)
            current_bal = redemption_res["new_balance"]
            payout_amount = 50
            print(f"\n6. Submitting valid Web3 payout request of {payout_amount} GXC to {wallet_address}...")
            payout_req = await request_wallet_payout(session, user_id=user_id, amount_gxc=payout_amount, wallet_address=wallet_address)
            print(f"SUCCESS: Payout request created! ID: {payout_req.id}, Status: {payout_req.status}, Amount: {payout_req.amount_gxc} GXC")

            # Verify new balance snapshot in reward_transactions
            latest_tx_res = await session.execute(text(f"SELECT balance_snapshot, trigger_event FROM reward_transactions WHERE user_id = '{user_id}' ORDER BY created_at DESC LIMIT 1"))
            latest_tx = latest_tx_res.fetchone()
            expected_final_bal = current_bal - payout_amount
            assert latest_tx[0] == expected_final_bal
            print(f"SUCCESS: Append-only ledger recorded payout transaction: Event={latest_tx[1]}, Final Balance Snapshot={latest_tx[0]} GXC")

        finally:
            # Cleanup
            print("\n7. Cleaning up test records...")
            await session.execute(text("ALTER TABLE reward_transactions DISABLE TRIGGER ALL"))
            await session.execute(text(f"DELETE FROM redemption_transactions WHERE user_id = '{user_id}'"))
            await session.execute(text(f"DELETE FROM payout_requests WHERE user_id = '{user_id}'"))
            await session.execute(text(f"DELETE FROM reward_transactions WHERE user_id = '{user_id}'"))
            await session.execute(text(f"DELETE FROM users WHERE id = '{user_id}'"))
            await session.execute(text("ALTER TABLE reward_transactions ENABLE TRIGGER ALL"))
            await session.commit()
            print("Cleanup completed successfully.")

if __name__ == "__main__":
    asyncio.run(main())
