"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2, RefreshCw, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { ActComudeConParticipantes } from "../lib/zod";
import { useConfiguracionMunicipio, useIntegrantesEstructuraMunicipio } from "@/components/(base)/(settings)/municipio/hooks";
import { useStorageDisplayUrl } from "@/components/(uploads)/imgs/useStorageDisplayUrl";
import { getInitialGlobalMunicipioState } from "@/components/(base)/layout/actions";
import { createClient } from "@/utils/supabase/client";
import { domToPng } from "modern-screenshot";
import jsPDF from "jspdf";
import { toast } from "react-toastify";

const BUCKET = "portada_imagenes";

interface GenerarConvocatoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  actividad: ActComudeConParticipantes;
}

function formatFechaEmisionSpanish(municipioNombre: string, date: Date = new Date()) {
  const meses = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
  ];
  const mun = (municipioNombre || "").toUpperCase();
  const dia = date.getDate();
  const mes = meses[date.getMonth()];
  const anio = date.getFullYear();
  return `${mun} ${dia} DE ${mes} DE ${anio}.`;
}

function formatFechaReunionTexto(fechaStr?: string | null) {
  if (!fechaStr) {
    return {
      fechaTexto: "________",
      horaTexto: "a las diez de la mañana (10:00 A.M.)",
      horaSimple: "10:00 A.M.",
    };
  }
  const date = new Date(fechaStr);
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
  ];

  const diaNombre = dias[date.getDay()];
  const diaNum = date.getDate();
  const mesNombre = meses[date.getMonth()];
  const anioNum = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "P.M." : "A.M.";
  const formattedHours = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, "0");

  const horasPalabras: Record<number, string> = {
    1: "una", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
    6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez",
    11: "once", 12: "doce",
  };

  const minutosEnPalabras = (m: number): string => {
    if (m === 0) return "";
    if (m === 15) return " y quince minutos";
    if (m === 30) return " y media";
    if (m === 45) return " y cuarenta y cinco minutos";

    const unidades = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const decenas = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta"];
    const especiales: Record<number, string> = {
      10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
      16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
      20: "veinte", 21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
      25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve"
    };

    if (especiales[m]) return ` y ${especiales[m]} minutos`;
    const d = Math.floor(m / 10);
    const u = m % 10;
    if (u === 0) return ` y ${decenas[d]} minutos`;
    return ` y ${decenas[d]} y ${unidades[u]} minutos`;
  };

  let periodo = "";
  if (hours === 12 && minutes === 0) {
    periodo = "del mediodía";
  } else if (hours >= 12 && hours < 19) {
    periodo = "de la tarde";
  } else if (hours >= 19 || hours < 5) {
    periodo = "de la noche";
  } else {
    periodo = "de la mañana";
  }

  const horaEnTexto = `${formattedHours === 1 ? "la" : "las"} ${horasPalabras[formattedHours]}${minutosEnPalabras(minutes)} ${periodo}`;
  const horaDigital = `${formattedHours}:${minutesStr} ${ampm}`;

  return {
    fechaTexto: `${diaNombre} ${diaNum} de ${mesNombre} del año ${anioNum}`,
    horaTexto: `a ${horaEnTexto} (${horaDigital})`,
    horaSimple: horaDigital,
  };
}

