import type { ButtonHTMLAttributes } from 'react'

// 03c：ボタン（docs/design.md の「主なボタン・控えめなボタン・危ないボタン」）。
// 送信中は文字を見えなくして幅を保ち、スピナーを重ねて、押せなくする（FR-UI-026）
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  small?: boolean
  loading?: boolean
}

export default function Button({
  variant = 'primary',
  small = false,
  loading = false,
  className = '',
  children,
  ...rest
}: Props) {
  const classes = [
    'button',
    variant === 'ghost' && 'button-ghost',
    variant === 'danger' && 'button-danger',
    small && 'button-small',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" {...rest} className={classes} disabled={rest.disabled || loading} aria-busy={loading}>
      <span className={loading ? 'button-label is-hidden' : 'button-label'}>{children}</span>
      {loading && <span className="spinner" aria-hidden="true" />}
    </button>
  )
}
