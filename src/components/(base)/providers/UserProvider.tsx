"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { PushListener } from "@/components/push/PushListener";
import BloqueoConfirmacionModal from "@/components/(comude)/actividades/modals/BloqueoConfirmacionModal";
import BloqueoActividad from "@/components/(comude)/tareas/BloqueoActividad";
import { verificarEsJefeUsuario } from "@/components/(comude)/tareas/lib/actions";
import { verificarEsMiembroComision } from "@/components/(comude)/comisiones/lib/actions";

/** Intervalo de refresco automático de sesión (ms) - 5 minutos */
const REFRESH_INTERVAL_MS = 300_000;

interface UserContextValue {
  user: User | null;
  simulatedRole: string | null;
  setSimulatedRole: (role: string | null) => void;
  effectiveRole: string;
  realRole: string;
  esJefe: boolean;
  esMiembroComision: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  simulatedRole: null,
  setSimulatedRole: () => {},
  effectiveRole: "user",
  realRole: "user",
  esJefe: false,
  esMiembroComision: false,
});

export function UserProvider({
  user: initialUser,
  children,
}: {
  user: User | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);
  const [esJefe, setEsJefe] = useState<boolean>(false);
  const [esMiembroComision, setEsMiembroComision] = useState<boolean>(false);
  const supabase = createClient();
  const lastRoleRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  // ----- Refresco de sesión para obtener user_metadata actualizado -----
  const refreshUser = useCallback(async () => {
    // refreshSession() fuerza obtener un JWT nuevo del servidor con user_metadata actualizado
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.user) {
      setUser(data.user);
    }
  }, [supabase]);

  // Escuchar cambios de auth (login, logout, token refresh)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Refrescar al volver a la pestaña eliminado temporalmente para evitar spam en alt-tab  // Refresco periódico cada 60s para detectar cambios de rol sin recargar
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(refreshUser, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  // Verificar si el usuario tiene asignada alguna jefatura o comisión en el municipio
  useEffect(() => {
    if (!user) {
      setEsJefe(false);
      setEsMiembroComision(false);
      return;
    }
    let isMounted = true;
    verificarEsJefeUsuario()
      .then((resultado) => {
        if (isMounted) setEsJefe(resultado);
      })
      .catch(() => {
        if (isMounted) setEsJefe(false);
      });
    verificarEsMiembroComision()
      .then((resultado) => {
        if (isMounted) setEsMiembroComision(resultado);
      })
      .catch(() => {
        if (isMounted) setEsMiembroComision(false);
      });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const metadata = user?.user_metadata || {};
  const realRole = metadata.rol || user?.role || "user";
  const effectiveRole = simulatedRole || realRole;

  // Log en dev cuando cambia el rol para facilitar depuración
  useEffect(() => {
    if (lastRoleRef.current !== undefined && lastRoleRef.current !== realRole) {
      console.info(
        `[UserProvider] Rol actualizado: ${lastRoleRef.current} → ${realRole}`,
      );
    }
    lastRoleRef.current = realRole;
  }, [realRole]);

  return (
    <UserContext.Provider value={{ user, simulatedRole, setSimulatedRole, effectiveRole, realRole, esJefe, esMiembroComision }}>
      {user && (
        <>
          <PushListener />
          <BloqueoConfirmacionModal />
          <BloqueoActividad />
        </>
      )}
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const ctx = useContext(UserContext);
  return ctx.user;
};

export const useUserContext = () => {
  return useContext(UserContext);
};
