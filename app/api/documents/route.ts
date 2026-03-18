import { NextRequest, NextResponse } from "next/server"

import socialDb from "@/lib/social-db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get("limit")
    const typeParam = searchParams.get("type")?.trim().toLowerCase()
    const qParam = searchParams.get("q")?.trim()

    let limit = Number.parseInt(limitParam || "", 10)
    if (!Number.isFinite(limit) || limit <= 0) {
      limit = 20
    }
    if (limit > 100) {
      limit = 100
    }

    let query = socialDb.selectFrom("documents").selectAll()

    if (typeParam === "doc" || typeParam === "video") {
      query = query.where("type", "=", typeParam)
    }

    if (qParam && qParam.length > 0) {
      const pattern = `%${qParam}%`
      query = query.where((eb) =>
        eb.or([
          eb("documents.title", "like", pattern),
          eb("documents.filename", "like", pattern),
        ]),
      )
    }

    
    const documents = await query.limit(limit).execute()

    return NextResponse.json(documents, { status: 200 })
  } catch (error) {
    console.error("Error fetching documents list", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nel recupero dei documenti",
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

