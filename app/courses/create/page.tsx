"use client"

import { useState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type Trainer = {
  name: string
  role: string
  company: string
}

type Module = {
  title: string
  description: string
  videoUrl: string
  thumbnailUrl?: string
  selectedDocumentId?: string
  documentSearch: string
  trainers: Trainer[]
}

type CourseFormState = {
  title: string
  description: string
  imageFile?: File
  dateFrom: string
  dateTo: string
  category: string
  company: string
  scormFileName?: string
  modules: Module[]
}

const DOCUMENTS = [
  { id: "DOC-001", name: "Manuale dipendenti" },
  { id: "DOC-002", name: "Policy sicurezza" },
  { id: "DOC-003", name: "Guida onboarding" },
  { id: "DOC-004", name: "Materiale formativo generale" },
]

const CATEGORIES = [
  { id: "cat-hr", label: "Risorse umane" },
  { id: "cat-soft", label: "Soft skills" },
  { id: "cat-tech", label: "Competenze tecniche" },
]

function getVideoThumbnail(url: string): string | undefined {
  try {
    const parsed = new URL(url)

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      let videoId = ""

      if (parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "")
      } else {
        videoId = parsed.searchParams.get("v") ?? ""
      }

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

export default function CourseCreatePage() {
  const [form, setForm] = useState<CourseFormState>({
    title: "",
    description: "",
    imageFile: undefined,
    dateFrom: "",
    dateTo: "",
    category: "",
    company: "",
    scormFileName: undefined,
    modules: Array.from({ length: 4 }, () => ({
      title: "",
      description: "",
      videoUrl: "",
      thumbnailUrl: undefined,
      selectedDocumentId: undefined,
      documentSearch: "",
      trainers: [],
    })),
  })

  function updateModule(index: number, updater: (current: Module) => Module) {
    setForm((prev) => {
      const modules = [...prev.modules]
      modules[index] = updater(modules[index])
      return { ...prev, modules }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: integrare con il backend quando sarà pronto
    console.log("Course form submit", form)
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-10 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Crea nuovo corso
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Compila le informazioni del corso, carica il file SCORM e
              configura i moduli.
            </p>
          </div>
          <Button type="submit" form="course-form" className="self-start">
            Salva corso
          </Button>
        </header>

        <form
          id="course-form"
          onSubmit={handleSubmit}
          className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]"
        >
          <section className="space-y-6 rounded-lg bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">
              Dettagli corso
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titolo corso</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Es. Introduzione alla sicurezza sul lavoro"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Descrizione corso</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descrivi gli obiettivi e i contenuti principali del corso..."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] sm:items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="courseImage">Immagine corso</Label>
                  <Input
                    id="courseImage"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      setForm((prev) => ({
                        ...prev,
                        imageFile: file,
                      }))
                    }}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Carica l&apos;immagine di copertina del corso. Verrà salvata e poi
                    mostrata nella lista corsi.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
                  {form.imageFile ? (
                    <>
                      <div className="relative h-28 w-full overflow-hidden rounded-md bg-black/5">
                        <Image
                          src={URL.createObjectURL(form.imageFile)}
                          alt="Immagine corso"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <span className="text-xs text-zinc-500">
                        Anteprima immagine corso
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xs text-zinc-400">
                        Nessuna
                        <br />
                        immagine
                      </div>
                      <span className="text-xs text-zinc-400">
                        Incolla un URL valido per vedere l&apos;anteprima
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="dateFrom">Data da</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={form.dateFrom}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dateFrom: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateTo">Data a</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={form.dateTo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dateTo: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Categoria</Label>
                  <div className="relative">
                    <select
                      id="category"
                      className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.category}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                    >
                      <option value="">Seleziona una categoria</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-zinc-500">
                      ▼
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company">Azienda</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                    placeholder="Es. ACME S.p.A."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scorm">File SCORM (.zip)</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="scorm"
                    type="file"
                    accept=".zip"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      setForm((prev) => ({
                        ...prev,
                        scormFileName: file?.name,
                      }))
                    }}
                  />
                  {form.scormFileName && (
                    <span className="text-xs text-zinc-500">
                      Selezionato: {form.scormFileName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Moduli</h2>
              <p className="text-xs text-zinc-500">
                Per ora sono presenti 4 moduli fissi.
              </p>
            </div>

            <div className="space-y-5">
              {form.modules.map((module, index) => {
                const selectedDocument = DOCUMENTS.find(
                  (doc) => doc.id === module.selectedDocumentId,
                )

                const filteredDocuments = DOCUMENTS.filter((doc) =>
                  (module.documentSearch || "")
                    .toLowerCase()
                    .split(" ")
                    .every((term) =>
                      doc.name.toLowerCase().includes(term) ||
                      doc.id.toLowerCase().includes(term),
                    ),
                )

                return (
                  <div
                    key={index}
                    className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight">
                        Modulo {index + 1}
                      </h3>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`module-title-${index}`}>
                          Titolo
                        </Label>
                        <Input
                          id={`module-title-${index}`}
                          value={module.title}
                          onChange={(e) =>
                            updateModule(index, (current) => ({
                              ...current,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Titolo del modulo"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`module-description-${index}`}>
                          Descrizione
                        </Label>
                        <Textarea
                          id={`module-description-${index}`}
                          value={module.description}
                          onChange={(e) =>
                            updateModule(index, (current) => ({
                              ...current,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Descrizione sintetica del modulo..."
                          rows={3}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] sm:items-start">
                        <div className="space-y-1.5">
                          <Label htmlFor={`module-video-${index}`}>
                            Link al video
                          </Label>
                          <Input
                            id={`module-video-${index}`}
                            value={module.videoUrl}
                            onChange={(e) => {
                              const value = e.target.value
                              const thumbnail = getVideoThumbnail(value)
                              updateModule(index, (current) => ({
                                ...current,
                                videoUrl: value,
                                thumbnailUrl: thumbnail,
                              }))
                            }}
                            placeholder="Incolla il link al video (es. YouTube)"
                          />
                          <p className="mt-1 text-xs text-zinc-500">
                            Una volta incollato il link verrà caricata
                            automaticamente la thumbnail (se disponibile).
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3">
                          {module.thumbnailUrl ? (
                            <>
                              <div className="relative h-28 w-full overflow-hidden rounded-md bg-black/5">
                                <Image
                                  src={module.thumbnailUrl}
                                  alt="Anteprima video"
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <span className="text-xs text-zinc-500">
                                Anteprima video
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xs text-zinc-400">
                                Nessuna
                                <br />
                                anteprima
                              </div>
                              <span className="text-xs text-zinc-400">
                                Incolla un link YouTube per vedere la thumbnail
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Documento associato</Label>
                        <div className="space-y-1.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              placeholder="Cerca per nome o ID documento..."
                              value={module.documentSearch}
                              onChange={(e) =>
                                updateModule(index, (current) => ({
                                  ...current,
                                  documentSearch: e.target.value,
                                }))
                              }
                            />
                            <div className="min-w-[150px] text-xs text-zinc-500">
                              {selectedDocument ? (
                                <span>
                                  Selezionato:{" "}
                                  <span className="font-medium">
                                    {selectedDocument.name}
                                  </span>{" "}
                                  <span className="text-[10px] text-zinc-400">
                                    ({selectedDocument.id})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-zinc-400">
                                  Nessun documento selezionato
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="max-h-32 space-y-1 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-1.5 text-xs">
                            {filteredDocuments.length === 0 && (
                              <div className="rounded px-2 py-1 text-zinc-400">
                                Nessun documento trovato
                              </div>
                            )}
                            {filteredDocuments.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition hover:bg-white ${
                                  module.selectedDocumentId === doc.id
                                    ? "bg-white text-zinc-900"
                                    : "text-zinc-700"
                                }`}
                                onClick={() =>
                                  updateModule(index, (current) => ({
                                    ...current,
                                    selectedDocumentId: doc.id,
                                  }))
                                }
                              >
                                <span className="truncate">{doc.name}</span>
                                <span className="ml-2 shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
                                  {doc.id}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-md border border-zinc-100 bg-zinc-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            Trainer
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateModule(index, (current) => ({
                                ...current,
                                trainers: [
                                  ...current.trainers,
                                  {
                                    name: "",
                                    role: "",
                                    company: form.company,
                                  },
                                ],
                              }))
                            }}
                          >
                            Aggiungi trainer
                          </Button>
                        </div>

                        {module.trainers.length === 0 ? (
                          <p className="text-xs text-zinc-500">
                            Nessun trainer aggiunto. Clicca su{" "}
                            <span className="font-medium">
                              “Aggiungi trainer”
                            </span>{" "}
                            per inserire il primo.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {module.trainers.map((trainer, tIndex) => (
                              <div
                                key={tIndex}
                                className="grid gap-2 rounded-md border border-zinc-200 bg-white p-2.5 sm:grid-cols-3"
                              >
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`module-${index}-trainer-name-${tIndex}`}
                                    className="text-xs"
                                  >
                                    Nome
                                  </Label>
                                  <Input
                                    id={`module-${index}-trainer-name-${tIndex}`}
                                    value={trainer.name}
                                    onChange={(e) =>
                                      updateModule(index, (current) => {
                                        const trainers = [...current.trainers]
                                        trainers[tIndex] = {
                                          ...trainers[tIndex],
                                          name: e.target.value,
                                        }
                                        return { ...current, trainers }
                                      })
                                    }
                                    placeholder="Nome e cognome"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`module-${index}-trainer-role-${tIndex}`}
                                    className="text-xs"
                                  >
                                    Ruolo
                                  </Label>
                                  <Input
                                    id={`module-${index}-trainer-role-${tIndex}`}
                                    value={trainer.role}
                                    onChange={(e) =>
                                      updateModule(index, (current) => {
                                        const trainers = [...current.trainers]
                                        trainers[tIndex] = {
                                          ...trainers[tIndex],
                                          role: e.target.value,
                                        }
                                        return { ...current, trainers }
                                      })
                                    }
                                    placeholder="Es. Formatore interno"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`module-${index}-trainer-company-${tIndex}`}
                                    className="text-xs"
                                  >
                                    Azienda
                                  </Label>
                                  <Input
                                    id={`module-${index}-trainer-company-${tIndex}`}
                                    value={trainer.company}
                                    onChange={(e) =>
                                      updateModule(index, (current) => {
                                        const trainers = [...current.trainers]
                                        trainers[tIndex] = {
                                          ...trainers[tIndex],
                                          company: e.target.value,
                                        }
                                        return { ...current, trainers }
                                      })
                                    }
                                    placeholder="Azienda del trainer"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </form>
      </div>
    </div>
  )
}

