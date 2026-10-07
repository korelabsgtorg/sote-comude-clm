"use client";

import { useEffect, useState } from "react";
import {
  ImageIcon,
  Loader2,
  Save,
  Clock,
  Shield,
  Trash2,
  Plus,
  FileImage,
  PenTool,
  FileText,
  UserCheck,
} from "lucide-react";
import ImageUploader from "@/components/(uploads)/imgs/ImageUploader";
import {
  useConfiguracionMunicipio,
  useUpsertConfiguracionMunicipio,
  useIntegrantesEstructuraMunicipio,
} from "./hooks";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import { useStorageDisplayUrl } from "@/components/(uploads)/imgs/useStorageDisplayUrl";
import { getInitialGlobalMunicipioState } from "@/components/(base)/layout/actions";
import { LogoMunicipioItem, FirmaMunicipioItem, ConvocatoriaConfig } from "./actions";
import { createClient } from "@/utils/supabase/client";
import { toast } from "react-toastify";

const BUCKET = "portada_imagenes";

// ── Tarjeta de Logo en el Banco ─────────────────────────────────────────────
function LogoCardItem({
  item,
  onDelete,
  disabled,
}: {
  item: LogoMunicipioItem;
  onDelete: (item: LogoMunicipioItem) => Promise<void>;
  disabled: boolean;
}) {
  const { url, loading } = useStorageDisplayUrl(BUCKET, item.path);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(item);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative group rounded-xl border border-border bg-background p-3 flex flex-col items-center justify-between gap-3 shadow-sm hover:border-emerald-500/50 transition-all">
      <div className="w-full h-28 flex items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-100 border border-border/40 overflow-hidden shadow-inner">
        {loading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={item.titulo} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Sin vista previa</span>
        )}
      </div>

      <div className="w-full text-center min-w-0">
        <h4 className="text-xs font-bold text-foreground truncate" title={item.titulo}>
          {item.titulo}
        </h4>
        <span className="text-[10px] text-muted-foreground block truncate">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={disabled || deleting}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
      >
        {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        Eliminar
      </button>
    </div>
  );
}

// ── Tarjeta de Firma/Sello en el Banco ──────────────────────────────────────
function FirmaCardItem({
  item,
  onDelete,
  disabled,
}: {
  item: FirmaMunicipioItem;
  onDelete: (item: FirmaMunicipioItem) => Promise<void>;
  disabled: boolean;
}) {
  const { url, loading } = useStorageDisplayUrl(BUCKET, item.path);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(item);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative group rounded-xl border border-border bg-background p-3 flex flex-col items-center justify-between gap-3 shadow-sm hover:border-purple-500/50 transition-all">
      <div className="w-full h-28 flex items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-100 border border-border/40 overflow-hidden shadow-inner">
        {loading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={item.titulo} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Sin vista previa</span>
        )}
      </div>

      <div className="w-full text-center min-w-0">
        <h4 className="text-xs font-bold text-foreground truncate" title={item.titulo}>
          {item.titulo}
        </h4>
        <span className="text-[10px] text-muted-foreground block truncate">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={disabled || deleting}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
      >
        {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        Eliminar
      </button>
    </div>
  );
}

