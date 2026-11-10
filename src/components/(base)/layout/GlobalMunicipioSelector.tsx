"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { getAllMunicipios } from "@/components/(base)/(auth)/signup/actions";
import { setGlobalMunicipioCookie, getInitialGlobalMunicipioState } from "./actions";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MapPin } from "lucide-react";

export function GlobalMunicipioSelector({ enabled = true }: { enabled?: boolean }) {
  const { effectiveRole } = useUserContext();
  const router = useRouter();
  const [selectedMun, setSelectedMun] = useState<string>("");

  const { data: initialState } = useQuery({
    queryKey: ["global-municipio-state"],
    queryFn: () => getInitialGlobalMunicipioState(),
    enabled: enabled && effectiveRole === "super",
    staleTime: 1000 * 60 * 5,
  });

  const { data: allMunsData } = useQuery({
    queryKey: ["todos-municipios"],
    queryFn: () => getAllMunicipios(),
    enabled: enabled && effectiveRole === "super",
    staleTime: Infinity,
  });

  useEffect(() => {
    if (initialState) {
      if (initialState.municipioId && !selectedMun) setSelectedMun(String(initialState.municipioId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  if (effectiveRole !== "super") return null;

  const municipiosFormatted = (allMunsData || []).map((m: any) => ({
    id: m.id,
    nombre: `${m.nombre}, ${m.lug_departamentos?.nombre || ""}`,
  }));

  return (
    <div className="flex items-center gap-2 w-full max-w-[350px]">
      <div className="w-full relative group">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground opacity-50 z-10" />
        <div className="[&_input]:pl-9 [&_input]:h-9 [&_input]:bg-white dark:[&_input]:bg-zinc-950 [&_input]:border-input">
          <SearchableSelect
            items={municipiosFormatted}
            value={selectedMun}
            placeholder="Buscar municipio..."
            onChange={async (val) => {
              setSelectedMun(val);
              if (val) {
                const mun = municipiosFormatted.find((m: any) => String(m.id) === val);
                await setGlobalMunicipioCookie(Number(val), mun?.nombre?.split(",")[0] || "");
              } else {
                await setGlobalMunicipioCookie(null, null);
              }
              window.location.reload();
            }}
            onAdd={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
