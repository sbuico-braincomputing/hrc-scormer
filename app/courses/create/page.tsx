"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

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
  dateFrom: string
  dateTo: string
  category: string
  company: string
  scormFileName?: string
  modules: Module[]
}

export default function CourseCreatePage() {
  const router = useRouter()
  const { showToast } = useToast()
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
  const [error, setError] = useState<string | null>(null)

  const vimeoVideoUrlsForDuration = useMemo(
    () =>
      form.modules
        .map((module) => module.videoUrl.trim())
        .filter((url) => url.length > 0 && url.includes("vimeo.com")),
    [form.modules],
  )
  const vimeoVideoUrlsSignature = useMemo(
    () => vimeoVideoUrlsForDuration.join("||"),
    [vimeoVideoUrlsForDuration],
  )

  useEffect(() => {
    async function loadDocuments() {
      try {
        setIsLoadingDocuments(true)
        setDocumentsError(null)

        const res = await fetch("/api/documents?limit=100&type=all")
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
    let aborted = false

    async function syncDurationFromVideos() {
      const videoUrls = vimeoVideoUrlsForDuration

      if (videoUrls.length === 0) {
        if (!aborted) {
          setForm((prev) =>
            prev.duration === 0 ? prev : { ...prev, duration: 0 },
          )
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

      if (!aborted) {
        setForm((prev) =>
          prev.duration === nextDuration
            ? prev
            : { ...prev, duration: nextDuration },
        )
      }
    }

    syncDurationFromVideos()

    return () => {
      aborted = true
    }
  }, [vimeoVideoUrlsSignature])

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

    setIsSaving(true)
    setError(null)

    try {
      const payload = {
        course_title: form.title,
        course_name: form.title,
        course_description: form.description,
        description: form.description,
        duration: form.duration,
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
          video_document_id: module.videoDocumentId ?? null,
          thumbnail_url: module.thumbnailUrl ?? null,
          document_id: module.selectedDocumentId ?? null,
          document_title: module.selectedDocumentTitle ?? null,
          document_filename: module.selectedDocumentFilename ?? null,
          trainers: module.trainers,
        })),
      }

      const res = await fetch("/api/courses/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          typeof data.error === "string"
            ? data.error
            : "Impossibile salvare il corso"
        throw new Error(message)
      }

      await res.json()
      showToast("Bozza corso salvata con successo.", "success")
      router.push("/courses")
    } catch (err) {
      console.error("Error saving course draft", err)
      setError(
        err instanceof Error ? err.message : "Errore inatteso nel salvataggio",
      )
      showToast("Errore durante il salvataggio della bozza.", "error")
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
              Crea nuovo corso
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Compila le informazioni del corso, carica il file SCORM e
              configura i moduli.
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
            disabled={isSaving}
          >
            {isSaving ? "Salvataggio in corso..." : "Salva corso"}
          </Button>
        </header>

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
                <div className="space-y-1.5">
                  <Label htmlFor="duration">Durata (minuti)</Label>
                  <Input id="duration" value={String(form.duration)} readOnly />
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
      </div>
    </div>
  )
}

