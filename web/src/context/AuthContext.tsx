import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Forca a releitura do ID token apos uma promocao a admin (Decisao tecnica 3). */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readIsAdmin(user: User): Promise<boolean> {
  const tokenResult = await user.getIdTokenResult();
  return tokenResult.claims.admin === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (current) => {
      setUser(current);
      setIsAdmin(current ? await readIsAdmin(current) : false);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signup(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function logout(): Promise<void> {
    await signOut(auth);
  }

  async function refreshClaims(): Promise<void> {
    if (!auth.currentUser) return;
    setIsAdmin(await readIsAdmin(auth.currentUser));
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, signup, logout, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  return ctx;
}
