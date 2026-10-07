"use client";

import { useEffect } from "react";

export function notifyActividadPendienteRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("actividad-pendiente-refresh"));
    try {
      const bc = new BroadcastChannel("sote_push_channel");
      bc.postMessage({ type: "ACTIVIDAD_PENDIENTE_REFRESH" });
      bc.close();
    } catch (e) {
      // Ignorar si BroadcastChannel no es soportado
    }
  }
}

export function PushListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const triggerRefresh = () => {
      window.dispatchEvent(new CustomEvent("actividad-pendiente-refresh"));
    };

    // 1. Escuchar Service Worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "ACTIVIDAD_PENDIENTE_REFRESH" ||
        event.data?.type === "PUSH_NOTIFICATION_RECEIVED" ||
        event.data?.action === "REFRESH_ACTVIDADES"
      ) {
        triggerRefresh();
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    }

    // 2. Escuchar BroadcastChannel (comunicación instantánea entre pestañas abiertas)
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("sote_push_channel");
      bc.onmessage = (event) => {
        if (event.data?.type === "ACTIVIDAD_PENDIENTE_REFRESH") {
          triggerRefresh();
        }
      };
    } catch (e) {
      // BroadcastChannel no soportado
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      }
      if (bc) {
        bc.close();
      }
    };
  }, []);

  return null;
}
