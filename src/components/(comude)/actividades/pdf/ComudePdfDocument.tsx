import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { ActComudeConParticipantes, ActComudeRegistro } from "../lib/zod";

// Dimensiones de papel Oficio Horizontal en puntos (PostScript points, 72 pt = 1 pulgada)
// 35.56 cm = 14 pulg = 1008 pt
// 21.59 cm = 8.5 pulg = 612 pt
const PAGE_WIDTH = 1008;
const PAGE_HEIGHT = 612;

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1F2937",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#2563EB",
    paddingBottom: 10,
    marginBottom: 12,
  },
  logo: {
    width: 130,
    height: 40,
    objectFit: "contain",
  },
  headerTextContainer: {
    flex: 1,
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  titleMain: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2563EB",
    textTransform: "uppercase",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#4B5563",
    marginTop: 2,
    textAlign: "center",
  },
  sessionInfoCard: {
    backgroundColor: "#F0F6FF",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderLeftColor: "#2563EB",
  },
  infoCol: {
    flex: 1,
    paddingRight: 10,
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#4B5563",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1D4ED8",
    backgroundColor: "#EFF6FF",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 6,
    textTransform: "uppercase",
  },
  table: {
    width: "100%",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableRowAlternate: {
    backgroundColor: "#F9FAFB",
  },
  colOrd: { width: "4%", textAlign: "center" },
  colPunto: { width: "30%" },
  colCat: { width: "16%" },
  colEstado: { width: "12%", textAlign: "center" },
  colVoto: { width: "14%", textAlign: "center" },
  colNotas: { width: "24%" },

  colPartNum: { width: "6%", textAlign: "center" },
  colPartNom: { width: "64%" },
  colPartEntrada: { width: "15%", textAlign: "center" },
  colPartSalida: { width: "15%", textAlign: "center" },

  badge: {
    fontSize: 7,
    fontWeight: "bold",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    textAlign: "center",
  },
  badgeSuccess: { backgroundColor: "#DEF7EC", color: "#03543F" },
  badgeWarning: { backgroundColor: "#FEF08A", color: "#713F12" },
  badgeDanger: { backgroundColor: "#FDE8E8", color: "#9B1C1C" },
  badgeInfo: { backgroundColor: "#E1EFFE", color: "#1E429F" },
  badgeMuted: { backgroundColor: "#F3F4F6", color: "#374151" },

  evidenciaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  evidenciaImage: {
    width: "23%",
    height: 120,
    borderRadius: 6,
    objectFit: "cover",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
    fontSize: 8,
    color: "#9CA3AF",
  },
});

interface ComudePdfDocumentProps {
  actividad: ActComudeConParticipantes;
  registros: ActComudeRegistro[];
  evidenciaUrls?: string[];
  logoUrl?: string;
}

