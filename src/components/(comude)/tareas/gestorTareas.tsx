import { obtenerDatosGestor } from './lib/actions';
import TareaList from './TareaList'; 
import { TipoVistaTareas } from './lib/zod';

interface Props {
  tipoVista: TipoVistaTareas;
}

export default async function GestorTareas({ tipoVista }: Props) {
  const datos = await obtenerDatosGestor(tipoVista);

  if (!datos) return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800 shadow-sm text-center font-medium">
            No se pudo cargar la información o no tienes permisos.
        </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="w-full">
        <TareaList
          initialData={datos}
          tipoVista={tipoVista}
        />
      </div>
    </div>
  );
}