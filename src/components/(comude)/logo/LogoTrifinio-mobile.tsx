"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import Image from "next/image";
import AnimacionLogoTrifinio from "./AnimacionLogoTrifinio";
import { useDynamicTitle } from "@/components/(base)/layout/useDynamicTitle";
import { cn } from "@/lib/utils";

interface LogoTrifinioMobileProps {
  backgroundEffect?: "blur" | "glow" | "none";
  forceAzulColors?: boolean;
}

export default function LogoTrifinioMobile({
  backgroundEffect = "blur",
  forceAzulColors = false,
}: LogoTrifinioMobileProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dynamicTitle = useDynamicTitle();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullScreen(true);
  };

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.8, rotate: -5 },
    visible: {
      opacity: 1, scale: 1, rotate: 0,
      transition: { type: "spring" as const, stiffness: 50, damping: 16, duration: 2.4 },
    },
  };

  const textContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.05 },
    },
  };

  const titleVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1, x: 0,
      transition: { type: "spring" as const, stiffness: 40, damping: 18, duration: 1.3 },
    },
  };

  const sloganVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1, y: 0,
      transition: { type: "spring" as const, stiffness: 50, damping: 16, duration: 1.1 },
    },
  };

  const lineVariants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: 1,
      transition: { duration: 1.2, ease: "easeInOut" as const },
    },
  };

  const countriesVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.3, ease: "easeOut" as const },
    },
  };

  const textClass = cn("text-azul-trifinio antialiased");
  const lineClass = cn("bg-azul-trifinio");
  const blurBgClass =
    "bg-white/55 backdrop-blur-md border border-white/50 transform-gpu [backface-visibility:hidden] [transform:translateZ(0)]";

  return (
    <>
      <motion.div
        onClick={handleClick}
        whileTap={{ scale: 0.96 }}
        className="relative select-none cursor-pointer flex items-center justify-center p-2 w-[95%] mx-auto rounded-2xl overflow-hidden"
        initial="hidden"
        animate="visible"
      >
        {backgroundEffect === "blur" && (
          <div className={cn("absolute inset-0 -z-10 shadow-xl rounded-2xl", blurBgClass)} />
        )}

        {backgroundEffect === "glow" && (
          <div className="absolute inset-x-[-20%] inset-y-[-10%] bg-white/50 dark:bg-transparent blur-[60px] -z-10 rounded-[100px]" />
        )}

        <div className="flex flex-row items-center justify-between gap-2 sm:gap-6 w-full px-2 sm:px-6">
          <motion.div variants={logoVariants} className="flex-shrink-0 overflow-hidden rounded-2xl shadow-sm">
            <Image
              src="/sote/logo.png"
              alt="COMUDE Concepción Las Minas"
              width={150}
              height={150}
              className="w-[90px] sm:w-[110px] h-auto object-contain rounded-2xl"
              priority
            />
          </motion.div>

          <motion.div
            variants={textContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center text-center py-2 relative flex-grow"
          >
            <motion.h1
              variants={titleVariants}
              className={cn("font-black leading-[1] whitespace-nowrap", textClass)}
              style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(0.85rem, 4vw, 3rem)" }}
            >
              Sistema de Organización<br />Territorial Estratégica
            </motion.h1>

            <motion.div
              variants={lineVariants}
              className={cn("w-[105%] h-[1px] sm:h-[2px] mt-2 origin-center", lineClass)}
            />

            <motion.p
              variants={sloganVariants}
              className={cn("font-bold italic mt-2 leading-tight", textClass)}
              style={{ fontFamily: "Arial, sans-serif", fontSize: "clamp(0.6rem, 2.5vw, 2.2rem)" }}
            >
              {dynamicTitle}
            </motion.p>
          </motion.div>
        </div>
      </motion.div>

      {mounted && createPortal(
        <AnimacionLogoTrifinio isOpen={isFullScreen} onClose={() => setIsFullScreen(false)} />,
        document.body
      )}
    </>
  );
}
