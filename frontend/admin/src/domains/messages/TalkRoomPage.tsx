import { Alert, Anchor, Badge, Button, Card, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toDate } from '../../date'

// A2（#221）：トークルームのやり取りを、続けて読む（FR-ADMIN-023）。メッセージの一覧の「やり取りを見る」から来る。
// 新しい方から 100件ずつ。「前の 100件」で、古い方へさかのぼる（読んだ分は、画面にためていく）
export default function TalkRoomPage() {
  const { publicId } = useParams()
  const [room, setRoom] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  // biome-ignore lint/correctness/useExhaustiveDependencies: ルームとページが変わったときだけ読む
  useEffect(() => {
    setLoading(true)
    fetch(`${api}/api/talk-rooms/${publicId}?page=${page}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setRoom(d)
        // 古い分を、前に足す（開発用の二重の読み込みで、同じ分が2回入らないよう、ID で見分ける）
        setMessages((now) => {
          const seen = new Set(now.map((m) => m.id))
          return [...(d.messages ?? []).filter((m: any) => !seen.has(m.id)), ...now]
        })
        setLoading(false)
      })
  }, [publicId, page])

  if (!room) return <Loader />
  if (!room.room_id) return <Alert color="red">{room.message ?? 'ルームが見つかりません'}</Alert>

  // 1人目を左、2人目を右に出す
  const left = room.members[0]?.user_id

  return (
    <Stack>
      <Group>
        <Button variant="subtle" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/messages'))}>
          ← 戻る
        </Button>
        <Title order={2}>やり取り</Title>
        <Text c="dimmed">全部で {Number(room.total).toLocaleString()} 件</Text>
      </Group>
      <Card withBorder radius="md">
        <Group>
          {room.members.map((m: any, i: number) => (
            <Group key={m.user_id ?? i} gap="xs">
              <Badge variant="light" color={i === 0 ? 'blue' : 'grape'}>
                {i === 0 ? '左' : '右'}
              </Badge>
              <Anchor component={Link} to={`/members/${m.user_id}`}>
                {m.nickname ?? '―'}
              </Anchor>
              {m.state === 'suspended' && <Badge color="red">停止中</Badge>}
              {m.state === 'withdrawn' && <Badge color="gray">退会</Badge>}
            </Group>
          ))}
        </Group>
      </Card>
      <Card withBorder radius="md">
        <Stack gap="xs">
          {messages.length < room.total && (
            <Button variant="default" loading={loading} onClick={() => setPage(page + 1)}>
              前の 100件を読む（今 {messages.length.toLocaleString()} 件）
            </Button>
          )}
          {messages.length === 0 && <Text c="dimmed">メッセージは、ありません</Text>}
          {messages.map((m) => (
            <Group key={m.id} justify={m.sender_id === left ? 'flex-start' : 'flex-end'}>
              <Paper
                withBorder
                radius="md"
                p="xs"
                maw="70%"
                bg={m.sender_id === left ? 'blue.0' : 'grape.0'}
                data-side={m.sender_id === left ? 'left' : 'right'}
              >
                <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</Text>
                <Text size="xs" c="dimmed">
                  {toDate(m.created_at).toLocaleString('ja-JP')}
                </Text>
              </Paper>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}
