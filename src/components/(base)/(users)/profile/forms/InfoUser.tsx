"use client";

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useTheme } from "next-themes";
import {
  Wand2,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ClipboardCopy,
  MessageCircle,
  ArrowLeft,
  Shield,
} from "lucide-react";
import Swal from "sweetalert2";
import { profileObjectSchema } from "../lib/schemas";
import {
  useUserCredentials,
  useCredentialsMutation,
  useProfile,
} from "../lib/hooks";
import { toggleUserStatus, updateProfile } from "../lib/actions";
import {
  useUser,
  useUserContext,
} from "@/components/(base)/providers/UserProvider";
import {
  canAssignRole,
  canManageUsers,
  getManageableRoles,
  isUserVisibleToActor,
  ROLE_LABELS,
} from "@/components/(base)/(users)/usuarios/lib/permissions";
import { cn } from "@/lib/utils";
import { generateStrongPassword } from "@/utils/general/password-generator";
import { AuroraText } from "@/components/ui/aurora-text";
import {
  isPasswordStrong,
  PasswordRequirements,
} from "@/components/ui/password-requirements";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

// --- SUB-COMPONENT: SWITCH PERSONALIZADO ---
const StatusSwitch = ({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onCheckedChange(!checked)}
    className={cn(
      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-green-600" : "bg-zinc-300 dark:bg-zinc-600",
    )}
  >
    <span
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
        checked ? "translate-x-4" : "translate-x-0",
      )}
    />
  </button>
);

