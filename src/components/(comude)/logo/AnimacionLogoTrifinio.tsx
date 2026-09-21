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
          onClick={onClose}
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-white/70 dark:bg-background/80 backdrop-blur-[20px] cursor-pointer p-4 lg:p-12 overflow-hidden"
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        >
          <motion.div
            initial={{ scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 lg:gap-8 w-fit px-4 sm:px-8 max-w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 50, damping: 16, duration: 2.4 }}
                className="flex-shrink-0 overflow-hidden rounded-2xl sm:rounded-3xl shadow-sm"
              >
                <Image
                  src="/sote/logo.png"
                  alt="SOTE"
                  width={250}
                  height={250}
                  className="w-[120px] lg:w-[250px] h-auto object-contain rounded-2xl sm:rounded-3xl"
                  priority
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.12, delayChildren: 0.05 }}
                className="flex flex-col items-center justify-center text-center py-2 relative shrink-0 max-w-full"
              >
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 40, damping: 18, duration: 1.3 }}
                  className="font-black text-azul-trifinio dark:text-white leading-[1] whitespace-nowrap"
                  style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(1.1rem, 4vw, 4rem)" }}
                >
                  Sistema de Organización<br />Territorial Estratégica
                </motion.h1>

                <div className="flex flex-col items-center w-[105%]">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    className="w-full h-[2px] mt-2 bg-azul-trifinio dark:bg-white origin-center"
                  />

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 50, damping: 16, duration: 1.1 }}
                    className="text-[#053154] dark:text-blue-100 font-bold italic mt-1 sm:mt-2 xl:mt-3 px-4 drop-shadow-md z-10 relative"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: "clamp(0.6rem, 2vw, 2.5rem)" }}
                  >
                    {dynamicTitle}
                  </motion.p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-azul-trifinio/60 dark:text-white/40 text-[10px] font-black tracking-[0.5em] uppercase pointer-events-none animate-bounce">
            Click en cualquier lugar para cerrar
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
