import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SimilarContact {
  id: string;
  name: string;
  email?: string | null;
  title?: string | null;
  opportunities?: { organization: string } | null;
}

export function useContactDuplicateCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [similarContacts, setSimilarContacts] = useState<SimilarContact[]>([]);

  const checkForDuplicates = useCallback(async (
    name: string,
    email?: string,
    excludeId?: string
  ): Promise<SimilarContact[]> => {
    if (!name || name.trim().length < 3) {
      setSimilarContacts([]);
      return [];
    }

    setIsChecking(true);
    try {
      const trimmedName = name.trim().toLowerCase();
      
      // Search by name similarity
      const { data: nameMatches, error: nameError } = await supabase
        .from('contacts')
        .select('id, name, email, title, opportunities:opportunity_id(organization)')
        .ilike('name', `%${trimmedName}%`)
        .limit(5);

      if (nameError) throw nameError;

      // Also search by email if provided
      let emailMatches: SimilarContact[] = [];
      if (email && email.trim().length > 3) {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, name, email, title, opportunities:opportunity_id(organization)')
          .ilike('email', `%${email.trim()}%`)
          .limit(5);
        if (!error && data) {
          emailMatches = data as unknown as SimilarContact[];
        }
      }

      // Merge and deduplicate
      const allMatches = [...(nameMatches || []), ...emailMatches] as unknown as SimilarContact[];
      const uniqueMap = new Map<string, SimilarContact>();
      allMatches.forEach(match => {
        if (excludeId && match.id === excludeId) return;
        uniqueMap.set(match.id, match);
      });

      // Filter for actual similarity
      const filtered = Array.from(uniqueMap.values()).filter(contact => {
        const contactName = contact.name.toLowerCase();
        const isSimilarName = 
          contactName === trimmedName ||
          contactName.includes(trimmedName) ||
          trimmedName.includes(contactName) ||
          contactName.split(' ')[0] === trimmedName.split(' ')[0];
        
        const isSameEmail = email && contact.email && 
          contact.email.toLowerCase() === email.trim().toLowerCase();
        
        return isSimilarName || isSameEmail;
      });

      setSimilarContacts(filtered);
      return filtered;
    } catch (error) {
      console.error('Error checking for contact duplicates:', error);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearDuplicates = useCallback(() => {
    setSimilarContacts([]);
  }, []);

  return {
    isChecking,
    similarContacts,
    checkForDuplicates,
    clearDuplicates
  };
}
