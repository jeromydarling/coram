import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '@/contexts/DemoModeContext';

type AppRole = 'admin' | 'regional_lead' | 'staff' | 'leadership' | 'warehouse_manager' | 'steward';

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  nickname: string | null;
  timezone: string | null;
  is_approved: boolean;
  ministry_role: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isSteward: boolean;
  isLeadership: boolean;
  isRegionalLead: boolean;
  isApproved: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName?: string, timezone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isDemoMode, demoSession, demoRole } = useDemoMode();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (userId: string): Promise<void> => {
    // Fetch profile and roles in parallel
    const [profileResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('id, user_id, display_name, nickname, timezone, is_approved, ministry_role').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('*').eq('user_id', userId)
    ]);
    
    if (profileResult.data) {
      setProfile(profileResult.data as Profile);
    } else {
      // Profile may not exist yet (trigger race condition) — set a minimal fallback
      setProfile(null);
    }
    
    if (rolesResult.data) {
      setRoles((rolesResult.data as UserRole[]).map(r => r.role));
    }
  };

  const loadUserData = async (userId: string): Promise<void> => {
    try {
      setIsLoading(true);
      await fetchUserData(userId);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const initializeAuth = async () => {
      // Check for existing session first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadUserData(session.user.id);
        return;
      }
      
      if (isMounted) {
        setIsLoading(false);
      }
    };

    // Initialize auth state
    initializeAuth();

    // Set up auth state listener for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // IMPORTANT: Ensure protected routes don't render until profile/roles are fetched,
          // otherwise the "Account Pending Approval" screen can briefly flash.
          // Defer to avoid blocking the callback.
          setIsLoading(true);
          setTimeout(() => {
            if (!isMounted) return;
            loadUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Realtime: live-refresh profile when ministry_role or is_approved changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('profile-role-watch')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setProfile({
            id: updated.id,
            user_id: updated.user_id,
            display_name: updated.display_name,
            nickname: updated.nickname,
            timezone: updated.timezone,
            is_approved: updated.is_approved,
            ministry_role: updated.ministry_role,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some(r => roles.includes(r));

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, displayName?: string, timezone?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName, timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  // Demo mode: provide synthetic auth context
  const demoMinistryRole = demoRole === 'steward' ? 'shepherd' : demoRole;
  const demoProfile: Profile | null = isDemoMode && demoSession ? {
    id: 'demo-profile-id',
    user_id: 'demo-user-id',
    display_name: demoSession.name,
    nickname: demoSession.name.split(' ')[0],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    is_approved: true,
    ministry_role: demoMinistryRole,
  } : null;

  const demoRoles: AppRole[] = isDemoMode
    ? (demoRole === 'steward' ? ['steward'] : [])
    : [];

  const effectiveProfile = isDemoMode ? demoProfile : profile;
  const effectiveRoles = isDemoMode ? demoRoles : roles;
  const effectiveUser = isDemoMode ? ({ id: 'demo-user-id', email: demoSession?.email } as unknown as User) : user;

  const effectiveHasRole = (role: AppRole) => effectiveRoles.includes(role);
  const effectiveHasAnyRole = (checkRoles: AppRole[]) => checkRoles.some(r => effectiveRoles.includes(r));

  const value: AuthContextType = {
    user: effectiveUser,
    session: isDemoMode ? ({} as Session) : session,
    profile: effectiveProfile,
    roles: effectiveRoles,
    isLoading: isDemoMode ? false : isLoading,
    isAdmin: isDemoMode ? false : hasRole('admin'),
    isSteward: isDemoMode ? demoRole === 'steward' : hasRole('steward'),
    isLeadership: isDemoMode ? (demoRole === 'steward' || demoRole === 'shepherd') : hasRole('leadership'),
    isRegionalLead: isDemoMode ? false : hasRole('regional_lead'),
    isApproved: isDemoMode ? true : (profile?.is_approved ?? false),
    hasRole: effectiveHasRole,
    hasAnyRole: effectiveHasAnyRole,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
