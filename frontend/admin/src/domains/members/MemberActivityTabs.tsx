import { Alert, Anchor, Badge, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toDate } from '../../date'

// A1・A7（#227）：会員の詳細の、やり取り・違反・ブロックのタブ。タブを開いたときに、それぞれの API を読む。
// 送り先・トークンの読み出し・読み込み中の出し方を、3つのタブに1つずつ書いた

// 通報の理由と、案件の状態・何をしたかの名前（通報の案件の画面にある一覧を、ここにもコピーした）
const REASONS: Record<string, string> = {
  harassment: 'しつこい連絡・迷惑な行い',
  solicitation: '勧誘・営業',
  money: 'お金の要求・詐欺の疑い',
  inappropriate: '不適切な写真・プロフィール',
  impersonation: 'なりすまし・年齢や独身でない疑い',
  other: 'その他',
}
const STATUS: Record<string, [string, string]> = {
  open: ['まだ', 'red'],
  in_progress: ['対応中', 'yellow'],
  closed: ['済み', 'gray'],
}
const ACTIONS: Record<string, string> = {
  none: '問題なし',
  warned: '注意した',
  suspended: '利用を止めた',
  banned: '強制退会にした',
}

function useMemberApi(publicId: string | undefined, path: string) {
  const [data, setData] = useState<any>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 会員が変わったときだけ読む
  useEffect(() => {
    setData(null)
    fetch(`${import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'}/api/members/${publicId}/${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [publicId])
  return data
}

function MemberLink({ user }: { user: { user_id?: string; nickname?: string; state?: string } }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Anchor component={Link} to={`/members/${user.user_id}`}>
        {user.nickname ?? '―'}
      </Anchor>
      {user.state === 'suspended' && <Badge color="red">停止中</Badge>}
      {user.state === 'withdrawn' && <Badge color="gray">退会</Badge>}
    </Group>
  )
}

// やり取り：この会員のトークルームの一覧。押すと、やり取りの画面（#221）へ
export function RoomsTab({ publicId }: { publicId?: string }) {
  const rooms = useMemberApi(publicId, 'talk-rooms')
  if (!rooms) return <Loader />
  if (!Array.isArray(rooms)) return <Alert color="red">読めませんでした</Alert>
  return (
    <Card withBorder radius="md">
      <Title order={4} mb="sm">
        やり取り（{rooms.length}人と）
      </Title>
      {rooms.length === 0 ? (
        <Text c="dimmed">マッチした相手は、いません</Text>
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>相手</Table.Th>
                <Table.Th ta="right">メッセージ</Table.Th>
                <Table.Th ta="right">この会員が送った</Table.Th>
                <Table.Th>最後のメッセージ</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rooms.map((r: any) => (
                <Table.Tr key={r.room_id}>
                  <Table.Td>
                    <MemberLink user={r.partner} />
                  </Table.Td>
                  <Table.Td ta="right">{Number(r.message_count).toLocaleString()}件</Table.Td>
                  <Table.Td ta="right">{Number(r.sent_count).toLocaleString()}件</Table.Td>
                  <Table.Td>
                    {r.last_message ? (
                      <>
                        <Text size="sm" lineClamp={1} maw={360}>
                          {r.last_message.mine ? 'この会員：' : '相手：'}
                          {r.last_message.body}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {toDate(r.last_message.created_at).toLocaleString('ja-JP')}
                        </Text>
                      </>
                    ) : (
                      <Text c="dimmed">まだ、ありません</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/messages/rooms/${r.room_id}`} style={{ whiteSpace: 'nowrap' }}>
                      やり取りを見る
                    </Anchor>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  )
}

// 違反：通報された案件・通報した記録（API）と、注意のお知らせ・停止・強制退会（会員の詳細の API が返したもの）を、1か所に出す
export function ViolationsTab({ publicId, member }: { publicId?: string; member: any }) {
  const data = useMemberApi(publicId, 'violations')
  if (!data) return <Loader />
  if (!data.cases) return <Alert color="red">読めませんでした</Alert>
  const warnings = (member.notices ?? []).filter((n: any) => n.kind === 'warning')
  const reported = data.cases.reduce((sum: number, c: any) => sum + Number(c.report_count), 0)
  const summary: [string, string, string][] = [
    ['通報された', `${reported}件（${data.cases.length}案件）`, reported > 0 ? 'red' : 'gray'],
    ['注意のお知らせ', `${warnings.length}回`, warnings.length > 0 ? 'orange' : 'gray'],
    ['利用の停止', `${(member.suspensions ?? []).length}回`, (member.suspensions ?? []).length > 0 ? 'red' : 'gray'],
    ['この会員が通報した', `${data.reports_made.length}件`, 'gray'],
  ]
  return (
    <Stack>
      {member.banned_at && (
        <Alert color="dark" title="強制退会にしています">
          {toDate(member.banned_at).toLocaleString('ja-JP')}・理由：{member.banned_reason ?? '―'}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {summary.map(([label, value, color]) => (
          <Card key={label} withBorder radius="md" padding="sm">
            <Text size="sm" c="dimmed">
              {label}
            </Text>
            <Text fz={20} fw={700} c={color === 'gray' ? undefined : `${color}.7`}>
              {value}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          通報された案件
        </Title>
        {data.cases.length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>最初の通報</Table.Th>
                <Table.Th>状態</Table.Th>
                <Table.Th ta="right">通報</Table.Th>
                <Table.Th>理由</Table.Th>
                <Table.Th>何をしたか</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.cases.map((c: any) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{toDate(c.created_at).toLocaleDateString('ja-JP')}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS[c.status]?.[1] ?? 'gray'}>{STATUS[c.status]?.[0] ?? c.status}</Badge>
                  </Table.Td>
                  <Table.Td ta="right">{c.report_count}件</Table.Td>
                  <Table.Td>{c.reasons.map((r: string) => REASONS[r] ?? r).join('・')}</Table.Td>
                  <Table.Td>{c.action ? (ACTIONS[c.action] ?? c.action) : '―'}</Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/reports/${c.id}`} style={{ whiteSpace: 'nowrap' }}>
                      案件を見る
                    </Anchor>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          注意のお知らせ・利用の停止
        </Title>
        {warnings.length + (member.suspensions ?? []).length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Table>
            <Table.Tbody>
              {/* 2つの一覧を、日時の新しい順に混ぜて出す（混ぜるのは、画面の側） */}
              {[
                ...warnings.map((n: any) => ({
                  at: n.created_at,
                  kind: '注意',
                  color: 'orange',
                  text: `${n.title}：${n.body}`,
                  extra: n.read_at ? '読んだ' : 'まだ読んでいない',
                })),
                ...(member.suspensions ?? []).map((s: any) => ({
                  at: s.suspended_at,
                  kind: '停止',
                  color: 'red',
                  text: s.reason || '（理由なし）',
                  extra: s.lifted_at ? `${toDate(s.lifted_at).toLocaleDateString('ja-JP')} に解いた` : '止めている',
                })),
              ]
                .sort((a, b) => (a.at < b.at ? 1 : -1))
                .map((row) => (
                  <Table.Tr key={`${row.kind}-${row.at}`}>
                    <Table.Td w={170}>{toDate(row.at).toLocaleString('ja-JP')}</Table.Td>
                    <Table.Td w={80}>
                      <Badge color={row.color}>{row.kind}</Badge>
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.text}</Table.Td>
                    <Table.Td w={170}>{row.extra}</Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          この会員が通報した記録（{data.reports_made.length}件）
        </Title>
        {data.reports_made.length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Table>
            <Table.Tbody>
              {data.reports_made.map((r: any, i: number) => (
                <Table.Tr key={`${r.created_at}-${i}`}>
                  <Table.Td w={170}>{toDate(r.created_at).toLocaleString('ja-JP')}</Table.Td>
                  <Table.Td>
                    <MemberLink user={r.reported} />
                  </Table.Td>
                  <Table.Td>{REASONS[r.reason] ?? r.reason}</Table.Td>
                  <Table.Td>
                    <Anchor component={Link} to={`/reports/${r.case_id}`} style={{ whiteSpace: 'nowrap' }}>
                      案件を見る
                    </Anchor>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  )
}

function BlockTable({ rows, empty }: { rows: any[]; empty: string }) {
  if (rows.length === 0) return <Text c="dimmed">{empty}</Text>
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>相手</Table.Th>
          <Table.Th>ブロックした日時</Table.Th>
          <Table.Th>2人の関係</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((b: any) => (
          <Table.Tr key={`${b.user_id}-${b.blocked_at}`}>
            <Table.Td>
              <MemberLink user={b} />
            </Table.Td>
            <Table.Td>{toDate(b.blocked_at).toLocaleString('ja-JP')}</Table.Td>
            <Table.Td>
              {b.matched ? <Badge color="pink">マッチしていた</Badge> : <Text c="dimmed">マッチしていない</Text>}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

// ブロック：この会員がブロックした相手と、この会員をブロックした相手
export function BlocksTab({ publicId }: { publicId?: string }) {
  const data = useMemberApi(publicId, 'blocks')
  if (!data) return <Loader />
  if (!data.made) return <Alert color="red">読めませんでした</Alert>
  return (
    <Stack>
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          この会員をブロックした相手（{data.received.length}人）
        </Title>
        <BlockTable rows={data.received} empty="だれからも、ブロックされていません" />
      </Card>
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          この会員がブロックした相手（{data.made.length}人）
        </Title>
        <BlockTable rows={data.made} empty="だれも、ブロックしていません" />
      </Card>
    </Stack>
  )
}
