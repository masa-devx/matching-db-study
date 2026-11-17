import { Badge, Button, Card, Group, Loader, Pagination, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toDate } from '../../date'

// 12 メッセージの一覧（FR-ADMIN-007）。本文の語・期間で絞る。50件ずつ（API は offset と 1件ごとに6本）
export default function MessagesPage() {
  // A2（#208）：送った会員（public_id）で絞る。API には前からあったが、画面から使えなかった。
  // 会員の詳細の「この会員が送ったメッセージを見る」と、行の「この人で絞る」から来る。URL のクエリに持つ
  const [params, setParams] = useSearchParams()
  const sender = params.get('sender') ?? ''
  const [form, setForm] = useState({ q: '', from: '', to: '' })
  const [query, setQuery] = useState(form)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    setData(null)
    const sent = new URLSearchParams({ ...query, page: String(page) })
    if (sender) sent.set('sender', sender)
    fetch(`${api}/api/messages?${sent}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, query, page, sender])

  return (
    <Stack>
      <Title order={2}>メッセージ</Title>
      <Card withBorder radius="md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setQuery(form)
          }}
        >
          <Group align="end">
            <TextInput
              label="本文の語"
              value={form.q}
              onChange={(e) => setForm({ ...form, q: e.currentTarget.value })}
            />
            <TextInput
              label="いつから"
              type="date"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.currentTarget.value })}
            />
            <TextInput
              label="いつまで"
              type="date"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.currentTarget.value })}
            />
            {/* A2（#208）：ボタンを見えるようにした（前は、Enter でしか絞れなかった） */}
            <Button type="submit">絞り込む</Button>
          </Group>
        </form>
        {sender && (
          <Group mt="sm" gap="xs">
            <Badge variant="light">送った会員で絞っています</Badge>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => {
                setPage(1)
                setParams({})
              }}
            >
              外す
            </Button>
          </Group>
        )}
      </Card>
      <Card withBorder radius="md" padding={0}>
        {!data ? (
          <Loader m="md" />
        ) : (
          <>
            <Text size="sm" c="dimmed" p="md">
              全部で {data.total.toLocaleString()} 件
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>送った日時</Table.Th>
                  <Table.Th>送った人</Table.Th>
                  <Table.Th>相手</Table.Th>
                  <Table.Th>本文</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.data.map((m: any) => (
                  <Table.Tr key={m.id}>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{toDate(m.created_at).toLocaleString('ja-JP')}</Table.Td>
                    <Table.Td>
                      <Link to={`/members/${m.sender.user_id}`}>{m.sender.nickname ?? '―'}</Link>
                      {!sender && (
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          ml={4}
                          onClick={() => {
                            setPage(1)
                            setParams({ sender: m.sender.user_id })
                          }}
                        >
                          この人で絞る
                        </Button>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Link to={`/members/${m.partner.user_id}`}>{m.partner.nickname ?? '―'}</Link>
                    </Table.Td>
                    <Table.Td>{m.body}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="center" p="md">
              <Pagination total={Math.ceil(data.total / 50)} value={page} onChange={setPage} />
            </Group>
          </>
        )}
      </Card>
    </Stack>
  )
}
