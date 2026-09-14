"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, getYear, getMonth, setMonth, lastDayOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Printer,
  Loader2,
  ChevronDown,
  CalendarDays,
  Filter,
  X,
  FileText,
  Settings2,
  RotateCcw,
} from "lucide-react";
import { AgendaConcejo } from "../lib/esquemas";
import {
  obtenerDatosReporte,
  ReporteFila,
  obtenerNombreDirectorDAFIM,
} from "../lib/acciones";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import { toast } from "react-toastify";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agendas: AgendaConcejo[];
}

const obtenerPesoCargo = (cargo: string): number => {
  const c = cargo.toUpperCase().trim();
  if (c.includes("ALCALDE")) return 1;
  if (/SINDICO\s+(I|1|PRIMERO)\b/.test(c)) return 2;
  if (/SINDICO\s+(II|2|SEGUNDO)\b/.test(c)) return 3;
  if (/SINDICO\s+(III|3|TERCERO)\b/.test(c)) return 4;
  if (c.includes("SINDICO SUPLENTE")) return 5;
  if (/CONCEJAL\s+(I|1|PRIMERO)\b/.test(c)) return 10;
  if (/CONCEJAL\s+(II|2|SEGUNDO)\b/.test(c)) return 11;
  if (/CONCEJAL\s+(III|3|TERCERO)\b/.test(c)) return 12;
  if (/CONCEJAL\s+(IV|4|CUARTO)\b/.test(c)) return 13;
  if (/CONCEJAL\s+(V|5|QUINTO)\b/.test(c)) return 14;
  if (/CONCEJAL\s+(VI|6|SEXTO)\b/.test(c)) return 15;
  if (/CONCEJAL\s+(VII|7|SEPTIMO)\b/.test(c)) return 16;
  if (/CONCEJAL\s+(VIII|8|OCTAVO)\b/.test(c)) return 17;
  if (/CONCEJAL\s+(IX|9|NOVENO)\b/.test(c)) return 18;
  if (/CONCEJAL\s+(X|10|DECIMO)\b/.test(c)) return 19;
  if (
    /PRIMER\s+CONCEJAL\s+SUPLENTE/.test(c) ||
    /CONCEJAL\s+SUPLENTE\s+(I|1|PRIMERO)/.test(c)
  )
    return 30;
  if (
    /SEGUNDO\s+CONCEJAL\s+SUPLENTE/.test(c) ||
    /CONCEJAL\s+SUPLENTE\s+(II|2|SEGUNDO)/.test(c)
  )
    return 31;
  if (
    /TERCER\s+CONCEJAL\s+SUPLENTE/.test(c) ||
    /CONCEJAL\s+SUPLENTE\s+(III|3|TERCERO)/.test(c)
  )
    return 32;
  if (c.includes("CONCEJAL SUPLENTE")) return 39;
  if (c.includes("SECRETARIO")) return 99;
  return 100;
};

