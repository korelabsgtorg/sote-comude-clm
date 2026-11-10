"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutos de caché por defecto (evita solicitudes redundantes)
            gcTime: 1000 * 60 * 15, // 15 minutos de permanencia en memoria
            refetchOnWindowFocus: false, // Evita disparar peticiones al cambiar de ventana/pestaña
            refetchOnMount: false, // Reutiliza datos frescos al cambiar entre vistas
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
