"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/global-toast"
import CourseModulesSection, {
  DocumentRef,
  Module,
} from "@/app/courses/_components/course-modules-section"

type Category = {
  id: string
  lms_name: string
}

type CourseFormState = {
  title: string
  description: string
  duration: number
  imageFile?: File
  uploadedImageUrl?: string
  dateFrom: string
  dateTo: string
  category: string
  company: string
  scormFileName?: string
  scormFile?: File
  uploadedScormUrl?: string
  scormOriginalName?: string
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

function getDocumentTitle(doc: DocumentRef): string {
  return (doc.title ?? doc.name ?? "").trim()
}

function getDocumentFilename(doc: DocumentRef): string {
  return (doc.filename ?? "").trim()
}

function getBasename(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  const trimmed = path.split("?")[0].split("#")[0]
  const parts = trimmed.split("/")
  return parts[parts.length - 1] || undefined
}

function isVideoDocument(doc: DocumentRef): boolean {
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

function mapDraftToFormState(draft: any): CourseFormState {
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
        videoDocumentId:
          typeof existing.video_document_id === "string" ||
          typeof existing.video_document_id === "number"
            ? String(existing.video_document_id)
            : undefined,
        videoSearch: "",
        selectedDocumentId: existing.document_id ?? undefined,
        selectedDocumentTitle:
          typeof existing.document_title === "string"
            ? existing.document_title
            : undefined,
        selectedDocumentFilename:
          typeof existing.document_filename === "string"
            ? existing.document_filename
            : undefined,
        documentSearch: "",
        trainers: Array.isArray(existing.trainers)
          ? existing.trainers
          : [],
      }
    },
  )

  return {
    title,
    description,
    duration:
      typeof draft.duration === "number" && Number.isFinite(draft.duration)
        ? draft.duration
        : Number(draft.duration) || 0,
    imageFile: undefined,
    uploadedImageUrl: draft.image_url_landscape ?? undefined,
    dateFrom: draft.date_from ?? "",
    dateTo: draft.date_to ?? "",
    category: draft.category_id ?? "",
    company: draft.company ?? "",
    scormFileName: draft.course_scorm_file ?? undefined,
    scormFile: undefined,
    uploadedScormUrl: draft.course_scorm_file ?? undefined,
    scormOriginalName:
      draft.course_scorm_original_name ??
      draft.scormOriginalName ??
      draft.scormFileName ??
      undefined,
    modules: normalizedModules,
  }
}

