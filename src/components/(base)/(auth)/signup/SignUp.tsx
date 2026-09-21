"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { getOrganizaciones, getDepartamentos, getMunicipios, crearDepartamento, crearMunicipio } from "./actions";
import { MagicCard } from "@/components/ui/magic-card";
import {
  X,
  Eye,
  EyeOff,
  Wand2,
  Loader2,
  UserPlus,
  ClipboardCopy,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignupLogic } from "./hooks";
import { AnimatePresence, motion } from "framer-motion";
import { generateStrongPassword } from "@/utils/general/password-generator";
import { AuroraText } from "@/components/ui/aurora-text";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useUser, useUserContext } from "@/components/(base)/providers/UserProvider";
import {
  getManageableRoles,
  isObservatorioRole,
  ROLE_LABELS,
} from "@/components/(base)/(users)/usuarios/lib/permissions";

interface SignUpProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  presentation?: "modal" | "panel" | "fullscreen";
}

const Label = ({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    {...props}
    className={cn(
      "text-sm font-semibold leading-none text-foreground/70",
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
      "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all outline-none",
      className,
    )}
  />
);

const Select = ({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
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

export default function SignUp({
  isOpen,
  onClose,
  onSuccess,
  presentation = "modal",
}: SignUpProps) {
  const logic = useSignupLogic();
  const { effectiveRole } = useUserContext();
  const creatableRoles = useMemo(
    () => getManageableRoles(effectiveRole),
    [effectiveRole],
  );
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [copied, setCopied] = useState(false);
  const [isUsernameEdited, setIsUsernameEdited] = useState(false);
  const [savedData, setSavedData] = useState({ user: "", pass: "" });
  const [organizaciones, setOrganizaciones] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
  const [municipios, setMunicipios] = useState<{ id: number; nombre: string }[]>([]);
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>("");
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>("");
  const hasMovedToStep2 = useRef(false);

  useEffect(() => {
    if (isOpen) {
      getOrganizaciones().then(setOrganizaciones).catch(() => setOrganizaciones([]));
      if (effectiveRole === "super") {
        getDepartamentos().then(setDepartamentos).catch(() => setDepartamentos([]));
      }
    }
  }, [isOpen, effectiveRole]);

  useEffect(() => {
    if (selectedDepartamento) {
      getMunicipios(Number(selectedDepartamento)).then(setMunicipios).catch(() => setMunicipios([]));
    } else {
      setMunicipios([]);
      setSelectedMunicipio("");
    }
  }, [selectedDepartamento]);

  useEffect(() => {
    if (isOpen && creatableRoles.length > 0 && !creatableRoles.includes(logic.rol)) {
      logic.setRol(creatableRoles[0]);
    }
  }, [isOpen, creatableRoles, logic.rol, logic.setRol]);

  const handleAddDepartamento = async () => {
    const nombre = window.prompt("Nombre del nuevo departamento:");
    if (!nombre || nombre.trim().length === 0) return;
    try {
      const nuevo = await crearDepartamento(nombre.trim());
      setDepartamentos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSelectedDepartamento(String(nuevo.id));
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
      setSelectedMunicipio(String(nuevo.id));
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const showOrganizacion = isObservatorioRole(logic.rol);

  const suggestedUsername = useMemo(() => {
    if (logic.name.trim().length > 3) {
      const cleanName = logic.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z ]/g, "");
      const connectors = ["de", "del", "la", "las", "los", "y", "el"];
      const parts = cleanName
        .split(" ")
        .filter((p) => p.length > 0 && !connectors.includes(p));
      if (parts.length >= 2) {
        const initial = parts[0][0];
        const surname = parts.length >= 3 ? parts[2] : parts[1];
        return initial + surname;
      } else if (parts.length === 1) {
        return parts[0];
      }
    }
    return "";
  }, [logic.name]);

  const resetForm = () => {
    const pass = generateStrongPassword();
    logic.setName("");
    logic.setUsername("");
    logic.setPasswordValue(pass);
    logic.setRol(creatableRoles[0] || "cocode");
    logic.setOrganizacionId("");
    logic.setShowPassword(false);
    setPhoneNumber("");
    setCopied(false);
    setIsUsernameEdited(false);
    setSelectedDepartamento("");
    setSelectedMunicipio("");
    setStep(1);
    setSavedData({ user: "", pass: "" });
    hasMovedToStep2.current = false;
    if (logic.state) {
      logic.state.success = false;
      logic.state.errors = undefined;
    }
  };

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || presentation !== "fullscreen") return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, presentation]);

  useEffect(() => {
    if (logic.state?.success && !hasMovedToStep2.current) {
      setSavedData({ user: logic.username, pass: logic.passwordValue });
      hasMovedToStep2.current = true;
      setStep(2);
      onSuccess?.();
    }
  }, [logic.state?.success, logic.username, logic.passwordValue, onSuccess]);
  const handleCopy = () => {
    const textToCopy = `*CREDENCIALES DE ACCESO*\n\n*Usuario:* ${savedData.user}\n*Contraseña:* ${savedData.pass}\n\n_Por seguridad, cambie su clave al ingresar_`;

    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;

    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      }
    } catch (err) {
      console.error("Fallo al copiar:", err);
    }

    document.body.removeChild(textArea);
  };

  const handleWhatsApp = () => {
    if (phoneNumber.length === 8) {
      const msg = `*CREDENCIALES DE ACCESO*\n\n*Usuario:* ${savedData.user}\n*Contraseña:* ${savedData.pass}\n\n_Por seguridad, cambie su clave al ingresar._`;
      window.open(
        `https://wa.me/502${phoneNumber}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
    }
  };

  if (!isOpen) return null;

  const panelCardClass =
    "rounded-2xl shadow-sm max-h-[calc(100dvh-2rem)] w-full flex flex-col overflow-hidden";

  const card = (
    <MagicCard
      className={cn(
        "border border-border/50 bg-card shadow-none overflow-hidden flex flex-col w-full",
        (presentation === "panel" || presentation === "fullscreen") &&
          panelCardClass,
        presentation === "modal" && "rounded-3xl",
      )}
    >
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-border/50 bg-muted/5 shrink-0">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <UserPlus size={26} className="text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground truncate">
              Nuevo Usuario
            </h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Configuración de acceso
            </p>
          </div>
        </div>
        {presentation !== "panel" && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "p-4 md:p-6 overflow-y-auto min-h-0",
          presentation === "modal" ? "min-h-105" : "flex-1",
        )}
      >
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.form
                    key="step1"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    action={logic.formAction}
                    className={cn(
                      effectiveRole === "super"
                        ? "grid gap-5 md:grid-cols-2"
                        : "space-y-5 flex flex-col"
                    )}
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="ej. Juan Pérez"
                        value={logic.name}
                        onChange={(e) => logic.setName(e.target.value)}
                        className={cn(
                          logic.state?.errors?.name &&
                            "border-destructive ring-1 ring-destructive",
                        )}
                      />
                      {logic.state?.errors?.name && (
                        <p className="text-[10px] text-destructive font-bold px-1 italic">
                          {logic.state.errors.name[0]}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="username"
                          className="flex items-center gap-1"
                        >
                          Usuario
                          {suggestedUsername && (
                            <>
                              <span className="text-muted-foreground font-normal ml-1 border-l border-border pl-2">Sugerido:</span>{" "}
                              <button
                                type="button"
                                onClick={() => {
                                  logic.setUsername(suggestedUsername);
                                  setIsUsernameEdited(true);
                                }}
                                className="group/sug flex items-center gap-1.5 transition-opacity cursor-pointer"
                              >
                                <AuroraText className="text-sm font-black lowercase opacity-80 group-hover/sug:opacity-100 transition-opacity">
                                  {suggestedUsername}
                                </AuroraText>
                                <Wand2
                                  size={14}
                                  className="text-primary/70 group-hover/sug:text-primary transition-all group-hover/sug:scale-110 rotate-15"
                                />
                                
                              </button>
                            </>
                          )}
                        </Label>
                      </div>
                      <Input
                        id="username"
                        name="username"
                        placeholder="ej. jperz"
                        value={logic.username}
                        onChange={(e) => {
                          logic.setUsername(e.target.value);
                          if (!isUsernameEdited) setIsUsernameEdited(true);
                        }}
                        className={cn(
                          logic.state?.errors?.username &&
                            "border-destructive ring-1 ring-destructive",
                        )}
                      />
                      {logic.state?.errors?.username && (
                        <p className="text-[10px] text-destructive font-bold px-1 italic">
                          {logic.state.errors.username[0]}
                        </p>
                      )}
                    </div>

                    {effectiveRole === "super" && (
                      <>
                        <div className="grid gap-2 z-20">
                          <Label htmlFor="departamento_id">Departamento</Label>
                          <SearchableSelect
                            name="departamento_id"
                            items={departamentos}
                            value={selectedDepartamento}
                            onChange={(val) => setSelectedDepartamento(val)}
                            onAdd={async (nombre) => {
                              try {
                                const nuevo = await crearDepartamento(nombre);
                                setDepartamentos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                                setSelectedDepartamento(String(nuevo.id));
                              } catch (e: any) {
                                alert("Error: " + e.message);
                              }
                            }}
                            placeholder="Buscar o agregar departamento..."
                          />
                        </div>
                        
                        <div className="grid gap-2 z-10">
                          <Label htmlFor="municipio_id">Municipio</Label>
                          <SearchableSelect
                            name="municipio_id"
                            items={municipios}
                            value={selectedMunicipio}
                            onChange={(val) => setSelectedMunicipio(val)}
                            disabled={!selectedDepartamento || (municipios.length === 0 && !selectedDepartamento)}
                            onAdd={async (nombre) => {
                              if (!selectedDepartamento) {
                                alert("Primero seleccione un departamento");
                                return;
                              }
                              try {
                                const nuevo = await crearMunicipio(Number(selectedDepartamento), nombre);
                                setMunicipios((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                                setSelectedMunicipio(String(nuevo.id));
                              } catch (e: any) {
                                alert("Error: " + e.message);
                              }
                            }}
                            placeholder="Buscar o agregar municipio..."
                          />
                        </div>
                      </>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="rol">Rol</Label>
                      <Select
                        id="rol"
                        name="rol"
                        value={logic.rol}
                        onChange={(e) => {
                          const newRol = e.target.value;
                          logic.setRol(newRol);
                          if (!isObservatorioRole(newRol)) {
                            logic.setOrganizacionId("");
                          }
                        }}
                      >
                        {creatableRoles.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role] || role}
                          </option>
                        ))}
                      </Select>
                      {logic.state?.errors?.rol && (
                        <p className="text-[10px] text-destructive font-bold px-1 italic">
                          {logic.state.errors.rol[0]}
                        </p>
                      )}
                    </div>



                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="flex items-center gap-1.5 animate-pulse">
                          <AuroraText className="text-sm font-bold">
                            Autogenerada
                          </AuroraText>
                          <Wand2
                            size={14}
                            className="text-primary rotate-15"
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={logic.showPassword ? "text" : "password"}
                          value={logic.passwordValue}
                          readOnly
                          tabIndex={-1}
                          className={cn(
                            "pr-10 bg-muted/20 font-mono border-dashed transition-all cursor-default focus-visible:ring-0",
                            !logic.showPassword && "tracking-[0.15em]",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            logic.setShowPassword(!logic.showPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1 cursor-pointer"
                        >
                          {logic.showPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                      {logic.state?.errors?.password && (
                        <p className="text-[10px] text-destructive font-bold px-1 italic">
                          {logic.state.errors.password[0]}
                        </p>
                      )}
                    </div>

                    {logic.state?.message && (
                      <div className={cn(
                        "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2",
                        effectiveRole === "super" && "md:col-span-2"
                      )}>
                        <p className="text-xs text-destructive font-semibold">
                          {logic.state.message}
                        </p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={logic.isPending}
                      className={cn(
                        "w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 shadow-sm cursor-pointer",
                        effectiveRole === "super" && "md:col-span-2"
                      )}
                    >
                      {logic.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "CREAR USUARIO"
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-5 rounded-2xl border border-border/60 bg-muted/30 space-y-5">
                      <div className="flex justify-between items-center border-b border-border/40 pb-4">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                          Credenciales generadas
                        </span>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold transition-all cursor-pointer"
                          >
                            <ClipboardCopy size={14} />
                            Copiar datos
                          </button>

                          <AnimatePresence>
                            {copied && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: -45, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                className="absolute left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded shadow-xl font-bold whitespace-nowrap z-10"
                              >
                                ¡Copiado!
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase opacity-70">
                            Usuario:
                          </span>
                          <span className="text-sm font-bold">
                            {savedData.user}
                          </span>
                          
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase opacity-70">
                            Contraseña:
                          </span>
                          <code className="text-sm font-mono text-foreground bg-background/80 px-2 py-1 rounded border border-border/40 tracking-wider shadow-sm">
                            {savedData.pass}
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <Label className="text-[10px] uppercase font-black tracking-widest">
                        Enviar por WhatsApp
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="Número de 8 dígitos"
                          value={phoneNumber}
                          onChange={(e) =>
                            setPhoneNumber(
                              e.target.value.replace(/\D/g, "").slice(0, 8),
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={handleWhatsApp}
                          disabled={phoneNumber.length !== 8}
                          className="px-5 rounded-xl border border-border bg-background text-foreground font-bold hover:bg-muted/50 disabled:opacity-40 flex items-center gap-2 text-[10px] tracking-widest transition-all h-10 shadow-sm cursor-pointer"
                        >
                          <MessageCircle size={16} />
                          ENVIAR
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="w-full h-12 rounded-xl border border-border bg-background text-foreground font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-muted/50 transition-all active:scale-95 shadow-sm cursor-pointer"
                    >
                      <ArrowLeft size={16} /> Volver
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
      </div>
    </MagicCard>
  );

  if (presentation === "panel") {
    return (
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        className="w-full sticky top-5"
      >
        {card}
      </motion.div>
    );
  }

  if (presentation === "fullscreen") {
    const fullscreen = (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 h-dvh w-full bg-background/60 backdrop-blur-sm"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "w-full relative",
            effectiveRole === "super" ? "max-w-2xl" : "max-w-md"
          )}
        >
          {card}
        </motion.div>
      </motion.div>
    );

    return createPortal(fullscreen, document.body);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "w-full relative",
            effectiveRole === "super" ? "max-w-2xl" : "max-w-md"
          )}
        >
          {card}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
