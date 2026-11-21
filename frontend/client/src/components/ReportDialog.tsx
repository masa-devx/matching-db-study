import { useState } from 'react'
import { apiFetch } from '../shared/api/client'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'

// レガシー版（M7。#202）。通報のモーダル。相手のプロフィールと、トーク画面から開く。
// 理由の一覧・送り方・結果の知らせを、この部品にまとめて書く。確かめるのは画面だけ（API は確かめない）
const REASONS = [
  { value: 'harassment', label: 'しつこい連絡・迷惑な行い' },
  { value: 'solicitation', label: '勧誘・営業' },
  { value: 'money', label: 'お金の要求・詐欺の疑い' },
  { value: 'inappropriate', label: '不適切な写真・プロフィール' },
  { value: 'impersonation', label: 'なりすまし・年齢や独身でない疑い' },
  { value: 'other', label: 'その他' },
]

type Props = {
  open: boolean
  userId: string
  nickname: string
  // メッセージを指して通報するときだけ渡す
  message?: { id: number; body: string } | null
  onClose: () => void
  // 通報が終わったとき。ブロックもしたかを渡す（した画面は、一覧に戻す）
  onDone: (blocked: boolean) => void
}

export default function ReportDialog({ open, userId, nickname, message, onClose, onDone }: Props) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [block, setBlock] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const close = () => {
    setReason('')
    setDetail('')
    setBlock(false)
    setError('')
    onClose()
  }

  const send = async () => {
    setError('')
    if (!reason) {
      setError('理由を選んでください')
      return
    }
    if (reason === 'other' && !detail.trim()) {
      setError('「その他」のときは、くわしい内容を書いてください')
      return
    }
    if (detail.length > 1000) {
      setError('くわしい内容は、1000文字までにしてください')
      return
    }
    setSending(true)
    const r = await apiFetch(`/api/me/reports`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, message_id: message?.id, reason, detail: detail || null, block }),
    })
    setSending(false)
    if (!r.ok) {
      // もうブロックしている相手を「ブロックもする」で通報すると、ここに来る（通報は入っている）
      setError('通報できませんでした')
      return
    }
    toast(block ? '通報して、ブロックしました' : '通報しました')
    const blocked = block
    close()
    onDone(blocked)
  }

  return (
    <ConfirmDialog
      open={open}
      title={message ? 'このメッセージを通報しますか？' : `${nickname}さんを通報しますか？`}
      confirmLabel="通報する"
      danger
      busy={sending}
      onConfirm={send}
      onClose={close}
    >
      {message && <p className="report-quote">{message.body}</p>}
      <label className="label">
        理由
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">選んでください</option>
          {REASONS.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <label className="label">
        くわしい内容（書かなくてもよい）
        <textarea className="input" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
        <span className={detail.length > 1000 ? 'hint is-over' : 'hint'}>{detail.length}／1000文字</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        この相手をブロックする
      </label>
      <p className="hint">通報したことは、相手には伝わりません。運営が中身を確かめます。結果はお知らせしません。</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </ConfirmDialog>
  )
}