export default function ComudePdfDocument({
  actividad,
  registros,
  evidenciaUrls = [],
  logoUrl,
}: ComudePdfDocumentProps) {
  const puntos = actividad.act_comude_puntos ?? [];
  const participantes = actividad.act_comude_participantes ?? [];

  const formatHora = (isoStr: string | null) => {
    if (!isoStr) return "--:--";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return "--:--";
    }
  };

  const formatFecha = (isoStr: string | null | undefined) => {
    if (!isoStr) return "--/--/----";
    try {
      const datePart = String(isoStr).split("T")[0];
      const parts = datePart.split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return "--/--/----";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "--/--/----";
    }
  };

  const calcDuracion = (inicioIso: string | null, finIso: string | null) => {
    if (!inicioIso) return "--";
    try {
      const start = new Date(inicioIso).getTime();
      const end = finIso ? new Date(finIso).getTime() : new Date().getTime();
      const diffMs = Math.max(0, end - start);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours === 0 && mins === 0) return "< 1m";
      if (hours === 0) return `${mins}m`;
      return `${hours}h ${mins}m`;
    } catch {
      return "--";
    }
  };

  const tituloSesion = actividad.detalles_sesion?.titulo || "Sesión General";
  const pdfTitle = `COMUDE - ${tituloSesion}`;

  return (
    <Document title={pdfTitle}>
      <Page size="LEGAL" orientation="landscape" style={styles.page}>
        
        {/* Encabezado SOTE Centrado */}
        <View style={styles.headerContainer}>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.logo} />
          ) : (
            <View style={{ width: 130 }}>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: "#2563EB" }}>SOTE</Text>
              <Text style={{ fontSize: 8, color: "#4B5563" }}>Sistema SOTE</Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.titleMain}>REPORTE OFICIAL DE SESIÓN COMUDE</Text>
            <Text style={styles.subtitle}>SISTEMA DE ORGANIZACIÓN TERRITORIAL ESTRATÉGICA</Text>
          </View>
          <View style={{ width: 130 }} /> {/* Espaciador simétrico para centrar perfectamente el texto */}
        </View>

        {/* Ficha de Datos de la Sesión */}
        <View style={styles.sessionInfoCard}>
          <View style={[styles.infoCol, { flex: 1.8 }]}>
            <Text style={styles.infoLabel}>Título de la Sesión</Text>
            <Text style={styles.infoValue}>{actividad.detalles_sesion?.titulo || "Sesión General"}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Fecha</Text>
            <Text style={styles.infoValue}>{formatFecha(actividad.fecha)}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>No. de Acta</Text>
            <Text style={styles.infoValue}>
              {actividad.detalles_sesion?.acta ? `ACTA ${actividad.detalles_sesion.acta}` : "Sin registro"}
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>No. de Libro</Text>
            <Text style={styles.infoValue}>
              {actividad.detalles_sesion?.libro ? `LIBRO ${actividad.detalles_sesion.libro}` : "Sin registro"}
            </Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Hora Inicio</Text>
            <Text style={styles.infoValue}>{formatHora(actividad.inicio)}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Hora Fin</Text>
            <Text style={styles.infoValue}>{formatHora(actividad.fin)}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Duración</Text>
            <Text style={styles.infoValue}>{calcDuracion(actividad.inicio, actividad.fin)}</Text>
          </View>
          <View style={[styles.infoCol, { flex: 0.8, paddingRight: 0 }]}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Text style={[styles.infoValue, { color: actividad.estado === "Finalizada" ? "#D97706" : "#2563EB" }]}>
              {actividad.estado ?? "Programada"}
            </Text>
          </View>
        </View>

        {/* 1. SECCIÓN AGENDA Y RESOLUCIONES (PRIMERO) */}
        <Text style={styles.sectionTitle}>1. Puntos de la Agenda y Acuerdos</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colOrd}>#</Text>
            <Text style={styles.colPunto}>Punto a Tratar</Text>
            <Text style={styles.colCat}>Categoría</Text>
            <Text style={styles.colEstado}>Estado</Text>
            <Text style={styles.colVoto}>Votación</Text>
            <Text style={styles.colNotas}>Notas y Acuerdos</Text>
          </View>

          {puntos.length === 0 ? (
            <View style={[styles.tableRow, { justifyContent: "center" }]}>
              <Text style={{ color: "#9CA3AF", fontStyle: "italic", marginVertical: 4 }}>
                No hay puntos registrados en esta agenda.
              </Text>
            </View>
          ) : (
            puntos.map((p, idx) => (
              <View
                key={p.id}
                style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlternate : {}]}
                wrap={false}
              >
                <Text style={[styles.colOrd, { fontWeight: "bold" }]}>{p.orden ?? idx + 1}</Text>
                <Text style={[styles.colPunto, { fontWeight: "bold" }]}>{p.titulo}</Text>
                <Text style={styles.colCat}>{p.categoria?.nombre ?? "Sin categoría"}</Text>
                <View style={styles.colEstado}>
                  <Text style={[styles.badge, styles.badgeInfo]}>
                    {p.estado ?? "En espera"}
                  </Text>
                </View>
                <View style={styles.colVoto}>
                  <Text style={[styles.badge, p.votacion === "Aprobado" || p.votacion === "Unanimidad" ? styles.badgeSuccess : styles.badgeMuted]}>
                    {p.votacion ?? "No emitido"}
                  </Text>
                </View>
                <View style={styles.colNotas}>
                  {p.notas && p.notas.length > 0 ? (
                    p.notas.map((nota, nIdx) => (
                      <Text key={nIdx} style={{ marginBottom: p.notas!.length > 1 ? 2 : 0 }}>
                        {p.notas!.length > 1 ? `${nIdx + 1}. ` : ""}{nota}
                      </Text>
                    ))
                  ) : (
                    <Text style={{ fontStyle: "italic", color: "#9CA3AF" }}>Sin notas registradas</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* 2. SECCIÓN ASISTENCIA Y QUÓRUM (DESPUÉS DE LA AGENDA, SIN ROL/TIPO) */}
        <Text style={styles.sectionTitle}>2. Control de Asistencia y Quórum</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colPartNum}>#</Text>
            <Text style={styles.colPartNom}>Nombre del Integrante</Text>
            <Text style={styles.colPartEntrada}>Hora Entrada</Text>
            <Text style={styles.colPartSalida}>Hora Salida</Text>
          </View>

          {participantes.length === 0 ? (
            <View style={[styles.tableRow, { justifyContent: "center" }]}>
              <Text style={{ color: "#9CA3AF", fontStyle: "italic", marginVertical: 4 }}>
                No hay participantes registrados.
              </Text>
            </View>
          ) : (
            participantes.map((part, idx) => {
              const regE = registros.find((r) => r.usuario_id === part.usuario_id && r.tipo_registro === "entrada");
              const regS = registros.find((r) => r.usuario_id === part.usuario_id && r.tipo_registro === "salida");

              return (
                <View
                  key={part.usuario_id}
                  style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlternate : {}]}
                  wrap={false}
                >
                  <Text style={[styles.colPartNum, { fontWeight: "bold" }]}>{idx + 1}</Text>
                  <Text style={[styles.colPartNom, { fontWeight: "bold" }]}>
                    {part.profiles?.nombre ?? "Sin nombre"}
                  </Text>
                  <Text style={styles.colPartEntrada}>{formatHora(regE?.created_at ?? null)}</Text>
                  <Text style={styles.colPartSalida}>{formatHora(regS?.created_at ?? null)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* 3. GALERÍA DE EVIDENCIAS FOTOGRÁFICAS (AL FINAL, si existen) */}
        {evidenciaUrls.length > 0 && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>3. Evidencia Fotográfica</Text>
            <View style={styles.evidenciaGrid}>
              {evidenciaUrls.map((url, idx) => (
                <Image key={idx} src={url} style={styles.evidenciaImage} />
              ))}
            </View>
          </View>
        )}

        {/* Pie de página */}
        <View style={styles.footer} fixed>
          <Text>SOTE - Sistema de Organización Territorial Estratégica</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
