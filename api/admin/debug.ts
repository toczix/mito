import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const diagnostics: any = {
    hasUrl: !!SUPABASE_URL,
    hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
    urlPrefix: SUPABASE_URL?.substring(0, 40),
    keyPrefix: SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20),
    keyLength: SUPABASE_SERVICE_ROLE_KEY?.length,
  };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ 
      status: 'missing_config',
      diagnostics 
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: tableTest, error: tableError } = await supabase
      .from('user_subscriptions')
      .select('count')
      .limit(1);
    
    diagnostics.tableQueryWorks = !tableError;
    diagnostics.tableError = tableError?.message;

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });

    diagnostics.authAdminWorks = !authError;
    diagnostics.authError = authError?.message;
    diagnostics.authErrorCode = (authError as any)?.code;
    diagnostics.authErrorStatus = (authError as any)?.status;
    diagnostics.userCount = authData?.users?.length;

    return res.status(200).json({
      status: authError ? 'auth_failed' : 'ok',
      diagnostics
    });
  } catch (error: any) {
    diagnostics.exception = error.message;
    return res.status(200).json({
      status: 'exception',
      diagnostics
    });
  }
}
