"""
Seed script to populate subscription plans in the database
Run this after creating the database schema
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import get_main_db_pool


async def seed_plans():
    """Seed subscription plans"""
    pool = await get_main_db_pool()
    
    plans = [
        {
            'name': 'free',
            'display_name': 'Free Plan',
            'price_monthly': 0.00,
            'api_requests_limit': 10000,
            'database_size_limit': 524288000,  # 500 MB in bytes
            'projects_limit': 1,
            'team_members_limit': 1,
            'backup_frequency': 'weekly',
            'features': ['Basic features', 'Community support', 'Manual backups']
        },
        {
            'name': 'pro',
            'display_name': 'Pro Plan',
            'price_monthly': 29.00,
            'api_requests_limit': 100000,
            'database_size_limit': 10737418240,  # 10 GB in bytes
            'projects_limit': 10,
            'team_members_limit': 5,
            'backup_frequency': 'daily',
            'features': ['All Free features', 'Priority support', 'Automated daily backups', 'Advanced analytics']
        },
        {
            'name': 'business',
            'display_name': 'Business Plan',
            'price_monthly': 99.00,
            'api_requests_limit': 999999999,  # Unlimited (high number)
            'database_size_limit': 107374182400,  # 100 GB in bytes
            'projects_limit': 999,  # Unlimited (high number)
            'team_members_limit': 999,  # Unlimited (high number)
            'backup_frequency': 'hourly',
            'features': ['All Pro features', 'Dedicated support', 'Hourly backups', 'Custom integrations', 'SLA guarantee']
        }
    ]
    
    async with pool.acquire() as conn:
        for plan in plans:
            # Check if plan already exists
            existing = await conn.fetchrow(
                "SELECT id FROM subscription_plans WHERE name = $1",
                plan['name']
            )
            
            if existing:
                print(f"Plan '{plan['name']}' already exists, skipping...")
                continue
            
            # Insert plan
            await conn.execute(
                """
                INSERT INTO subscription_plans (
                    name, display_name, price_monthly, api_requests_limit,
                    database_size_limit, projects_limit, team_members_limit,
                    backup_frequency, features
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                plan['name'],
                plan['display_name'],
                plan['price_monthly'],
                plan['api_requests_limit'],
                plan['database_size_limit'],
                plan['projects_limit'],
                plan['team_members_limit'],
                plan['backup_frequency'],
                plan['features']
            )
            
            print(f"✓ Created plan: {plan['display_name']}")
    
    print("\n✓ All subscription plans seeded successfully!")


async def assign_free_plan_to_users():
    """Assign free plan to all existing users who don't have a subscription"""
    pool = await get_main_db_pool()
    
    async with pool.acquire() as conn:
        # Get free plan ID
        free_plan = await conn.fetchrow(
            "SELECT id FROM subscription_plans WHERE name = 'free'"
        )
        
        if not free_plan:
            print("Error: Free plan not found. Run seed_plans first.")
            return
        
        free_plan_id = free_plan['id']
        
        # Get all users without subscriptions
        users = await conn.fetch(
            """
            SELECT u.id
            FROM users u
            LEFT JOIN user_subscriptions us ON u.id = us.user_id
            WHERE us.id IS NULL
            """
        )
        
        if not users:
            print("No users without subscriptions found.")
            return
        
        # Assign free plan to each user
        for user in users:
            user_id = user['id']
            
            # Create subscription
            await conn.execute(
                """
                INSERT INTO user_subscriptions (
                    user_id, plan_id, status, current_period_start, current_period_end
                )
                VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 month')
                """,
                user_id, free_plan_id
            )
            
            # Create initial usage tracking
            await conn.execute(
                """
                INSERT INTO usage_tracking (
                    user_id, period_start, period_end,
                    api_requests_count, database_size_bytes,
                    projects_count, team_members_count
                )
                VALUES ($1, NOW(), NOW() + INTERVAL '1 month', 0, 0, 0, 0)
                ON CONFLICT (user_id, period_start) DO NOTHING
                """,
                user_id
            )
            
            print(f"✓ Assigned free plan to user: {user_id}")
        
        print(f"\n✓ Assigned free plan to {len(users)} users!")


async def main():
    """Main function"""
    print("="*60)
    print("ZENDBX - Subscription Plans Seeder")
    print("="*60)
    print()
    
    # Seed plans
    print("Step 1: Seeding subscription plans...")
    await seed_plans()
    print()
    
    # Assign free plan to existing users
    print("Step 2: Assigning free plan to existing users...")
    await assign_free_plan_to_users()
    print()
    
    print("="*60)
    print("✓ Seeding completed successfully!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
