"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Rocket, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/global-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Course = {
  id: number
  course_id?: number | null
  category_id?: number | null
  eye_url?: string | null
  isDraft?: boolean
  image_url_landscape: string | null
  image_url_portrait: string | null
  image_url_square: string | null
  course_scorm_file: string | null
  category_name: string | null
  course_title: string | null
  course_name: string | null
  course_description: string | null
  description: string | null
  created_at: string | null
  updated_at: string | null
}

type ApiResponse = {
  items: Course[]
  totalCount: number
  nextCursor: number | null
  hasMore: boolean
}

type DraftsApiResponse = {
  items: Course[]
  totalCount: number
}

function parseSocialUrls(envValue: string) {
  return envValue
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean)
}

function buildEyeUrlForDomain(eyeUrl: string, socialUrl: string | null) {
  if (!socialUrl) {
    return eyeUrl
  }

  try {
    const sourceUrl = new URL(eyeUrl)
    const domainUrl = new URL(socialUrl)
    return `${domainUrl.origin}${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`
  } catch {
    if (eyeUrl.startsWith("/")) {
      return `${socialUrl}${eyeUrl}`
    }

    return eyeUrl
  }
}

export default function CoursesListPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const socialUrls = useMemo(
    () =>
      parseSocialUrls(
        process.env.SOCIAL_URL ?? process.env.NEXT_PUBLIC_SOCIAL_URL ?? "",
      ),
    [],
  )
  const [drafts, setDrafts] = useState<Course[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [draftsTotalCount, setDraftsTotalCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [draftToDelete, setDraftToDelete] = useState<Course | null>(null)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => clearTimeout(handler)
  }, [search])

  const fetchCourses = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (isLoading || isFetchingRef.current) return

      const isReset = opts?.reset ?? false

      if (!isReset && !hasMore) {
        return
      }

      if (isReset) {
        setIsInitialLoading(true)
        setDrafts([])
        setCourses([])
        setCursor(null)
        setHasMore(true)
        setTotalCount(0)
        setDraftsTotalCount(0)
        setError(null)
      } else {
        setIsLoading(true)
      }

      isFetchingRef.current = true

      try {
        if (isReset) {
          const draftsParams = new URLSearchParams()
          if (debouncedSearch) {
            draftsParams.set("q", debouncedSearch)
          }

          const draftsRes = await fetch(
            `/api/courses/drafts?${draftsParams.toString()}`,
            {
              method: "GET",
            },
          )

          if (!draftsRes.ok) {
            throw new Error("Errore nella chiamata API per le bozze")
          }

          const draftsData: DraftsApiResponse = await draftsRes.json()
          setDrafts(draftsData.items)
          setDraftsTotalCount(draftsData.totalCount)
        }

        const params = new URLSearchParams()
        if (debouncedSearch) {
          params.set("q", debouncedSearch)
        }
        if (!isReset && cursor) {
          params.set("cursor", String(cursor))
        }

        const res = await fetch(`/api/courses?${params.toString()}`, {
          method: "GET",
        })

        if (!res.ok) {
          throw new Error("Errore nella chiamata API")
        }

        const data: ApiResponse = await res.json()

        setCourses((prev) => (isReset ? data.items : [...prev, ...data.items]))
        setTotalCount(data.totalCount)
        setCursor(data.nextCursor)
        setHasMore(data.hasMore)
      } catch (err) {
        console.error(err)
        setError("Non è stato possibile caricare i corsi.")
        showToast("Errore nel caricamento dei corsi.", "error")
      } finally {
        isFetchingRef.current = false
        setIsLoading(false)
        setIsInitialLoading(false)
      }
    },
    [cursor, debouncedSearch, hasMore, isLoading],
  )

  useEffect(() => {
    fetchCourses({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  useEffect(() => {
    const handleScroll = () => {
      if (isLoading || isInitialLoading || !hasMore) return

      const scrollPosition =
        window.innerHeight + (window.scrollY || window.pageYOffset)
      const pageHeight = document.documentElement.scrollHeight
      const threshold = 200 // px dalla fine della pagina

      if (scrollPosition >= pageHeight - threshold) {
        fetchCourses()
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [fetchCourses, hasMore, isInitialLoading, isLoading])

  useEffect(() => {
    const handleClickOutsideDropdown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      const openDropdowns = document.querySelectorAll<HTMLDetailsElement>(
        'details[data-eye-dropdown="true"][open]',
      )

      openDropdowns.forEach((dropdown) => {
        if (!dropdown.contains(target)) {
          dropdown.open = false
        }
      })
    }

    document.addEventListener("click", handleClickOutsideDropdown)

    return () => {
      document.removeEventListener("click", handleClickOutsideDropdown)
    }
  }, [])

  const handleConfirmDeleteDraft = useCallback(async () => {
    if (!draftToDelete) return

    try {
      setDeletingId(draftToDelete.id)
      const res = await fetch(`/api/courses/drafts/${draftToDelete.id}`, {
        method: "DELETE",
      })

      if (!res.ok && res.status !== 204) {
        throw new Error("Errore nella cancellazione della bozza")
      }

      setDrafts((prev) => prev.filter((c) => c.id !== draftToDelete.id))
      showToast("Bozza eliminata con successo.", "success")
    } catch (err) {
      console.error(err)
      setError("Non è stato possibile eliminare la bozza.")
      showToast("Errore durante l'eliminazione della bozza.", "error")
    } finally {
      setDeletingId(null)
      setDraftToDelete(null)
    }
  }, [draftToDelete, showToast])

  return (
    <div className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Corsi LMS
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Elenco dei corsi provenienti da <code>lms_provider_learning</code>,
              ordinati dal più recente.
            </p>
          </div>
          <Button asChild className="self-start">
            <Link href="/courses/create">Nuovo corso</Link>
          </Button>
        </header>

        <section className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-md space-y-1.5">
              <Label htmlFor="search">Ricerca corsi</Label>
              <Input
                id="search"
                placeholder="Cerca per titolo o descrizione..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>
                Risultati:{" "}
                <span className="font-medium text-zinc-700">
                  {totalCount + draftsTotalCount}
                </span>
              </span>
              {isInitialLoading && <span>Caricamento...</span>}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="divide-y divide-zinc-100">
            {[...drafts, ...courses].map((course) => {
              const baseSocialUrl =
                process.env.NEXT_PUBLIC_SOCIAL_URL ??
                process.env.SOCIAL_URL ??
                ""
              const imageFileName =
                course.image_url_landscape ||
                course.image_url_square ||
                course.image_url_portrait ||
                ""

              let imageUrl: string | null = null

              if (imageFileName) {
                // Se è un URL assoluto o un path in /uploads, usalo direttamente
                if (
                  imageFileName.startsWith("http://") ||
                  imageFileName.startsWith("https://") ||
                  imageFileName.startsWith("/uploads/")
                ) {
                  imageUrl = imageFileName
                } else if (baseSocialUrl) {
                  // Compatibilità con immagini legacy in /img/lmshrc
                  imageUrl = `${baseSocialUrl.replace(
                    /\/$/,
                    "",
                  )}/img/lmshrc/${imageFileName
                    .replace("/img/lmshrc/", "")
                    .replace(/^\//, "")}`
                }
              }

              const title =
                course.course_title ??
                course.course_name ??
                "(Titolo non disponibile)"

              const description =
                course.course_description ?? course.description ?? ""

              const category = course.category_name

              const createdAt = course.created_at
                ? new Date(course.created_at).toLocaleString("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                : null

              return (
                <article
                  key={course.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex w-full min-w-0 items-start gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100 sm:h-32 sm:w-32">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={`Immagine corso ${title}`}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h2
                        className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight"
                        title={title}
                      >
                        <span className="block min-w-0 max-w-full wrap-break-word sm:max-w-[540px] sm:truncate">
                          {title}
                        </span>

                        {course.isDraft ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Bozza
                          </span>
                        ) : <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700">
                          ID: {course.id}
                        </span>}
                      </h2>
                      {category && (
                        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                          {category}
                        </p>
                      )}
                      {description && (
                        <p className="text-xs text-zinc-600 line-clamp-2">
                          {description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-xs text-zinc-500 sm:items-end sm:text-right">
                    {createdAt && (
                      <span className="sm:whitespace-nowrap">
                        Creato il {createdAt}
                      </span>
                    )}
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      {course.isDraft ? (
                        <div className="relative group/action">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label="Modifica"
                            onClick={() => {
                              const params = new URLSearchParams()
                              params.set("draft", "1")

                              const query = params.toString()
                              router.push(
                                `/courses/${course.id}/edit${
                                  query ? `?${query}` : ""
                                }`,
                              )
                            }}
                          >
                            <Pencil />
                          </Button>
                          <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow transition-opacity group-hover/action:opacity-100">
                            Modifica bozza
                          </span>
                        </div>
                      ) : (
                        <div className="relative group/action">
                          {course.eye_url && socialUrls.length > 1 ? (
                            <details className="relative" data-eye-dropdown="true">
                              <summary
                                aria-label="Scegli dominio anteprima corso"
                                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
                              >
                                <Eye className="h-4 w-4" />
                              </summary>
                              <div className="absolute top-9 right-0 z-20 min-w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
                                {socialUrls.map((socialUrl) => (
                                  <a
                                    key={socialUrl}
                                    href={buildEyeUrlForDomain(course.eye_url!, socialUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded px-2 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                                  >
                                    {socialUrl.replace(/^https?:\/\//, "")}
                                  </a>
                                ))}
                              </div>
                            </details>
                          ) : (
                            <Button asChild type="button" variant="outline" size="icon-sm">
                              <Link
                                href={
                                  course.eye_url
                                    ? buildEyeUrlForDomain(
                                      course.eye_url,
                                      socialUrls[0] ?? null,
                                    )
                                    : "#"
                                }
                                aria-label="Anteprima corso"
                                target={course.eye_url ? "_blank" : undefined}
                                rel={course.eye_url ? "noopener noreferrer" : undefined}
                              >
                                <Eye />
                              </Link>
                            </Button>
                          )}
                          <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow transition-opacity group-hover/action:opacity-100">
                            Visualizza corso
                          </span>
                        </div>
                      )}
                      {course.isDraft && (
                        <>
                          <div className="relative group/action">
                            <Button
                              type="button"
                              size="icon-sm"
                              aria-label="Pubblica"
                              onClick={() =>
                                router.push(`/courses/${course.id}/review?draft=1`)
                              }
                            >
                              <Rocket />
                            </Button>
                            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow transition-opacity group-hover/action:opacity-100">
                              Pubblica SCORM
                            </span>
                          </div>
                          <div className="relative group/action">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label="Elimina bozza"
                              disabled={deletingId === course.id}
                              onClick={() => setDraftToDelete(course)}
                            >
                              <Trash2 />
                            </Button>
                            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-[10px] font-medium whitespace-nowrap text-white opacity-0 shadow transition-opacity group-hover/action:opacity-100">
                              Elimina bozza
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {!isInitialLoading &&
              drafts.length === 0 &&
              courses.length === 0 &&
              !error && (
              <div className="py-6 text-center text-sm text-zinc-500">
                Nessun corso trovato.
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 pt-2 text-xs text-zinc-500">
            {isLoading && <span>Caricamento altri corsi…</span>}
            {!hasMore && courses.length > 0 && (
              <span>Hai raggiunto la fine della lista.</span>
            )}
          </div>
        </section>
      </div>

      <AlertDialog
        open={!!draftToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDraftToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa bozza?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La bozza del corso verrà
              rimossa definitivamente dall&apos;elenco locale.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteDraft}
              disabled={!!draftToDelete && deletingId === draftToDelete.id}
            >
              Conferma eliminazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