// --- SUB-COMPONENT: TOGGLE DE ESTADO ---
const UserStatusToggle = ({
  userId,
  isBanned,
  onStatusChange,
  canEdit,
}: {
  userId: string;
  isBanned: boolean;
  onStatusChange: () => void;
  canEdit: boolean;
}) => {
  const user = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [showSelfHint, setShowSelfHint] = useState(false);

  const isSelf = user?.id === userId;

  const revealSelfHint = () => {
    if (!isSelf) return;
    setShowSelfHint(true);
  };

  const hideSelfHint = () => {
    setShowSelfHint(false);
  };

  const handleSwitchTouch = () => {
    if (!isSelf) return;
    revealSelfHint();
    window.setTimeout(hideSelfHint, 2500);
  };

  const handleToggle = async (shouldBan: boolean) => {
    if (isLoading || isSelf || !canEdit) return;
    setIsLoading(true);
    try {
      const result = await toggleUserStatus(userId, shouldBan);
      if (result.success) onStatusChange();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isActive = !isBanned;

  return (
    <div className="flex h-10 w-full items-center justify-end gap-2">
      {isLoading && (
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
      )}
      <span
        className={cn(
          "text-xs font-bold whitespace-nowrap",
          isActive
            ? "text-green-700 dark:text-green-400"
            : "text-red-700 dark:text-red-400",
        )}
      >
        {isActive ? "Activo" : "Inactivo"}
      </span>
      <div
        className="relative"
        onMouseEnter={revealSelfHint}
        onMouseLeave={hideSelfHint}
        onFocus={revealSelfHint}
        onBlur={hideSelfHint}
        onTouchStart={handleSwitchTouch}
      >
        <StatusSwitch
          checked={isActive}
          onCheckedChange={(val) => handleToggle(!val)}
          disabled={!canEdit || isLoading || isSelf}
        />
        {isSelf && showSelfHint && (
          <div
            role="tooltip"
            className="absolute bottom-[calc(100%+6px)] right-0 z-20 whitespace-nowrap rounded-md border border-orange-200/80 bg-background px-2 py-1 text-[8px] leading-tight text-orange-600 shadow-md dark:border-orange-900/60 dark:text-orange-500"
          >
            No puedes desactivar tu propio usuario
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
interface InfoUserProps {
  userId: string;
  canEdit: boolean;
  onClose?: () => void;
  onViewChange?: (view: "perfil" | "usuario") => void;
  embedded?: boolean;
  onCredentialChanges?: (hasChanges: boolean) => void;
}

export type InfoUserRef = {
  hasCredentialChanges: () => boolean;
  saveCredentials: () => Promise<boolean>;
};

export const InfoUser = forwardRef<InfoUserRef, InfoUserProps>(
  function InfoUser(
    {
      userId,
      canEdit,
      onClose,
      onViewChange,
      embedded = false,
      onCredentialChanges,
    },
    ref,
  ) {
    const { theme } = useTheme();
    const { effectiveRole } = useUserContext();
    const queryClient = useQueryClient();
    const { profile, refetch: refetchProfile } = useProfile(userId, true);
    const { credentials, loading, refetch } = useUserCredentials(userId);
    const mutation = useCredentialsMutation();

    const rawRole =
      (profile?.rol === "cocode" ? "comude" : profile?.rol) ||
      (credentials as any)?.rol ||
      "";
    const targetRole = rawRole || "comude";
    const roleOptions = getManageableRoles(effectiveRole).filter((r) => r !== "cocode");
    const canManageTarget = isUserVisibleToActor(targetRole, effectiveRole);
    const canChangeRole =
      canManageTarget &&
      roleOptions.length > 0 &&
      !(effectiveRole === "admin" && targetRole === "super");
    const canManageStatus = canManageUsers(effectiveRole) && canManageTarget;

    const [step, setStep] = useState(1);
    const [selectedRole, setSelectedRole] = useState(rawRole || "comude");
    const [formData, setFormData] = useState({
      username: "",
      newPassword: "",
      confirmPassword: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [hasChanges, setHasChanges] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [savedData, setSavedData] = useState({ user: "", pass: "" });

    useEffect(() => {
      if (rawRole) {
        setSelectedRole(rawRole);
      }
    }, [rawRole]);

    useEffect(() => {
      if (
        roleOptions.length > 0 &&
        selectedRole &&
        !roleOptions.includes(selectedRole)
      ) {
        const fallback =
          rawRole && roleOptions.includes(rawRole)
            ? rawRole
            : roleOptions.includes("comude")
            ? "comude"
            : roleOptions[0];
        setSelectedRole(fallback);
      }
    }, [roleOptions, rawRole, selectedRole]);

    useEffect(() => {
      if (credentials) {
        setFormData({
          username: credentials.username || "",
          newPassword: "",
          confirmPassword: "",
        });
        setHasChanges(false);
      }
    }, [credentials]);

    const hasPendingAccessChanges =
      hasChanges || selectedRole !== (rawRole || "comude");

    useEffect(() => {
      if (embedded) onCredentialChanges?.(hasPendingAccessChanges);
    }, [embedded, hasPendingAccessChanges, onCredentialChanges]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEdit) return;
      const { name, value } = e.target;
      const val =
        name === "username"
          ? value.toLowerCase().replace(/[^a-z0-9]/g, "")
          : value;

      setFormData((prev) => ({ ...prev, [name]: val }));
      setHasChanges(true);
      if (errors[name])
        setErrors((prev) => {
          const n = { ...prev };
          delete n[name];
          return n;
        });
    };

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!canEdit || !canChangeRole) return;
      setSelectedRole(e.target.value);
      setHasChanges(true);
    };

    const handleSave = useCallback(async (): Promise<boolean> => {
      const roleChanged = selectedRole !== (rawRole || "comude");
      const credentialsChanged =
        formData.username !== (credentials?.username || "") ||
        formData.newPassword.length > 0;

      if (!roleChanged && !credentialsChanged) return true;

      try {
        if (credentialsChanged) {
          const valid = profileObjectSchema
            .pick({ username: true, newPassword: true, confirmPassword: true })
            .refine(
              (data) =>
                !data.newPassword || data.newPassword === data.confirmPassword,
              { path: ["confirmPassword"] },
            )
            .safeParse(formData);

          if (!valid.success) {
            const fieldErrors: Record<string, string> = {};
            valid.error.issues.forEach((i) => {
              if (i.path[0]) fieldErrors[i.path[0].toString()] = i.message;
            });
            setErrors(fieldErrors);
            return false;
          }

          await mutation.mutateAsync({
            userId,
            username: formData.username,
            password: formData.newPassword || undefined,
          });

          if (embedded) {
            setFormData((prev) => ({
              ...prev,
              newPassword: "",
              confirmPassword: "",
            }));
          } else {
            setSavedData({
              user: formData.username,
              pass: formData.newPassword || "Sin cambios",
            });
            setStep(2);
          }
        }

        if (roleChanged) {
          if (!canAssignRole(effectiveRole, selectedRole)) {
            Swal.fire({
              icon: "error",
              title: "Sin permiso",
              text: "No tienes permiso para asignar este rol.",
              background: theme === "dark" ? "#18181b" : "#fff",
              color: theme === "dark" ? "#fff" : "#000",
            });
            return false;
          }

          await updateProfile(userId, { rol: selectedRole as never });
          await queryClient.invalidateQueries({
            queryKey: ["profile", userId],
          });
          await refetchProfile();
        }

        setHasChanges(false);
        return true;
      } catch (error: any) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.message,
          background: theme === "dark" ? "#18181b" : "#fff",
          color: theme === "dark" ? "#fff" : "#000",
        });
        return false;
      }
    }, [
      credentials?.username,
      effectiveRole,
      embedded,
      formData,
      mutation,
      profile?.rol,
      queryClient,
      refetchProfile,
      selectedRole,
      theme,
      userId,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        hasCredentialChanges: () => hasPendingAccessChanges,
        saveCredentials: handleSave,
      }),
      [hasPendingAccessChanges, handleSave],
    );

    // --- LÓGICA DE VALIDACIÓN ---
    const isPasswordValid = isPasswordStrong(formData.newPassword);

    if (loading)
      return (
        <div
          className={cn(
            "flex items-center justify-center",
            embedded ? "h-32" : "h-40",
          )}
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      );

    const accesoForm = (
      <div className="space-y-3">
        <div>
          <label className="text-sm font-semibold text-foreground/70 mb-1.5 block">
            Usuario
          </label>
          <input
            name="username"
            value={formData.username}
            onChange={handleChange}
            disabled={!canEdit}
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50",
              errors.username && "border-destructive",
            )}
          />
        </div>

        <div>
          <div
            className={cn(
              "gap-3 items-end",
              canManageStatus ? "grid grid-cols-2" : "flex flex-col",
            )}
          >
            <div className={cn(canManageStatus ? "min-w-0" : "w-full")}>
              <label className="text-sm font-semibold text-foreground/70 mb-1.5 block">
                Rol
              </label>
              <select
                value={selectedRole || rawRole || "comude"}
                onChange={handleRoleChange}
                disabled={!canChangeRole || !canEdit}
                className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                {canChangeRole ? (
                  roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </option>
                  ))
                ) : (
                  <option value={selectedRole || rawRole || "comude"}>
                    {ROLE_LABELS[selectedRole || rawRole || "comude"] || selectedRole || "Comude"}
                  </option>
                )}
              </select>
            </div>
            {canManageStatus && (
              <div className="min-w-0">
                <UserStatusToggle
                  userId={userId}
                  isBanned={!!credentials?.banned_until}
                  onStatusChange={refetch}
                  canEdit={canEdit}
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-foreground/70">
              Contraseña
            </label>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  const p = generateStrongPassword();
                  setFormData((prev) => ({
                    ...prev,
                    newPassword: p,
                    confirmPassword: p,
                  }));
                  setHasChanges(true);
                  setShowPass(true);
                }}
                className="text-xs flex items-center gap-1 font-bold hover:underline text-primary cursor-pointer transition-opacity shrink-0"
              >
                <AuroraText>Generar</AuroraText>
                <Wand2 size={12} className="rotate-[15deg]" />
              </button>
            )}
          </div>

          <div className="relative">
            <input
              name="newPassword"
              type={showPass ? "text" : "password"}
              value={formData.newPassword}
              onChange={handleChange}
              disabled={!canEdit}
              placeholder="Nueva contraseña"
              className={cn(
                "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm pr-8 focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50",
                errors.newPassword && "border-destructive",
                formData.newPassword.length > 0 &&
                  isPasswordValid &&
                  "border-green-500 ring-green-500",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <input
            name="confirmPassword"
            type={showPass ? "text" : "password"}
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={!canEdit}
            placeholder="Confirmar contraseña"
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50",
              formData.confirmPassword &&
                formData.newPassword !== formData.confirmPassword &&
                "border-red-500 ring-red-500",
              formData.confirmPassword &&
                formData.newPassword === formData.confirmPassword &&
                "border-green-500 ring-green-500",
            )}
          />

          <PasswordRequirements
            newPassword={formData.newPassword}
            confirmPassword={formData.confirmPassword}
          />
        </div>
      </div>
    );

    if (embedded) {
      return accesoForm;
    }

    return (
      <div className="w-full flex flex-col h-full min-h-0">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1"
            >
              <div className="pb-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/40 mb-4">
                  <Shield
                    size={22}
                    className="text-purple-700 dark:text-purple-500"
                  />
                  <h3 className="text-sm font-bold uppercase tracking-tight">
                    Acceso
                  </h3>
                </div>
                {accesoForm}
              </div>
              <div
                className={cn(
                  "grid gap-3 mt-auto pt-4 border-t border-border/40 shrink-0",
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
                    disabled={!hasPendingAccessChanges || mutation.isPending}
                    className="text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed transition-colors cursor-pointer text-right flex items-center justify-end gap-1.5"
                  >
                    {mutation.isPending && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    Guardar
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <SuccessView
              savedData={savedData}
              phone={credentials?.phone || ""}
              onBack={() => setStep(1)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  },
);
const SuccessView = ({
  savedData,
  phone,
  onBack,
  compact = false,
}: {
  savedData: { user: string; pass: string };
  phone: string;
  onBack: () => void;
  compact?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const [inputPhone, setInputPhone] = useState(phone);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Usuario: ${savedData.user}\nContraseña: ${savedData.pass}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn("space-y-4", compact && "space-y-3")}
    >
      <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-border/50">
          <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
            Actualizado
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline cursor-pointer"
          >
            {copied ? <CheckCircle2 size={12} /> : <ClipboardCopy size={12} />}{" "}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs flex items-center justify-between">
            <span className="font-bold opacity-70">Usuario:</span>
            <span className="font-mono">{savedData.user}</span>
          </p>
          <p className="text-xs flex items-center justify-between">
            <span className="font-bold opacity-70">Clave:</span>
            <code className="bg-background px-1.5 py-0.5 rounded border text-[10px]">
              {savedData.pass}
            </code>
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={inputPhone}
          onChange={(e) =>
            setInputPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          placeholder="Teléfono (8 dígitos)"
          className="flex-1 h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={() =>
            window.open(
              `https://wa.me/502${inputPhone}?text=${encodeURIComponent(
                `*CREDENCIALES ACTUALIZADAS*\n\nUsuario: ${savedData.user}\nContraseña: ${savedData.pass}\n\n_Por favor cambie su contraseña al ingresar._`,
              )}`,
              "_blank",
            )
          }
          disabled={inputPhone.length !== 8}
          className="h-9 px-3 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-md disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          <MessageCircle size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full h-9 border rounded-lg text-xs font-bold uppercase hover:bg-muted flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Volver
      </button>
    </motion.div>
  );
};
