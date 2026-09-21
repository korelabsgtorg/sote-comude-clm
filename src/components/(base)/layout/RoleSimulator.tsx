"use client";

import { useUserContext } from "@/components/(base)/providers/UserProvider";

export function RoleSimulator() {
  const { simulatedRole, setSimulatedRole, realRole } = useUserContext();

  return (
    <div className="fixed top-1/2 -translate-y-1/2 right-0 z-[9999] flex items-center group">
      <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-r-0 border-white/20 rounded-l-xl px-2 py-1.5 flex flex-col gap-1 transition-transform duration-500 translate-x-full group-hover:translate-x-0 cursor-pointer">
        <span className="text-[8px] text-foreground/40 tracking-widest font-mono uppercase leading-none">Rol</span>
        <select 
          className="bg-transparent text-foreground font-bold outline-none cursor-pointer text-xs leading-none"
          value={simulatedRole || ""}
          onChange={(e) => setSimulatedRole(e.target.value || null)}
        >
          <option value="">{realRole}</option>
          <option value="super">SUPER ADMIN</option>
          <option value="admin">ADMINISTRADOR</option>
          <option value="cocode">COMUDE</option>
          <option value="institucion">INSTITUCCIÓN</option>
        </select>
      </div>
      <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md px-1 py-1.5 rounded-l-lg border border-r-0 border-white/20 cursor-pointer transition-opacity duration-300 group-hover:opacity-0 group-hover:pointer-events-none">
        <span className="text-[9px] font-bold text-foreground/60" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>ROL</span>
      </div>
    </div>
  );
}
