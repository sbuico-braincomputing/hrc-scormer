import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

import db from "@/lib/db"
import socialDb from "@/lib/social-db"
import {
  buildPublishPreview,
  collectMissingFields,
  DraftPayload,
} from "@/lib/draft-publish-preview"
import { getErrorLogger, serializeError } from "@/lib/logger"

const DATABASE_PREFIX = process.env.DATABASE_PREFIX ?? ""

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

type DraftRow = {
  id: number
  data: unknown
}

type PublishModule = {
  title?: string | null
  description?: string | null
  video_url?: string | null
  video_document_id?: string | number | null
  document_id?: string | number | null
  trainers?: Array<{
    name?: string | null
    role?: string | null
    company?: string | null
  }> | null
}

type FtpTargetConfig = {
  name: string
  host: string
  port: number
  user: string
  password: string
  secure: boolean
  basePath?: string
  scormPaths: string[]
  imagePaths: string[]
}

function isMissingColumn(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; sqlMessage?: unknown }
  if (candidate.code === "ER_BAD_FIELD_ERROR") {
    return String(candidate.sqlMessage ?? "").includes(columnName)
  }
  return false
}

class PublishError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(
    message: string,
    options?: {
      status?: number
      code?: string
      details?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = "PublishError"
    this.status = options?.status ?? 500
    this.code = options?.code ?? "PUBLISH_ERROR"
    this.details = options?.details
  }
}

async function createFtpClient() {
  const ftpModuleName = "basic-ftp"
  try {
    const ftpLib = (await import(ftpModuleName)) as {
      Client: new (timeout?: number) => any
    }
    return new ftpLib.Client(20000)
  } catch {
    throw new PublishError("Dipendenza FTP non installata: basic-ftp.", {
      status: 500,
      code: "FTP_DEPENDENCY_MISSING",
    })
  }
}

