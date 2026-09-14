export function formatearFechaBitacora(fecha: Date | string = new Date()) {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return '';
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const diaSemana = dias[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  let hora = d.getHours();
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const period = hora >= 12 ? 'PM' : 'AM';
  hora = hora % 12;
  hora = hora ? hora : 12;
  const horaStr = String(hora).padStart(2, '0');
  return `${diaSemana} ${day}/${month}/${year}, ${horaStr}:${minutos} ${period}`;
}

export function componerBitacoraActividad({
  nota,
  anterior,
  cambios = [],
}: {
  nota?: string;
  anterior: string | null | undefined;
  cambios?: string[];
}) {
  const notaLimpia = nota?.trim() ?? '';
  const cambiosLimpios = cambios.map((c) => c.trim()).filter(Boolean);
  const previa = anterior?.trim() ?? '';

  if (!notaLimpia && cambiosLimpios.length === 0) return previa;

  const cuerpo = [notaLimpia, ...cambiosLimpios].filter(Boolean).join('\n');
  const entrada = `${formatearFechaBitacora()}\n${cuerpo}`;
  return previa ? `${entrada}\n\n${previa}` : entrada;
}
