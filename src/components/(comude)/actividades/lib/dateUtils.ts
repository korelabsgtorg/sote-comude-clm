export function formatFecha(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaName = dias[fecha.getDay()];
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString().slice(-2);
  let hours = fecha.getHours();
  const minutes = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${diaName} ${d}/${m}/${y} | ${hours}:${minutes} ${ampm}`;
}

export function formatHora(isoStr: string) {
  const fecha = new Date(isoStr);
  let h = fecha.getHours();
  const m = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function formatFechaCompleta(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const diaName = dias[fecha.getDay()];
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString().slice(-2);
  let hours = fecha.getHours();
  const minutes = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${diaName} ${d}/${m}/${y} a las ${hours}:${minutes} ${ampm}`;
}

export function formatFechaCorto(isoStr: string) {
  const fecha = new Date(isoStr);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${meses[fecha.getMonth()]}, ${fecha.getFullYear()}`;
}

export function formatFechaConfirmacion(isoStr: string) {
  const fecha = new Date(isoStr);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const diaName = dias[fecha.getDay()];
  const d = fecha.getDate().toString().padStart(2, "0");
  const m = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const y = fecha.getFullYear().toString().slice(-2);
  let hours = fecha.getHours();
  const minutes = fecha.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${diaName} ${d}/${m}/${y}, ${hours}:${minutes} ${ampm}`;
}

export function calcDuracion(entrada: string, salida: string) {
  const diff = (new Date(salida).getTime() - new Date(entrada).getTime()) / 1000 / 60;
  if (diff < 0) return "--";
  const h = Math.floor(diff / 60);
  const m = Math.round(diff % 60);
  return `${h}h ${m}m`;
}

export function esHoy(fechaStr: string) {
  const fecha = new Date(fechaStr);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}
