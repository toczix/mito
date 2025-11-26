import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ error: 'Missing config' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      return res.status(200).json({ 
        status: 'auth_error',
        error: authError.message,
        code: (authError as any).code
      });
    }

    return res.status(200).json({
      status: 'ok',
      userCount: authData?.users?.length || 0,
      firstUser: authData?.users?.[0]?.email
    });
  } catch (error: any) {
    return res.status(200).json({
      status: 'exception',
      error: error.message
    });
  }
}
