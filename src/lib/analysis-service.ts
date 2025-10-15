import { supabase, type Analysis } from './supabase';
import type { AnalysisResult } from './biomarkers';

export async function getClientAnalyses(clientId: string): Promise<Analysis[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('client_id', clientId)
    .order('analysis_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching analyses:', error);
    return [];
  }
  
  return data || [];
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching analysis:', error);
    return null;
  }
  
  return data;
}

export async function createAnalysis(
  clientId: string,
  results: AnalysisResult[],
  labTestDate?: string | null,
  notes?: string
): Promise<Analysis | null> {
  if (!supabase) return null;
  
  // Check for existing analysis with same lab_test_date
  if (labTestDate) {
    const existing = await findAnalysisByDate(clientId, labTestDate);
    if (existing) {
      console.log(`Analysis already exists for ${labTestDate}, updating instead of creating duplicate`);
      return updateAnalysis(existing.id, { results, notes });
    }
  }
  
  // Generate summary stats
  const summary = {
    totalBiomarkers: results.length,
    measuredBiomarkers: results.filter(r => r.hisValue !== 'N/A').length,
    missingBiomarkers: results.filter(r => r.hisValue === 'N/A').length,
  };
  
  const { data, error } = await supabase
    .from('analyses')
    .insert({
      client_id: clientId,
      lab_test_date: labTestDate || null,
      results: results,
      summary: summary,
      notes: notes || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating analysis:', error);
    return null;
  }
  
  return data;
}

export async function updateAnalysis(
  id: string,
  updates: { results?: AnalysisResult[]; notes?: string }
): Promise<Analysis | null> {
  if (!supabase) return null;
  
  const updateData: any = {};
  
  if (updates.results) {
    updateData.results = updates.results;
    updateData.summary = {
      totalBiomarkers: updates.results.length,
      measuredBiomarkers: updates.results.filter(r => r.hisValue !== 'N/A').length,
      missingBiomarkers: updates.results.filter(r => r.hisValue === 'N/A').length,
    };
  }
  
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }
  
  const { data, error } = await supabase
    .from('analyses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating analysis:', error);
    return null;
  }
  
  return data;
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('analyses')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting analysis:', error);
    return false;
  }
  
  return true;
}

export async function getLatestAnalysis(clientId: string): Promise<Analysis | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('client_id', clientId)
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    console.error('Error fetching latest analysis:', error);
    return null;
  }
  
  return data;
}

export async function findAnalysisByDate(
  clientId: string,
  labTestDate: string
): Promise<Analysis | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('client_id', clientId)
    .eq('lab_test_date', labTestDate)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('Error finding analysis by date:', error);
    return null;
  }
  
  return data;
}

export async function deleteDuplicateAnalyses(clientId: string): Promise<number> {
  if (!supabase) return 0;
  
  // Get all analyses for this client
  const analyses = await getClientAnalyses(clientId);
  
  // Group by lab_test_date
  const byDate = new Map<string, Analysis[]>();
  analyses.forEach(analysis => {
    const date = analysis.lab_test_date || 'no-date';
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(analysis);
  });
  
  // Delete duplicates (keep the most recent one for each date)
  let deletedCount = 0;
  for (const [date, group] of byDate) {
    if (group.length > 1 && date !== 'no-date') {
      // Sort by created_at, keep the newest
      group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Delete all but the first (newest)
      for (let i = 1; i < group.length; i++) {
        const deleted = await deleteAnalysis(group[i].id);
        if (deleted) deletedCount++;
      }
    }
  }
  
  return deletedCount;
}

