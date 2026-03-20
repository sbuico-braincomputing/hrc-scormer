"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type Trainer = {
  name: string
  role: string
  company: string
}

export type Module = {
  title: string
  description: string
  videoUrl: string
  thumbnailUrl?: string
  videoDocumentId?: string
  videoSearch: string
  selectedDocumentId?: string
  /** Snapshot UI quando il documento non è nell’elenco globale né nei risultati di ricerca */
  selectedDocumentTitle?: string
  selectedDocumentFilename?: string
  documentSearch: string
  trainers: Trainer[]
}

export type DocumentRef = {
  id: string
  title?: string | null
  name?: string | null
  filename?: string | null
}

export type CourseForModules = {
  company: string
  // Altri campi del corso possono essere presenti ma non sono necessari qui
  [key: string]: unknown
}

export function getVideoThumbnail(url: string): string | undefined {
  try {
    const parsed = new URL(url)

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      let videoId = ""

      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "")
      } else {
        videoId = parsed.searchParams.get("v") ?? ""
      }

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

export function getDocumentTitle(doc: DocumentRef): string {
  return (doc.title ?? doc.name ?? "").trim()
}

export function getDocumentFilename(doc: DocumentRef): string {
  return (doc.filename ?? "").trim()
}

export function isVideoDocument(doc: DocumentRef): boolean {
  const filename = getDocumentFilename(doc).toLowerCase()
  const title = (doc.title ?? "").toLowerCase()
  const name = (doc.name ?? "").toLowerCase()

  const haystack = `${filename} ${title} ${name}`.trim()
  if (!haystack) return false

  return (
    haystack.includes("youtube.com") ||
    haystack.includes("youtu.be") ||
    haystack.includes("vimeo.com")
  )
}

type CourseModuleCardProps = {
  course: CourseForModules
  module: Module
  index: number
  documents: DocumentRef[]
  isLoadingDocuments: boolean
  documentsError: string | null
  onChange: (updater: (current: Module) => Module) => void
  onUpdateVideoFromDocument: (doc: DocumentRef) => void | Promise<void>
}

