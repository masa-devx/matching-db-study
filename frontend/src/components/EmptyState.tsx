import { Link } from 'react-router'
import Icon from './Icon'

// 03c：空の状態（FR-UI-033）。アイコン・1行の説明・次にやることのボタンを1つ
export default function EmptyState({
  icon,
  text,
  actionLabel,
  to,
}: {
  icon: string
  text: string
  actionLabel?: string
  to?: string
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={32} />
      </span>
      <p className="empty-text">{text}</p>
      {actionLabel && to && (
        <Link to={to} viewTransition className="button empty-action">
          <span className="button-label">{actionLabel}</span>
        </Link>
      )}
    </div>
  )
}
