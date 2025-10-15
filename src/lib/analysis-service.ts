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
  notes?: string
): Promise<Analysis | null> {
  if (!supabase) return null;
  
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

