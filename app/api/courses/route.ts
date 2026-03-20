import { NextRequest, NextResponse } from "next/server"

import socialDb from "@/lib/social-db"

const PAGE_SIZE = 10
const COURSES_PATH = "/learning/lms/lms-hrc-courses"

function getPrimarySocialUrl() {
  const socialUrls = (process.env.SOCIAL_URL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  if (socialUrls.length > 0) {
    return socialUrls[0]
  }

  return process.env.NEXT_PUBLIC_SOCIAL_URL?.trim() ?? ""
}

function getCoursesBaseUrl() {
  const coursesBaseUrl = (process.env.COURSES_BASE_URL ?? "").trim()
  const hasMultipleSocialUrls = (process.env.SOCIAL_URL ?? "").includes(",")

  if (coursesBaseUrl && !hasMultipleSocialUrls) {
    return coursesBaseUrl.replace(/\/+$/, "")
  }

  const primarySocialUrl = getPrimarySocialUrl()
  if (!primarySocialUrl) {
    return ""
  }

  return `${primarySocialUrl.replace(/\/+$/, "")}${COURSES_PATH}`
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
    let baseQuery = socialDb
      .selectFrom("lms_provider_learning as courses")
      .leftJoin(
        "lms_category",
        "lms_category.id",
        "courses.category_id",
      )
      .select([
        "courses.id",
        "courses.course_id",
        "courses.category_id",
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

    const totalResult = await baseQuery
      .clearSelect()
      .select((eb) => eb.fn.countAll<number>().as("totalCount"))
      .executeTakeFirst()

    let query = baseQuery

    if (cursor !== undefined && !Number.isNaN(cursor)) {
      query = query.where("courses.id", "<", cursor)
    }

    const courses = await query
      .orderBy("courses.id", "desc")
      .limit(limit)
      .execute()

    const normalizedBaseUrl = getCoursesBaseUrl()
    const items = courses.map((course) => {
      const categoryId = course.category_id
      const courseId = course.course_id

      const eyeUrl =
        normalizedBaseUrl &&
        categoryId !== null &&
        categoryId !== undefined &&
        courseId !== null &&
        courseId !== undefined
          ? `${normalizedBaseUrl}/${categoryId}/${courseId}`
          : null

      return {
        ...course,
        eye_url: eyeUrl,
      }
    })

    const nextCursor =
      courses.length === limit ? courses[courses.length - 1]?.id ?? null : null

    return NextResponse.json(
      {
        items,
        totalCount: totalResult?.totalCount ?? 0,
        nextCursor,
        hasMore: Boolean(nextCursor),
      },
      { status: 200 },
    )
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
