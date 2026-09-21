"use client";

import { useEffect, useMemo } from "react";
import { useDepartamentos } from "../lib/hooks";
import { hijosDirectosDepartamento, type DepartamentoRecord } from "../lib/zod";
import { FormLabel } from "./EstructuraFormShell";

export function JefaturasField({
  departamentoId,
  selectedIds,
  onChange,
  required = false,
  esComunidad = false,
}: {
  departamentoId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
  esComunidad?: boolean;
}) {
  const { data: departamentos = [], isLoading } = useDepartamentos();

  const opciones = useMemo(() => {
    if (!departamentoId) return [] as (DepartamentoRecord & { propia: boolean })[];
    const propia = departamentos.find((d) => d.id === departamentoId);
    const hijos = hijosDirectosDepartamento(departamentos, departamentoId);
    const lista: (DepartamentoRecord & { propia: boolean })[] = [];
    if (propia) lista.push({ ...propia, propia: true });
    for (const hijo of hijos) lista.push({ ...hijo, propia: false });
    return lista;
  }, [departamentos, departamentoId]);

  const opcionIds = useMemo(
    () => new Set(opciones.map((d) => d.id)),
    [opciones],
  );

  useEffect(() => {
    const validas = selectedIds.filter((id) => opcionIds.has(id));
    if (validas.length !== selectedIds.length) {
      onChange(validas);
    }
  }, [opcionIds, selectedIds, onChange]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-3">
      <FormLabel>
        {esComunidad ? "Asignar como Presidente / Líder" : "Jefatura de departamentos"}
        {required ? (
          <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">
            (obligatorio)
          </span>
        ) : null}
      </FormLabel>

      <p className="text-xs text-muted-foreground">
        {esComunidad
          ? "Marca esta opción si este puesto también tendrá rol de Presidente / Líder en esta comunidad o en sus aldeas/caseríos dependientes."
          : "Marca su propia dependencia para quedar como jefatura de ella, o una del nivel inmediatamente inferior. Al seleccionar una, quedan a cargo también sus subdependencias."}
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando departamentos...</p>
      ) : opciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta dependencia no tiene subdependencias directas para asignar.
        </p>
      ) : (
        <div className="space-y-2">
          {opciones.map((departamento) => (
            <label
              key={departamento.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-celeste-trifinio bg-transparent px-4 py-3"
            >
              <input
                type="checkbox"
                className="size-4 accent-celeste-trifinio"
                checked={selectedIds.includes(departamento.id)}
                onChange={() => toggle(departamento.id)}
              />
              <span className="text-sm font-medium text-foreground">
                {departamento.nombre}
                {departamento.propia ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (esta dependencia)
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
