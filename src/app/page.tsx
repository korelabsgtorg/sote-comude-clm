"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/(base)/providers/UserProvider";
import { Suspense } from "react";
import LoginForm from "@/components/(base)/(auth)/login/LogIn";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/comude");
    }
  }, [user, router]);

  if (user) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-azul-trifinio" />
      </div>
    );
  }

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