export default function MunicipioSettingsSection() {
  const { effectiveRole } = useUserContext();
  const [municipioId, setMunicipioId] = useState<number | null>(null);

  useEffect(() => {
    getInitialGlobalMunicipioState().then((state) => {
      setMunicipioId(state.municipioId ?? null);
    });
  }, []);

  const { data: config, isLoading } = useConfiguracionMunicipio(municipioId);
  const { data: integrantes = [] } = useIntegrantesEstructuraMunicipio(municipioId);
  const { mutate: upsertConfig, isPending } = useUpsertConfiguracionMunicipio(municipioId);

  const [minutosAntes, setMinutosAntes] = useState<number | "">(15);
  const [minutosDespues, setMinutosDespues] = useState<number | "">(30);

  // Estado local para Banco de Logos
  const [nuevoTituloLogo, setNuevoTituloLogo] = useState("");
  const [mostrarFormNuevoLogo, setMostrarFormNuevoLogo] = useState(false);

  // Estado local para Banco de Firmas
  const [nuevoTituloFirma, setNuevoTituloFirma] = useState("");
  const [mostrarFormNuevaFirma, setMostrarFormNuevaFirma] = useState(false);

  // Estado local para Plantilla de Convocatoria
  const [convocatoriaForm, setConvocatoriaForm] = useState<ConvocatoriaConfig>({
    logo_izquierda_path: "",
    logo_derecha_path: "",
    coordinador_id: "",
    coordinador_nombre: "",
    coordinador_puesto: "",
    firma_path: "",
    destinatarios_default:
      "Síndicos Y Concejales\nRepresentantes De Los Consejos Comunitarios De Desarrollo De Primer Nivel\nRepresentantes De Las Entidades Públicas Con Presencia En El Municipio.\nApoyo de Oficinas con Presencia en la Municipalidad.",
  });

  useEffect(() => {
    if (config) {
      setMinutosAntes(config.minutos_antes_permitidos ?? 15);
      setMinutosDespues(config.minutos_despues_permitidos ?? 30);
      if (config.convocatoria_config) {
        setConvocatoriaForm({
          logo_izquierda_path: config.convocatoria_config.logo_izquierda_path ?? "",
          logo_derecha_path: config.convocatoria_config.logo_derecha_path ?? "",
          coordinador_id: config.convocatoria_config.coordinador_id ?? "",
          coordinador_nombre: config.convocatoria_config.coordinador_nombre ?? "",
          coordinador_puesto: config.convocatoria_config.coordinador_puesto ?? "",
          firma_path: config.convocatoria_config.firma_path ?? "",
          destinatarios_default:
            config.convocatoria_config.destinatarios_default ??
            "Síndicos Y Concejales\nRepresentantes De Los Consejos Comunitarios De Desarrollo De Primer Nivel\nRepresentantes De Las Entidades Públicas Con Presencia En El Municipio.\nApoyo de Oficinas con Presencia en la Municipalidad.",
        });
      }
    }
  }, [config]);

  const currentPath = config?.imagen_portada_url ?? null;
  const folderPath = municipioId ? `portadas/municipio_${municipioId}` : undefined;
  const logoFolderPath = municipioId ? `logo/municipio_${municipioId}` : undefined;
  const firmasFolderPath = municipioId ? `firmas/municipio_${municipioId}` : undefined;

  // Normalizar Banco de Logos
  const currentLogos: LogoMunicipioItem[] = (() => {
    if (!config?.logo) return [];
    if (Array.isArray(config.logo)) return config.logo;
    const raw = config.logo as any;
    const singlePath = typeof raw === "string" ? raw : raw?.url || raw?.path;
    if (singlePath) {
      return [
        {
          id: "logo_legacy_1",
          titulo: "Logo Principal",
          path: singlePath,
          created_at: new Date().toISOString(),
        },
      ];
    }
    return [];
  })();

  // Normalizar Banco de Firmas
  const currentFirmas: FirmaMunicipioItem[] = Array.isArray(config?.firmas) ? config.firmas : [];

  const { url: previewUrl } = useStorageDisplayUrl(BUCKET, currentPath);

  // Manejadores para Portada
  const handleUploadSuccess = async (newPath: string) => {
    upsertConfig(
      {
        imagenPortadaUrl: newPath,
        minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
        minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
        logo: currentLogos,
        convocatoriaConfig: convocatoriaForm,
        firmas: currentFirmas,
      },
      {
        onSuccess: () => toast.success("Imagen de portada actualizada."),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDeleteSuccess = async () => {
    upsertConfig(
      {
        imagenPortadaUrl: null,
        minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
        minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
        logo: currentLogos,
        convocatoriaConfig: convocatoriaForm,
        firmas: currentFirmas,
      },
      {
        onSuccess: () => toast.success("Imagen de portada eliminada."),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  // Manejadores para Banco de Logos
  const handleLogoUploadSuccess = async (newPath: string) => {
    const tituloFinal = nuevoTituloLogo.trim() || `Logo ${currentLogos.length + 1}`;
    const newItem: LogoMunicipioItem = {
      id: `logo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      titulo: tituloFinal,
      path: newPath,
      created_at: new Date().toISOString(),
    };

    const updatedLogos = [...currentLogos, newItem];

    upsertConfig(
      {
        imagenPortadaUrl: currentPath,
        minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
        minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
        logo: updatedLogos,
        convocatoriaConfig: convocatoriaForm,
        firmas: currentFirmas,
      },
      {
        onSuccess: () => {
          toast.success(`Logo "${tituloFinal}" agregado al banco.`);
          setNuevoTituloLogo("");
          setMostrarFormNuevoLogo(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleLogoDelete = async (itemToDelete: LogoMunicipioItem) => {
    try {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([itemToDelete.path]);

      const updatedLogos = currentLogos.filter((item) => item.id !== itemToDelete.id);

      upsertConfig(
        {
          imagenPortadaUrl: currentPath,
          minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
          minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
          logo: updatedLogos,
          convocatoriaConfig: convocatoriaForm,
          firmas: currentFirmas,
        },
        {
          onSuccess: () => toast.success(`Logo "${itemToDelete.titulo}" eliminado.`),
          onError: (err) => toast.error(err.message),
        }
      );
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar el logo.");
    }
  };

  // Manejadores para Banco de Firmas
  const handleFirmaUploadSuccess = async (newPath: string) => {
    const tituloFinal = nuevoTituloFirma.trim() || `Firma ${currentFirmas.length + 1}`;
    const newItem: FirmaMunicipioItem = {
      id: `firma_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      titulo: tituloFinal,
      path: newPath,
      created_at: new Date().toISOString(),
    };

    const updatedFirmas = [...currentFirmas, newItem];

    upsertConfig(
      {
        imagenPortadaUrl: currentPath,
        minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
        minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
        logo: currentLogos,
        convocatoriaConfig: convocatoriaForm,
        firmas: updatedFirmas,
      },
      {
        onSuccess: () => {
          toast.success(`Firma "${tituloFinal}" agregada al banco.`);
          setNuevoTituloFirma("");
          setMostrarFormNuevaFirma(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleFirmaDelete = async (itemToDelete: FirmaMunicipioItem) => {
    try {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([itemToDelete.path]);

      const updatedFirmas = currentFirmas.filter((item) => item.id !== itemToDelete.id);

      upsertConfig(
        {
          imagenPortadaUrl: currentPath,
          minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
          minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
          logo: currentLogos,
          convocatoriaConfig: convocatoriaForm,
          firmas: updatedFirmas,
        },
        {
          onSuccess: () => toast.success(`Firma "${itemToDelete.titulo}" eliminada.`),
          onError: (err) => toast.error(err.message),
        }
      );
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar la firma.");
    }
  };

  // Manejador de Guardado de Reglas de Asistencia
  const handleSaveMinutes = () => {
    upsertConfig(
      {
        imagenPortadaUrl: currentPath,
        minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
        minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
        logo: currentLogos,
        convocatoriaConfig: convocatoriaForm,
        firmas: currentFirmas,
      },
      {
        onSuccess: () => toast.success("Reglas de asistencia actualizadas."),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  // Manejador de Selección de Coordinador
  const handleCoordinadorSelect = (profileId: string) => {
    const selected = integrantes.find((i) => i.id === profileId);
    if (selected) {
      setConvocatoriaForm((prev) => ({
        ...prev,
        coordinador_id: selected.id,
        coordinador_nombre: selected.nombre,
        coordinador_puesto: selected.puesto,
      }));
    } else {
      setConvocatoriaForm((prev) => ({
        ...prev,
        coordinador_id: "",
        coordinador_nombre: "",
        coordinador_puesto: "",
      }));
    }
  };

  // Manejador de Guardado de Plantilla de Convocatorias
  const handleSaveConvocatoriaConfig = () => {
    upsertConfig(
      {
        imagenPortadaUrl: currentPath,
        minutosAntes: minutosAntes === "" ? 0 : minutosAntes,
        minutosDespues: minutosDespues === "" ? 0 : minutosDespues,
        logo: currentLogos,
        convocatoriaConfig: convocatoriaForm,
        firmas: currentFirmas,
      },
      {
        onSuccess: () => toast.success("Plantilla de Convocatorias guardada correctamente."),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  // Se muestra solo a administradores
  if (!["admin", "super"].includes(effectiveRole)) return null;
  if (!municipioId) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Reglas de Asistencia */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="size-5 text-azul-trifinio dark:text-celeste-trifinio" />
            <h3 className="text-xl font-bold text-foreground">Reglas de Asistencia</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Define el tiempo mínimo y máximo permitido para que los usuarios puedan marcar su entrada o salida respecto a la hora programada.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Minutos antes */}
          <div className="space-y-2">
            <label htmlFor="mun-min-antes" className="text-sm font-semibold text-foreground">
              Minutos antes permitidos
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mun-min-antes"
                type="number"
                min={0}
                value={minutosAntes}
                onChange={(e) => setMinutosAntes(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full sm:max-w-32 px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-azul-trifinio [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-muted-foreground">minutos</span>
            </div>
          </div>

          {/* Minutos despues */}
          <div className="space-y-2">
            <label htmlFor="mun-min-despues" className="text-sm font-semibold text-foreground">
              Minutos después permitidos
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mun-min-despues"
                type="number"
                min={0}
                value={minutosDespues}
                onChange={(e) => setMinutosDespues(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full sm:max-w-32 px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-azul-trifinio [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-muted-foreground">minutos</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            onClick={handleSaveMinutes}
            disabled={isPending || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-azul-trifinio hover:bg-azul-trifinio/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar Reglas
          </button>
        </div>
      </div>

      {/* Banco de Logos del Municipio */}
      <div className="flex flex-col divide-y divide-border/25 overflow-hidden rounded-2xl border border-border/80 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <FileImage className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-semibold text-foreground">
                Banco de Logos del Municipio
              </h3>
              <p className="text-xs text-muted-foreground">
                Almacena los logos y escudos oficiales de este municipio para utilizarlos en documentos. Máximo 500 KB por imagen (PNG, JPG o WebP).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMostrarFormNuevoLogo((v) => !v)}
            disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Plus className="size-4" />
            {mostrarFormNuevoLogo ? "Cancelar" : "Agregar Logo"}
          </button>
        </div>

        {/* Formulario para agregar un nuevo logo */}
        {mostrarFormNuevoLogo && (
          <div className="p-4 md:p-5 bg-muted/15 space-y-4">
            <h4 className="text-sm font-bold text-foreground">Nuevo Registro en Banco de Logos</h4>
            
            <div className="space-y-1.5 max-w-md">
              <label htmlFor="logo-titulo" className="text-xs font-semibold text-foreground">
                Título o Identificador del Logo <span className="text-red-500">*</span>
              </label>
              <input
                id="logo-titulo"
                type="text"
                placeholder="Ej: Logo Municipal, Escudo Oficial, Sello COMUDE..."
                value={nuevoTituloLogo}
                onChange={(e) => setNuevoTituloLogo(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Seleccionar e Imagen a Cargar
              </label>
              {isLoading || !municipioId ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ImageUploader
                  bucketName={BUCKET}
                  currentImagePath={null}
                  onUploadSuccess={handleLogoUploadSuccess}
                  onDeleteSuccess={async () => {}}
                  disabled={isPending || !nuevoTituloLogo.trim()}
                  aspect={1}
                  aspectLabel="Cuadrado 1:1"
                  maxSizeMB={0.5}
                  maxDimension={1024}
                  folderPath={logoFolderPath}
                />
              )}
              {!nuevoTituloLogo.trim() && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  * Ingrese un título arriba para habilitar la carga de la imagen.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Galería de Logos Registrados */}
        <div className="p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Logos Registrados ({currentLogos.length})
            </h4>
          </div>

          {currentLogos.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-border/70 p-6">
              <Shield className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs font-medium text-muted-foreground">
                No hay logos registrados en el banco de este municipio.
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Haga clic en &quot;Agregar Logo&quot; para registrar el primero.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {currentLogos.map((logoItem) => (
                <LogoCardItem
                  key={logoItem.id}
                  item={logoItem}
                  onDelete={handleLogoDelete}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Banco de Firmas y Sellos del Municipio */}
      <div className="flex flex-col divide-y divide-border/25 overflow-hidden rounded-2xl border border-border/80 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-500/10 p-2.5">
              <PenTool className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-base font-semibold text-foreground">
                Banco de Firmas y Sellos del Municipio
              </h3>
              <p className="text-xs text-muted-foreground">
                Almacena imágenes de firmas digitalizadas y sellos oficiales para adjuntar a convocatorias y documentos. Máximo 500 KB por imagen (PNG o WebP con transparencia recomendados).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMostrarFormNuevaFirma((v) => !v)}
            disabled={isPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Plus className="size-4" />
            {mostrarFormNuevaFirma ? "Cancelar" : "Agregar Firma"}
          </button>
        </div>

        {/* Formulario para agregar una nueva firma */}
        {mostrarFormNuevaFirma && (
          <div className="p-4 md:p-5 bg-muted/15 space-y-4">
            <h4 className="text-sm font-bold text-foreground">Nuevo Registro en Banco de Firmas</h4>

            <div className="space-y-1.5 max-w-md">
              <label htmlFor="firma-titulo" className="text-xs font-semibold text-foreground">
                Título o Identificador de la Firma / Sello <span className="text-red-500">*</span>
              </label>
              <input
                id="firma-titulo"
                type="text"
                placeholder="Ej: Firma Telmo (Coordinador), Sello Oficial COMUDE..."
                value={nuevoTituloFirma}
                onChange={(e) => setNuevoTituloFirma(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Seleccionar e Imagen a Cargar
              </label>
              {isLoading || !municipioId ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ImageUploader
                  bucketName={BUCKET}
                  currentImagePath={null}
                  onUploadSuccess={handleFirmaUploadSuccess}
                  onDeleteSuccess={async () => {}}
                  disabled={isPending || !nuevoTituloFirma.trim()}
                  aspect={1}
                  aspectLabel="Cuadrado 1:1"
                  maxSizeMB={0.5}
                  maxDimension={1024}
                  folderPath={firmasFolderPath}
                />
              )}
              {!nuevoTituloFirma.trim() && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  * Ingrese un título arriba para habilitar la carga de la firma.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Galería de Firmas Registradas */}
        <div className="p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Firmas Registradas ({currentFirmas.length})
            </h4>
          </div>

          {currentFirmas.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-border/70 p-6">
              <PenTool className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs font-medium text-muted-foreground">
                No hay firmas ni sellos registrados en el banco de este municipio.
              </p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Haga clic en &quot;Agregar Firma&quot; para registrar la primera.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {currentFirmas.map((firmaItem) => (
                <FirmaCardItem
                  key={firmaItem.id}
                  item={firmaItem}
                  onDelete={handleFirmaDelete}
                  disabled={isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plantilla de Convocatorias por Defecto */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <FileText className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Plantilla de Convocatorias</h3>
            <p className="text-sm text-muted-foreground">
              Configura los elementos y autoridades predeterminadas que se utilizarán al generar convocatorias en este municipio.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Logo Izquierdo */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileImage className="size-4 text-emerald-500" /> Logo Izquierdo (Encabezado)
            </label>
            <select
              value={convocatoriaForm.logo_izquierda_path || ""}
              onChange={(e) =>
                setConvocatoriaForm((prev) => ({ ...prev, logo_izquierda_path: e.target.value }))
              }
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sin logo izquierdo --</option>
              {currentLogos.map((logo) => (
                <option key={logo.id} value={logo.path}>
                  {logo.titulo}
                </option>
              ))}
            </select>
          </div>

          {/* Logo Derecho */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileImage className="size-4 text-emerald-500" /> Logo Derecho (Encabezado)
            </label>
            <select
              value={convocatoriaForm.logo_derecha_path || ""}
              onChange={(e) =>
                setConvocatoriaForm((prev) => ({ ...prev, logo_derecha_path: e.target.value }))
              }
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sin logo derecho --</option>
              {currentLogos.map((logo) => (
                <option key={logo.id} value={logo.path}>
                  {logo.titulo}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinador / Autoridad Firmante */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <UserCheck className="size-4 text-indigo-500" /> Coordinador / Autoridad Firmante
            </label>
            <select
              value={convocatoriaForm.coordinador_id || ""}
              onChange={(e) => handleCoordinadorSelect(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccionar integrante de la estructura --</option>
              {integrantes.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({i.puesto})
                </option>
              ))}
            </select>

            {convocatoriaForm.coordinador_nombre && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 text-xs space-y-0.5">
                <p className="font-bold text-foreground">
                  Firmante: <span className="font-normal">{convocatoriaForm.coordinador_nombre}</span>
                </p>
                <p className="font-bold text-foreground">
                  Cargo: <span className="font-normal">{convocatoriaForm.coordinador_puesto}</span>
                </p>
              </div>
            )}
          </div>

          {/* Firma / Sello Predeterminado */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <PenTool className="size-4 text-purple-500" /> Firma / Sello Predeterminado
            </label>
            <select
              value={convocatoriaForm.firma_path || ""}
              onChange={(e) =>
                setConvocatoriaForm((prev) => ({ ...prev, firma_path: e.target.value }))
              }
              className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sin firma / sello por defecto --</option>
              {currentFirmas.map((firma) => (
                <option key={firma.id} value={firma.path}>
                  {firma.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Destinatarios por defecto */}
        <div className="space-y-2">
          <label htmlFor="convocatoria-destinatarios" className="text-sm font-semibold text-foreground">
            Destinatarios Predeterminados (&quot;A:&quot;)
          </label>
          <textarea
            id="convocatoria-destinatarios"
            rows={4}
            value={convocatoriaForm.destinatarios_default || ""}
            onChange={(e) =>
              setConvocatoriaForm((prev) => ({ ...prev, destinatarios_default: e.target.value }))
            }
            placeholder="Ingrese los destinatarios divididos por líneas..."
            className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={handleSaveConvocatoriaConfig}
            disabled={isPending || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar Plantilla de Convocatorias
          </button>
        </div>
      </div>

      {/* Imagen de portada */}
      <div className="flex flex-col divide-y divide-border/25 overflow-hidden rounded-2xl border border-border/80 bg-card">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 md:p-5">
          <div className="rounded-lg bg-indigo-500/10 p-2.5">
            <ImageIcon className="size-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-base font-semibold text-foreground">
              Imagen de portada
            </h3>
            <p className="text-xs text-muted-foreground">
              Esta imagen aparece como fondo en el inicio para todos los usuarios de este municipio.
              Máximo 4.5 MB · Formato optimizado WebP (hasta 4K) · Proporción recomendada 16:9
            </p>
          </div>
        </div>

        {/* Uploader */}
        <div className="p-4 md:p-5">
          {isLoading || !municipioId ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ImageUploader
              bucketName={BUCKET}
              currentImagePath={currentPath}
              onUploadSuccess={handleUploadSuccess}
              onDeleteSuccess={handleDeleteSuccess}
              disabled={isPending}
              aspect={16 / 9}
              aspectLabel="Horizontal 16:9"
              maxSizeMB={4.5}
              maxDimension={3840}
              forceFormat="image/webp"
              folderPath={folderPath}
            />
          )}
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="px-4 pb-4 md:px-5 md:pb-5">
            <div className="relative overflow-hidden rounded-xl border border-border/60 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Vista previa de portada"
                className="w-full max-h-48 object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                <span className="text-xs text-white/80 font-medium">
                  Vista previa de portada actual
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
