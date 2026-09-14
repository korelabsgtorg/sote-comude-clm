"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, useUserContext } from "@/components/(base)/providers/UserProvider";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Menu as MenuIcon, X, RefreshCw, LogIn } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import Menu from "./Menu";
import { getPendingDevicesCount } from "@/components/(comude)/admin/lib/actions";
import Image from "next/image";
import { createPortal } from "react-dom";
import AnimacionLogoTrifinio from "@/components/(comude)/logo/AnimacionLogoTrifinio";
import { GlobalMunicipioSelector } from "./GlobalMunicipioSelector";
import { useDynamicTitle } from "./useDynamicTitle";

export default function Header() {
  const user = useUser();
  const { effectiveRole } = useUserContext();
  const [pendingDevices, setPendingDevices] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dynamicTitle = useDynamicTitle();
  const pathname = usePathname();
  const isPublicHome = pathname === "/";
  const isPrincipal = pathname === "/comude" || pathname === "/";
  const isLoginPage = pathname === "/login" || pathname === "/";
  const showLoginButton = !user && !isLoginPage;
  const showBreadcrumb = Boolean(user) && !isLoginPage;
  const showHamburger = Boolean(user);

  const metadata = user?.user_metadata || {};
  const role = metadata.rol || user?.role || "user";
  const canManage = ["super", "admin"].includes(role);

  useEffect(() => {
    setMounted(true);
    if (!canManage) return;
    getPendingDevicesCount().then((c) => setPendingDevices(c ?? 0));
  }, [canManage]);

  const handleLogoClick = (e: React.MouseEvent) => {
    // Prevent default navigation to show the animation instead
    e.preventDefault();
    setIsFullScreen(true);
  };

  return (
    <>
      {/* Spacer para compensar el header fijo + safe area */}
      <div
        aria-hidden
        className={`shrink-0 pointer-events-none transition-[height] duration-200 ${
          showBreadcrumb 
            ? "h-[calc(6.5rem+env(safe-area-inset-top))] md:h-[calc(3.5rem+env(safe-area-inset-top))]" 
            : "h-[calc(3rem+env(safe-area-inset-top))] md:h-[calc(3.5rem+env(safe-area-inset-top))]"
        }`}
      />
      <header 
        className="w-full fixed top-0 left-0 transition-all bg-card border-b border-border/40 z-[100] shadow-sm"
      >
        {/* Cubre el notch/Dynamic Island con el mismo fondo del header */}
        <div style={{ height: "env(safe-area-inset-top)" }} />
        {/* Contenido del nav */}
        <div 
          className="mx-auto flex h-12 md:h-14 items-center justify-between px-4 md:px-8 gap-4"
        >
          <div className="flex items-center h-full">
            <div className="flex items-center shrink-0">
              <Link
                href={user ? "/comude" : "/"}
                onClick={handleLogoClick}
                id="observatorio-header-brand"
                className="flex flex-row items-center shrink-0 group gap-2 md:gap-3 cursor-pointer"
              >
                {user ? (
                  <>
                    <motion.h1
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="text-base md:text-2xl font-extrabold tracking-tighter leading-tight md:leading-none text-azul-trifinio dark:text-white transition-transform duration-300 group-hover:scale-105 origin-left"
                    >
                      SOTE<span className="hidden sm:inline">-</span><br className="block sm:hidden" />COMUDE
                    </motion.h1>
                    <motion.div
                      initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
                      animate={{ opacity: 1, clipPath: "inset(0 0 0 0)" }}
                      transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      className="hidden md:block text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-[1.15] md:leading-[1.15] text-celeste-trifinio border-l border-border/60 pl-2 md:pl-3 transition-transform duration-300 group-hover:scale-[1.02] origin-left group-hover:text-azul-trifinio dark:group-hover:text-[#FFFDD0]"
                    >
                      SISTEMA DE ORGANIZACIÓN<br />TERRITORIAL ESTRATÉGICA
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="flex flex-col gap-0 leading-none text-sm md:text-lg lg:text-xl font-extrabold tracking-tight"
                    >
                      <span className="text-azul-trifinio dark:text-white">SOTE</span>
                      <span className="inline-flex items-baseline gap-1">
                        <span className="font-light text-border/80">|</span>
                        <span
                          className="text-xs md:text-base lg:text-lg font-semibold text-celeste-trifinio tracking-normal"
                          style={{ fontFamily: "Arial, sans-serif" }}
                        >
                          {dynamicTitle}
                        </span>
                      </span>
                    </motion.div>
                  </>
                )}
              </Link>
            </div>
            {showBreadcrumb && (
              <div className="hidden md:flex ml-4 md:ml-6 border-l border-border/30 h-10 items-center pl-4 md:pl-6">
                <BreadcrumbNav />
              </div>
            )}
          </div>

          <div className="flex items-center gap-5 md:gap-4 shrink-0">
            <AnimatedThemeToggler />
            <button
              id="refresh-btn"
              onClick={() => window.location.reload()}
              className="flex items-center justify-center text-azul-trifinio hover:text-celeste-trifinio dark:text-white dark:hover:text-white/80 cursor-pointer transition-all hover:rotate-180 duration-500 active:scale-95"
            >
              <RefreshCw className="size-7 md:size-6" />
            </button>
            {showLoginButton && (
              <Link
                href="/login"
                className="group flex items-center gap-2 min-h-11 px-1.5 md:min-h-0 md:px-0 cursor-pointer active:scale-95"
                title="Iniciar Sesión"
              >
                <LogIn className="size-7 md:size-5 lg:size-6 shrink-0 text-azul-trifinio group-hover:text-celeste-trifinio dark:text-white dark:group-hover:text-celeste-trifinio transition-colors duration-300" />
                <span className="text-xs md:text-[11px] lg:text-xs font-extrabold text-celeste-trifinio group-hover:text-azul-trifinio dark:text-celeste-trifinio dark:group-hover:text-white tracking-tight transition-colors duration-300">
                  SOTE-COMUDE
                </span>
              </Link>
            )}
            {showHamburger && (
            <div className="relative">
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-center text-foreground hover:text-foreground/80 cursor-pointer transition-all active:scale-95"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isOpen ? (
                        <motion.div
                          key="close"
                          initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <X className="size-7 md:size-8" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="menu"
                          initial={{ opacity: 0, rotate: 90, scale: 0.8 }}
                          animate={{ opacity: 1, rotate: 0, scale: 1 }}
                          exit={{ opacity: 0, rotate: -90, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <MenuIcon className="size-7 md:size-8" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  {!isOpen && canManage && pendingDevices > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white animate-pulse pointer-events-none">
                      {pendingDevices}
                    </span>
                  )}
              </div>
            )}
          </div>
        </div>
      </header>

      {showBreadcrumb && (
        <div 
          style={{ top: 'calc(var(--banner-height, 0px) + 3rem + env(safe-area-inset-top))' }}
          className="fixed left-0 md:hidden w-full pl-4 pr-3 py-1 min-h-[var(--mobile-breadcrumb-height)] flex items-center justify-between gap-3 bg-card border-b border-border/30 shadow-sm z-[105]"
        >
          <div className="shrink-0">
            <BreadcrumbNav />
          </div>
        </div>
      )}

      {showHamburger && <Menu isOpen={isOpen} setIsOpen={setIsOpen} user={user} />}

      {mounted && createPortal(
        <AnimacionLogoTrifinio isOpen={isFullScreen} onClose={() => setIsFullScreen(false)} />,
        document.body
      )}
    </>
  );
}
