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

async function getVimeoThumbnail(url: URL): Promise<string | undefined> {
  if (!url.hostname.includes("vimeo.com")) {
    return undefined
  }

  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
      url.toString(),
    )}`

    const res = await fetch(oembedUrl)
    if (!res.ok) {
      return undefined
    }

    const data = (await res.json()) as { thumbnail_url?: string }
    return data.thumbnail_url
  } catch {
    return undefined
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
      return NextResponse.json({ thumbnailUrl: youtubeThumb }, { status: 200 })
    }

    const vimeoThumb = await getVimeoThumbnail(parsed)
    if (vimeoThumb) {
      return NextResponse.json({ thumbnailUrl: vimeoThumb }, { status: 200 })
    }

    return NextResponse.json({ thumbnailUrl: null }, { status: 200 })
  } catch {
    return NextResponse.json(
      { error: "URL video non valido" },
      { status: 400 },
    )
  }
}

