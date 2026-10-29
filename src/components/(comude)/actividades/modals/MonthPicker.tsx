"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = [
  "Ene", "Feb", "Mar",
  "Abr", "May", "Jun",
  "Jul", "Ago", "Sep",
  "Oct", "Nov", "Dic"
];

const MESES_COMPLETOS = [
  "Enero", "Febrero", "Marzo",
  "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre",
  "Octubre", "Noviembre", "Diciembre"
];

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export default function MonthPicker({ year, month, onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Actualizar viewYear si cambia el year prop y el popover está cerrado
  useEffect(() => {
    if (!isOpen) {
      setViewYear(year);
    }
  }, [year, isOpen]);

  const selectMonth = (m: number) => {
    onChange(viewYear, m);
    setIsOpen(false);
  };

  const todoElAnio = month === -1;
  const etiqueta = todoElAnio
    ? String(year)
    : `${MESES_COMPLETOS[month]} ${year}`;

  return (
    <div className="flex flex-1 sm:flex-none items-center gap-2 relative" ref={popoverRef}>
      {/* Botón Selector */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 min-w-[140px] flex-1 items-center justify-between gap-2 rounded-xl border border-border/70 bg-background px-3 dark:bg-card sm:flex-none hover:bg-muted/70 dark:hover:bg-muted/40 shadow-xs transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="shrink-0 text-azul-trifinio dark:text-blue-400" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
            {etiqueta}
          </span>
        </div>
        <ChevronDown size={14} className="text-muted-foreground ml-2" />
      </button>

      {/* Botón Todo el año */}
      <button
        type="button"
        onClick={() => {
          onChange(viewYear, -1);
          setIsOpen(false);
        }}
        className={cn(
          'h-10 shrink-0 cursor-pointer rounded-xl border px-4 text-sm font-semibold whitespace-nowrap transition-colors',
          todoElAnio
            ? 'border-border/70 bg-zinc-200 text-zinc-900 dark:border-border/60 dark:bg-zinc-800 dark:text-white shadow-xs'
            : 'border-border/70 bg-background text-zinc-700 hover:bg-muted dark:bg-card dark:text-zinc-200 dark:hover:bg-muted/50 shadow-xs',
        )}
      >
        Todo el año
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-12 left-0 w-64 bg-white dark:bg-zinc-800 border border-border/50 dark:border-border/50 shadow-xl rounded-xl p-3 z-50">
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              onClick={() => setViewYear(y => y - 1)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10 rounded transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-sm text-azul-trifinio dark:text-blue-400">
              {viewYear}
            </span>
            <button
              onClick={() => setViewYear(y => y + 1)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10 rounded transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-1">
            {MESES.map((mStr, idx) => {
              const isActive = !todoElAnio && viewYear === year && month === idx;
              return (
                <button
                  key={idx}
                  onClick={() => selectMonth(idx)}
                  className={cn(
                    "py-2 text-sm font-semibold rounded-lg transition-colors",
                    isActive
                      ? "bg-azul-trifinio text-white dark:bg-blue-500"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-muted dark:hover:bg-white/10"
                  )}
                >
                  {mStr}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