export default function InformeDietas({ isOpen, onClose, agendas }: Props) {
  const [datos, setDatos] = useState<ReporteFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [anioSeleccionado, setAnioSeleccionado] = useState<string>("");
  const [mesSeleccionado, setMesSeleccionado] = useState<string>("");
  const [numeroInforme, setNumeroInforme] = useState("");
  const [nombreDirectora, setNombreDirectora] = useState("");
  const [cargosEditados, setCargosEditados] = useState<Record<string, string>>({});

  const handleEditCargo = (userId: string, newVal: string) => {
    setCargosEditados((prev) => ({ ...prev, [userId]: newVal }));
  };

  const handleResetAllCargos = () => {
    setCargosEditados({});
  };

  const isCargoTaken = (cargoOption: string, currentUserId: string) => {
    return Object.entries(cargosEditados).some(
      ([id, val]) => val === cargoOption && id !== currentUserId
    );
  };

  const integrantesEditables = useMemo(() => {
    return datos.filter((d) => {
      const cargo = d.cargo.toUpperCase();
      return (
        !cargo.includes("ALCALDE") &&
        !cargo.includes("SINDICO") &&
        !cargo.includes("CONCEJAL") &&
        !cargo.includes("SECRETARIO")
      );
    });
  }, [datos]);

  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mesSeleccionado !== "") {
      const numeroSugerido = (parseInt(mesSeleccionado) + 1)
        .toString()
        .padStart(3, "0");
      setNumeroInforme(numeroSugerido);
    } else {
      setNumeroInforme("");
    }
  }, [mesSeleccionado]);
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      obtenerNombreDirectorDAFIM()
        .then((nombre) => {
          setNombreDirectora(nombre ? nombre.toUpperCase() : "");
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  const aniosDisponibles = useMemo(() => {
    const years = new Set(
      agendas.map((a) => getYear(new Date(a.fecha_reunion)).toString()),
    );
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [agendas]);

  useEffect(() => {
    if (isOpen && aniosDisponibles.length > 0 && !anioSeleccionado) {
      const savedAnio = localStorage.getItem('agenda_filtroAnio');
      const savedMes = localStorage.getItem('agenda_filtroMes');

      const anioAUsar = (savedAnio && aniosDisponibles.includes(savedAnio)) ? savedAnio : getYear(new Date()).toString();
      const mesAUsar = (savedMes !== null && savedMes !== "todos") ? savedMes : getMonth(new Date()).toString();

      if (aniosDisponibles.includes(anioAUsar)) {
        setAnioSeleccionado(anioAUsar);
        setMesSeleccionado(mesAUsar);
      } else {
        setAnioSeleccionado(aniosDisponibles[0]);
        setMesSeleccionado("0");
      }
    }
  }, [isOpen, aniosDisponibles, anioSeleccionado]);

  useEffect(() => {
    if (anioSeleccionado) localStorage.setItem('agenda_filtroAnio', anioSeleccionado);
  }, [anioSeleccionado]);

  useEffect(() => {
    if (mesSeleccionado && mesSeleccionado !== "todos") localStorage.setItem('agenda_filtroMes', mesSeleccionado);
  }, [mesSeleccionado]);

  const mesesDisponibles = useMemo(() => {
    if (!anioSeleccionado) return [];
    const agendasDelAnio = agendas.filter(
      (a) => getYear(new Date(a.fecha_reunion)).toString() === anioSeleccionado,
    );
    const mesesSet = new Set(
      agendasDelAnio.map((a) => getMonth(new Date(a.fecha_reunion))),
    );
    return Array.from(mesesSet)
      .sort((a, b) => a - b)
      .map((mesIndex) => ({
        value: mesIndex.toString(),
        label: format(setMonth(new Date(), mesIndex), "MMMM", {
          locale: es,
        }).toUpperCase(),
      }));
  }, [agendas, anioSeleccionado]);

  const { primeraSesionAnual, ultimaSesionAnual, totalSesionesMes } =
    useMemo(() => {
      if (!anioSeleccionado || mesSeleccionado === "") {
        return {
          primeraSesionAnual: "___",
          ultimaSesionAnual: "___",
          totalSesionesMes: 0,
        };
      }

      const agendasDelAnio = agendas
        .filter((a) => {
          const fecha = new Date(a.fecha_reunion);
          const mismoAnio = getYear(fecha).toString() === anioSeleccionado;
          const estadoValido = a.estado !== "En preparación";
          return mismoAnio && estadoValido;
        })
        .sort(
          (a, b) =>
            new Date(a.fecha_reunion).getTime() -
            new Date(b.fecha_reunion).getTime(),
        );

      const agendasConCorrelativo = agendasDelAnio.map((agenda, index) => ({
        ...agenda,
        numeroCorrelativo: index + 1,
      }));

      const agendasDelMes = agendasConCorrelativo.filter(
        (a) =>
          getMonth(new Date(a.fecha_reunion)).toString() === mesSeleccionado,
      );

      if (agendasDelMes.length === 0) {
        return {
          primeraSesionAnual: "___",
          ultimaSesionAnual: "___",
          totalSesionesMes: 0,
        };
      }

      const primera = agendasDelMes[0].numeroCorrelativo;
      const ultima = agendasDelMes[agendasDelMes.length - 1].numeroCorrelativo;

      return {
        primeraSesionAnual: primera.toString().padStart(3, "0"),
        ultimaSesionAnual: ultima.toString().padStart(3, "0"),
        totalSesionesMes: agendasDelMes.length,
      };
    }, [agendas, anioSeleccionado, mesSeleccionado]);

  const agendasReporte = useMemo(() => {
    if (!anioSeleccionado || mesSeleccionado === "") return [];
    return agendas.filter((agenda) => {
      const fecha = new Date(agenda.fecha_reunion);
      return (
        getYear(fecha).toString() === anioSeleccionado &&
        getMonth(fecha).toString() === mesSeleccionado &&
        agenda.estado !== "En preparación"
      );
    });
  }, [agendas, anioSeleccionado, mesSeleccionado]);

  useEffect(() => {
    if (isOpen && agendasReporte.length > 0) {
      setLoading(true);
      obtenerDatosReporte(agendasReporte)
        .then((data) => {
          const datosConPago = data.filter((d) => d.total_devengado > 0);
          const datosOrdenados = datosConPago.sort((a, b) => {
            const pesoA = obtenerPesoCargo(a.cargo);
            const pesoB = obtenerPesoCargo(b.cargo);
            return pesoA - pesoB;
          });
          setDatos(datosOrdenados);
        })
        .catch((e) => {
          console.error(e);
          toast.error("Error al procesar datos");
        })
        .finally(() => setLoading(false));
    } else {
      setDatos([]);
      setLoading(false);
    }
  }, [isOpen, agendasReporte]);

  const nombreSecretario = useMemo(() => {
    const nombre =
      datos.find((d) => d.cargo.toUpperCase().includes("SECRETARIO"))?.nombre ||
      "";
    return nombre ? `Lic. ${nombre}` : "";
  }, [datos]);

  const generatePdf = async () => {
    setIsPrinting(true);
    await new Promise((r) => setTimeout(r, 100)); // Pequeña espera para renderizado

    const element = printRef.current;
    if (!element) {
      toast.error("Error: Elemento no encontrado.");
      setIsPrinting(false);
      return;
    }

    try {
      // Configuramos html-to-image para capturar exactamente el ancho del contenedor (816px)
      const dataUrl = await htmlToImage.toJpeg(element, {
        quality: 1.0, // Máxima calidad
        backgroundColor: "#ffffff",
        pixelRatio: 3, // Alta resolución para nitidez
        width: 816, // Ancho exacto carta a 96dpi
        style: { margin: "0", transform: "none" }, // Evitar transformaciones que muevan la imagen
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: "letter",
      });

      // Obtenemos el ancho de la página PDF (8.5 pulgadas)
      const pdfWidth = pdf.internal.pageSize.getWidth();

      // Creamos una imagen para obtener sus proporciones reales
      const img = new Image();
      img.src = dataUrl;

      img.onload = () => {
        // Calculamos la altura proporcional
        const imgProps = pdf.getImageProperties(img);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Renderizamos en 0,0 para usar los márgenes internos del HTML (padding)
        // No agregamos márgenes extra (marginLeft/marginTop) para evitar el doble margen
        pdf.addImage(img, "JPEG", 0, 0, pdfWidth, pdfHeight);

        const nombreArchivo = `Informe_Dietas_${anioSeleccionado}_${mesesDisponibles.find((m) => m.value === mesSeleccionado)?.label}.pdf`;

        // Guardar o abrir
        if (window.innerWidth < 768) {
          pdf.save(nombreArchivo);
        } else {
          window.open(pdf.output("bloburl"), "_blank");
        }
        setIsPrinting(false);
      };
    } catch (err) {
      console.error(err);
      toast.error("Error al generar PDF.");
      setIsPrinting(false);
    }
  };

  const nombreMes = mesSeleccionado
    ? format(setMonth(new Date(), parseInt(mesSeleccionado)), "MMMM", {
        locale: es,
      })
    : "";
  const nombreMesMayus = nombreMes.toUpperCase();
  const nombreMesTitulo =
    nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
  const ultimoDia =
    mesSeleccionado && anioSeleccionado
      ? lastDayOfMonth(
          new Date(parseInt(anioSeleccionado), parseInt(mesSeleccionado)),
        ).getDate()
      : 30;
  const textoPeriodo = `1 al ${ultimoDia} de ${nombreMesTitulo}`;
  const fechaHoyTexto = format(new Date(), "d 'de' MMMM 'de' yyyy", {
    locale: es,
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] flex flex-col p-0 bg-white dark:bg-neutral-900 text-black [&>button]:hidden">
        <DialogHeader className="p-4 border-b flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl shrink-0">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-lg font-bold dark:text-white truncate">
              Informe de Pago (DAFIM)
            </DialogTitle>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="# Informe"
                className="w-24 h-9 text-xs border-gray-200 dark:border-neutral-700 dark:text-white"
                value={numeroInforme}
                onChange={(e) => setNumeroInforme(e.target.value)}
              />
            </div>

            <div className="relative w-full sm:w-28 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-gray-500" />
              </div>
              <select
                value={anioSeleccionado}
                onChange={(e) => {
                  setAnioSeleccionado(e.target.value);
                }}
                disabled={loading || isPrinting}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-white rounded-lg text-sm focus:ring-2 outline-none appearance-none"
              >
                {aniosDisponibles.map((anio) => (
                  <option key={anio} value={anio}>
                    {anio}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-36 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarDays className="h-4 w-4 text-gray-500" />
              </div>
              <select
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                disabled={loading || isPrinting}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 dark:text-white rounded-lg text-sm focus:ring-2 outline-none appearance-none"
              >
                {mesesDisponibles.map((mes) => (
                  <option key={mes.value} value={mes.value}>
                    {mes.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={generatePdf}
                disabled={loading || datos.length === 0 || isPrinting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all active:scale-95"
              >
                {isPrinting ? (
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}{" "}
                PDF
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-row overflow-hidden w-full">
          {/* Panel de Ajustes de Cargos Temporales */}
          <div className="w-80 border-r border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50 overflow-y-auto p-5 shrink-0 h-full">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
              <Settings2 size={16} className="text-blue-500" /> Ajustes de Cargos
            </h3>
            {integrantesEditables.length === 0 ? (
              <div className="p-5 bg-white dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-200 dark:border-neutral-700 text-center">
                <p className="text-xs text-gray-400">Sin integrantes externos ajustables.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {integrantesEditables.map((integrante) => (
                  <div key={integrante.usuario_id} className="p-4 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-sm transition-all hover:shadow-md">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate mb-1" title={integrante.nombre}>
                      {integrante.nombre}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 truncate italic font-medium">
                      Original: {integrante.cargo}
                    </p>
                    <select 
                      className="w-full text-sm p-2.5 border rounded-lg bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-700 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all appearance-none cursor-pointer font-semibold"
                      value={cargosEditados[integrante.usuario_id] || ""}
                      onChange={(e) => handleEditCargo(integrante.usuario_id, e.target.value)}
                    >
                      <option value="">(Mantener original)</option>
                      <option value="Primer Concejal Suplente" disabled={isCargoTaken("Primer Concejal Suplente", integrante.usuario_id)}>1er Concejal Suplente</option>
                      <option value="Segundo Concejal Suplente" disabled={isCargoTaken("Segundo Concejal Suplente", integrante.usuario_id)}>2do Concejal Suplente</option>
                      <option value="Síndico suplente" disabled={isCargoTaken("Síndico suplente", integrante.usuario_id)}>Síndico suplente</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
            {Object.keys(cargosEditados).length > 0 && (
              <button
                onClick={handleResetAllCargos}
                className="mt-4 w-full py-2 bg-red-50 dark:bg-red-900/10 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold text-xs rounded-lg flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30 transition-all"
              >
                <RotateCcw size={14} /> Restaurar todos los cargos
              </button>
            )}
            <div className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100/20">
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 leading-relaxed italic">
                * Estos cambios son <b>temporales</b> y solo afectan a este documento PDF. No modifican la ficha oficial del usuario.
              </p>
            </div>
          </div>

          {/* Área de Previsualización */}
          <div className="flex-1 overflow-auto bg-gray-100 dark:bg-neutral-950 p-6 min-w-0 h-full relative">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <span className="text-sm font-medium">Generando informe...</span>
              </div>
            ) : agendasReporte.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <FileText className="h-10 w-10 opacity-50" />
                <p className="text-sm">
                  Seleccione un mes con registros válidos.
                </p>
              </div>
            ) : (
            <div
              className="bg-white px-10 py-10 w-[816px] mx-auto shadow-sm min-h-[1056px] relative text-black"
              ref={printRef}
            >
              <div className="flex justify-between items-start mb-4 border-b-2 border-[#0066CC] pb-2">
                <div className="text-xs text-gray-500 font-bold uppercase pt-2">
                  Municipalidad de Concepción Las Minas
                  <br />
                  <span className="font-normal normal-case">
                    Departamento de Chiquimula, Guatemala C.A.
                  </span>
                </div>
                <img
                  src="/images/logo-muni.png"
                  alt="Logo"
                  className="h-24 object-contain"
                />
              </div>

              <div className="text-right text-xs font-bold mb-1">
                Concepción Las Minas, {fechaHoyTexto}
              </div>

              <div className="text-right text-xs font-bold mb-6">
                Informe de pago de dietas número {numeroInforme || "___"}-
                {anioSeleccionado}
                <br />
                Sesiones Ordinaria y Extraordinarias del Concejo Municipal
              </div>

              <div className="text-xs font-bold uppercase mb-1">
                LICENCIADA {nombreDirectora || "____________________"}
              </div>
              <div className="text-xs font-bold uppercase mb-1">
                DIRECTORA DE LA DIRECCIÓN DE ADMINISTRACIÓN FINANCIERA INTEGRADA
                MUNICIPAL (DAFIM)
              </div>
              <div className="text-xs font-bold uppercase mb-6">
                MUNICIPALIDAD DE CONCEPCIÓN LAS MINAS, CHIQUIMULA.
              </div>

              <div className="text-xs text-justify mb-4 leading-relaxed">
                Por medio de la presente me permito informarle que, durante el
                mes de{" "}
                <span className="font-bold underline">{nombreMesMayus}</span>,
                se realizaron{" "}
                <span className="font-bold">{totalSesionesMes}</span> sesiones
                del Concejo Municipal, que corresponden de la numero{" "}
                <span className="font-bold">
                  {primeraSesionAnual}-{anioSeleccionado}
                </span>{" "}
                a la{" "}
                <span className="font-bold">
                  {ultimaSesionAnual}-{anioSeleccionado}
                </span>
                ; ASISTIENDO A DICHAS REUNIONES:
              </div>

              <div className="bg-black text-white text-[10px] font-bold py-1 px-2 mb-0 uppercase tracking-widest text-center">
                {nombreMesMayus} {anioSeleccionado}
              </div>

              <table className="w-full border-collapse text-[9px] font-sans text-black border border-black mb-8">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border border-black p-1 text-center w-8">
                      No.
                    </th>
                    <th className="border border-black p-1 text-left">
                      NOMBRE COMPLETO
                    </th>
                    <th className="border border-black p-1 text-left">CARGO</th>
                    <th className="border border-black p-1 text-center w-16 leading-tight">
                      CANTIDAD DE REUNIONES
                    </th>
                    <th className="border border-black p-1 text-center w-24">
                      Periodo
                    </th>
                    <th className="border border-black p-1 text-right w-20">
                      Valor de Dieta
                    </th>
                    <th className="border border-black p-1 text-right w-20">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.map((fila, idx) => {
                    const cantidadReuniones = Object.values(
                      fila.asistencias,
                    ).filter((a) => a.devengado > 0).length;
                    return (
                      <tr key={fila.usuario_id}>
                        <td className="border border-black p-1 text-center">
                          {idx + 1}
                        </td>
                        <td className="border border-black p-1 uppercase font-bold">
                          {fila.nombre}
                        </td>
                        <td className="border border-black p-1 capitalize text-[8px]">
                          {cargosEditados[fila.usuario_id] || fila.cargo}
                        </td>
                        <td className="border border-black p-1 text-center">
                          {cantidadReuniones}
                        </td>
                        <td className="border border-black p-1 text-center text-[8px]">
                          {textoPeriodo}
                        </td>
                        <td className="border border-black p-1 text-right">
                          Q 2,000.00
                        </td>
                        <td className="border border-black p-1 text-right font-bold">
                          Q{" "}
                          {fila.total_devengado.toLocaleString("es-GT", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="text-xs mb-16">
                Se envía el presente informe para efecto de iniciar el trámite
                de pago de Dietas Municipales.
              </div>

              <div className="text-xs mb-24">
                <div className="border-t border-black w-64 pt-1 font-bold mb-1">
                  Nombre y Firma
                </div>
                <p>Recibí Conforme Documentos Adjuntos</p>
                <div className="mt-6 flex items-end gap-2">
                  <span>Fecha</span>
                  <div className="border-b border-black w-48"></div>
                </div>
              </div>

              <div className="text-center">
                <div className="border-t border-black w-64 mx-auto pt-2 mb-1 font-bold text-xs uppercase">
                  {nombreSecretario}
                </div>
                <div className="font-bold text-[10px] uppercase">
                  Secretario Municipal
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
