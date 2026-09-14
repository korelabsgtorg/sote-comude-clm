"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import Image from "next/image";
import AnimacionLogoTrifinio from "./AnimacionLogoTrifinio";
import { useDynamicTitle } from "@/components/(base)/layout/useDynamicTitle";
import { cn } from "@/lib/utils";

interface LogoTrifinioProps {
  scale?: number;
  noAnimation?: boolean;
  refreshInterval?: number;
  backgroundEffect?: "blur" | "glow" | "none";
  forceAzulColors?: boolean;
}

export default function LogoTrifinio({
  scale: scaleValue = 1,
  noAnimation = false,
  refreshInterval = 0,
  backgroundEffect = "blur",
  forceAzulColors = false,
}: LogoTrifinioProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dynamicTitle = useDynamicTitle();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleHover = () => {
    if (!noAnimation && !isFullScreen) {
      setAnimationKey(prev => prev + 1);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!noAnimation) {
      setIsFullScreen(true);
    }
  };

  const repeatConfig = refreshInterval > 0 && !isFullScreen ? {
    repeat: Infinity,
    repeatDelay: refreshInterval,
    repeatType: "loop" as const
  } : {};

  const textContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.05 },
    },
  };

  const logoVariants = {
    hidden: { opacity: 0, scale: 0.8, rotate: -5 },
    visible: {
      opacity: 1, scale: 1, rotate: 0,
      transition: { type: "spring" as const, stiffness: 50, damping: 16, duration: 2.4 },
    },
  };

  const titleVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1, x: 0,
      transition: { type: "spring" as const, stiffness: 40, damping: 18, duration: 1.3, ...repeatConfig },
    },
  };

  const sloganVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1, y: 0,
      transition: { type: "spring" as const, stiffness: 50, damping: 16, duration: 1.1, ...repeatConfig },
    },
  };

  const lineVariants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: 1,
      transition: { duration: 1.2, ease: "easeInOut" as const, ...repeatConfig },
    },
  };

  const countriesVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.3, ease: "easeOut" as const, ...repeatConfig },
    },
  };

  const textClass = cn("text-azul-trifinio");
  const lineClass = cn("bg-azul-trifinio");
  const blurBgClass = forceAzulColors
    ? "bg-white/55 backdrop-blur-md border border-white/50"
    : "bg-white/55 backdrop-blur-md border border-white/50";

  return (
    <>
      <motion.div
        onMouseEnter={handleHover}
        onClick={handleClick}
        whileTap={{ scale: 0.96 }}
        className="relative select-none cursor-pointer flex items-center justify-center p-2 sm:px-4 w-full sm:w-fit mx-auto"
        style={{ scale: scaleValue }}
        initial="hidden"
        animate="visible"
      >
        {backgroundEffect === "blur" && (
          <div className={cn("absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] -z-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]", blurBgClass)} />
        )}
        
        {backgroundEffect === "glow" && (
          <div className="absolute inset-x-[-20%] inset-y-[-10%] bg-white/50 dark:bg-transparent blur-[60px] -z-10 rounded-[100px]" />
        )}

        <div className="flex flex-row items-center justify-center sm:justify-start gap-6 lg:gap-8 w-fit px-4 lg:px-8">
          <motion.div variants={logoVariants} className="flex-shrink-0">
            <Image
              src="/sote/logo.png"
              alt="COMUDE Concepción Las Minas"
              width={150}
              height={150}
              className="w-[120px] lg:w-[150px] h-auto object-contain"
              priority
            />
          </motion.div>

          <motion.div
            key={animationKey}
            variants={textContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center sm:items-start justify-center text-center sm:text-left py-2 relative"
          >
            <motion.h1
              variants={titleVariants}
              className={cn("font-black leading-[1.1]", textClass)}
              style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(1.2rem, 2vw, 1.8rem)" }}
            >
              Sistema de Organización<br />Territorial Estratégica
            </motion.h1>

            <motion.div
              variants={lineVariants}
              className={cn("w-full h-[2px] mt-2 origin-left", lineClass)}
            />

            <motion.p
              variants={sloganVariants}
              className={cn("font-bold italic mt-2 leading-tight", textClass)}
              style={{ fontFamily: "Arial, sans-serif", fontSize: "clamp(0.85rem, 1.2vw, 1.1rem)" }}
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
