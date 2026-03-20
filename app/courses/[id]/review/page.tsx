"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/global-toast"
import CourseModulesSection, {
  Module as FormModule,
} from "@/app/courses/_components/course-modules-section"

type Trainer = {
  name?: string | null
  role?: string | null
  company?: string | null
}

type DraftModule = {
  title?: string | null
  description?: string | null
  video_url?: string | null
  thumbnail_url?: string | null
  document_id?: string | null
  document_title?: string | null
  document_filename?: string | null
  trainers?: Trainer[] | null
}

type DraftCourse = {
  id: number
  course_title?: string | null
  course_name?: string | null
  course_description?: string | null
  description?: string | null
  duration?: number | string | null
  image_url_landscape?: string | null
  category_id?: string | null
  company?: string | null
  course_scorm_file?: string | null
  date_from?: string | null
  date_to?: string | null
  modules?: DraftModule[] | null
}

function isMissing(value: unknown) {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (typeof value === "number" || typeof value === "boolean") return false
  return String(value).trim().length === 0
}

function getBasename(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  const trimmed = path.split("?")[0].split("#")[0]
  const parts = trimmed.split("/")
  return parts[parts.length - 1] || undefined
}

export default function CourseReviewPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const isDraft = searchParams.get("draft") === "1"
  const courseId = params.id

  const [course, setCourse] = useState<DraftCourse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiMissingFields, setApiMissingFields] = useState<string[]>([])
  const [publishHint, setPublishHint] = useState<string | null>(null)

  useEffect(() => {
    async function loadDraft() {
      if (!courseId) return

      try {
        setIsLoading(true)
        setError(null)

        const res = await fetch(`/api/courses/drafts/${courseId}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const message =
            typeof data.error === "string"
              ? data.error
              : "Impossibile caricare la bozza"
          throw new Error(message)
        }

        const data = (await res.json()) as DraftCourse
        setCourse(data)
      } catch (err) {
        console.error("Errore caricamento bozza per review", err)
        setError(
          err instanceof Error ? err.message : "Errore nel caricamento della bozza",
        )
      } finally {
        setIsLoading(false)
      }
    }

    if (isDraft) {
      loadDraft()
      return
    }

    setError("La review è disponibile solo per le bozze.")
    setIsLoading(false)
  }, [courseId, isDraft])

  const localMissingFields = useMemo(() => {
    if (!course) return []

    const missing: string[] = []
    const title = (course.course_title ?? course.course_name ?? "").trim()
    const description = (course.course_description ?? course.description ?? "").trim()
    const modules = Array.isArray(course.modules) ? course.modules : []

    if (isMissing(title)) missing.push("Titolo corso")
    if (isMissing(description)) missing.push("Descrizione corso")
    if (isMissing(course.image_url_landscape)) missing.push("Immagine corso")
    if (isMissing(course.category_id)) missing.push("Categoria")
    if (isMissing(course.company)) missing.push("Azienda")
    if (isMissing(course.course_scorm_file)) missing.push("File SCORM")
    if (isMissing(course.date_from)) missing.push("Data inizio")
    if (isMissing(course.date_to)) missing.push("Data fine")
    if (modules.length === 0) missing.push("Almeno un modulo")

    modules.forEach((module, index) => {
      const moduleLabel = `Modulo ${index + 1}`
      if (isMissing(module?.title)) missing.push(`${moduleLabel}: Titolo`)
      if (isMissing(module?.description))
        missing.push(`${moduleLabel}: Descrizione`)
      if (isMissing(module?.video_url)) missing.push(`${moduleLabel}: Video`)
      if (isMissing(module?.document_id))
        missing.push(`${moduleLabel}: Documento associato`)

      const trainers = Array.isArray(module?.trainers) ? module.trainers : []
      if (trainers.length === 0) {
        missing.push(`${moduleLabel}: Almeno un trainer`)
        return
      }

      trainers.forEach((trainer, trainerIndex) => {
        const trainerLabel = `${moduleLabel} - Trainer ${trainerIndex + 1}`
        if (isMissing(trainer?.name)) missing.push(`${trainerLabel}: Nome`)
        if (isMissing(trainer?.role)) missing.push(`${trainerLabel}: Ruolo`)
        if (isMissing(trainer?.company))
          missing.push(`${trainerLabel}: Azienda`)
      })
    })

    return missing
  }, [course])

  const reviewModules = useMemo<FormModule[]>(() => {
    if (!course?.modules || !Array.isArray(course.modules)) return []

    return course.modules.map((module) => ({
      title: module.title ?? "",
      description: module.description ?? "",
      videoUrl: module.video_url ?? "",
      thumbnailUrl: module.thumbnail_url ?? undefined,
      videoDocumentId: undefined,
      videoSearch: "",
      selectedDocumentId: module.document_id ?? undefined,
      selectedDocumentTitle: module.document_title ?? undefined,
      selectedDocumentFilename: module.document_filename ?? undefined,
      documentSearch: "",
      trainers: (module.trainers ?? []).map((trainer) => ({
        name: trainer.name ?? "",
        role: trainer.role ?? "",
        company: trainer.company ?? "",
      })),
    }))
  }, [course])

  async function handlePublish() {
    if (!courseId) return

    try {
      setIsPublishing(true)
      setError(null)
      setApiMissingFields([])
      setPublishHint(null)

      const res = await fetch(`/api/courses/drafts/${courseId}/publish`, {
        method: "POST",
      })

      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        code?: string
        details?: { compensationWarning?: string }
        missingFields?: string[]
        message?: string
        publishedCourseId?: number
      }

      if (!res.ok) {
        if (Array.isArray(data.missingFields)) {
          setApiMissingFields(data.missingFields)
        }
        if (data.code === "FTP_PATHS_MISSING" || data.code === "FTP_ENV_MISSING") {
          setPublishHint("Configurazione FTP da verificare nelle variabili ambiente.")
        }
        if (data.code === "LOCAL_FILES_MISSING") {
          setPublishHint(
            "File locali mancanti: riapri la bozza, ricarica SCORM/immagine e salva.",
          )
        }
        if (typeof data.details?.compensationWarning === "string") {
          setPublishHint(data.details.compensationWarning)
        }
        throw new Error(data.error ?? "Impossibile pubblicare il corso")
      }

      showToast(data.message ?? "Corso pubblicato con successo.", "success")
      router.push("/courses")
    } catch (err) {
      console.error("Errore pubblicazione bozza", err)
      setError(err instanceof Error ? err.message : "Errore di pubblicazione")
      showToast("Errore durante la pubblicazione del corso.", "error")
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Review bozza corso
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Verifica i dettagli del corso in sola lettura prima della pubblicazione.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button asChild type="button" variant="outline">
              <Link href="/courses">Torna alla lista corsi</Link>
            </Button>
            <Button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || isLoading || localMissingFields.length > 0}
            >
              {isPublishing ? "Pubblicazione in corso..." : "Conferma pubblicazione"}
            </Button>
          </div>
        </header>

        {isLoading && (
          <div className="rounded-lg bg-white p-5 text-sm text-zinc-500 shadow-sm">
            Caricamento bozza...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!isLoading && course && (
          <>
            {localMissingFields.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Ci sono campi mancanti: completa la bozza prima di procedere alla
                pubblicazione.{" "}
                <Link
                  href={`/courses/${courseId}/edit?draft=1`}
                  className="font-medium underline"
                >
                  Apri la pagina di modifica
                </Link>
                .
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {localMissingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}

            {apiMissingFields.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                L&apos;API di pubblicazione ha bloccato la richiesta per campi
                mancanti.
                <ul className="mt-2 list-disc pl-5 text-xs">
                  {apiMissingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
            {publishHint && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {publishHint}
              </div>
            )}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]">
              <section className="space-y-6 rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold tracking-tight">Dettagli corso</h2>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Titolo corso</Label>
                    <Input
                      value={course.course_title ?? course.course_name ?? ""}
                      readOnly
                      className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Descrizione corso</Label>
                    <Textarea
                      value={course.course_description ?? course.description ?? ""}
                      readOnly
                      rows={4}
                      ref={(el) => {
                        if (!el) return
                        el.style.height = "auto"
                        el.style.height = `${el.scrollHeight}px`
                      }}
                      className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Immagine corso</Label>
                   
                      <div className="flex flex-col max-w-[180px] items-center justify-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-center text-[11px] text-zinc-500">
                        <div
                          className="relative w-full max-w-[180px] overflow-hidden rounded-md bg-black/5"
                          style={{ aspectRatio: "1 / 1" }}
                        >
                          {course.image_url_landscape ? (
                            <Image
                              src={course.image_url_landscape}
                              alt="Immagine corso"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-400">
                              Nessuna immagine
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Data inizio</Label>
                      <Input
                        value={course.date_from ?? ""}
                        readOnly
                        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data fine</Label>
                      <Input
                        value={course.date_to ?? ""}
                        readOnly
                        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Categoria</Label>
                      <Input
                        value={String(course.category_id ?? "")}
                        readOnly
                        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Azienda</Label>
                      <Input
                        value={course.company ?? ""}
                        readOnly
                        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Durata (minuti)</Label>
                      <Input
                        value={String(course.duration ?? 0)}
                        readOnly
                        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>File SCORM (.zip)</Label>
                    {course.course_scorm_file ? (
                      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-800">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[11px] font-semibold text-zinc-800">
                          ZIP
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="wrap-break-word font-medium">
                            {getBasename(course.course_scorm_file) ?? "File SCORM"}
                          </div>
                          <div className="mt-0.5 break-all text-[10px] text-zinc-600">
                            {course.course_scorm_file}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
                        Nessun file SCORM associato.
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <CourseModulesSection
                  course={{ company: course.company ?? "" }}
                  modules={reviewModules}
                  documents={[]}
                  isLoadingDocuments={false}
                  documentsError={null}
                  readOnly
                  onModulesChange={(_updater) => {
                    return
                  }}
                />
              </section>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button asChild variant="outline">
                <Link href={`/courses/${courseId}/edit?draft=1`}>Torna a modifica</Link>
              </Button>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || localMissingFields.length > 0}
              >
                {isPublishing ? "Pubblicazione in corso..." : "Conferma pubblicazione"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
