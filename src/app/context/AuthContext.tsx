// context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
// import { supabase } from '../lib/supabase'; // adjust path

export type UserRole = 'candidate' | 'employer' | null;

interface AuthContextType {
  user: any | null;           // Supabase user object
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        setRole(null);
      } else {
        setRole((data?.role as UserRole) ?? null);
      }
    } catch (err) {
      console.error('Profile load failed:', err);
      setRole(null);
    }
  };
  useEffect(() => {
    // Initial session...
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) loadUserProfile(currentUser.id);  // no await here
      else setRole(null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {          // ← NO async!
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          loadUserProfile(currentUser.id); // fire and forget
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const value: AuthContextType = {
    user,
    role,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}