function CourseModuleCard({
  course,
  module,
  index,
  documents,
  isLoadingDocuments,
  documentsError,
  onChange,
  onUpdateVideoFromDocument,
}: CourseModuleCardProps) {
  const [videoResults, setVideoResults] = useState<DocumentRef[]>([])
  const [isSearchingVideos, setIsSearchingVideos] = useState(false)
  const [videoSearchError, setVideoSearchError] = useState<string | null>(null)
  const [documentResults, setDocumentResults] = useState<DocumentRef[]>([])
  const [isSearchingDocuments, setIsSearchingDocuments] = useState(false)
  const [documentSearchError, setDocumentSearchError] = useState<string | null>(
    null,
  )

  const selectedDocument = useMemo((): DocumentRef | undefined => {
    const id = module.selectedDocumentId
    if (!id) return undefined

    const fromDocuments = documents.find((doc) => doc.id === id)
    if (fromDocuments) return fromDocuments

    const fromResults = documentResults.find((doc) => doc.id === id)
    if (fromResults) return fromResults

    const title = module.selectedDocumentTitle?.trim()
    const filename = module.selectedDocumentFilename?.trim()
    if (title || filename) {
      return {
        id,
        title: title || null,
        name: null,
        filename: filename || null,
      }
    }

    return { id, title: null, name: null, filename: null }
  }, [
    documents,
    documentResults,
    module.selectedDocumentId,
    module.selectedDocumentTitle,
    module.selectedDocumentFilename,
  ])

  /** In ricerca, mantieni in lista il documento già scelto anche se la nuova query non lo include */
  const documentResultsWithSelection = useMemo(() => {
    const id = module.selectedDocumentId
    if (!id || !selectedDocument) return documentResults
    if (documentResults.some((doc) => doc.id === id)) return documentResults
    return [selectedDocument, ...documentResults]
  }, [documentResults, module.selectedDocumentId, selectedDocument])

  const visibleDocumentResults = documentResultsWithSelection.slice(0, 8)

  const selectedVideoFromDocuments = documents.find(
    (doc) => doc.id === module.videoDocumentId,
  )

  const selectedVideoFromResults = videoResults.find(
    (doc) => doc.id === module.videoDocumentId,
  )

  const selectedVideoDocument = selectedVideoFromDocuments || selectedVideoFromResults

  const visibleVideoDocuments = videoResults.slice(0, 8)

  useEffect(() => {
    let aborted = false

    const term = module.videoSearch.trim()
    if (!term) {
      setVideoResults([])
      setVideoSearchError(null)
      setIsSearchingVideos(false)
      return
    }

    async function searchVideos() {
      try {
        setIsSearchingVideos(true)
        setVideoSearchError(null)

        const params = new URLSearchParams()
        params.set("limit", "20")
        params.set("type", "video")
        params.set("q", term)

        const res = await fetch(`/api/documents?${params.toString()}`)
        if (!res.ok) {
          throw new Error("Impossibile cercare i video")
        }

        const data = (await res.json()) as DocumentRef[]
        if (!aborted) {
          setVideoResults(data.filter(isVideoDocument))
        }
      } catch (err) {
        console.error("Error searching video documents", err)
        if (!aborted) {
          setVideoSearchError(
            err instanceof Error
              ? err.message
              : "Errore nel caricamento dei video",
          )
          setVideoResults([])
        }
      } finally {
        if (!aborted) {
          setIsSearchingVideos(false)
        }
      }
    }

    const timeoutId = window.setTimeout(searchVideos, 300)

    return () => {
      aborted = true
      window.clearTimeout(timeoutId)
    }
  }, [module.videoSearch])

  useEffect(() => {
    const term = module.documentSearch.trim()
    if (!term) {
      setDocumentSearchError(null)
      setIsSearchingDocuments(false)
      return
    }

    let aborted = false

    async function searchDocuments() {
      try {
        setIsSearchingDocuments(true)
        setDocumentSearchError(null)

        const params = new URLSearchParams()
        params.set("limit", "20")
        params.set("type", "doc")
        params.set("q", term)

        const res = await fetch(`/api/documents?${params.toString()}`)
        if (!res.ok) {
          throw new Error("Impossibile cercare i documenti")
        }

        const data = (await res.json()) as DocumentRef[]
        if (!aborted) {
          setDocumentResults(data)
        }
      } catch (err) {
        console.error("Error searching documents", err)
        if (!aborted) {
          setDocumentSearchError(
            err instanceof Error
              ? err.message
              : "Errore nel caricamento dei documenti",
          )
          setDocumentResults([])
        }
      } finally {
        if (!aborted) {
          setIsSearchingDocuments(false)
        }
      }
    }

    const timeoutId = window.setTimeout(searchDocuments, 300)

    return () => {
      aborted = true
      window.clearTimeout(timeoutId)
    }
  }, [module.documentSearch])

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">
          Modulo {index + 1}
        </h3>
      </div>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`module-title-${index}`}>Titolo</Label>
          <Input
            id={`module-title-${index}`}
            value={module.title}
            onChange={(e) =>
              onChange((current) => ({
                ...current,
                title: e.target.value,
              }))
            }
            placeholder="Titolo del modulo"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`module-description-${index}`}>Descrizione</Label>
          <Textarea
            id={`module-description-${index}`}
            value={module.description}
            onChange={(e) =>
              onChange((current) => ({
                ...current,
                description: e.target.value,
              }))
            }
            placeholder="Descrizione sintetica del modulo..."
            rows={3}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] sm:items-start">
          <div className="space-y-1.5 w-full overflow-auto">
            <Label>Video (da tabella documents)</Label>
            <div className="space-y-2">
              <Input
                placeholder="Cerca per titolo, filename o ID documento video..."
                value={module.videoSearch}
                onChange={(e) =>
                  onChange((current) => ({
                    ...current,
                    videoSearch: e.target.value,
                  }))
                }
              />
              {module.videoSearch.trim().length > 0 && (
                <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-xs">
                  {(isLoadingDocuments || isSearchingVideos) && (
                    <div className="rounded px-2 py-1 text-zinc-400">
                      Caricamento documenti video...
                    </div>
                  )}
                  {(documentsError || videoSearchError) &&
                    !isLoadingDocuments &&
                    !isSearchingVideos && (
                      <div className="rounded px-2 py-1 text-red-500">
                        {videoSearchError || documentsError}
                      </div>
                    )}
                  {!isLoadingDocuments &&
                    !isSearchingVideos &&
                    !documentsError &&
                    !videoSearchError &&
                    visibleVideoDocuments.length === 0 && (
                      <div className="rounded px-2 py-1 text-zinc-400">
                        Nessun documento video trovato
                      </div>
                    )}
                  {!isLoadingDocuments &&
                    !documentsError &&
                    visibleVideoDocuments.map((doc) => {
                      const title = getDocumentTitle(doc)
                      const filename = getDocumentFilename(doc)

                      return (
                        <button
                          key={doc.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition hover:bg-white ${
                            module.videoDocumentId === doc.id
                              ? "bg-white text-zinc-900"
                              : "text-zinc-700"
                          }`}
                          onClick={() => onUpdateVideoFromDocument(doc)}
                        >
                          <span className="mr-2 flex min-w-0 flex-col">
                            <span className="truncate">{title || doc.id}</span>
                            {filename && (
                              <span className="truncate text-[10px] text-zinc-400">
                                {filename}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
                            {doc.id}
                          </span>
                        </button>
                      )
                    })}
                </div>
              )}
              {module.videoUrl && (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-500">
                  URL video selezionato:
                  <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-600">
                    {module.videoUrl}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
            {module.thumbnailUrl ? (
              <>
                <div className="relative h-28 w-full overflow-hidden rounded-md bg-black/5">
                  <Image
                    src={module.thumbnailUrl}
                    alt="Anteprima video"
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-xs text-zinc-500">Anteprima video</span>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xs text-zinc-400">
                  Nessuna
                  <br />
                  anteprima
                </div>
                <span className="text-xs text-zinc-400">
                  Seleziona un video YouTube o Vimeo dai documenti per vedere la
                  thumbnail
                </span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2 w-full overflow-auto">
          <Label>Documento associato</Label>
          <div className="space-y-1.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Cerca per titolo, filename o ID documento..."
                value={module.documentSearch}
                onChange={(e) =>
                  onChange((current) => ({
                    ...current,
                    documentSearch: e.target.value,
                  }))
                }
              />
            </div>

            {module.documentSearch.trim().length > 0 && (
              <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-xs">
                {isLoadingDocuments && (
                  <div className="rounded px-2 py-1 text-zinc-400">
                    Caricamento documenti...
                  </div>
                )}
                {(documentsError || documentSearchError) &&
                  !isLoadingDocuments &&
                  !isSearchingDocuments && (
                    <div className="rounded px-2 py-1 text-red-500">
                      {documentSearchError || documentsError}
                    </div>
                  )}
                {!isLoadingDocuments &&
                  !isSearchingDocuments &&
                  !documentsError &&
                  !documentSearchError &&
                  visibleDocumentResults.length === 0 && (
                    <div className="rounded px-2 py-1 text-zinc-400">
                      Nessun documento trovato
                    </div>
                  )}
                {!isLoadingDocuments &&
                  !isSearchingDocuments &&
                  !documentsError &&
                  !documentSearchError &&
                  visibleDocumentResults.map((doc) => {
                    const title = getDocumentTitle(doc)
                    const filename = getDocumentFilename(doc)

                    return (
                      <button
                        key={doc.id}
                        type="button"
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition hover:bg-white ${
                          module.selectedDocumentId === doc.id
                            ? "bg-white text-zinc-900"
                            : "text-zinc-700"
                        }`}
                        onClick={() =>
                          onChange((current) => ({
                            ...current,
                            selectedDocumentId: doc.id,
                            documentSearch: "",
                            selectedDocumentTitle:
                              getDocumentTitle(doc) || undefined,
                            selectedDocumentFilename:
                              getDocumentFilename(doc) || undefined,
                          }))
                        }
                      >
                        <span className="mr-2 flex min-w-0 flex-col">
                          <span className="truncate">{title || doc.id}</span>
                          {filename && (
                            <span className="truncate text-[10px] text-zinc-400">
                              {filename}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
                          {doc.id}
                        </span>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
          {selectedDocument && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-500">
              Documento selezionato:
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-700">
                    {getDocumentTitle(selectedDocument) || selectedDocument.id}
                  </div>
                  {getDocumentFilename(selectedDocument) && (
                    <div className="truncate text-[10px] text-zinc-400">
                      {getDocumentFilename(selectedDocument)}
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
                  {selectedDocument.id}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-md border border-zinc-100 bg-zinc-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Trainer</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onChange((current) => ({
                  ...current,
                  trainers: [
                    ...current.trainers,
                    {
                      name: "",
                      role: "",
                      company: course.company,
                    },
                  ],
                }))
              }}
            >
              Aggiungi trainer
            </Button>
          </div>

          {module.trainers.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Nessun trainer aggiunto. Clicca su{" "}
              <span className="font-medium">“Aggiungi trainer”</span> per
              inserire il primo.
            </p>
          ) : (
            <div className="space-y-3">
              {module.trainers.map((trainer, tIndex) => (
                <div
                  key={tIndex}
                  className="relative space-y-2 rounded-md border border-zinc-200 bg-white p-2.5"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() =>
                      onChange((current) => ({
                        ...current,
                        trainers: current.trainers.filter(
                          (_, i) => i !== tIndex,
                        ),
                      }))
                    }
                    aria-label={`Rimuovi trainer ${tIndex + 1}`}
                    title="Rimuovi trainer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <div className="flex flex-col gap-2 pt-6 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label
                        htmlFor={`module-${index}-trainer-name-${tIndex}`}
                        className="text-xs"
                      >
                        Nome
                      </Label>
                      <Input
                        id={`module-${index}-trainer-name-${tIndex}`}
                        value={trainer.name}
                        onChange={(e) =>
                          onChange((current) => {
                            const trainers = [...current.trainers]
                            trainers[tIndex] = {
                              ...trainers[tIndex],
                              name: e.target.value,
                            }
                            return { ...current, trainers }
                          })
                        }
                        placeholder="Nome e cognome"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`module-${index}-trainer-role-${tIndex}`}
                        className="text-xs"
                      >
                        Ruolo
                      </Label>
                      <Textarea
                        id={`module-${index}-trainer-role-${tIndex}`}
                        value={trainer.role}
                        ref={(el) => {
                          if (!el) return
                          el.style.height = "auto"
                          el.style.height = `${el.scrollHeight}px`
                        }}
                        onChange={(e) =>
                          onChange((current) => {
                            const trainers = [...current.trainers]
                            trainers[tIndex] = {
                              ...trainers[tIndex],
                              role: e.target.value,
                            }
                            return { ...current, trainers }
                          })
                        }
                        onInput={(e) => {
                          const el = e.currentTarget
                          el.style.height = "auto"
                          el.style.height = `${el.scrollHeight}px`
                        }}
                        rows={1}
                        className="min-h-9 resize-none overflow-hidden"
                        placeholder="Es. Formatore interno"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor={`module-${index}-trainer-company-${tIndex}`}
                        className="text-xs"
                      >
                        Azienda
                      </Label>
                      <Input
                        id={`module-${index}-trainer-company-${tIndex}`}
                        value={trainer.company}
                        onChange={(e) =>
                          onChange((current) => {
                            const trainers = [...current.trainers]
                            trainers[tIndex] = {
                              ...trainers[tIndex],
                              company: e.target.value,
                            }
                            return { ...current, trainers }
                          })
                        }
                        placeholder="Azienda del trainer"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type CourseModulesSectionProps = {
  course: CourseForModules
  modules: Module[]
  documents: DocumentRef[]
  isLoadingDocuments: boolean
  documentsError: string | null
  onModulesChange: (updater: (current: Module[]) => Module[]) => void
}

export default function CourseModulesSection({
  course,
  modules,
  documents,
  isLoadingDocuments,
  documentsError,
  onModulesChange,
}: CourseModulesSectionProps) {
  function updateModule(index: number, updater: (current: Module) => Module) {
    onModulesChange((current) => {
      const next = [...current]
      next[index] = updater(next[index])
      return next
    })
  }

  async function updateVideoFromDocument(index: number, doc: DocumentRef) {
    const filename = getDocumentFilename(doc)

    updateModule(index, (current) => ({
      ...current,
      videoDocumentId: doc.id,
      videoSearch: "",
      videoUrl: filename,
      thumbnailUrl: getVideoThumbnail(filename),
    }))

    if (!filename) {
      return
    }

    try {
      const res = await fetch(
        `/api/video-thumbnail?url=${encodeURIComponent(filename)}`,
      )
      if (!res.ok) return

      const data = (await res.json()) as { thumbnailUrl?: string | null }
      if (data.thumbnailUrl) {
        updateModule(index, (current) => ({
          ...current,
          thumbnailUrl: data.thumbnailUrl ?? current.thumbnailUrl,
        }))
      }
    } catch (err) {
      console.error("Error fetching video thumbnail", err)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Moduli</h2>
      </div>

      <div className="space-y-5">
        {modules.map((module, index) => (
          <CourseModuleCard
            key={index}
            course={course}
            module={module}
            index={index}
            documents={documents}
            isLoadingDocuments={isLoadingDocuments}
            documentsError={documentsError}
            onChange={(updater) => updateModule(index, updater)}
            onUpdateVideoFromDocument={(doc) =>
              updateVideoFromDocument(index, doc)
            }
          />
        ))}
      </div>
    </section>
  )
}

