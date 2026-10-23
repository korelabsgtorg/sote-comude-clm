"use client";

import { useSignedUrl } from "./lib/hooks";
import { ImagePlus } from "lucide-react";

export default function StorageImage({ path }: { path: string }) {
  const { data: url, isLoading } = useSignedUrl(path);

  if (isLoading) return <div className="w-full h-full bg-muted animate-pulse rounded-lg" />;
  if (!url) {
    return (
      <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
        <ImagePlus className="w-6 h-6 opacity-30" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="Evidencia"
      className="w-full h-full object-contain rounded-lg transition-transform duration-500"
    />
  );
}
