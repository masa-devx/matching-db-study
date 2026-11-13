import { type ReactNode, useEffect, useRef } from 'react'
import Button from './Button'

// 03c：確認のモーダル（FR-UI-023。docs/design.md の「確認モーダル」）。<dialog> を showModal() で開くので、
// Esc・後ろを押すと閉じ、フォーカスは中に閉じ込められる。閉じたら、開いたボタンにフォーカスを戻す。
// 06 のブロック・退会、07 の有料会員への誘導もこれを使う（children に説明や入力欄を入れる）
type Props = {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'キャンセル',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onClose={() => {
        opener.current?.focus()
        if (open) onClose()
      }}
      // 後ろ（dialog そのもの）を押したら閉じる。中身を押したときは閉じない
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="sheet-body">
        <h2 id="sheet-title" className="modal-title">
          {title}
        </h2>
        {children}
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  )
}
