import { Badge } from '@mantine/core'
import { toDate } from '../../date'

// A1（#224）：有料の区分。is_paid は、期限が過ぎても true のまま（会員の側が戻していない）なので、期限も見て分ける。
// 同じ決め方が、API（会員の一覧・ダッシュボード）にもある。ここは、会員の詳細のために、画面の側にもう一度書いたもの
export type PaidState = 'free' | 'paid' | 'expiring' | 'expired'

export function paidStateOf(user: { is_paid?: boolean; paid_until?: string | null }): PaidState {
  if (!user.is_paid) return 'free'
  if (!user.paid_until) return 'expired'
  const left = toDate(user.paid_until).getTime() - Date.now()
  if (left < 0) return 'expired'
  return left < 7 * 86400000 ? 'expiring' : 'paid'
}

const LABELS: Record<PaidState, [string, string]> = {
  free: ['無料', 'gray'],
  paid: ['有料', 'grape'],
  expiring: ['もうすぐ切れる', 'orange'],
  expired: ['期限が過ぎた', 'red'],
}

export function PaidBadge({ state, small = false }: { state: PaidState; small?: boolean }) {
  const [label, color] = LABELS[state] ?? [state, 'gray']
  return (
    <Badge color={color} variant={state === 'free' ? 'outline' : 'filled'} size={small ? 'sm' : 'md'}>
      {label}
    </Badge>
  )
}
