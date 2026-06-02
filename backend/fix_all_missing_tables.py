"""
Fix all missing tables in the database
"""
import psycopg2
from urllib.parse import urlparse

DATABASE_URL = "postgresql://postgres:Pawan@121@localhost:5432/nexora_main"

def run_migration():
    parsed = urlparse(DATABASE_URL)
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        database=parsed.path[1:],
        user=parsed.username,
        password=parsed.password
    )
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("🔄 Fixing all missing tables...")
    
    try:
        # 1. Create oauth_providers table
        print("  - Creating oauth_providers table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS oauth_providers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider_name VARCHAR(50) UNIQUE NOT NULL,
                client_id TEXT NOT NULL,
                client_secret TEXT NOT NULL,
                is_enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # 2. Create user_sessions table
        print("  - Creating user_sessions table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_token TEXT UNIQUE NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                last_activity TIMESTAMP DEFAULT NOW()
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)")
        
        # 3. Create project_api_keys table
        print("  - Creating project_api_keys table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_api_keys (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                key_hash TEXT NOT NULL,
                scopes TEXT[] DEFAULT '{}',
                last_used_at TIMESTAMP,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT true
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_project_api_keys_project ON project_api_keys(project_id)")
        
        # 4. Create usage_records table
        print("  - Creating usage_records table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usage_records (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                resource_type VARCHAR(50) NOT NULL,
                quantity INTEGER DEFAULT 1,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_records_project ON usage_records(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_records_created ON usage_records(created_at)")
        
        # 5. Create quota_overrides table
        print("  - Creating quota_overrides table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS quota_overrides (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                quota_type VARCHAR(50) NOT NULL,
                override_value INTEGER NOT NULL,
                reason TEXT,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                created_by UUID REFERENCES users(id),
                UNIQUE(user_id, quota_type)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_quota_overrides_user ON quota_overrides(user_id)")
        
        # 6. Create backup_history table (bbackup_history is likely a typo)
        print("  - Creating backup_history table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backup_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                backup_file VARCHAR(500) NOT NULL,
                backup_size BIGINT,
                backup_type VARCHAR(50) DEFAULT 'manual',
                status VARCHAR(50) DEFAULT 'completed',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                created_by UUID REFERENCES users(id)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_backup_history_project ON backup_history(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at)")
        
        print("✅ All missing tables created successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
