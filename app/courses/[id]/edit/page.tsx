"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Document = {
  id: string
  title?: string | null
  name?: string | null
  filename?: string | null
}

type Category = {
  id: string
  lms_name: string
}

type Trainer = {
  name: string
  role: string
  company: string
}

type Module = {
  title: string
  description: string
  videoUrl: string
  thumbnailUrl?: string
  videoDocumentId?: string
  videoSearch: string
  selectedDocumentId?: string
  documentSearch: string
  trainers: Trainer[]
}

type CourseFormState = {
  title: string
  description: string
  imageFile?: File
  dateFrom: string
  dateTo: string
  category: string
  company: string
  scormFileName?: string
  modules: Module[]
}

function getVideoThumbnail(url: string): string | undefined {
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

function getDocumentTitle(doc: Document): string {
  return (doc.title ?? doc.name ?? "").trim()
}

function getDocumentFilename(doc: Document): string {
  return (doc.filename ?? "").trim()
}

function isVideoDocument(doc: Document): boolean {
  const filename = getDocumentFilename(doc).toLowerCase()
  if (!filename) return false

  if (
    filename.includes("youtube.com") ||
    filename.includes("youtu.be") ||
    filename.includes("vimeo.com")
  ) {
    return true
  }

  return false
}

export default function CourseEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isDraft = searchParams.get("draft") === "1"

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [documentsError, setDocumentsError] = useState<string | null>(null)

  const [form, setForm] = useState<CourseFormState>({
    title: "",
    description: "",
    imageFile: undefined,
    dateFrom: "",
    dateTo: "",
    category: "",
    company: "",
    scormFileName: undefined,
    modules: Array.from({ length: 4 }, () => ({
      title: "",
      description: "",
      videoUrl: "",
      thumbnailUrl: undefined,
      videoDocumentId: undefined,
      videoSearch: "",
      selectedDocumentId: undefined,
      documentSearch: "",
      trainers: [],
    })),
  })

  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = params.id
    if (!id) {
      setError("ID corso non valido")
      setIsLoading(false)
      return
    }

    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)

        if (isDraft) {
          const res = await fetch(`/api/courses/drafts/${id}`)

          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            const message =
              typeof (data as any).error === "string"
                ? (data as any).error
                : "Impossibile caricare la bozza"
            throw new Error(message)
          }

          const draft = await res.json()

          const title =
            draft.course_title ??
            draft.course_name ??
            ""
          const description =
            draft.course_description ??
            draft.description ??
            ""

          const modules = Array.isArray(draft.modules)
            ? draft.modules
            : []

          const normalizedModules: Module[] = Array.from(
            { length: 4 },
            (_, index) => {
              const existing = modules[index] ?? {}
              return {
                title: existing.title ?? "",
                description: existing.description ?? "",
                videoUrl: existing.video_url ?? "",
                thumbnailUrl: existing.thumbnail_url ?? undefined,
                videoDocumentId: undefined,
                videoSearch: "",
                selectedDocumentId: existing.document_id ?? undefined,
                documentSearch: "",
                trainers: Array.isArray(existing.trainers)
                  ? existing.trainers
                  : [],
              }
            },
          )

          setForm({
            title,
            description,
            imageFile: undefined,
            dateFrom: draft.date_from ?? "",
            dateTo: draft.date_to ?? "",
            category: draft.category_id ?? "",
            company: draft.company ?? "",
            scormFileName: draft.course_scorm_file ?? undefined,
            modules: normalizedModules,
          })
        } else {
          const title =
            searchParams.get("title") ?? ""
          const description =
            searchParams.get("description") ?? ""
          const category = searchParams.get("category") ?? ""
          const company = searchParams.get("company") ?? ""

          setForm((prev) => ({
            ...prev,
            title,
            description,
            category,
            company,
          }))
        }
      } catch (err) {
        console.error("Error loading course for edit", err)
        setError(
          err instanceof Error
            ? err.message
            : "Errore nel caricamento dei dati del corso",
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [isDraft, params.id, searchParams])

  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoadingDocuments(true)
        setDocumentsError(null)

        const res = await fetch("/api/documents")
        if (!res.ok) {
          throw new Error("Impossibile caricare l'elenco documenti")
        }

        const data = (await res.json()) as Document[]
        setDocuments(data)
      } catch (err) {
        console.error("Error loading documents", err)
        setDocumentsError(
          err instanceof Error
            ? err.message
            : "Errore nel caricamento dei documenti",
        )
      } finally {
        setIsLoadingDocuments(false)
      }
    }

    loadDocuments()
  }, [])

  useEffect(() => {
    async function loadCategories() {
      try {
        setIsLoadingCategories(true)
        setCategoriesError(null)

        const res = await fetch("/api/categories")
        if (!res.ok) {
          throw new Error("Impossibile caricare le categorie")
        }

        const data = (await res.json()) as Category[]
        setCategories(data)
      } catch (err) {
        console.error("Error loading categories", err)
        setCategoriesError(
          err instanceof Error
            ? err.message
            : "Errore nel caricamento delle categorie",
        )
      } finally {
        setIsLoadingCategories(false)
      }
    }

    loadCategories()
  }, [])

  function updateModule(index: number, updater: (current: Module) => Module) {
    setForm((prev) => {
      const modules = [...prev.modules]
      modules[index] = updater(modules[index])
      return { ...prev, modules }
    })
  }

  async function updateVideoFromDocument(index: number, doc: Document) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim()) {
      return
    }

    if (!isDraft) {
      window.alert(
        "La modifica dei corsi pubblicati sarà disponibile in una fase successiva.",
      )
      router.push("/courses")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const id = params.id
      if (!id) {
        throw new Error("ID bozza non valido")
      }

      const payload = {
        course_title: form.title,
        course_name: form.title,
        course_description: form.description,
        description: form.description,
        image_url_landscape: null,
        image_url_portrait: null,
        image_url_square: null,
        course_scorm_file: form.scormFileName ?? null,
        date_from: form.dateFrom || null,
        date_to: form.dateTo || null,
        category_id: form.category || null,
        company: form.company || null,
        modules: form.modules.map((module) => ({
          title: module.title,
          description: module.description,
          video_url: module.videoUrl,
          thumbnail_url: module.thumbnailUrl ?? null,
          document_id: module.selectedDocumentId ?? null,
          trainers: module.trainers,
        })),
      }

      const res = await fetch(`/api/courses/drafts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          typeof data.error === "string"
            ? data.error
            : "Impossibile salvare le modifiche"
        throw new Error(message)
      }

      await res.json()
      router.push("/courses")
    } catch (err) {
      console.error("Error updating course draft", err)
      setError(
        err instanceof Error ? err.message : "Errore inatteso nel salvataggio",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isDraft ? "Modifica bozza corso" : "Modifica corso"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Aggiorna le informazioni del corso, il file SCORM e i moduli.
            </p>
            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
          <Button
            type="submit"
            form="course-form"
            className="self-start"
            disabled={isSaving || isLoading}
          >
            {isSaving ? "Salvataggio in corso..." : "Salva modifiche"}
          </Button>
        </header>

        {isLoading ? (
          <div className="rounded-lg bg-white p-5 text-sm text-zinc-500 shadow-sm">
            Caricamento dati del corso...
          </div>
        ) : (
          <form
            id="course-form"
            onSubmit={handleSubmit}
            className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]"
          >
            <section className="space-y-6 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold tracking-tight">
                Dettagli corso
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Titolo corso</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Es. Introduzione alla sicurezza sul lavoro"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrizione corso</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Descrivi gli obiettivi e i contenuti principali del corso..."
                    rows={4}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] sm:items-start">
                  <div className="space-y-1.5">
                    <Label htmlFor="courseImage">Immagine corso</Label>
                    <Input
                      id="courseImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        setForm((prev) => ({
                          ...prev,
                          imageFile: file,
                        }))
                      }}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      Carica l&apos;immagine di copertina del corso. Verrà salvata e poi
                      mostrata nella lista corsi.
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
                    {form.imageFile ? (
                      <>
                        <div className="relative h-28 w-full overflow-hidden rounded-md bg-black/5">
                          <Image
                            src={URL.createObjectURL(form.imageFile)}
                            alt="Immagine corso"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <span className="text-xs text-zinc-500">
                          Anteprima immagine corso
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xs text-zinc-400">
                          Nessuna
                          <br />
                          immagine
                        </div>
                        <span className="text-xs text-zinc-400">
                          Incolla un URL valido per vedere l&apos;anteprima
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dateFrom">Data inizio</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={form.dateFrom}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, dateFrom: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dateTo">Data fine</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={form.dateTo}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, dateTo: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Categoria</Label>
                    <div className="relative">
                      <select
                        id="category"
                        className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={form.category}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                      >
                        <option value="">Seleziona una categoria</option>
                        {isLoadingCategories && (
                          <option value="" disabled>
                            Caricamento categorie...
                          </option>
                        )}
                        {categoriesError && !isLoadingCategories && (
                          <option value="" disabled>
                            Errore nel caricamento categorie
                          </option>
                        )}
                        {!isLoadingCategories &&
                          !categoriesError &&
                          categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.lms_name}
                            </option>
                          ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-zinc-500">
                        ▼
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company">Azienda</Label>
                    <Input
                      id="company"
                      value={form.company}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          company: e.target.value,
                        }))
                      }
                      placeholder="Es. ACME S.p.A."
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="scorm">File SCORM (.zip)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="scorm"
                      type="file"
                      accept=".zip"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        setForm((prev) => ({
                          ...prev,
                          scormFileName: file?.name,
                        }))
                      }}
                    />
                    {form.scormFileName && (
                      <span className="text-xs text-zinc-500">
                        Selezionato: {form.scormFileName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Moduli</h2>
              </div>

              <div className="space-y-5">
                {form.modules.map((module, index) => {
                  const selectedDocument = documents.find(
                    (doc) => doc.id === module.selectedDocumentId,
                  )

                  const selectedVideoDocument = documents.find(
                    (doc) => doc.id === module.videoDocumentId,
                  )

                  const filteredDocuments = documents.filter((doc) => {
                    const search = (module.documentSearch || "")
                      .toLowerCase()
                      .split(" ")
                      .filter(Boolean)

                    if (search.length === 0) return true

                    const title = getDocumentTitle(doc).toLowerCase()
                    const filename = getDocumentFilename(doc).toLowerCase()
                    const id = (doc.id ?? "").toString().toLowerCase()

                    return search.every(
                      (term) =>
                        title.includes(term) ||
                        filename.includes(term) ||
                        id.includes(term),
                    )
                  })

                  const filteredVideoDocuments = documents.filter((doc) => {
                    if (!isVideoDocument(doc)) return false

                    const search = (module.videoSearch || "")
                      .toLowerCase()
                      .split(" ")
                      .filter(Boolean)

                    if (search.length === 0) return true

                    const title = getDocumentTitle(doc).toLowerCase()
                    const filename = getDocumentFilename(doc).toLowerCase()
                    const id = (doc.id ?? "").toString().toLowerCase()

                    return search.every(
                      (term) =>
                        title.includes(term) ||
                        filename.includes(term) ||
                        id.includes(term),
                    )
                  })

                  const visibleDocuments = filteredDocuments.slice(0, 8)
                  const visibleVideoDocuments = filteredVideoDocuments.slice(0, 8)

                  return (
                    <div
                      key={index}
                      className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold tracking-tight">
                          Modulo {index + 1}
                        </h3>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor={`module-title-${index}`}>
                            Titolo
                          </Label>
                          <Input
                            id={`module-title-${index}`}
                            value={module.title}
                            onChange={(e) =>
                              updateModule(index, (current) => ({
                                ...current,
                                title: e.target.value,
                              }))
                            }
                            placeholder="Titolo del modulo"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`module-description-${index}`}>
                            Descrizione
                          </Label>
                          <Textarea
                            id={`module-description-${index}`}
                            value={module.description}
                            onChange={(e) =>
                              updateModule(index, (current) => ({
                                ...current,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Descrizione sintetica del modulo..."
                            rows={3}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] sm:items-start">
                        <div className="space-y-1.5">
                          <Label>Video (da tabella documents)</Label>
                          <div className="space-y-2">
                            <Input
                              placeholder="Cerca per titolo, filename o ID documento video..."
                              value={module.videoSearch}
                              onChange={(e) =>
                                updateModule(index, (current) => ({
                                  ...current,
                                  videoSearch: e.target.value,
                                }))
                              }
                            />
                            <div className="min-w-[150px] text-xs text-zinc-500">
                              {selectedVideoDocument ? (
                                <span>
                                  Selezionato:{" "}
                                  <span className="font-medium">
                                    {getDocumentTitle(selectedVideoDocument) ||
                                      selectedVideoDocument.id}
                                  </span>{" "}
                                  <span className="text-[10px] text-zinc-400">
                                    ({selectedVideoDocument.id})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-zinc-400">
                                  Nessun video selezionato
                                </span>
                              )}
                            </div>
                            <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-xs">
                              {isLoadingDocuments && (
                                <div className="rounded px-2 py-1 text-zinc-400">
                                  Caricamento documenti video...
                                </div>
                              )}
                              {documentsError && !isLoadingDocuments && (
                                <div className="rounded px-2 py-1 text-red-500">
                                  {documentsError}
                                </div>
                              )}
                              {!isLoadingDocuments &&
                                !documentsError &&
                                filteredVideoDocuments.length === 0 && (
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
                                      onClick={() =>
                                        updateVideoFromDocument(index, doc)
                                      }
                                    >
                                      <span className="mr-2 flex min-w-0 flex-col">
                                        <span className="truncate">
                                          {title || doc.id}
                                        </span>
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
                                <span className="text-xs text-zinc-500">
                                  Anteprima video
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xs text-zinc-400">
                                  Nessuna
                                  <br />
                                  anteprima
                                </div>
                                <span className="text-xs text-zinc-400">
                                Seleziona un video YouTube o Vimeo dai
                                documenti per vedere la thumbnail
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Documento associato</Label>
                          <div className="space-y-1.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                                placeholder="Cerca per titolo, filename o ID documento..."
                                value={module.documentSearch}
                                onChange={(e) =>
                                  updateModule(index, (current) => ({
                                    ...current,
                                    documentSearch: e.target.value,
                                  }))
                                }
                              />
                              <div className="min-w-[150px] text-xs text-zinc-500">
                                {selectedDocument ? (
                                  <span>
                                    Selezionato:{" "}
                                    <span className="font-medium">
                                      {getDocumentTitle(selectedDocument) ||
                                        selectedDocument.id}
                                    </span>{" "}
                                    <span className="text-[10px] text-zinc-400">
                                      ({selectedDocument.id})
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-zinc-400">
                                    Nessun documento selezionato
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-xs">
                              {isLoadingDocuments && (
                                <div className="rounded px-2 py-1 text-zinc-400">
                                  Caricamento documenti...
                                </div>
                              )}
                              {documentsError && !isLoadingDocuments && (
                                <div className="rounded px-2 py-1 text-red-500">
                                  {documentsError}
                                </div>
                              )}
                              {!isLoadingDocuments &&
                                !documentsError &&
                                filteredDocuments.length === 0 && (
                                  <div className="rounded px-2 py-1 text-zinc-400">
                                    Nessun documento trovato
                                  </div>
                                )}
                              {!isLoadingDocuments &&
                                !documentsError &&
                                visibleDocuments.map((doc) => {
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
                                        updateModule(index, (current) => ({
                                          ...current,
                                          selectedDocumentId: doc.id,
                                        }))
                                      }
                                    >
                                      <span className="mr-2 flex min-w-0 flex-col">
                                        <span className="truncate">
                                          {title || doc.id}
                                        </span>
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
                          </div>
                        </div>

                        <div className="space-y-3 rounded-md border border-zinc-100 bg-zinc-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">
                              Trainer
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateModule(index, (current) => ({
                                  ...current,
                                  trainers: [
                                    ...current.trainers,
                                    {
                                      name: "",
                                      role: "",
                                      company: form.company,
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
                              <span className="font-medium">
                                “Aggiungi trainer”
                              </span>{" "}
                              per inserire il primo.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {module.trainers.map((trainer, tIndex) => (
                                <div
                                  key={tIndex}
                                  className="grid gap-2 rounded-md border border-zinc-200 bg-white p-2.5 sm:grid-cols-3"
                                >
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
                                        updateModule(index, (current) => {
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
                                    <Input
                                      id={`module-${index}-trainer-role-${tIndex}`}
                                      value={trainer.role}
                                      onChange={(e) =>
                                        updateModule(index, (current) => {
                                          const trainers = [...current.trainers]
                                          trainers[tIndex] = {
                                            ...trainers[tIndex],
                                            role: e.target.value,
                                          }
                                          return { ...current, trainers }
                                        })
                                      }
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
                                        updateModule(index, (current) => {
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
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </form>
        )}
      </div>
    </div>
  )
}

