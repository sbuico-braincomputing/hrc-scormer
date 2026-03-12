import { NextRequest, NextResponse } from "next/server"

import db from "@/lib/db"
import socialDb from "@/lib/social-db"

const PAGE_SIZE = 10
const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type DraftRow = {
  id: number
  data: unknown
  created_at: Date
  updated_at: Date
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const q = searchParams.get("q")?.trim() ?? ""
  const cursorParam = searchParams.get("cursor")
  const limitParam = searchParams.get("limit")

  const limit =
    limitParam && !Number.isNaN(Number(limitParam))
      ? Math.min(Number(limitParam), PAGE_SIZE)
      : PAGE_SIZE

  const cursor = cursorParam ? Number(cursorParam) : undefined

  try {
    const draftsPromise = (db as any)
      .selectFrom(`${DATABASE_PREFIX}drafts`)
      .select(["id", "data", "created_at", "updated_at"])
      .orderBy("created_at", "desc")
      .execute() as Promise<DraftRow[]>

    let baseQuery = socialDb
      .selectFrom("lms_provider_learning as courses")
      .leftJoin(
        "lms_category",
        "lms_category.id",
        "courses.category_id",
      )
      .select([
        "courses.id",
        "courses.image_url_landscape",
        "courses.image_url_portrait",
        "courses.image_url_square",
        "courses.course_scorm_file",
        "courses.course_title",
        "courses.course_name",
        "courses.course_description",
        "courses.description",
        "courses.created_at",
        "courses.updated_at",
      ])
      .select((eb) =>
        eb.ref("lms_category.lms_name").as("category_name"),
      )
      .where("courses.deleted_at", "is", null)

    if (q) {
      baseQuery = baseQuery.where((eb) =>
        eb.or([
          eb("course_title", "like", `%${q}%`),
          eb("course_name", "like", `%${q}%`),
          eb("course_description", "like", `%${q}%`),
          eb("description", "like", `%${q}%`),
        ]),
      )
    }

    const [draftRows, totalResult] = await Promise.all([
      draftsPromise,
      baseQuery
        .clearSelect()
        .select((eb) => eb.fn.countAll<number>().as("totalCount"))
        .executeTakeFirst(),
    ])

    const parsedDrafts = draftRows.map((row) => {
      const data =
        typeof row.data === "string" ? JSON.parse(row.data) : row.data

      return {
        ...(data as Record<string, unknown>),
        id: row.id,
        isDraft: true,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })

    const filteredDrafts =
      q.length === 0
        ? parsedDrafts
        : parsedDrafts.filter((draft) => {
            const draftRecord = draft as Record<string, unknown>

            const searchableFields = [
              draftRecord.course_title,
              draftRecord.course_name,
              draftRecord.course_description,
              draftRecord.description,
            ]
              .filter(Boolean)
              .map((value) => String(value).toLowerCase())

            const query = q.toLowerCase()

            return searchableFields.some((value) =>
              value.includes(query),
            )
          })

    const draftsCount = filteredDrafts.length
    const coursesCount = totalResult?.totalCount ?? 0
    const totalCount = draftsCount + coursesCount

    let query = baseQuery

    if (cursor !== undefined && !Number.isNaN(cursor)) {
      query = query.where("courses.id", "<", cursor)
    }

    const courses = await query
      .orderBy("courses.id", "desc")
      .limit(limit)
      .execute()

    const nextCursor =
      courses.length === limit ? courses[courses.length - 1]?.id ?? null : null

    return NextResponse.json({
      items: [...filteredDrafts, ...courses],
      totalCount,
      nextCursor,
      hasMore: Boolean(nextCursor),
    })
  } catch (error) {
    console.error("Error fetching courses list", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nel recupero dei corsi",
    }

    if (isDebug) {
      if (error instanceof Error) {
        payload.message = error.message
        payload.stack = error.stack
      } else {
        payload.details = String(error)
      }
    }

    return NextResponse.json(payload, { status: 500 })
  }
}