export default function CourseEditPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isDraft = searchParams.get("draft") === "1"

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentRef[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [documentsError, setDocumentsError] = useState<string | null>(null)

  const [form, setForm] = useState<CourseFormState>({
    title: "",
    description: "",
    duration: 0,
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
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)

  async function deleteUploadedFile(path: string | undefined) {
    if (!path || !path.startsWith("/uploads/")) {
      return
    }

    try {
      await fetch("/api/uploads", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      })
    } catch (err) {
      console.error("Errore eliminazione file upload", err)
    }
  }

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
          setForm(mapDraftToFormState(draft))
        } else {
          const title = searchParams.get("title") ?? ""
          const description = searchParams.get("description") ?? ""
          const category = searchParams.get("category") ?? ""
          const company = searchParams.get("company") ?? ""
          const imageUrl = searchParams.get("imageUrl") ?? undefined
          const scormUrl = searchParams.get("scormUrl") ?? undefined
          const scormName = searchParams.get("scormName") ?? undefined

          setForm((prev) => ({
            ...prev,
            title,
            description,
            category,
            company,
            uploadedImageUrl: imageUrl ?? prev.uploadedImageUrl,
            scormFile: prev.scormFile,
            uploadedScormUrl: scormUrl ?? prev.uploadedScormUrl,
            scormFileName: scormUrl ?? prev.scormFileName,
            scormOriginalName: scormName ?? prev.scormOriginalName,
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
    let aborted = false

    async function syncDurationFromVideos() {
      const videoUrls = form.modules
        .map((module) => module.videoUrl.trim())
        .filter((url) => url.length > 0 && url.includes("vimeo.com"))

      if (videoUrls.length === 0) {
        if (!aborted && form.duration !== 0) {
          setForm((prev) => ({ ...prev, duration: 0 }))
        }
        return
      }

      const uniqueUrls = [...new Set(videoUrls)]
      const durationMap = new Map<string, number>()

      await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const res = await fetch(`/api/video-thumbnail?url=${encodeURIComponent(url)}`)
            if (!res.ok) return
            const data = (await res.json()) as { durationSeconds?: number | null }
            if (typeof data.durationSeconds === "number" && Number.isFinite(data.durationSeconds)) {
              durationMap.set(url, Math.max(0, Math.round(data.durationSeconds)))
            }
          } catch {
            return
          }
        }),
      )

      let totalSeconds = 0
      videoUrls.forEach((url) => {
        totalSeconds += durationMap.get(url) ?? 0
      })
      const nextDuration = Math.ceil(totalSeconds / 60)

      if (!aborted && nextDuration !== form.duration) {
        setForm((prev) => ({ ...prev, duration: nextDuration }))
      }
    }

    syncDurationFromVideos()

    return () => {
      aborted = true
    }
  }, [form.modules, form.duration])

  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoadingDocuments(true)
        setDocumentsError(null)

        const res = await fetch("/api/documents?limit=100&type=doc")
        if (!res.ok) {
          throw new Error("Impossibile caricare l'elenco documenti")
        }

        const data = (await res.json()) as DocumentRef[]
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
      let imageUrl: string | null = form.uploadedImageUrl ?? null
      let scormUrl: string | null = form.uploadedScormUrl ?? null

      if (form.imageFile || form.scormFile) {
        setIsUploadingFiles(true)
        const uploadFormData = new FormData()
        if (form.imageFile) {
          uploadFormData.append("courseImage", form.imageFile)
        }
        if (form.scormFile) {
          uploadFormData.append("scormFile", form.scormFile)
        }

        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          body: uploadFormData,
        })

        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}))
          const message =
            typeof (data as any).error === "string"
              ? (data as any).error
              : "Errore nel caricamento dei file"
          throw new Error(message)
        }

        const uploadData = (await uploadRes.json()) as {
          imageUrl?: string
          scormUrl?: string
        }

        if (uploadData.imageUrl) {
          imageUrl = uploadData.imageUrl
        }
        if (uploadData.scormUrl) {
          scormUrl = uploadData.scormUrl
        }
      }

      const id = params.id
      if (!id) {
        throw new Error("ID bozza non valido")
      }

      const payload = {
        course_title: form.title,
        course_name: form.title,
        course_description: form.description,
        description: form.description,
        duration: form.duration,
        image_url_landscape: imageUrl,
        image_url_portrait: null,
        image_url_square: null,
        course_scorm_file: scormUrl,
        course_scorm_original_name:
          form.scormOriginalName ?? form.scormFile?.name ?? null,
        date_from: form.dateFrom || null,
        date_to: form.dateTo || null,
        category_id: form.category || null,
        company: form.company || null,
        modules: form.modules.map((module) => ({
          title: module.title,
          description: module.description,
          video_url: module.videoUrl,
          video_document_id: module.videoDocumentId ?? null,
          thumbnail_url: module.thumbnailUrl ?? null,
          document_id: module.selectedDocumentId ?? null,
          document_title: module.selectedDocumentTitle ?? null,
          document_filename: module.selectedDocumentFilename ?? null,
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

      const refreshedDraftRes = await fetch(`/api/courses/drafts/${id}`)
      if (!refreshedDraftRes.ok) {
        const data = await refreshedDraftRes.json().catch(() => ({}))
        const message =
          typeof (data as any).error === "string"
            ? (data as any).error
            : "Salvato, ma impossibile ricaricare la bozza aggiornata"
        throw new Error(message)
      }

      const refreshedDraft = await refreshedDraftRes.json()
      setForm(mapDraftToFormState(refreshedDraft))
      showToast("Modifiche salvate con successo.", "success")
    } catch (err) {
      console.error("Error updating course draft", err)
      setError(
        err instanceof Error ? err.message : "Errore inatteso nel salvataggio",
      )
      showToast("Errore durante il salvataggio delle modifiche.", "error")
    } finally {
      setIsUploadingFiles(false)
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
          <div className="flex items-center gap-2 self-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/courses")}
            >
              Torna alla lista corsi
            </Button>
            <Button
              type="submit"
              form="course-form"
              disabled={isSaving || isLoading || !isDraft}
            >
              {isSaving ? "Salvataggio in corso..." : "Salva modifiche"}
            </Button>
          </div>
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

                <div className="space-y-1.5">
                  <Label htmlFor="courseImage">Immagine corso</Label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)] sm:items-center">
                    <div className="space-y-1.5 text-xs text-zinc-500">
                      <p>
                        Carica l&apos;immagine di copertina del corso. Verrà salvata e poi
                        mostrata nella lista corsi.
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Usa un formato orizzontale leggibile. Dimensione consigliata
                        almeno 600×600px.
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Puoi cliccare sull&apos;anteprima o trascinare un file
                        direttamente sopra.
                      </p>
                    </div>

                    <div
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-2 text-center text-[11px] text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-100"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const file = e.dataTransfer.files?.[0]
                        if (file && file.type.startsWith("image/")) {
                          setForm((prev) => ({
                            ...prev,
                            imageFile: file,
                          }))
                        }
                      }}
                      onClick={(e) => {
                        // Evita che il click sulla X riapra il file picker
                        if ((e.target as HTMLElement).dataset.dismiss === "image-remove") {
                          return
                        }
                        const input = document.getElementById(
                          "courseImageInput",
                        ) as HTMLInputElement | null
                        input?.click()
                      }}
                    >
                      <input
                        id="courseImageInput"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          setForm((prev) => ({
                            ...prev,
                            imageFile: file,
                          }))
                        }}
                      />

                      <div className="relative w-full max-w-[180px] overflow-hidden rounded-md bg-black/5" style={{ aspectRatio: "1 / 1" }}>
                        {form.imageFile || form.uploadedImageUrl ? (
                          <>
                            <Image
                              src={
                                form.imageFile
                                  ? URL.createObjectURL(form.imageFile)
                                  : (form.uploadedImageUrl as string)
                              }
                              alt="Immagine corso"
                              fill
                              className="object-cover"
                            />
                            <button
                              type="button"
                              data-dismiss="image-remove"
                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 hover:text-white"
                              onClick={async (e) => {
                                e.stopPropagation()
                                const previousUrl = form.uploadedImageUrl
                                setForm((prev) => ({
                                  ...prev,
                                  imageFile: undefined,
                                  uploadedImageUrl: undefined,
                                }))
                                if (previousUrl) {
                                  await deleteUploadedFile(previousUrl)
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-400">
                            Nessuna immagine
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-zinc-700">
                        Clicca o trascina qui l&apos;immagine
                      </span>
                    </div>
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
                  <div className="space-y-1.5">
                    <Label htmlFor="duration">Durata (minuti)</Label>
                    <Input id="duration" value={String(form.duration)} readOnly />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="scorm">File SCORM (.zip)</Label>
                  <div className="space-y-2">
                    {(form.scormFile || form.uploadedScormUrl) ? (
                      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[11px] font-semibold text-zinc-800">
                          ZIP
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {form.scormOriginalName ||
                                  form.scormFile?.name ||
                                  getBasename(form.scormFileName) ||
                                  getBasename(form.uploadedScormUrl) ||
                                  "File SCORM caricato"}
                              </div>
                              {form.uploadedScormUrl && (
                                <div className="mt-0.5 break-all text-[10px] text-zinc-600">
                                  {form.uploadedScormUrl}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-900 hover:bg-red-600 hover:text-white"
                              onClick={async () => {
                                const previousUrl = form.uploadedScormUrl
                                setForm((prev) => ({
                                  ...prev,
                                  scormFile: undefined,
                                  scormFileName: undefined,
                                  uploadedScormUrl: undefined,
                              scormOriginalName: undefined,
                                }))
                                if (previousUrl) {
                                  await deleteUploadedFile(previousUrl)
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-xs text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-100"
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const file = e.dataTransfer.files?.[0]
                          if (file && file.name.toLowerCase().endsWith(".zip")) {
                            setForm((prev) => ({
                              ...prev,
                              scormFile: file,
                              scormFileName: file.name,
                            }))
                          }
                        }}
                        onClick={() => {
                          const input = document.getElementById(
                            "scormInput",
                          ) as HTMLInputElement | null
                          input?.click()
                        }}
                      >
                        <input
                          id="scormInput"
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            setForm((prev) => ({
                              ...prev,
                              scormFile: file,
                              scormFileName: file?.name,
                            }))
                          }}
                        />
                        <span className="text-[11px] font-medium text-zinc-700">
                          Clicca per scegliere il file SCORM (.zip)
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          oppure trascinalo qui
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <CourseModulesSection
              course={form}
              modules={form.modules}
              documents={documents}
              isLoadingDocuments={isLoadingDocuments}
              documentsError={documentsError}
              onModulesChange={(updater) =>
                setForm((prev) => ({
                  ...prev,
                  modules: updater(prev.modules),
                }))
              }
            />
          </form>
        )}
      </div>
    </div>
  )
}

