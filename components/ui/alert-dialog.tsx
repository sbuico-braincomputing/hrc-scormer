"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "./button"

type AlertDialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(
  null,
)

function useAlertDialogContext() {
  const context = React.useContext(AlertDialogContext)
  if (!context) {
    throw new Error(
      "AlertDialog subcomponents must be used within <AlertDialog>",
    )
  }
  return context
}

export interface AlertDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function AlertDialog({
  open,
  onOpenChange,
  children,
}: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open)

  React.useEffect(() => {
    setInternalOpen(open)
  }, [open])

  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  if (!internalOpen) return null

  return (
    <AlertDialogContext.Provider value={{ open: internalOpen, setOpen }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        {children}
      </div>
    </AlertDialogContext.Provider>
  )
}

export interface AlertDialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  AlertDialogContentProps
>(({ className, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()

  return (
    <div
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
      onClick={() => setOpen(false)}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        className={cn(
          "pointer-events-auto w-full max-w-sm rounded-lg bg-white p-6 shadow-lg outline-none",
          className,
        )}
        onClick={(event) => {
          event.stopPropagation()
        }}
        {...props}
      />
    </div>
  )
})

AlertDialogContent.displayName = "AlertDialogContent"

export const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-left", className)}
    {...props}
  />
)

export const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
)

export const AlertDialogTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2
    className={cn("text-base font-semibold text-zinc-900", className)}
    {...props}
  />
)

export const AlertDialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn("mt-1 text-sm text-zinc-600", className)}
    {...props}
  />
)

export type AlertDialogButtonProps = React.ComponentProps<typeof Button>

export const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  AlertDialogButtonProps
>(({ className, ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()

  return (
    <Button
      ref={ref}
      className={cn(className)}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) {
          setOpen(false)
        }
      }}
      {...props}
    />
  )
})

AlertDialogAction.displayName = "AlertDialogAction"

export const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  AlertDialogButtonProps
>(({ className, variant = "outline", ...props }, ref) => {
  const { setOpen } = useAlertDialogContext()

  return (
    <Button
      ref={ref}
      variant={variant}
      className={cn(className)}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) {
          setOpen(false)
        }
      }}
      {...props}
    />
  )
})

AlertDialogCancel.displayName = "AlertDialogCancel"

