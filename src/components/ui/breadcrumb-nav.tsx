"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowLeft, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useUser } from "@/components/(base)/providers/UserProvider";

import { cn } from "@/lib/utils";

const crumbIconLink =
  "group flex items-center justify-center text-foreground hover:text-celeste-trifinio dark:text-white dark:hover:text-celeste-trifinio transition-colors duration-300 cursor-pointer active:scale-95";

const crumbPanelLink =
  "group flex items-center text-foreground hover:text-celeste-trifinio dark:text-white dark:hover:text-celeste-trifinio transition-colors duration-300 cursor-pointer active:scale-95 p-1 shrink-0";

const crumbTextLink =
  "capitalize text-foreground hover:text-celeste-trifinio dark:text-white dark:hover:text-celeste-trifinio transition-all duration-300 truncate group/link hover:underline underline-offset-4";

const crumbActive =
  "text-celeste-trifinio";

const iconMotion =
  "transition-transform duration-500 ease-out group-hover:scale-125";

export function BreadcrumbNav() {
  const pathname = usePathname();
  const user = useUser();

  if (pathname === "/") {
    if (!user) return null; // invitado: sin breadcrumb (Iniciar Sesión en header)

    return (
      <LayoutGroup id="breadcrumb">
        <motion.div
          layout
          className="flex items-center gap-2 text-[9px] md:text-base font-medium text-muted-foreground overflow-hidden md:pt-1"
        >
          <motion.div layout="position">
            <Link
              href="/comude"
              className={cn(crumbPanelLink, "gap-2")}
              title="Ir al panel"
            >
              <LayoutDashboard className={cn("size-4 md:size-5 shrink-0", iconMotion, "group-hover:translate-x-0.5")} />
              <span className="text-sm font-bold transition-transform duration-500 ease-out group-hover:translate-x-0.5">
                Ir al Panel
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </LayoutGroup>
    );
  }

  if (pathname === "/comude") {
    return (
      <LayoutGroup id="breadcrumb">
        <motion.div
          layout
          className="flex items-center gap-2 text-[9px] md:text-base font-medium text-muted-foreground overflow-hidden md:pt-1"
        >


          <motion.div layout="position" className="flex items-center">
            <span
              className={cn(crumbActive, "p-1 shrink-0 flex items-center")}
              title="Panel"
            >
              <LayoutDashboard className="size-4 md:size-5" />
            </span>
          </motion.div>
        </motion.div>
      </LayoutGroup>
    );
  }

  const rawSegments = pathname.split("/").filter((item) => item !== "");
  const uuidRegex = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  
  const segments = rawSegments.filter(seg => {
    const withoutUuid = seg.replace(uuidRegex, "").replace(/^-/, "");
    // Si era un UUID puro sin título detrás, se filtra
    return !uuidRegex.test(seg) || withoutUuid.length > 0;
  });

  let parentPath =
    rawSegments.length > 1 ? `/${rawSegments.slice(0, -1).join("/")}` : "/comude";

  if (parentPath === "/comude/comude") {
    parentPath = "/comude";
  }

  return (
    <LayoutGroup id="breadcrumb">
      <motion.div
        layout
        className="flex items-center gap-2 text-[9px] md:text-base font-medium text-muted-foreground overflow-hidden md:pt-1"
      >
        <motion.div layout="position">
          <Link
            href={parentPath}
            className={cn(crumbIconLink, "mr-1")}
            title="Atrás"
          >
            <ArrowLeft className={cn("size-4 md:size-5", iconMotion, "group-hover:-translate-x-1")} />
          </Link>
        </motion.div>

        <motion.div layout="position" className="flex items-center">
          <Link
            href="/comude"
            className={crumbPanelLink}
            title="Ir al panel"
          >
            <LayoutDashboard className={cn("size-4 md:size-5", iconMotion)} />
          </Link>
        </motion.div>

        <div className="flex items-center gap-1 overflow-hidden mask-gradient">
          <AnimatePresence mode="popLayout" initial={false}>
            {segments.map((segment, index) => {
              if (segment === "comude") return null;

              const href = `/${rawSegments.slice(0, index + 1).join("/")}`;
              const isLast = index === segments.length - 1;
              const displayLabel = segment.replace(uuidRegex, "").replace(/^-/, "").replace(/-/g, " ");

              return (
                <motion.div
                  layout="position"
                  key={href}
                  initial={{ opacity: 0, x: 10, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    transition: { duration: 0.15 },
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 25,
                    mass: 1,
                  }}
                  className="flex items-center gap-1 shrink-0 group/segment min-w-0"
                >
                  <ChevronRight className="size-4 md:size-5 text-muted-foreground/40 shrink-0 transition-all duration-300 group-hover/segment:text-celeste-trifinio group-hover/segment:translate-x-0.5" />
                  <Link
                    href={href}
                    title={displayLabel}
                    className={cn(
                      isLast
                        ? cn(
                            crumbActive,
                            "capitalize underline underline-offset-4 pointer-events-none text-xs md:text-lg truncate max-w-[210px] sm:max-w-[340px] md:max-w-[480px] lg:max-w-none block"
                          )
                        : cn(crumbTextLink, "truncate max-w-[140px] sm:max-w-[220px] md:max-w-none block"),
                    )}
                  >
                    {displayLabel}
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </LayoutGroup>
  );
}
