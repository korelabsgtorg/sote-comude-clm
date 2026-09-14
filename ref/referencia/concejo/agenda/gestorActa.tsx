'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, UploadCloud, FileText, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import '@/components/files/pdf-config'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

interface GestorActaProps {
  agendaId: string
  currentActaPath: string | null | undefined
  rol: string
  estadoAgenda: string
  onUpdate: (path: string | null) => void
}

export default function GestorActa({ agendaId, currentActaPath, rol, estadoAgenda, onUpdate }: GestorActaProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [loadingPdf, setLoadingPdf] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const puedeEditar = ['SUPER', 'SECRETARIO', 'SEC-TECNICO'].includes(rol)

  useEffect(() => {
    const esActaValida = typeof currentActaPath === 'string' && currentActaPath.toLowerCase().includes('.pdf');

    if (esActaValida) {
      const fetchUrl = async () => {
        setLoadingPdf(true)
        const { data, error } = await supabase.storage
          .from('actas')
          .createSignedUrl(currentActaPath as string, 3600)

        if (error || !data?.signedUrl) {
          console.error(error)
          toast.error('No se pudo cargar el documento')
        } else {
          setPdfUrl(data.signedUrl)
        }
        setLoadingPdf(false)
      }
      fetchUrl()
    } else {
      setPdfUrl(null)
    }
  }, [currentActaPath, supabase])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (selected.type !== 'application/pdf') return toast.warning('Solo PDF')
      setFile(selected)
    }
  }

  const subirActa = async () => {
    if (!file) return
    setIsUploading(true)

    try {
      const fileExt = 'pdf'
      const filePath = `${agendaId}/acta_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('actas').upload(filePath, file)
      if (uploadError) throw uploadError

      const { error: dbError } = await supabase
        .from('agenda_concejo')
        .update({ acta: filePath })
        .eq('id', agendaId)

      if (dbError) throw dbError

      toast.success('Acta subida con éxito')
      setFile(null)
      onUpdate(filePath)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Error al subir el acta')
    } finally {
      setIsUploading(false)
    }
  }

  const eliminarActa = async () => {
    if (!currentActaPath) return

    const result = await Swal.fire({
      title: '¿Eliminar Acta?',
      text: "El archivo se borrará permanentemente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    try {
      await supabase.storage.from('actas').remove([currentActaPath])
      
      const { error: dbError } = await supabase
        .from('agenda_concejo')
        .update({ acta: null })
        .eq('id', agendaId)

      if (dbError) throw dbError

      toast.success('Acta eliminada')
      setPdfUrl(null)
      onUpdate(null)
      router.refresh()
    } catch (error) {
      toast.error('Error eliminando acta')
    }
  }

  const hayActaValida = typeof currentActaPath === 'string' && currentActaPath.toLowerCase().includes('.pdf');

  if (!hayActaValida) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 min-h-[400px]">
        {puedeEditar ? (
          !file ? (
            <label className="flex flex-col items-center justify-center w-full max-w-lg h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-neutral-800 border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-12 h-12 mb-4 text-gray-400" />
                <p className="mb-2 text-lg text-gray-500 dark:text-gray-400 font-semibold">Subir Acta de Sesión</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Formato PDF (Máx. 50MB)</p>
              </div>
              <input type="file" className="hidden" onChange={handleFileChange} accept="application/pdf" />
            </label>
          ) : (
            <div className="w-full max-w-lg p-6 border rounded-lg bg-white dark:bg-neutral-800 shadow-sm text-center">
              <div className="flex flex-col items-center gap-4 mb-6">
                 <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
                    <FileText className="w-8 h-8 text-red-500" />
                 </div>
                 <span className="text-sm font-medium text-gray-700 dark:text-gray-300 break-all">{file.name}</span>
              </div>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setFile(null)} 
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={subirActa} 
                  disabled={isUploading}
                  className="px-6 py-2 text-sm font-bold text-white bg-black dark:bg-white dark:text-black rounded-md flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUploading ? 'Subiendo...' : 'Confirmar Subida'}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-gray-400 italic">No hay acta disponible.</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 shadow-sm shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2">
           <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-30">
             <ChevronLeft size={20} />
           </button>
           <span className="text-sm font-mono mx-2 min-w-[60px] text-center">
             {pageNumber} / {numPages || '-'}
           </span>
           <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded disabled:opacity-30">
             <ChevronRight size={20} />
           </button>
           <div className="h-4 w-px bg-gray-300 mx-2" />
           <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
             <ZoomOut size={18} />
           </button>
           <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
             <ZoomIn size={18} />
           </button>
        </div>

        {puedeEditar && (
          <button 
            onClick={eliminarActa}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
          >
            <Trash2 size={14} />
            <span>Eliminar Acta</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto flex justify-center p-4 md:p-8">
        {loadingPdf ? (
           <div className="self-center flex flex-col items-center gap-2">
             <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
             <span className="text-sm text-gray-500">Cargando documento...</span>
           </div>
        ) : pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="mt-10"><Loader2 className="animate-spin text-gray-400" /></div>}
            error={<div className="mt-10 text-red-500">Error al cargar PDF</div>}
            className="shadow-lg"
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              renderTextLayer={false} 
              renderAnnotationLayer={false}
              className="bg-white"
            />
          </Document>
        ) : (
          <div className="mt-10 text-gray-400">Preparando visualización...</div>
        )}
      </div>
    </div>
  )
}