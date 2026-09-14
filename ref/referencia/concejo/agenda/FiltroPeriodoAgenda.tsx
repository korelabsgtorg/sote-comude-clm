'use client';

import MonthPicker from '@/components/(comude)/actividades/modals/MonthPicker';

type FiltroPeriodoAgendaProps = {
  filtroAnio: string;
  filtroMes: string | null;
  onChangeAnio: (anio: string) => void;
  onChangeMes: (mes: string | null) => void;
};

export default function FiltroPeriodoAgenda({
  filtroAnio,
  filtroMes,
  onChangeAnio,
  onChangeMes,
}: FiltroPeriodoAgendaProps) {
  const anio = parseInt(filtroAnio, 10) || new Date().getFullYear();
  const mes = filtroMes !== null ? parseInt(filtroMes, 10) : -1;

  return (
    <MonthPicker
      year={anio}
      month={mes}
      onChange={(y, m) => {
        onChangeAnio(y.toString());
        onChangeMes(m === -1 ? null : m.toString());
      }}
    />
  );
}
