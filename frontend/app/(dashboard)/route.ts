// Force dynamic rendering for all dashboard routes
// This prevents Next.js from trying to statically generate pages that use localStorage
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
