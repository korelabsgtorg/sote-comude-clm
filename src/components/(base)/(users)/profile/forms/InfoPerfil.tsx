"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  User,
  Phone,
  MapPin,
  Fingerprint,
  Calendar,
  Heart,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Swal from "sweetalert2";
import { useQueryClient } from "@tanstack/react-query";
import { updateProfile } from "../lib/actions";
import { useProfile } from "../lib/hooks";
import { getOrganizaciones } from "@/components/(base)/(auth)/signup/actions";
import { cn } from "@/lib/utils";
import { Building2, Shield } from "lucide-react";
import { InfoUser, type InfoUserRef } from "./InfoUser";
import { getDepartamentos, getMunicipios, crearDepartamento, crearMunicipio } from "@/components/(base)/(auth)/signup/actions";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createClient } from "@/utils/supabase/client";
import { useUserContext } from "@/components/(base)/providers/UserProvider";

const Label = ({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    {...props}
    className={cn(
      "text-sm font-semibold leading-none text-foreground/70 mb-2 block",
      className,
    )}
  />
);

const Input = ({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={cn(
      "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-all",
      className,
    )}
  />
);

const Select = ({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative w-full">
    <select
      {...props}
      className={cn(
        "flex h-10 w-full appearance-none rounded-lg border border-input bg-background/50 px-3 py-2 text-sm outline-none cursor-pointer",
        className,
      )}
    />
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 1L5 5L9 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  </div>
);

interface InfoPerfilProps {
  userId: string;
  canEdit: boolean;
  onClose: () => void;
}

export const InfoPerfil = ({ userId, canEdit, onClose }: InfoPerfilProps) => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { effectiveRole } = useUserContext();
  const accesoRef = useRef<InfoUserRef>(null);
  const { profile: perfilData } = useProfile(userId, true);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [credentialChanges, setCredentialChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organizaciones, setOrganizaciones] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
  const [municipios, setMunicipios] = useState<{ id: number; nombre: string }[]>([]);
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>("");

  useEffect(() => {
    if (perfilData) {
      setFormData(perfilData);
      setHasChanges(false);

      if (perfilData.municipio_id) {
        const fetchDept = async () => {
          const supabase = createClient();
          const { data } = await supabase.from("lug_municipios").select("departamento_id").eq("id", perfilData.municipio_id).single();
          if (data?.departamento_id) {
            setSelectedDepartamento(String(data.departamento_id));
          }
        };
        fetchDept();
      }
    }
  }, [perfilData]);

  useEffect(() => {
    getOrganizaciones().then(setOrganizaciones).catch(() => setOrganizaciones([]));
    if (perfilData?.rol === "super" || formData?.rol === "super" || effectiveRole === "super") {
      getDepartamentos().then(setDepartamentos).catch(() => setDepartamentos([]));
    }
  }, [perfilData?.rol, formData?.rol, effectiveRole]);

  useEffect(() => {
    if (selectedDepartamento) {
      getMunicipios(Number(selectedDepartamento)).then(setMunicipios).catch(() => setMunicipios([]));
    } else {
      setMunicipios([]);
    }
  }, [selectedDepartamento]);

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>,
  ) => {
    if (!canEdit) return;
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    setHasChanges(true);

    if (name === "departamento_id") {
       setSelectedDepartamento(value);
       setFormData((prev: any) => ({ ...prev, municipio_id: "" }));
    }
  };

  const handleAddDepartamento = async () => {
    const nombre = window.prompt("Nombre del nuevo departamento:");
    if (!nombre || nombre.trim().length === 0) return;
    try {
      const nuevo = await crearDepartamento(nombre.trim());
      setDepartamentos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSelectedDepartamento(String(nuevo.id));
      setFormData((prev: any) => ({ ...prev, municipio_id: "" }));
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleAddMunicipio = async () => {
    if (!selectedDepartamento) {
      alert("Primero seleccione un departamento");
      return;
    }
    const nombre = window.prompt("Nombre del nuevo municipio:");
    if (!nombre || nombre.trim().length === 0) return;
    try {
      const nuevo = await crearMunicipio(Number(selectedDepartamento), nombre.trim());
      setMunicipios((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setFormData((prev: any) => ({ ...prev, municipio_id: String(nuevo.id) }));
      setHasChanges(true);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    const swalConfig = {
      background: theme === "dark" ? "#18181b" : "#ffffff",
      color: theme === "dark" ? "#ffffff" : "#000000",
      toast: true,
      position: "top" as const,
      showConfirmButton: false,
      timer: 2000,
    };

    try {
      let didSave = false;

      if (accesoRef.current?.hasCredentialChanges()) {
        const credentialsSaved = await accesoRef.current.saveCredentials();
        if (!credentialsSaved) return;
        didSave = true;
      }

      if (hasChanges) {
        await updateProfile(userId, formData);
        await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
        setHasChanges(false);
        didSave = true;
      }

      if (didSave) {
        Swal.fire({
          ...swalConfig,
          icon: "success",
          title: "Guardado",
        });
      }
    } catch (e: any) {
      Swal.fire({
        ...swalConfig,
        icon: "error",
        title: "Error",
        text: e.message,
        timer: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const NavButtons = (
    <div className="flex md:hidden items-center gap-2 text-muted-foreground/60">
      <button
        onClick={() => setStep((s) => Math.max(1, s - 1))}
        disabled={step === 1}
        className="active:scale-90 disabled:opacity-10 transition-all p-1"
      >
        <ChevronLeft size={32} />
      </button>
      <button
        onClick={() => setStep((s) => Math.min(3, s + 1))}
        disabled={step === 3}
        className="active:scale-90 disabled:opacity-10 transition-all p-1"
      >
        <ChevronRight size={32} />
      </button>
    </div>
  );

  const SectionPersonal = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <User size={25} className="text-blue-700" />
          <h3 className="text-md font-bold uppercase tracking-tight">
            Personal
          </h3>
        </div>
        {NavButtons}
      </div>
      <div className="space-y-4">
        <div>
          <Label>Nombre Completo</Label>
          <Input
            name="nombre"
            value={formData.nombre || ""}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>DPI</Label>
          <div className="relative">
            <Fingerprint
              size={14}
              className="absolute left-3 top-3 text-muted-foreground"
            />
            <Input
              name="dpi"
              inputMode="numeric"
              value={formData.dpi || ""}
              onChange={handleChange}
              disabled={!canEdit}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label>Género</Label>
          <Select
            name="genero"
            value={formData.genero || "Masculino"}
            onChange={handleChange}
            disabled={!canEdit}
          >
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </Select>
        </div>
        <div className="min-w-0">
          <Label>Fecha Nacimiento</Label>
          <div
            className="relative flex items-center group cursor-pointer"
            onClick={(e) => {
              const input = e.currentTarget.querySelector("input");
              if (input && !input.disabled) input.showPicker();
            }}
          >
            <Calendar
              size={14}
              className="absolute left-3 text-muted-foreground pointer-events-none z-10"
            />
            <Input
              type="date"
              name="fecha_nacimiento"
              value={formData.fecha_nacimiento?.split("T")[0] || ""}
              onChange={handleChange}
              disabled={!canEdit}
              className={cn(
                "pl-9 pr-3 cursor-pointer w-full appearance-none",
                "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const SectionContacto = (
    <div className="space-y-6 lg:space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <MapPin size={25} className="text-green-700" />
          <h3 className="text-md font-bold uppercase tracking-tight">
            Contacto
          </h3>
        </div>
        {NavButtons}
      </div>
      <div className="space-y-4">
        <div>
          <Label>Correo Electrónico</Label>
          <Input
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input
            name="telefono"
            type="tel"
            inputMode="numeric"
            value={formData.telefono || ""}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Dirección</Label>
          <Input
            name="direccion"
            value={formData.direccion || ""}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>
      </div>
    </div>
  );

  const SectionEmergencia = (
    <div className="space-y-6 lg:space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Heart size={25} className="text-red-500" />
          <h3 className="text-md font-bold uppercase tracking-tight">
            Emergencia
          </h3>
        </div>
        {NavButtons}
      </div>
      <div className="space-y-4">
        <div>
          <Label>Nombre Contacto</Label>
          <Input
            name="contacto_emergencia"
            value={formData.contacto_emergencia || ""}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Teléfono Emergencia</Label>
          <Input
            name="telefono_emergencia"
            type="tel"
            inputMode="numeric"
            value={formData.telefono_emergencia || ""}
            onChange={handleChange}
            disabled={!canEdit}
          />
        </div>

        {effectiveRole === "super" && (
          <>
            <div className="z-20">
              <Label>Departamento</Label>
              <SearchableSelect
                items={departamentos}
                value={selectedDepartamento}
                onChange={(val) => {
                  setSelectedDepartamento(val);
                  setFormData((prev: any) => ({ ...prev, municipio_id: "", departamento_id: val }));
                  setHasChanges(true);
                }}
                disabled={!canEdit}
                onAdd={async (nombre) => {
                  try {
                    const nuevo = await crearDepartamento(nombre);
                    setDepartamentos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                    setSelectedDepartamento(String(nuevo.id));
                    setFormData((prev: any) => ({ ...prev, municipio_id: "", departamento_id: String(nuevo.id) }));
                    setHasChanges(true);
                  } catch (e: any) {
                    alert("Error: " + e.message);
                  }
                }}
                placeholder="Buscar o agregar departamento..."
              />
            </div>
            <div className="z-10">
              <Label>Municipio</Label>
              <SearchableSelect
                items={municipios}
                value={formData.municipio_id || ""}
                onChange={(val) => {
                  setFormData((prev: any) => ({ ...prev, municipio_id: val }));
                  setHasChanges(true);
                }}
                disabled={!canEdit || !selectedDepartamento || (municipios.length === 0 && !selectedDepartamento)}
                onAdd={async (nombre) => {
                  if (!selectedDepartamento) {
                    alert("Primero seleccione un departamento");
                    return;
                  }
                  try {
                    const nuevo = await crearMunicipio(Number(selectedDepartamento), nombre);
                    setMunicipios((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                    setFormData((prev: any) => ({ ...prev, municipio_id: String(nuevo.id) }));
                    setHasChanges(true);
                  } catch (e: any) {
                    alert("Error: " + e.message);
                  }
                }}
                placeholder="Buscar o agregar municipio..."
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  const SectionAcceso = (
    <div className="space-y-6 lg:space-y-4">
      <div className="flex items-center pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Shield size={25} className="text-purple-700 dark:text-purple-500" />
          <h3 className="text-md font-bold uppercase tracking-tight">Acceso</h3>
        </div>
      </div>
      <InfoUser
        ref={accesoRef}
        userId={userId}
        canEdit={canEdit}
        embedded
        onCredentialChanges={setCredentialChanges}
      />
    </div>
  );

  return (
    <div className="w-full flex flex-col h-full animate-in fade-in duration-300 ">
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,3fr)] lg:items-start">
        <div className="mr-5 xl:mr-6 rounded-2xl border border-border/70 bg-muted/35 dark:border-border/80 dark:bg-muted/20 p-4 xl:p-5 shadow-sm shadow-black/5 dark:shadow-none">
          {SectionAcceso}
        </div>

        <div
          className="w-px shrink-0 self-stretch bg-linear-to-b from-transparent via-border to-transparent dark:via-border/80"
          aria-hidden
        />

        <div className="grid min-w-0 grid-cols-3 gap-6 pl-5 xl:gap-8 xl:pl-6">
          {SectionPersonal}
          {SectionContacto}
          {SectionEmergencia}
        </div>
      </div>

      <div className="hidden md:grid lg:hidden md:grid-cols-3 gap-6 lg:gap-8 pb-6">
        {SectionPersonal}
        {SectionContacto}
        {SectionEmergencia}
      </div>

      <div className="md:hidden flex flex-col flex-1">
        <div className="flex-1 space-y-6">
          {step === 1 && (
            <div className="animate-in fade-in duration-300">
              {SectionPersonal}
            </div>
          )}
          {step === 2 && (
            <div className="animate-in fade-in duration-300">
              {SectionContacto}
            </div>
          )}
          {step === 3 && (
            <div className="animate-in fade-in duration-300">
              {SectionEmergencia}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 border-t border-border/60 shrink-0",
          "mt-4 pt-4 lg:mt-2 lg:pt-4",
          canEdit ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors cursor-pointer text-left"
        >
          Volver
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={(!hasChanges && !credentialChanges) || saving}
            className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed transition-colors cursor-pointer text-right flex items-center justify-end gap-1.5"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        )}
      </div>
    </div>
  );
};
