import { Badge, Group, Loader, Paper, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PaidBadge } from './domains/members/paid'
import Icon from './Icon'

// A1（#224）：上の帯の、会員の検索窓。どの画面からでも、名前・メールアドレス・会員の ID で会員を探して、詳細へ飛ぶ。
// 打つのを 0.3秒やめたら、会員の一覧の API（GET /api/members）を呼ぶ（検索のための軽い API はない。
// 1回の検索で、一覧と同じ 200本ほどの SQL が流れる）。候補は、上の 8人だけを出す
export default function MemberSearch() {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<any[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  // 矢印のキーで選んでいる行（-1 は、選んでいない）
  const [cursor, setCursor] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'
  // 会員の ID（UUID）の形なら、ID の完全一致で探す。そうでなければ、名前・メールアドレスの部分一致
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim())

  // biome-ignore lint/correctness/useExhaustiveDependencies: 打った文字が変わったときだけ
  useEffect(() => {
    const word = text.trim()
    if (word.length < 2) {
      setRows(null)
      return
    }
    setLoading(true)
    // 古い検索の答えが、あとから届いて上書きしないよう、打ち直したら前の分は捨てる
    let stale = false
    const timer = setTimeout(() => {
      const query = new URLSearchParams(isId ? { id: word } : { q: word })
      fetch(`${api}/api/members?${query}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (stale) return
          setRows(Array.isArray(d.data) ? d.data.slice(0, 8) : [])
          setTotal(d.total ?? 0)
          setCursor(-1)
          setLoading(false)
        })
    }, 300)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [text])

  // 外を押したら閉じる
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (publicId: string) => {
    setOpen(false)
    setText('')
    navigate(`/members/${publicId}`)
  }
  // 全部の結果を、会員の一覧で見る
  const all = () => {
    setOpen(false)
    navigate(`/members?${new URLSearchParams(isId ? { id: text.trim() } : { q: text.trim() })}`)
    setText('')
  }

  return (
    <div ref={box} style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
      <TextInput
        role="combobox"
        aria-label="会員を探す"
        aria-expanded={open && rows !== null}
        aria-controls="member-search-list"
        placeholder="会員を探す（名前・メールアドレス・ID）"
        leftSection={<Icon name="search" />}
        rightSection={loading ? <Loader size="xs" /> : null}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.currentTarget.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'ArrowDown' && rows) setCursor(Math.min(cursor + 1, rows.length - 1))
          if (e.key === 'ArrowUp' && rows) setCursor(Math.max(cursor - 1, -1))
          if (e.key === 'Enter' && text.trim().length >= 2) {
            if (rows && cursor >= 0) go(rows[cursor].public_id)
            else all()
          }
        }}
      />
      {open && rows !== null && (
        <Paper
          id="member-search-list"
          role="listbox"
          withBorder
          shadow="md"
          radius="md"
          p={4}
          style={{ position: 'absolute', top: 40, left: 0, right: 0, zIndex: 300 }}
        >
          {rows.length === 0 ? (
            <Text size="sm" c="dimmed" p="sm">
              見つかりません
            </Text>
          ) : (
            <Stack gap={0}>
              {rows.map((u, i) => (
                <UnstyledButton
                  key={u.public_id}
                  role="option"
                  aria-selected={i === cursor}
                  p="xs"
                  style={{ borderRadius: 6, background: i === cursor ? 'var(--mantine-color-blue-0)' : undefined }}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(u.public_id)}
                >
                  <Group gap="xs" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>
                        {u.nickname ?? '―'}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {u.email}
                      </Text>
                    </div>
                    <PaidBadge state={u.paid_state} small />
                    {u.suspended_at && (
                      <Badge size="sm" color="red">
                        停止中
                      </Badge>
                    )}
                    {u.deleted_at && (
                      <Badge size="sm" color={u.banned_at ? 'dark' : 'gray'}>
                        {u.banned_at ? '強制退会' : '退会'}
                      </Badge>
                    )}
                  </Group>
                </UnstyledButton>
              ))}
              {total > rows.length && (
                <UnstyledButton p="xs" onClick={all}>
                  <Text size="sm" c="blue">
                    {total.toLocaleString()} 人を、会員の一覧で見る（Enter）
                  </Text>
                </UnstyledButton>
              )}
            </Stack>
          )}
        </Paper>
      )}
    </div>
  )
}
