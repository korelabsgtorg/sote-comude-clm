import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConfiguracionMunicipio,
  upsertConfiguracionMunicipio,
  getIntegrantesEstructuraMunicipio,
  ConfiguracionMunicipio,
  LogoMunicipioItem,
  FirmaMunicipioItem,
  ConvocatoriaConfig,
  IntegranteEstructura,
} from "./actions";

export const useConfiguracionMunicipio = (municipioId: number | null | undefined) => {
  return useQuery<ConfiguracionMunicipio | null, Error>({
    queryKey: ["configuracionMunicipio", municipioId],
    queryFn: async () => {
      if (!municipioId) return null;
      return getConfiguracionMunicipio(municipioId);
    },
    enabled: !!municipioId,
  });
};

export const useIntegrantesEstructuraMunicipio = (municipioId: number | null | undefined) => {
  return useQuery<IntegranteEstructura[], Error>({
    queryKey: ["integrantesEstructuraMunicipio", municipioId],
    queryFn: async () => {
      if (!municipioId) return [];
      return getIntegrantesEstructuraMunicipio(municipioId);
    },
    enabled: !!municipioId,
  });
};

export const useUpsertConfiguracionMunicipio = (municipioId: number | null | undefined) => {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    {
      imagenPortadaUrl: string | null;
      minutosAntes: number;
      minutosDespues: number;
      logo?: LogoMunicipioItem[] | null;
      convocatoriaConfig?: ConvocatoriaConfig | null;
      firmas?: FirmaMunicipioItem[] | null;
    }
  >({
    mutationFn: async ({ imagenPortadaUrl, minutosAntes, minutosDespues, logo, convocatoriaConfig, firmas }) => {
      if (!municipioId) throw new Error("municipio_id requerido");
      await upsertConfiguracionMunicipio(municipioId, imagenPortadaUrl, minutosAntes, minutosDespues, logo, convocatoriaConfig, firmas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracionMunicipio", municipioId] });
    },
  });
};
