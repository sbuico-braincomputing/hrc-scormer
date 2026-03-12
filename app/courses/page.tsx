"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Course = {
  id: number
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

export default function CoursesListPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [cursor, setCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
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
        setCourses([])
        setCursor(null)
        setHasMore(true)
        setTotalCount(0)
        setError(null)
      } else {
        setIsLoading(true)
      }

      isFetchingRef.current = true

      try {
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
                  {totalCount}
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
            {courses.map((course) => {
              const baseSocialUrl = process.env.NEXT_PUBLIC_SOCIAL_URL ?? process.env.SOCIAL_URL ?? ""
              const imageFileName =
                course.image_url_landscape ||
                course.image_url_square ||
                course.image_url_portrait ||
                ""

              const imageUrl =
                baseSocialUrl && imageFileName
                  ? `${baseSocialUrl.replace(/\/$/, "")}/img/lmshrc/${imageFileName.replace('/img/lmshrc/', '').replace(/^\//, "")}`
                  : null

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
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex w-full items-start gap-3">
                    <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={`Immagine corso ${title}`}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold tracking-tight">
                        {title}  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-700">
                          ID: {course.id}
                        </span>
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
                  <div className="flex flex-col items-start gap-1 text-right text-xs text-zinc-500 sm:items-end">
                    {createdAt && (
                      <span className="whitespace-nowrap">
                        Creato il {createdAt}
                      </span>
                    )}

                  </div>
                </article>
              )
            })}

            {!isInitialLoading && courses.length === 0 && !error && (
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
    </div>
  )
}

