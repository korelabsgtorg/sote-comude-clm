import { createClient } from "@/utils/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getManageableRoles } from "./permissions";
import { getGlobalMunicipioCookie } from "@/components/(base)/layout/actions";

export function useUsers(actorRole?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["users-list", actorRole],
    queryFn: async () => {
      if (!actorRole || getManageableRoles(actorRole).length === 0) {
        return [];
      }

      let query = supabase
        .from("profiles")
        .select("id, nombre, rol")
        .order("nombre", { ascending: true });

      if (actorRole === "super") {
        const globalMun = await getGlobalMunicipioCookie();
        if (globalMun?.id) {
          query = query.or(`municipio_id.eq.${globalMun.id},municipio_id.is.null`);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("municipio_id")
              .eq("id", user.id)
              .single();
            if (profile?.municipio_id) {
              query = query.or(`municipio_id.eq.${profile.municipio_id},municipio_id.is.null`);
            }
          }
        }
      } else if (actorRole === "admin") {
        query = query.neq("rol", "super");
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("municipio_id")
            .eq("id", user.id)
            .single();
          if (profile?.municipio_id) {
            query = query.eq("municipio_id", profile.municipio_id);
          }
        }
      } else if (actorRole === "admin-observatorio") {
        query = query.in("rol", getManageableRoles(actorRole));
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;

      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: !!actorRole && getManageableRoles(actorRole).length > 0,
  });
}
