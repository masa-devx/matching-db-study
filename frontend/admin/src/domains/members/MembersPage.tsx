import {
  Badge,
  Card,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

// 12 会員の一覧（FR-ADMIN-004）。メールアドレス・ニックネームで探し、状態で絞る。50人ずつ（API は offset）
export default function MembersPage() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<any>(null)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    setData(null)
    const params = new URLSearchParams({ q: query, status, page: String(page) })
    fetch(`${api}/api/members?${params}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api, query, status, page])

  return (
    <Stack>
      <Title order={2}>会員</Title>
      <Card withBorder radius="md">
        <Group align="end">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              setQuery(q)
            }}
          >
            <TextInput
              label="メールアドレス・ニックネーム"
              placeholder="部分一致"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
            />
          </form>
          <SegmentedControl
            value={status}
            onChange={(v) => {
              setPage(1)
              setStatus(v)
            }}
            data={[
              { value: 'all', label: 'すべて' },
              { value: 'paid', label: '有料' },
              { value: 'suspended', label: '停止中' },
              { value: 'withdrawn', label: '退会' },
            ]}
          />
        </Group>
      </Card>
      <Card withBorder radius="md" padding={0}>
        {!data ? (
          <Loader m="md" />
        ) : (
          <>
            <Text size="sm" c="dimmed" p="md">
              全部で {data.total.toLocaleString()} 人
            </Text>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ニックネーム</Table.Th>
                  <Table.Th>メールアドレス</Table.Th>
                  <Table.Th>状態</Table.Th>
                  <Table.Th>購入</Table.Th>
                  <Table.Th>登録日</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.data.map((u: any) => (
                  <Table.Tr
                    key={u.public_id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/members/${u.public_id}`)}
                  >
                    <Table.Td>{u.nickname ?? '―'}</Table.Td>
                    <Table.Td>{u.email}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {u.is_paid && <Badge color="grape">有料</Badge>}
                        {u.suspended_at && <Badge color="red">停止中</Badge>}
                        {u.deleted_at && <Badge color="gray">退会</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{u.purchases}</Table.Td>
                    <Table.Td>{new Date(u.created_at).toLocaleDateString('ja-JP')}</Table.Td>
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
