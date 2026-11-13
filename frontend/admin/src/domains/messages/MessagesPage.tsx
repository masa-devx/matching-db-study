import { Card, Group, Loader, Pagination, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

// 12 メッセージの一覧（FR-ADMIN-007）。本文の語・期間で絞る。50件ずつ（API は offset と 1件ごとに6本）
export default function MessagesPage() {
  const [form, setForm] = useState({ q: '', from: '', to: '' })
  const [query, setQuery] = useState(form)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    setData(null)
    const params = new URLSearchParams({ ...query, page: String(page) })
    fetch(`${api}/api/messages?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, query, page])

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
            <button type="submit" hidden />
          </Group>
        </form>
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
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('ja-JP')}
                    </Table.Td>
                    <Table.Td>
                      <Link to={`/members/${m.sender.user_id}`}>{m.sender.nickname ?? '―'}</Link>
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
