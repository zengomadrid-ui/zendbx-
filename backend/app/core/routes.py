"""
ZendBX Route Registry - Single source of truth for all API routes
"""

class Routes:
    """
    Central route definition registry.
    All routers must use these constants.
    """
    
    # ========================================
    # Public Project-Scoped API Routes
    # Pattern: /p/{project_slug}/v1/...
    # ========================================
    
    # Authentication
    AUTH_SIGNUP = "/p/{project_slug}/v1/auth/signup"
    AUTH_LOGIN = "/p/{project_slug}/v1/auth/login"
    AUTH_USER = "/p/{project_slug}/v1/auth/user"
    AUTH_LOGOUT = "/p/{project_slug}/v1/auth/logout"
    AUTH_REFRESH = "/p/{project_slug}/v1/auth/refresh"
    AUTH_FORGOT_PASSWORD = "/p/{project_slug}/v1/auth/forgot-password"
    AUTH_RESET_PASSWORD = "/p/{project_slug}/v1/auth/reset-password"
    AUTH_VERIFY_EMAIL = "/p/{project_slug}/v1/auth/verify-email"
    
    # REST API (Data Operations)
    REST_LIST = "/p/{project_slug}/v1/rest/{table}"
    REST_CREATE = "/p/{project_slug}/v1/rest/{table}"
    REST_UPDATE = "/p/{project_slug}/v1/rest/{table}"
    REST_DELETE = "/p/{project_slug}/v1/rest/{table}"
    REST_GET_BY_ID = "/p/{project_slug}/v1/rest/{table}/{id}"
    
    # Storage
    STORAGE_LIST_BUCKETS = "/p/{project_slug}/v1/storage/buckets"
    STORAGE_CREATE_BUCKET = "/p/{project_slug}/v1/storage/buckets"
    STORAGE_DELETE_BUCKET = "/p/{project_slug}/v1/storage/buckets/{bucket_id}"
    STORAGE_LIST_FILES = "/p/{project_slug}/v1/storage/buckets/{bucket_id}/files"
    STORAGE_UPLOAD = "/p/{project_slug}/v1/storage/buckets/{bucket_id}/upload"
    STORAGE_DOWNLOAD = "/p/{project_slug}/v1/storage/buckets/{bucket_id}/files/{file_id}"
    STORAGE_DELETE_FILE = "/p/{project_slug}/v1/storage/buckets/{bucket_id}/files/{file_id}"
    
    # Realtime
    REALTIME_WEBSOCKET = "/p/{project_slug}/v1/realtime"
    
    # Functions (Future)
    FUNCTIONS_INVOKE = "/p/{project_slug}/v1/functions/{function_name}"
    
    # ========================================
    # Platform/Admin Routes (Internal)
    # Pattern: /api/...
    # Require platform authentication
    # ========================================
    
    # Platform Authentication
    PLATFORM_AUTH_SIGNUP = "/api/auth/signup"
    PLATFORM_AUTH_LOGIN = "/api/auth/login"
    PLATFORM_AUTH_ME = "/api/auth/me"
    PLATFORM_AUTH_LOGOUT = "/api/auth/logout"
    
    # Projects Management
    PROJECTS_LIST = "/api/projects"
    PROJECTS_CREATE = "/api/projects"
    PROJECTS_GET = "/api/projects/{project_id}"
    PROJECTS_UPDATE = "/api/projects/{project_id}"
    PROJECTS_DELETE = "/api/projects/{project_id}"
    PROJECTS_KEYS = "/api/projects/{project_id}/keys"
    
    # Admin
    ADMIN_USERS = "/api/admin/users"
    ADMIN_QUOTAS = "/api/admin/quotas"
    
    @classmethod
    def format_route(cls, route_const: str, **params) -> str:
        """
        Format a route constant with parameters.
        
        Example:
            Routes.format_route(Routes.AUTH_SIGNUP, project_slug="my-project")
            # Returns: "/p/my-project/v1/auth/signup"
        """
        return route_const.format(**params)


# Route groups for documentation
PUBLIC_ROUTES = [
    Routes.AUTH_SIGNUP,
    Routes.AUTH_LOGIN,
    Routes.AUTH_USER,
    Routes.REST_LIST,
    Routes.REST_CREATE,
    Routes.STORAGE_LIST_BUCKETS,
]

ADMIN_ROUTES = [
    Routes.PLATFORM_AUTH_SIGNUP,
    Routes.PLATFORM_AUTH_LOGIN,
    Routes.PROJECTS_LIST,
    Routes.PROJECTS_CREATE,
]
