import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { getMe } from "../lib/api.ts";

interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Prosodeus runs as a single local user. The API decides who that is (`/api/me`); if it is
// unreachable the app still renders with a placeholder so the editor can work offline.
const LOCAL_USER: User = { id: "local-user", email: "" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then((profile) => setUser({ id: profile.id, email: profile.email }))
      .catch(() => setUser(LOCAL_USER))
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext value={{ user, loading }}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
