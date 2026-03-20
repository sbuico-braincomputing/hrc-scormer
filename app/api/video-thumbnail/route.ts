import { NextRequest, NextResponse } from "next/server"

function getYouTubeThumbnail(url: URL): string | undefined {
  if (
    !url.hostname.includes("youtube.com") &&
    !url.hostname.includes("youtu.be")
  ) {
    return undefined
  }

  let videoId = ""

  if (url.hostname.includes("youtu.be")) {
    videoId = url.pathname.replace("/", "")
  } else {
    videoId = url.searchParams.get("v") ?? ""
  }

  if (!videoId) return undefined

  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

async function getVimeoMetadata(
  url: URL,
): Promise<{ thumbnailUrl?: string; durationSeconds?: number }> {
  if (!url.hostname.includes("vimeo.com")) {
    return {}
  }

  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
      url.toString(),
    )}`

    const res = await fetch(oembedUrl)
    if (!res.ok) return {}

    const data = (await res.json()) as {
      thumbnail_url?: string
      duration?: number
    }

    return {
      thumbnailUrl: data.thumbnail_url,
      durationSeconds:
        typeof data.duration === "number" && Number.isFinite(data.duration)
          ? Math.max(0, Math.round(data.duration))
          : undefined,
    }
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get("url") ?? ""

  if (!rawUrl.trim()) {
    return NextResponse.json(
      { error: "Parametro URL mancante" },
      { status: 400 },
    )
  }

  try {
    const parsed = new URL(rawUrl)

    const youtubeThumb = getYouTubeThumbnail(parsed)
    if (youtubeThumb) {
      return NextResponse.json(
        { thumbnailUrl: youtubeThumb, durationSeconds: null },
        { status: 200 },
      )
    }

    const vimeoMetadata = await getVimeoMetadata(parsed)
    if (vimeoMetadata.thumbnailUrl || vimeoMetadata.durationSeconds !== undefined) {
      return NextResponse.json(
        {
          thumbnailUrl: vimeoMetadata.thumbnailUrl ?? null,
          durationSeconds: vimeoMetadata.durationSeconds ?? null,
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      { thumbnailUrl: null, durationSeconds: null },
      { status: 200 },
    )
  } catch {
    return NextResponse.json(
      { error: "URL video non valido" },
      { status: 400 },
    )
  }
}

