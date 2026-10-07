"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useDynamicTitle } from "@/components/(base)/layout/useDynamicTitle";

interface AnimacionLogoTrifinioProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnimacionLogoTrifinio({ isOpen, onClose }: AnimacionLogoTrifinioProps) {
  const dynamicTitle = useDynamicTitle();

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="fullscreen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/35 dark:bg-black/45 backdrop-blur-[12px] cursor-pointer p-4 lg:p-12 overflow-hidden"
          style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
        >
          <motion.div
            initial={{ scale: 1.15, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full h-full flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto relative flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-10 w-fit p-6 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[2.5rem] bg-white/80 dark:bg-white/85 backdrop-blur-xl border border-white/70 shadow-[0_25px_60px_rgba(0,0,0,0.2)] max-w-full transform-gpu [backface-visibility:hidden] [transform:translateZ(0)]">
              <motion.div
                initial={{ opacity: 0, scale: 0.88, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="flex-shrink-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-sm transform-gpu [backface-visibility:hidden] [transform:translateZ(0)]"
              >
                <Image
                  src="/sote/logo.png"
                  alt="SOTE"
                  width={250}
                  height={250}
                  className="w-[120px] sm:w-[160px] lg:w-[220px] h-auto object-contain rounded-2xl sm:rounded-3xl"
                  priority
                />
              </motion.div>

              <div className="flex flex-col items-center sm:items-start justify-center text-center sm:text-left py-2 relative shrink-0 max-w-full transform-gpu [backface-visibility:hidden] [transform:translateZ(0)]">
                <motion.h1
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="font-black text-azul-trifinio leading-[1.05] whitespace-nowrap antialiased"
                  style={{
                    fontFamily: "'Arial Black', sans-serif",
                    fontSize: "clamp(1.2rem, 3.5vw, 3.2rem)",
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                    transform: "translateZ(0)",
                  }}
                >
                  Sistema de Organización<br />Territorial Estratégica
                </motion.h1>

                <div className="flex flex-col items-center sm:items-start w-full">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="w-full h-[2px] sm:h-[3px] mt-2.5 bg-azul-trifinio origin-left transform-gpu [transform:translateZ(0)]"
                  />

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="text-azul-trifinio font-bold italic mt-2 sm:mt-2.5 px-0 antialiased"
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontSize: "clamp(0.85rem, 1.8vw, 1.8rem)",
                      WebkitFontSmoothing: "antialiased",
                      MozOsxFontSmoothing: "grayscale",
                      transform: "translateZ(0)",
                    }}
                  >
                    {dynamicTitle}
                  </motion.p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80 dark:text-white/60 text-[11px] font-black tracking-[0.4em] uppercase pointer-events-none drop-shadow-md">
            Click en cualquier lugar para cerrar
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
