import { getAllClients, createClient } from './client-service';
import type { Client } from './supabase';
import type { PatientInfo } from './claude-service';

export interface ClientMatchResult {
  matched: boolean;
  client: Client | null;
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
  suggestedAction: 'use-existing' | 'create-new' | 'manual-select';
}

/**
 * Smart matching algorithm to find existing client or suggest creation
 */
export async function matchOrCreateClient(patientInfo: PatientInfo): Promise<ClientMatchResult> {
  // If no patient info extracted, require manual selection
  if (!patientInfo.name && !patientInfo.dateOfBirth) {
    return {
      matched: false,
      client: null,
      confidence: 'low',
      needsConfirmation: true,
      suggestedAction: 'manual-select',
    };
  }

  // Get all clients (active + past) for matching
  const allClients = await getAllClients();
  
  if (allClients.length === 0) {
    // No clients exist, auto-create is safe
    return {
      matched: false,
      client: null,
      confidence: 'high',
      needsConfirmation: true,
      suggestedAction: 'create-new',
    };
  }

  // Try to find exact or close match
  const match = findBestMatch(allClients, patientInfo);
  
  if (match) {
    return match;
  }

  // No match found, suggest creating new client
  return {
    matched: false,
    client: null,
    confidence: 'high',
    needsConfirmation: true,
    suggestedAction: 'create-new',
  };
}

/**
 * Find best matching client based on name and DOB
 */
function findBestMatch(clients: Client[], patientInfo: PatientInfo): ClientMatchResult | null {
  const { name, dateOfBirth, gender } = patientInfo;

  for (const client of clients) {
    let matchScore = 0;
    let maxScore = 0;

    // Name matching (most important)
    if (name) {
      maxScore += 3;
      const similarity = calculateNameSimilarity(name, client.full_name);
      if (similarity >= 0.9) {
        matchScore += 3; // Exact or very close match
      } else if (similarity >= 0.7) {
        matchScore += 2; // Good match
      } else if (similarity >= 0.5) {
        matchScore += 1; // Partial match
      }
    }

    // DOB matching (very important)
    if (dateOfBirth && client.date_of_birth) {
      maxScore += 3;
      if (dateOfBirth === client.date_of_birth) {
        matchScore += 3; // Exact match
      }
    }

    // Gender matching (nice to have)
    if (gender && client.gender) {
      maxScore += 1;
      if (gender === client.gender) {
        matchScore += 1;
      }
    }

    // Calculate confidence
    const confidence = maxScore > 0 ? matchScore / maxScore : 0;

    // High confidence match (name + DOB exact)
    if (confidence >= 0.85) {
      return {
        matched: true,
        client,
        confidence: 'high',
        needsConfirmation: false,
        suggestedAction: 'use-existing',
      };
    }

    // Medium confidence match (name similar, DOB matches OR name exact)
    if (confidence >= 0.65) {
      return {
        matched: true,
        client,
        confidence: 'medium',
        needsConfirmation: true,
        suggestedAction: 'use-existing',
      };
    }
  }

  return null;
}

/**
 * Calculate similarity between two names (0 to 1)
 * Uses normalized Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = normalizeName(name1);
  const s2 = normalizeName(name2);

  if (s1 === s2) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - distance / maxLength;
}

/**
 * Normalize name for comparison
 * Handles "First Last", "Last, First", "FIRST LAST", etc.
 */
function normalizeName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove special characters, commas, etc.
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
  
  // Sort words alphabetically to handle "adam winchester" vs "winchester adam"
  const words = normalized.split(' ');
  return words.sort().join(' ');
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Auto-create client from patient info
 */
export async function autoCreateClient(patientInfo: PatientInfo): Promise<Client | null> {
  if (!patientInfo.name) {
    throw new Error('Patient name is required to create a client');
  }

  return createClient({
    full_name: patientInfo.name,
    date_of_birth: patientInfo.dateOfBirth || null,
    gender: patientInfo.gender || null,
    email: null,
    status: 'active',
    notes: 'Auto-created from lab report',
    tags: [],
  });
}

