import { useQuery } from "@tanstack/react-query";
import { getGlobalMunicipioTitle } from "@/components/(base)/layout/actions";
import { useEffect, useState } from "react";

export function useDynamicTitle() {
  const defaultTitle = "COMUDE Concepcion Las Minas, Chiquimula";
  const [localTitle, setLocalTitle] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sote_municipio_title") || defaultTitle;
    }
    return defaultTitle;
  });

  const { data: serverTitle } = useQuery({
    queryKey: ["global-municipio-title"],
    queryFn: async () => {
      try {
        return await getGlobalMunicipioTitle();
      } catch {
        return defaultTitle;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de caché
  });

  useEffect(() => {
    if (serverTitle && serverTitle !== localTitle) {
      setLocalTitle(serverTitle);
      localStorage.setItem("sote_municipio_title", serverTitle);
    }
  }, [serverTitle, localTitle]);

  return localTitle;
}
