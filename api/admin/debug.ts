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

    // Iterate through users one by one to find the corrupted record
    const goodUsers: string[] = [];
    const badPage: number[] = [];
    
    for (let page = 1; page <= 20; page++) {
      try {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1
        });
        
        if (error) {
          badPage.push(page);
        } else if (data?.users?.[0]) {
          goodUsers.push(data.users[0].email || data.users[0].id);
        } else {
          // No more users
          break;
        }
      } catch (e: any) {
        badPage.push(page);
      }
    }

    // Now try to find which specific page breaks when fetching more
    let breakPoint = null;
    for (let size = 2; size <= 20; size++) {
      try {
        const { error } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: size
        });
        if (error) {
          breakPoint = size;
          break;
        }
      } catch (e) {
        breakPoint = size;
        break;
      }
    }

    return res.status(200).json({
      status: 'diagnostic',
      totalGoodUsers: goodUsers.length,
      goodUsers,
      badPages: badPage,
      breaksAtSize: breakPoint,
      message: breakPoint 
        ? `Fetching fails when perPage >= ${breakPoint}. User #${breakPoint} may be corrupted.`
        : 'All individual fetches worked'
    });
  } catch (error: any) {
    return res.status(200).json({
      status: 'exception',
      error: error.message
    });
  }
}
