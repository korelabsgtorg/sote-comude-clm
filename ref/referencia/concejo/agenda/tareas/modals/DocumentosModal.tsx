'use client'

import { useState } from 'react'
import { Tarea } from '@/components/concejo/agenda/lib/esquemas'
import UploadPDF from '@/components/files/uploadPDF'
import ListPDF from '@/components/files/listPDF'
import {
  ModalCancel,
  ModalFooter,
  ModalLabel,
  ModalShell,
} from '@/components/ui/general-modal'

interface DocumentosModalProps {
  isOpen: boolean
  onClose: () => void
  tarea: Tarea
  rol: string
  estadoAgenda: string
}

export default function DocumentosModal({ isOpen, onClose, tarea, rol, estadoAgenda }: DocumentosModalProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  const puedeSubir = ['SUPER', 'SECRETARIO', 'SEC-TECNICO'].includes(rol) && estadoAgenda !== 'Finalizada'

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="Documentos adjuntos"
      subtitle={tarea.titulo_item}
      footer={
        <ModalFooter>
          <ModalCancel onClick={onClose}>Cerrar</ModalCancel>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-6">
        {puedeSubir && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-600 dark:bg-zinc-900/50">
            <ModalLabel className="mb-3">Subir nuevo documento</ModalLabel>
            <UploadPDF
              bucketName="archivos_tareas"
              tableName="archivos_tareas"
              referenceId={tarea.id}
              referenceColumn="tarea_id"
              onUploadComplete={() => setRefreshKey((prev) => prev + 1)}
            />
          </div>
        )}

        <ListPDF
          bucketName="archivos_tareas"
          tableName="archivos_tareas"
          referenceId={tarea.id}
          referenceColumn="tarea_id"
          refreshTrigger={refreshKey}
          rol={rol}
        />
      </div>
    </ModalShell>
  )
}
