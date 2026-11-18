import { Anchor, Badge, Card, Group, Loader, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toDate } from '../../date'

// A7（#227）：多くの人からブロックされている会員の一覧（FR-ADMIN-033）。上から 50人。
// 通報されていなくても、ブロックが重なっている会員を見つけるための画面
export default function BlockRankingPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    fetch(`${api}/api/block-ranking`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
  }, [api])

  return (
    <Stack>
      <Title order={2}>ブロック</Title>
      <Text c="dimmed">多くの会員からブロックされている会員を、多い順に 50人まで出します。</Text>
      <Card withBorder radius="md" padding={0}>
        {!rows ? (
          <Loader m="md" />
        ) : rows.length === 0 ? (
          <Text c="dimmed" p="md">
            ブロックされている会員は、いません
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>会員</Table.Th>
                  <Table.Th ta="right">ブロックされた</Table.Th>
                  <Table.Th>いちばん新しいブロック</Table.Th>
                  <Table.Th ta="right">通報された</Table.Th>
                  <Table.Th>通報の案件</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.user_id}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Anchor component={Link} to={`/members/${r.user_id}?tab=blocks`}>
                          {r.nickname ?? '―'}
                        </Anchor>
                        {r.state === 'suspended' && <Badge color="red">停止中</Badge>}
                        {r.state === 'withdrawn' && <Badge color="gray">退会</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fw={700}>{r.blocked_count}人</Text>
                    </Table.Td>
                    <Table.Td>{toDate(r.last_blocked_at).toLocaleDateString('ja-JP')}</Table.Td>
                    <Table.Td ta="right">{r.report_count}件</Table.Td>
                    <Table.Td>
                      {r.open_case ? (
                        <Anchor component={Link} to={`/reports/${r.open_case}`}>
                          対応していない案件がある
                        </Anchor>
                      ) : (
                        <Text c="dimmed">―</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  )
}