async function loadDraftPayload(numericId: number) {
  let draft: DraftRow | undefined
  try {
    draft = (await (db as any)
      .selectFrom(`${DATABASE_PREFIX}drafts`)
      .select(["id", "data"])
      .where("id", "=", numericId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()) as DraftRow | undefined
  } catch (error) {
    if (!isMissingColumn(error, "deleted_at")) {
      throw error
    }
    draft = (await (db as any)
      .selectFrom(`${DATABASE_PREFIX}drafts`)
      .select(["id", "data"])
      .where("id", "=", numericId)
      .executeTakeFirst()) as DraftRow | undefined
  }

  if (!draft) return null

  const payload =
    typeof draft.data === "string" ? JSON.parse(draft.data) : draft.data

  return (payload ?? {}) as DraftPayload
}

function getLocalUploadPath(uploadUrl: string | null | undefined) {
  if (!uploadUrl || !uploadUrl.startsWith("/uploads/")) {
    throw new Error("Percorso upload locale non valido per publish FTP.")
  }
  const relative = uploadUrl.replace(/^\/+/, "")
  return path.join(process.cwd(), "public", relative)
}

function normalizeCourseLanguage(value: unknown): "it" | "en" {
  return value === "en" ? "en" : "it"
}

function getFtpConfig() {
  const host = process.env.FTP_HOST
  const user = process.env.FTP_USER
  const password = process.env.FTP_PASSWORD
  const port = Number(process.env.FTP_PORT ?? 21)
  const secure =
    process.env.FTP_SECURE === "true" ||
    process.env.FTP_SECURE === "1" ||
    process.env.FTP_SECURE === "TRUE"

  if (!host || !user || !password) {
    throw new PublishError(
      "Configurazione FTP incompleta: valorizza FTP_HOST, FTP_USER e FTP_PASSWORD.",
      {
        status: 400,
        code: "FTP_ENV_MISSING",
      },
    )
  }

  if (!Number.isFinite(port) || port <= 0) {
    throw new PublishError("Valore FTP_PORT non valido.", {
      status: 400,
      code: "FTP_PORT_INVALID",
    })
  }

  return { host, user, password, port, secure }
}

function parseFtpTargetsFromEnv(): FtpTargetConfig[] {
  const rawJson = process.env.FTP_TARGETS_JSON?.trim()
  if (!rawJson) {
    const single = getFtpConfig()
    return [
      {
        name: "default",
        host: single.host,
        port: single.port,
        user: single.user,
        password: single.password,
        secure: single.secure,
        basePath: "",
        scormPaths: (process.env.FTP_SCORM_PATHS ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        imagePaths: (process.env.FTP_IMAGE_PATHS ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      },
    ]
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new PublishError("FTP_TARGETS_JSON non è un JSON valido.", {
      status: 400,
      code: "FTP_TARGETS_JSON_INVALID",
    })
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new PublishError("FTP_TARGETS_JSON deve contenere almeno un target.", {
      status: 400,
      code: "FTP_TARGETS_JSON_EMPTY",
    })
  }

  return parsed.map((item, index) => {
    const target = item as Record<string, unknown>
    const host = String(target.host ?? "").trim()
    const user = String(target.user ?? "").trim()
    const password = String(target.password ?? "").trim()
    const name = String(target.name ?? `target_${index + 1}`).trim()
    const port = Number(target.port ?? 21)
    const secure = Boolean(target.secure)
    const basePath = String(target.basePath ?? "").trim()
    const scormPaths = Array.isArray(target.scormPaths)
      ? target.scormPaths.map((path) => String(path).trim()).filter(Boolean)
      : []
    const imagePaths = Array.isArray(target.imagePaths)
      ? target.imagePaths.map((path) => String(path).trim()).filter(Boolean)
      : []

    if (!host || !user || !password) {
      throw new PublishError(`Target FTP ${name}: host/user/password obbligatori.`, {
        status: 400,
        code: "FTP_TARGET_INVALID",
      })
    }
    if (!Number.isFinite(port) || port <= 0) {
      throw new PublishError(`Target FTP ${name}: porta non valida.`, {
        status: 400,
        code: "FTP_TARGET_PORT_INVALID",
      })
    }
    if (scormPaths.length === 0 || imagePaths.length === 0) {
      throw new PublishError(
        `Target FTP ${name}: servono scormPaths e imagePaths valorizzati.`,
        {
          status: 400,
          code: "FTP_TARGET_PATHS_MISSING",
        },
      )
    }

    return {
      name,
      host,
      user,
      password,
      port,
      secure,
      basePath,
      scormPaths,
      imagePaths,
    }
  })
}

function composeRemotePath(basePath: string | undefined, itemPath: string) {
  const normalizedBase = (basePath ?? "").trim().replace(/\/+$/, "")
  const normalizedPath = itemPath.trim().replace(/^\/+/, "")
  if (!normalizedBase) {
    return `/${normalizedPath}`
  }
  return `${normalizedBase}/${normalizedPath}`
}

function normalizeDocumentId(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeModules(payload: DraftPayload): PublishModule[] {
  if (!Array.isArray(payload.modules)) return []
  return payload.modules as PublishModule[]
}

function formatModuleTrainers(
  trainers: PublishModule["trainers"],
): string {
  const normalized = Array.isArray(trainers) ? trainers : []
  if (normalized.length === 0) return ""

  const namesAndRoles = normalized
    .map((trainer) => {
      const name = (trainer?.name ?? "").trim()
      const role = (trainer?.role ?? "").trim()
      if (!name && !role) return ""
      if (!name) return role
      if (!role) return name
      return `${name}, ${role}`
    })
    .filter(Boolean)

  const company = (normalized[0]?.company ?? "").trim()
  if (namesAndRoles.length === 0) return company
  if (!company) return namesAndRoles.join(" e ")
  return `${namesAndRoles.join(" e ")} ${company}`
}

async function resolveVideoDocumentIdForModule(
  trx: any,
  module: PublishModule,
): Promise<number | null> {
  const explicitId = normalizeDocumentId(module.video_document_id)
  if (explicitId !== null) return explicitId

  const videoUrl = (module.video_url ?? "").trim()
  if (!videoUrl) return null

  const numericFromUrl = normalizeDocumentId(videoUrl)
  if (numericFromUrl !== null) return numericFromUrl

  const docByFilename = await trx
    .selectFrom("documents")
    .select(["id"])
    .where("filename", "=", videoUrl)
    .orderBy("id", "desc")
    .executeTakeFirst()

  if (docByFilename?.id) {
    return Number(docByFilename.id)
  }

  return null
}

async function uploadFileToFtpTargets(params: {
  target: FtpTargetConfig
  localFilePath: string
  remoteTargets: string[]
}) {
  if (params.remoteTargets.length === 0) {
    throw new PublishError("Nessun target FTP configurato.", {
      status: 400,
      code: "FTP_TARGETS_MISSING",
    })
  }
  const config = params.target

  const client = await createFtpClient()
  client.ftp.verbose = false
  const uploadedTargets: string[] = []

  try {
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      secure: config.secure,
    })

    for (const target of params.remoteTargets) {
      const normalizedTarget = target.replace(/\/+/g, "/")
      const remoteDir = normalizedTarget.split("/").slice(0, -1).join("/") || "/"
      await client.ensureDir(remoteDir)
      await client.uploadFrom(params.localFilePath, normalizedTarget)
      uploadedTargets.push(normalizedTarget)
    }
  } finally {
    client.close()
  }

  return uploadedTargets
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params
    const numericId = Number(id)

    if (!numericId || Number.isNaN(numericId)) {
      return NextResponse.json(
        { error: "ID bozza non valido" },
        { status: 400 },
      )
    }

    const payload = await loadDraftPayload(numericId)
    if (!payload) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 },
      )
    }

    const missingFields = collectMissingFields(payload)

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Impossibile pubblicare: ci sono campi mancanti.",
          missingFields,
          editUrl: `/courses/${numericId}/edit?draft=1`,
        },
        { status: 400 },
      )
    }

    const preview = await buildPublishPreview(payload)
    const dbImagePath = `/img/lmshrc/${preview.imageFilename}`
    const scormLocalPath = getLocalUploadPath(payload.course_scorm_file)
    const imageLocalPath = getLocalUploadPath(payload.image_url_landscape)

    try {
      await Promise.all([fs.access(scormLocalPath), fs.access(imageLocalPath)])
    } catch {
      throw new PublishError(
        "File locali non trovati: ricarica immagine e SCORM prima di pubblicare.",
        {
          status: 400,
          code: "LOCAL_FILES_MISSING",
        },
      )
    }

    const ftpTargets = parseFtpTargetsFromEnv()
    const uploadedTargets: Array<{ target: FtpTargetConfig; path: string }> = []

    try {
      // 1) FTP upload: se fallisce, stop senza query DB esterno.
      for (const target of ftpTargets) {
        const scormRemoteTargets = target.scormPaths.map(
          (remotePath) =>
            `${composeRemotePath(target.basePath, remotePath).replace(/\/$/, "")}/${preview.scormFilename}`,
        )
        const imageRemoteTargets = target.imagePaths.map(
          (remotePath) =>
            `${composeRemotePath(target.basePath, remotePath).replace(/\/$/, "")}/${preview.imageFilename}`,
        )

        const uploadedScorm = await uploadFileToFtpTargets({
          target,
          localFilePath: scormLocalPath,
          remoteTargets: scormRemoteTargets,
        })
        uploadedTargets.push(...uploadedScorm.map((path) => ({ target, path })))

        const uploadedImage = await uploadFileToFtpTargets({
          target,
          localFilePath: imageLocalPath,
          remoteTargets: imageRemoteTargets,
        })
        uploadedTargets.push(...uploadedImage.map((path) => ({ target, path })))
      }

      // 2) DB esterno transaction.
      const insertResult = await socialDb.transaction().execute(async (trx) => {
        const maxCourseIdRow = await (trx as any)
          .selectFrom("lms_provider_learning")
          .select((eb: any) => eb.fn.max("course_id").as("max_course_id"))
          .executeTakeFirst()

        const nextCourseId = Number(maxCourseIdRow?.max_course_id ?? 0) + 1

        const courseInsert = await (trx as any)
          .insertInto("lms_provider_learning")
          .values({
            course_id: nextCourseId,
            course_code: preview.resolvedCourseCode,
            course_title: payload.course_title ?? payload.course_name ?? null,
            course_name: payload.course_name ?? payload.course_title ?? null,
            course_description:
              payload.course_description ?? payload.description ?? null,
            description: payload.description ?? payload.course_description ?? null,
            duration: Number(payload.duration ?? 0) || 0,
            category_id: payload.category_id ? Number(payload.category_id) : null,
            course_scorm_file: preview.scormFilename,
            course_scorm_available: "1",
            image_url_landscape: dbImagePath,
            image_url_square: dbImagePath,
            min_perc_complete: 80,
            language: normalizeCourseLanguage(payload.language),
          })
          .executeTakeFirst()

        const courseId = Number((courseInsert as any).insertId ?? 0)
        if (!courseId) {
          throw new Error("Inserimento corso non riuscito sul DB esterno.")
        }

        const modules = normalizeModules(payload)
        for (let index = 0; index < modules.length; index += 1) {
          const module = modules[index]
          const moduleInsert = await (trx as any)
            .insertInto("lms_provider_learning_moduli")
            .values({
              course_id: nextCourseId,
              module_title: module.title ?? null,
              module_description: module.description ?? null,
              module_order: String(index + 1),
              module_trainers: formatModuleTrainers(module.trainers),
              module_status: 1,
            })
            .executeTakeFirst()

          const moduleId = Number((moduleInsert as any).insertId ?? 0)
          if (!moduleId) {
            throw new Error(`Inserimento modulo ${index + 1} non riuscito.`)
          }

          const videoDocId = await resolveVideoDocumentIdForModule(trx as any, module)
          const docId = normalizeDocumentId(module.document_id)
          if (videoDocId === null || docId === null) {
            throw new PublishError(
              `Modulo ${index + 1}: servono sia video che documento per creare i record SCORM.`,
              {
                status: 400,
                code: "SCORM_LINKS_MISSING",
                details: {
                  moduleIndex: index + 1,
                  hasVideo: videoDocId !== null,
                  hasDocument: docId !== null,
                },
              },
            )
          }

          // list_order 1 = video
          await (trx as any)
            .insertInto("lms_provider_learning_scorm")
            .values({
              course_id: nextCourseId,
              module_id: moduleId,
              document_id: videoDocId,
              list_order: 1,
            })
            .executeTakeFirst()

          // list_order 2 = documento
          await (trx as any)
            .insertInto("lms_provider_learning_scorm")
            .values({
              course_id: nextCourseId,
              module_id: moduleId,
              document_id: docId,
              list_order: 2,
            })
            .executeTakeFirst()
        }

        return { courseId, nextCourseId }
      })

      // 3) soft-delete bozza solo a successo completo.
      try {
        await (db as any)
          .updateTable(`${DATABASE_PREFIX}drafts`)
          .set({
            deleted_at: new Date(),
            published_course_id: insertResult.nextCourseId,
          })
          .where("id", "=", numericId)
          .where("deleted_at", "is", null)
          .executeTakeFirst()
      } catch (error) {
        if (
          !isMissingColumn(error, "deleted_at") &&
          !isMissingColumn(error, "published_course_id")
        ) {
          throw error
        }
        await (db as any)
          .deleteFrom(`${DATABASE_PREFIX}drafts`)
          .where("id", "=", numericId)
          .executeTakeFirst()
      }

      return NextResponse.json(
        {
          success: true,
          mode: "published",
          message: "Corso pubblicato con successo.",
          publishedCourseId: insertResult.courseId,
          publishedCourseBusinessId: insertResult.nextCourseId,
          courseCode: preview.resolvedCourseCode,
        },
        { status: 200 },
      )
    } catch (publishError) {
      let compensationFailed = false
      try {
        for (const target of ftpTargets) {
          const client = await createFtpClient()
          client.ftp.verbose = false
          try {
            await client.access({
              host: target.host,
              user: target.user,
              password: target.password,
              port: target.port,
              secure: target.secure,
            })
            const targetUploads = uploadedTargets.filter(
              (entry) => entry.target.name === target.name,
            )
            for (const entry of targetUploads) {
              try {
                await client.remove(entry.path)
              } catch {
                compensationFailed = true
              }
            }
          } finally {
            client.close()
          }
        }
      } catch {
        compensationFailed = true
      }

      if (publishError instanceof PublishError) {
        if (compensationFailed) {
          publishError.details = {
            ...(publishError.details ?? {}),
            compensationWarning: "Rollback FTP parziale: verifica i file remoti.",
          }
        }
        throw publishError
      }

      throw new PublishError("Errore durante la pubblicazione del corso.", {
        status: 500,
        code: "PUBLISH_RUNTIME_ERROR",
        details: {
          ...(compensationFailed
            ? { compensationWarning: "Rollback FTP parziale: verifica i file remoti." }
            : {}),
          cause:
            publishError instanceof Error
              ? publishError.message
              : String(publishError),
        },
      })
    }
  } catch (error) {
    const errorLogger = getErrorLogger()
    const serializedError = serializeError(error)
    errorLogger.error(
      {
        context: "publish-draft",
        draftRoute: "/api/courses/drafts/[id]/publish",
        error: serializedError,
      },
      "Errore publish bozza",
    )
    console.error("Error publishing draft", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nella pubblicazione della bozza",
    }

    if (error instanceof PublishError) {
      payload.error = error.message
      payload.code = error.code
      payload.details = {
        ...(error.details ?? {}),
        ...serializedError,
      }
      return NextResponse.json(payload, { status: error.status })
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

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params
    const numericId = Number(id)

    if (!numericId || Number.isNaN(numericId)) {
      return NextResponse.json(
        { error: "ID bozza non valido" },
        { status: 400 },
      )
    }

    const payload = await loadDraftPayload(numericId)
    if (!payload) {
      return NextResponse.json(
        { error: "Bozza non trovata" },
        { status: 404 },
      )
    }

    const missingFields = collectMissingFields(payload)
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Impossibile generare l'anteprima: ci sono campi mancanti.",
          missingFields,
          editUrl: `/courses/${numericId}/edit?draft=1`,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        draftId: numericId,
        mode: "preview-only",
        preview: await buildPublishPreview(payload),
      },
      { status: 200 },
    )
  } catch (error) {
    const errorLogger = getErrorLogger()
    errorLogger.error(
      {
        context: "publish-preview",
        draftRoute: "/api/courses/drafts/[id]/publish",
        error: serializeError(error),
      },
      "Errore generazione preview publish",
    )
    console.error("Error generating publish preview", error)

    const isDebug =
      process.env.DEBUG === "TRUE" ||
      process.env.DEBUG === "true" ||
      process.env.DEBUG === "1"

    const payload: Record<string, unknown> = {
      error: "Errore nella generazione dell'anteprima pubblicazione",
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
