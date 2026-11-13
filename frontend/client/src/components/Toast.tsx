import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react'

// 03c：トースト（FR-UI-024）。画面の上の真ん中に1つだけ。新しいものが来たら、タイマーごと入れ替える（3秒）。
// role="status" で読み上げる。どの画面からも useToast().show() で出す
type Kind = 'success' | 'error'
const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; kind: Kind; key: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((text: string, kind: Kind = 'success') => {
    window.clearTimeout(timer.current)
    setToast({ text, kind, key: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {toast && (
          <p key={toast.key} className={`toast toast-${toast.kind}`}>
            <span className="toast-dot" aria-hidden="true" />
            {toast.text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