export default function GenerarConvocatoriaModal({
  isOpen,
  onClose,
  actividad,
}: GenerarConvocatoriaModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [municipioId, setMunicipioId] = useState<number | null>(null);
  const [municipioNombre, setMunicipioNombre] = useState<string>("CONCEPCIÓN LAS MINAS");
  const [departamentoNombre, setDepartamentoNombre] = useState<string>("CHIQUIMULA");
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    getInitialGlobalMunicipioState().then((state) => {
      if (state.municipioId) setMunicipioId(state.municipioId);
    });
  }, []);

  // Cargar municipios y departamentos nombres
  useEffect(() => {
    if (!municipioId) return;
    const supabase = createClient();
    supabase
      .from("lug_municipios")
      .select("nombre, departamento_id, lug_departamentos(nombre)")
      .eq("id", municipioId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.nombre) setMunicipioNombre(data.nombre);
          const depName = (data.lug_departamentos as any)?.nombre;
          if (depName) setDepartamentoNombre(depName);
        }
      });
  }, [municipioId]);

  const { data: config, isLoading: configLoading } = useConfiguracionMunicipio(municipioId);
  const { data: integrantes = [] } = useIntegrantesEstructuraMunicipio(municipioId);

  // Form de edición de la convocatoria antes de descargar
  const [logoIzqPath, setLogoIzqPath] = useState<string>("");
  const [logoDerPath, setLogoDerPath] = useState<string>("");
  const [firmaPath, setFirmaPath] = useState<string>("");
  const [coordinadorNombre, setCoordinadorNombre] = useState<string>("");
  const [coordinadorPuesto, setCoordinadorPuesto] = useState<string>("");
  const [destinatarios, setDestinatarios] = useState<string>(
    "Síndicos Y Concejales\nRepresentantes De Los Consejos Comunitarios De Desarrollo De Primer Nivel\nRepresentantes De Las Entidades Públicas Con Presencia En El Municipio.\nApoyo de Oficinas con Presencia en la Municipalidad."
  );
  const [fechaEmision, setFechaEmision] = useState<string>("");
  const [tipoSesion, setTipoSesion] = useState<string>(
    actividad.detalles_sesion?.titulo || "Sesión Ordinaria de Consejo Municipal de Desarrollo -COMUDE-"
  );
  const [ubicacion, setUbicacion] = useState<string>(
    actividad.ubicacion || "GIMNASIO MUNICIPAL, Casco Urbano, " + municipioNombre
  );

  // Auto-completar datos desde la configuración del municipio al cargar
  useEffect(() => {
    if (config?.convocatoria_config) {
      const cfg = config.convocatoria_config;
      if (cfg.logo_izquierda_path) setLogoIzqPath(cfg.logo_izquierda_path);
      if (cfg.logo_derecha_path) setLogoDerPath(cfg.logo_derecha_path);
      if (cfg.firma_path) setFirmaPath(cfg.firma_path);
      if (cfg.coordinador_nombre) setCoordinadorNombre(cfg.coordinador_nombre);
      if (cfg.coordinador_puesto) setCoordinadorPuesto(cfg.coordinador_puesto);
      if (cfg.destinatarios_default) setDestinatarios(cfg.destinatarios_default);
    }
    setFechaEmision(formatFechaEmisionSpanish(municipioNombre));
  }, [config, municipioNombre]);

  // URLs de almacenamiento de logos y firma
  const { url: logoIzqUrl } = useStorageDisplayUrl(BUCKET, logoIzqPath);
  const { url: logoDerUrl } = useStorageDisplayUrl(BUCKET, logoDerPath);
  const { url: firmaUrl } = useStorageDisplayUrl(BUCKET, firmaPath);

  const logosDisponibles = Array.isArray(config?.logo) ? config.logo : [];
  const firmasDisponibles = Array.isArray(config?.firmas) ? config.firmas : [];

  const { fechaTexto, horaTexto } = formatFechaReunionTexto(actividad.fecha);

  // Descargar como Imagen PNG
  const handleDescargarImagen = async () => {
    if (!printRef.current) return;
    setGenerando(true);
    try {
      const dataUrl = await domToPng(printRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        quality: 0.95,
      });

      const link = document.createElement("a");
      link.download = `Convocatoria_COMUDE_${actividad.detalles_sesion?.acta || "Sesion"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagen de convocatoria descargada con éxito.");
    } catch (err: any) {
      toast.error("Error al generar la imagen de la convocatoria.");
    } finally {
      setGenerando(false);
    }
  };

  // Descargar como PDF
  const handleDescargarPDF = async () => {
    if (!printRef.current) return;
    setGenerando(true);
    try {
      const dataUrl = await domToPng(printRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        quality: 0.95,
      });

      const pdf = new jsPDF("p", "mm", "letter");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = res));

      const pdfHeight = (img.height * pdfWidth) / img.width;

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Convocatoria_COMUDE_${actividad.detalles_sesion?.acta || "Sesion"}.pdf`);
      toast.success("Documento PDF de convocatoria descargado.");
    } catch (err: any) {
      toast.error("Error al generar el PDF de la convocatoria.");
    } finally {
      setGenerando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Generar Convocatoria Oficial</h2>
              <p className="text-xs text-muted-foreground">
                Previsualiza y personaliza la convocatoria oficial de esta actividad COMUDE.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Content: Split View (Ajustes izquierda, Previsualización hoja derecha) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Panel de Controles (Izquierda) */}
          <div className="lg:col-span-4 p-5 space-y-5 bg-card/40 overflow-y-auto">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-blue-500" /> Opciones de Documento
            </h3>

            {/* Logo Izquierdo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Logo Izquierdo</label>
              <select
                value={logoIzqPath}
                onChange={(e) => setLogoIzqPath(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg"
              >
                <option value="">-- Sin logo --</option>
                {logosDisponibles.map((l) => (
                  <option key={l.id} value={l.path}>
                    {l.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Logo Derecho */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Logo Derecho</label>
              <select
                value={logoDerPath}
                onChange={(e) => setLogoDerPath(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg"
              >
                <option value="">-- Sin logo --</option>
                {logosDisponibles.map((l) => (
                  <option key={l.id} value={l.path}>
                    {l.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Coordinador / Autoridad */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Autoridad Firmante</label>
              <select
                value={integrantes.find((i) => i.nombre === coordinadorNombre)?.id || ""}
                onChange={(e) => {
                  const sel = integrantes.find((i) => i.id === e.target.value);
                  if (sel) {
                    setCoordinadorNombre(sel.nombre);
                    setCoordinadorPuesto(sel.puesto);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg"
              >
                <option value="">-- Seleccionar integrante --</option>
                {integrantes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.puesto})
                  </option>
                ))}
              </select>
            </div>

            {/* Nombre y Cargo manuales */}
            <div className="grid grid-cols-1 gap-2">
              <input
                type="text"
                placeholder="Nombre del Coordinador"
                value={coordinadorNombre}
                onChange={(e) => setCoordinadorNombre(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg"
              />
              <input
                type="text"
                placeholder="Cargo (ej: COORDINADOR COMUDE)"
                value={coordinadorPuesto}
                onChange={(e) => setCoordinadorPuesto(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-background border border-input rounded-lg"
              />
            </div>

            {/* Seleccionar Firma / Sello */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Firma / Sello</label>
              <select
                value={firmaPath}
                onChange={(e) => setFirmaPath(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg"
              >
                <option value="">-- Sin firma --</option>
                {firmasDisponibles.map((f) => (
                  <option key={f.id} value={f.path}>
                    {f.titulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Destinatarios */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Destinatarios (&quot;A:&quot;)</label>
              <textarea
                rows={4}
                value={destinatarios}
                onChange={(e) => setDestinatarios(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg"
              />
            </div>

            {/* Ubicación de la Sesión */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Lugar de la Sesión</label>
              <input
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-input rounded-lg"
              />
            </div>
          </div>

          {/* Document Preview (Derecha) */}
          <div className="lg:col-span-8 p-6 bg-zinc-800/20 dark:bg-black/40 flex justify-center items-start overflow-y-auto">
            {/* Hoja de papel formato Carta/A4 exactamente idéntica a la imagen de muestra */}
            <div
              ref={printRef}
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              className="w-full max-w-[720px] bg-white text-black p-10 md:p-12 shadow-2xl rounded-sm flex flex-col justify-between text-[13px] leading-relaxed select-none"
            >
              {/* Encabezado Superior (Logos + Título oficial) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  {/* Logo Izquierdo */}
                  <div className="w-20 h-20 flex items-center justify-center shrink-0">
                    {logoIzqUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logoIzqUrl} alt="Logo Izquierdo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="w-16 h-16 border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-400">
                        Logo Izq
                      </div>
                    )}
                  </div>

                  {/* Texto Central */}
                  <div className="text-center flex-1 space-y-0.5">
                    <h1 className="text-[15px] font-bold tracking-tight uppercase text-black">
                      CONSEJO MUNICIPAL DE DESARROLLO –COMUDE–
                    </h1>
                    <p className="text-[12px] text-gray-800 font-normal">
                      {municipioNombre}, {departamentoNombre}, Guatemala, C. A.
                    </p>
                  </div>

                  {/* Logo Derecho */}
                  <div className="w-20 h-20 flex items-center justify-center shrink-0">
                    {logoDerUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logoDerUrl} alt="Logo Derecho" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="w-16 h-16 border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-400">
                        Logo Der
                      </div>
                    )}
                  </div>
                </div>

                {/* Doble línea separadora */}
                <div className="border-t-2 border-b border-black h-1 my-2" />
              </div>

              {/* Cuerpo del Documento */}
              <div className="space-y-6 my-6 text-[13.5px]">
                {/* Encabezado en negrita subrayado */}
                <div className="text-center">
                  <p className="font-bold underline uppercase tracking-wide">
                    CONSEJO MUNICIPAL DE DESARROLLO -COMUDE- {municipioNombre}, {departamentoNombre}.
                  </p>
                </div>

                {/* Fecha de Emisión */}
                <div className="text-right font-bold tracking-wide">
                  <p>{fechaEmision}</p>
                </div>

                {/* Destinatarios */}
                <div className="space-y-1">
                  <p className="font-bold">A:</p>
                  <div className="font-normal pl-4 whitespace-pre-line leading-snug">
                    {destinatarios}
                  </div>
                </div>

                {/* Saludo */}
                <div className="pt-2">
                  <p>Le saludo muy cordialmente deseándole toda clase de éxitos en sus labores diarias.</p>
                </div>

                {/* Párrafo de Convocatoria */}
                <div className="text-justify leading-relaxed">
                  <p>
                    Por este medio se les convoca a:{" "}
                    <span className="font-bold">{tipoSesion}</span> para el día:{" "}
                    <span className="font-bold">{fechaTexto}</span>, en el lugar:{" "}
                    <span className="font-bold underline">{ubicacion}</span>, {horaTexto}.
                  </p>
                </div>

                {/* Despedida */}
                <div className="pt-2">
                  <p>Sin más que agregar me suscribo,</p>
                </div>
              </div>

              {/* Pie de página con Firma y Sello */}
              <div className="mt-12 space-y-6">
                <div className="flex justify-center relative">
                  <div className="relative text-center flex flex-col items-center">
                    {/* Imagen de Firma / Sello superpuesta */}
                    {firmaUrl && (
                      <div className="absolute -top-16 inset-x-0 flex justify-center pointer-events-none z-10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={firmaUrl}
                          alt="Firma y Sello"
                          className="max-h-28 max-w-48 object-contain mix-blend-multiply"
                        />
                      </div>
                    )}

                    <div className="pt-8 border-t border-transparent font-bold text-center z-0">
                      <p className="uppercase text-[14px]">{coordinadorNombre || "NOMBRE DEL COORDINADOR"}</p>
                      <p className="uppercase text-[13px]">{coordinadorPuesto || "COORDINADOR COMUDE"}</p>
                    </div>
                  </div>
                </div>

                {/* Pie inferior con nombre de municipio */}
                <div className="pt-6 border-t border-gray-300 text-center font-serif text-[12px] italic text-gray-700">
                  <p>{municipioNombre} {departamentoNombre}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer / Botones de Acción */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDescargarImagen}
              disabled={generando}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              {generando ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              Descargar Imagen (PNG)
            </button>

            <button
              type="button"
              onClick={handleDescargarPDF}
              disabled={generando}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              {generando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
