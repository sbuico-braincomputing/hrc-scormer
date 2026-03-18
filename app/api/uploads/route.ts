import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"

type UploadResult = {
  imageUrl?: string
  scormUrl?: string
}

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {
    // ignore if already exists or cannot be created
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const imageFile = formData.get("courseImage")
    const scormFile = formData.get("scormFile")

    if (!imageFile && !scormFile) {
      return NextResponse.json(
        { error: "Nessun file da caricare" },
        { status: 400 },
      )
    }

    const uploadsRoot = path.join(process.cwd(), "public", "uploads")
    const imageDir = path.join(uploadsRoot, "images")
    const scormDir = path.join(uploadsRoot, "scorm")

    await Promise.all([ensureDir(imageDir), ensureDir(scormDir)])

    const result: UploadResult = {}

    if (imageFile && imageFile instanceof File) {
      const ext = path.extname(imageFile.name) || ".png"
      const fileName = `${randomUUID()}${ext}`
      const filePath = path.join(imageDir, fileName)

      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(filePath, buffer)

      result.imageUrl = `/uploads/images/${fileName}`
    }

    if (scormFile && scormFile instanceof File) {
      const ext = path.extname(scormFile.name) || ".zip"
      const fileName = `${randomUUID()}${ext}`
      const filePath = path.join(scormDir, fileName)

      const arrayBuffer = await scormFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(filePath, buffer)

      result.scormUrl = `/uploads/scorm/${fileName}`
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Errore upload file", error)
    return NextResponse.json(
      { error: "Errore durante il caricamento dei file" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const rawPath =
      body && typeof body.path === "string" ? (body.path as string) : ""

    if (!rawPath.trim()) {
      return NextResponse.json(
        { error: "Percorso file mancante" },
        { status: 400 },
      )
    }

    if (!rawPath.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Percorso non valido" },
        { status: 400 },
      )
    }

    const relativePath = rawPath.replace(/^\/+/, "")
    const absolutePath = path.join(process.cwd(), "public", relativePath)

    try {
      await fs.unlink(absolutePath)
    } catch {
      // Se il file non esiste più, consideriamo comunque l'operazione riuscita
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Errore eliminazione file upload", error)
    return NextResponse.json(
      { error: "Errore durante l'eliminazione del file" },
      { status: 500 },
    )
  }
}


