"use client";

import { useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import { useRouter } from "next/navigation";
import AnimatedIcon from "@/components/ui/AnimatedIcon";
import { useUserContext } from "@/components/(base)/providers/UserProvider";
import LogoTrifinio from "@/components/(comude)/logo/LogoTrifinio";
import LogoTrifinioMobile from "@/components/(comude)/logo/LogoTrifinio-mobile";
import VerPerfil from "@/components/(base)/(users)/profile/VerPerfil";
import PassKeysModal from "@/components/(base)/layout/modals/PassKeysModal";
import { useAppSettings } from "@/components/(base)/(settings)/hooks";
import GestorActividades from "@/components/(comude)/actividades/GestorActividades";
import {
  User as UserIcon,
  KeyRound,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import {
  DASHBOARD_MODULES,
  getVisibleDashboardModules,
} from "@/components/(base)/dashboard/modules";
import { cn } from "@/lib/utils";

const MODULES = DASHBOARD_MODULES;

const DASHBOARD_ICON_PLATE_CLASS =
  "flex items-center justify-center dark:rounded-2xl dark:bg-white";

const DASHBOARD_DOTTED_BG_CLASS =
  "pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] dark:bg-[radial-gradient(oklch(50%_0_0)_1px,transparent_1px)] opacity-60";

export function Dashboard({ initialPortada = "/sote/hero-background2.jpg" }: { initialPortada?: string }) {
  const { user, effectiveRole } = useUserContext();
  const { data: appSettings } = useAppSettings();
  const passkeysEnabled = appSettings?.enable_passkeys ?? false;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedPerfil, setExpandedPerfil] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPasskeysOpen, setIsPasskeysOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [testModeOption, setTestModeOption] = useState<1 | 2 | 3>(1);
  const isSuper = effectiveRole === "super";
  const router = useRouter();

  const displayImage = initialPortada;

  const { scrollY } = useScroll();
  const logoY = useTransform(scrollY, [0, 600], [0, -300]);
  const logoOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const imgYMobile = useTransform(scrollY, [0, 800], [0, 150]);
  const imgYTestMode = useTransform(scrollY, [0, 800], [0, 80]);
  // Zoom sutil y suavizado
  const bgScaleRaw = useTransform(scrollY, [0, 800], [1, 1.05]);
  const bgScale = useSpring(bgScaleRaw, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visibleModules = getVisibleDashboardModules(effectiveRole);

  const handleCardClick = (id: string, href: string) => {
    if (isMobile) {
      if (activeId === id) {
        router.push(href);
      } else {
        setActiveId(id);
      }
    } else {
      router.push(href);
    }
  };

  const CardsGrid = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex flex-col items-center justify-center px-[1%] pt-0 pb-2 sm:px-10 lg:px-14 sm:pt-0 sm:pb-4 lg:pt-0 lg:pb-6 text-center w-full max-w-none mx-auto transition-all group"
    >




      <div className="w-full text-left">
        <GestorActividades userId={user?.id} effectiveRole={effectiveRole} />
      </div>
    </motion.div>
  );

  return (
    <div className="relative w-full">
      {/* MODALES */}
      <VerPerfil
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userId={null}
      />
      <PassKeysModal
        isOpen={isPasskeysOpen && passkeysEnabled}
        onClose={() => setIsPasskeysOpen(false)}
        user={user}
      />

      <div className="flex flex-col md:hidden w-full bg-muted dark:bg-muted">
        <div className="w-full pt-2 pb-0 -mb-[6%] relative z-[2] mt-4">
          <LogoTrifinioMobile backgroundEffect="blur" />
        </div>

        <div className="w-full overflow-hidden">
          <motion.img
            src={displayImage}
            alt="COMUDE Concepción Las Minas"
            style={{
              y: imgYMobile,
              scale: bgScale,
            }}
            className="w-full h-auto object-contain block origin-center"
          />
        </div>

        <div className="relative w-full px-[1%] pt-8 pb-20">
          <div className={cn("absolute inset-0", DASHBOARD_DOTTED_BG_CLASS)} />
          <div className="relative z-10">
            <CardsGrid />
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:flex-col w-full bg-[#0a1628]">
        {/* Banner de Portada en PC (70vh relativo a la altura de pantalla) */}
        <div className="relative w-full h-[70vh] min-h-[440px] overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt="COMUDE Concepción Las Minas"
            className="w-full h-full object-fill block"
          />
          <div className="absolute inset-0 bg-black/15 flex items-center justify-center z-[5] p-4">
            <div className="w-full sm:w-auto max-w-[750px] mx-auto">
              <LogoTrifinio />
            </div>
          </div>
        </div>

        {/* Sección de Contenido (Actividades COMUDE) */}
        <div className="relative z-10 w-full bg-muted dark:bg-muted px-8 lg:px-12 pt-6 pb-20">
          <div className={cn("absolute inset-0", DASHBOARD_DOTTED_BG_CLASS)} />
          <div className="relative z-20 w-full max-w-[min(100%,1600px)] mx-auto pt-0 pb-2">
            <CardsGrid />
          </div>
        </div>
      </div>
    </div>
  );
}
