"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { PanelUserDTO } from "@/lib/types";

interface PanelAuthContextValue {
  user: PanelUserDTO | null;
  loading: boolean;
  refreshUser: () => Promise<PanelUserDTO | null>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<PanelUserDTO | null>>;
}

const PanelAuthContext = createContext<PanelAuthContextValue | null>(null);

export function PanelAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<PanelUserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (): Promise<PanelUserDTO | null> => {
    try {
      const res = await fetch("/api/panel/auth/me", {
        cache: "no-store",
      });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = (await res.json()) as { user?: PanelUserDTO };
      const resolved = data.user ?? null;
      setUser(resolved);
      return resolved;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/panel/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <PanelAuthContext.Provider
      value={{ user, loading, refreshUser, logout, setUser }}
    >
      {children}
    </PanelAuthContext.Provider>
  );
}

export function usePanelAuth(): PanelAuthContextValue {
  const ctx = useContext(PanelAuthContext);
  if (!ctx) {
    throw new Error("usePanelAuth must be used inside PanelAuthProvider");
  }
  return ctx;
}
