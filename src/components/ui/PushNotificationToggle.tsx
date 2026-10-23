'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import { urlBase64ToUint8Array } from '@/utils/vapid'
import { Bell, BellOff, Loader2, Check } from 'lucide-react'
import { useUser } from '@/components/(base)/providers/UserProvider'
import { useTheme } from 'next-themes'

export function PushNotificationToggle({ className }: { className?: string }) {
  const user = useUser()
  const userId = user?.id
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const { theme } = useTheme()
  const supabase = useMemo(() => createClient(), [])

  const isDark = theme === 'dark'

  useEffect(() => {
    let isMounted = true

    const checkStatus = async () => {
      if (!userId || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        if (isMounted) setIsInitializing(false)
        return
      }

      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (!isMounted) return

        if (reg) {
          const sub = await reg.pushManager.getSubscription()
          if (!isMounted) return

          if (sub) {
            const subJson = JSON.parse(JSON.stringify(sub))
            const { data } = await supabase
              .from('push_subscriptions')
              .select('id')
              .match({ user_id: userId, endpoint: subJson.endpoint })
              .maybeSingle()

            if (!isMounted) return
            if (data) {
              setIsSubscribed(true)
            } else {
              await sub.unsubscribe().catch(() => {})
              setIsSubscribed(false)
            }
          } else {
            setIsSubscribed(false)
          }
        } else {
          setIsSubscribed(false)
        }
      } catch (e) {
        console.error("Error checking push status:", e)
      } finally {
        if (isMounted) setIsInitializing(false)
      }
    }

    checkStatus()

    return () => {
      isMounted = false
    }
  }, [userId, supabase])

  const handleToggle = async () => {
    if (!userId) return
    setLoading(true)
    try {
      if (!('serviceWorker' in navigator)) {
        alert("Tu navegador no soporta notificaciones push.")
        return
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          alert("Debes permitir las notificaciones para poder recibirlas.")
          return
        }
      }

      console.log("Iniciando registro de Service Worker...")
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await reg.update()
      
      const registration = await navigator.serviceWorker.ready
      console.log("Service Worker está listo.")

      if (isSubscribed) {
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          const subscriptionJson = JSON.parse(JSON.stringify(subscription))
          
          await supabase.from('push_subscriptions')
            .delete()
            .match({ user_id: userId, endpoint: subscriptionJson.endpoint })

          await subscription.unsubscribe()
        }
        setIsSubscribed(false)
      } else {
        const rawVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!rawVapidKey) throw new Error("VAPID public key not found")
        
        const vapidKey = rawVapidKey.replace(/^["']|["']$/g, '')
        
        console.log("Suscribiendo al usuario...")
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        })

        const subscriptionJson = JSON.parse(JSON.stringify(sub))
        console.log("Suscripción generada con éxito.")

        const { error } = await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys.p256dh,
          auth: subscriptionJson.keys.auth
        }, { onConflict: 'endpoint' })

        if (error) throw error

        setIsSubscribed(true)
      }
    } catch (error: any) {
      console.error("Detalles del fallo en Push:", error)
      alert(`Error: ${error.message || "Fallo al activar notificaciones"}`)
    } finally {
      setLoading(false)
    }
  }

  if (!userId) return null;

  if (isInitializing) {
    return (
      <div 
        className={cn("size-7 md:size-6 shrink-0 flex items-center justify-center", className)}
      />
    )
  }

  const activeBellClassName =
    "text-yellow-500 fill-yellow-500 dark:text-yellow-400 dark:fill-yellow-400";
  const inactiveBellClassName =
    "text-azul-trifinio/80 hover:text-azul-trifinio dark:text-white/80 dark:hover:text-white group-hover/bell:text-yellow-500 dark:group-hover/bell:text-yellow-400";

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "group/bell size-7 md:size-6 flex shrink-0 items-center justify-center cursor-pointer transition-all duration-300 active:scale-95 bg-transparent",
        className,
      )}
      title={isSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
    >
      {loading ? (
        <Loader2 className="animate-spin" style={{ width: '22px', height: '22px', color: '#2563EB' }} />
      ) : isSubscribed ? (
        <div style={{ position: 'relative', display: 'flex' }}>
          <Bell
            strokeWidth={2}
            className={cn(
              "size-7 md:size-6 transition-transform duration-500 ease-out group-hover/bell:scale-110 group-hover/bell:-rotate-12",
              activeBellClassName,
            )}
          />
          <div style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '12px',
            height: '12px',
            backgroundColor: '#22c55e',
            border: isDark ? '2px solid #000000' : '2px solid #ffffff',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Check strokeWidth={4} style={{ width: '7px', height: '7px', color: '#ffffff' }} />
          </div>
        </div>
      ) : (
        <BellOff
          strokeWidth={2}
          className={cn(
            "size-7 md:size-6 transition-all duration-500 ease-out group-hover/bell:scale-110 group-hover/bell:-rotate-12",
            inactiveBellClassName,
          )}
        />
      )}
    </button>
  )
}
