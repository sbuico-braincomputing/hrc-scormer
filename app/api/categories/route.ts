import { NextRequest, NextResponse } from "next/server"

import socialDb from "@/lib/social-db"

export async function GET(_request: NextRequest) {
  try {
    const categories = await socialDb
      .selectFrom("lms_category")
      .select(["id", "lms_name", "cat_default"])
      .where("cat_default", "=", 1)
      .execute()

    return NextResponse.json(categories, { status: 200 })
  } catch (error) {
    console.error("Error fetching categories list", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nel recupero delle categorie",
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

