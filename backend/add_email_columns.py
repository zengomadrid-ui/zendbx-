"""
Script to add welcome_email_sent columns to users table
"""
import asyncio
import asyncpg
from app.core.config import settings

async def add_email_columns():
    """Add welcome email tracking columns to users table"""
    
    print("🔧 Adding welcome email tracking columns...")
    
    try:
        # Connect to database
        conn = await asyncpg.connect(settings.DATABASE_URL)
        
        # Add columns
        await conn.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
        """)
        
        print("✅ Added welcome_email_sent column")
        print("✅ Added welcome_email_sent_at column")
        
        # Add index
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_welcome_email_sent 
            ON users(welcome_email_sent) 
            WHERE welcome_email_sent = FALSE;
        """)
        
        print("✅ Added index for welcome_email_sent")
        
        # Add comments
        await conn.execute("""
            COMMENT ON COLUMN users.welcome_email_sent IS 'Tracks if welcome email has been sent to the user';
        """)
        
        await conn.execute("""
            COMMENT ON COLUMN users.welcome_email_sent_at IS 'Timestamp when welcome email was sent';
        """)
        
        print("✅ Added column comments")
        
        # Close connection
        await conn.close()
        
        print("\n🎉 Welcome email tracking setup completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(add_email_columns())
