import {
  Alert,
  Anchor,
  Badge,
  Blockquote,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useNotice } from '../../Notice'

// 理由の名前（会員の側の通報のモーダルにある一覧を、ここにもコピーした）
const REASONS: Record<string, string> = {
  harassment: 'しつこい連絡・迷惑な行い',
  solicitation: '勧誘・営業',
  money: 'お金の要求・詐欺の疑い',
  inappropriate: '不適切な写真・プロフィール',
  impersonation: 'なりすまし・年齢や独身でない疑い',
  other: 'その他',
}
const ACTIONS: Record<string, string> = {
  none: '問題なし',
  warned: '注意した',
  suspended: '利用を止めた',
  banned: '強制退会にした',
}

// A7 通報の案件の中身と、対応（FR-REPORT-011〜014・016。#203）。状態を変えるボタンは owner にだけ出す（画面で隠すだけ）
export default function ReportCaseDetailPage() {
  const { publicId } = useParams()
  const [c, setC] = useState<any>(null)
  const [opened, setOpened] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // A7（#213）：「注意した」で済みにするときに、会員に送る注意の文（空なら、送らない）
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const [notice, notify] = useNotice()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'
  const role = JSON.parse(sessionStorage.getItem('admin') ?? '{}').role
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
  }

  const load = () =>
    fetch(`${api}/api/report-cases/${publicId}`, { headers })
      .then((r) => r.json())
      .then(setC)

  // biome-ignore lint/correctness/useExhaustiveDependencies: 案件が変わったときだけ読む
  useEffect(() => {
    load()
  }, [publicId])

  // 状態を変える。A6（#208）で、結果を知らせるようにした
  const change = async (body: any) => {
    setBusy(true)
    const r = await fetch(`${api}/api/report-cases/${publicId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })
    setBusy(false)
    setOpened(false)
    notify(r.ok ? (body.status === 'closed' ? '済みにしました' : '対応中にしました') : '変えられませんでした', r.ok)
    load()
  }

  const close = () => {
    // 「何をしたか」を選んだかは、画面だけで確かめる（API は確かめない）
    if (!action) {
      setError('何をしたかを選んでください')
      return
    }
    setError('')
    // A7（#213）：注意の文があれば、先に、お知らせとして送る。送れたかは見ない（送れなくても、案件は済みになる）
    if (action === 'warned' && warning.trim()) {
      fetch(`${api}/api/members/${c.member.id}/notices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ kind: 'warning', title: '運営からの注意', body: warning, report_case_id: c.id }),
      })
    }
    change({ status: 'closed', action, note })
  }

  if (!c) return <Loader />
  if (!c.id) return <Alert color="red">{c.message ?? '案件が見つかりません'}</Alert>

  const reporters = new Set(c.reports.map((r: any) => r.reporter.id)).size

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" onClick={() => navigate('/reports')}>
            ← 通報の一覧
          </Button>
          <Title order={2}>{c.member.nickname ?? '―'} さんへの通報</Title>
          <Badge color={c.status === 'open' ? 'red' : c.status === 'in_progress' ? 'yellow' : 'gray'}>
            {c.status === 'open' ? 'まだ' : c.status === 'in_progress' ? '対応中' : '済み'}
          </Badge>
        </Group>
        {role === 'owner' && c.status !== 'closed' && (
          <Group>
            {c.status === 'open' && (
              <Button variant="default" loading={busy} onClick={() => change({ status: 'in_progress' })}>
                対応中にする
              </Button>
            )}
            <Button onClick={() => setOpened(true)}>済みにする</Button>
          </Group>
        )}
      </Group>

      {c.status === 'closed' && (
        <Alert color="gray" title={`済み：${ACTIONS[c.action] ?? c.action ?? '―'}`}>
          {c.closed_at ? new Date(c.closed_at).toLocaleString('ja-JP') : '―'}・{c.handled_by ?? '―'}
          {c.note && <Text mt="xs">{c.note}</Text>}
        </Alert>
      )}

      <Card withBorder radius="md">
        <Table>
          <Table.Tbody>
            <Table.Tr>
              <Table.Th w={200}>通報された会員</Table.Th>
              <Table.Td>
                <Group gap="xs">
                  <Anchor component={Link} to={`/members/${c.member.id}`}>
                    {c.member.nickname ?? '―'}（会員の詳細へ）
                  </Anchor>
                  {c.member.state === 'suspended' && <Badge color="red">停止中</Badge>}
                  {c.member.state === 'withdrawn' && <Badge color="gray">退会</Badge>}
                </Group>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>通報の件数・通報した人数</Table.Th>
              <Table.Td>
                {c.reports.length}件・{reporters}人
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>この会員の、これまでの案件</Table.Th>
              <Table.Td>{c.member.case_count}件（この案件を入れて）</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
        {role === 'owner' && c.status !== 'closed' && (
          <Text size="sm" c="dimmed" mt="sm">
            利用を止める・強制退会にするときは、会員の詳細で操作してから、この案件を済みにします（済みにしただけでは、止まりません）。「注意した」のときは、注意の文を一緒に送れます。
          </Text>
        )}
      </Card>

      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          通報（{c.reports.length}件）
        </Title>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={170}>日時</Table.Th>
              <Table.Th w={160}>通報した会員</Table.Th>
              <Table.Th w={220}>理由</Table.Th>
              <Table.Th>くわしい内容・指されたメッセージ</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {c.reports.map((r: any) => (
              <Table.Tr key={r.id}>
                <Table.Td>{new Date(r.created_at).toLocaleString('ja-JP')}</Table.Td>
                <Table.Td>
                  <Anchor component={Link} to={`/members/${r.reporter.id}`}>
                    {r.reporter.nickname ?? '―'}
                  </Anchor>
                </Table.Td>
                <Table.Td>{REASONS[r.reason] ?? r.reason}</Table.Td>
                <Table.Td>
                  {r.detail && <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.detail}</Text>}
                  {r.message && (
                    <Blockquote
                      p="xs"
                      mt={r.detail ? 'xs' : 0}
                      cite={`${new Date(r.message.created_at).toLocaleString('ja-JP')} のメッセージ`}
                    >
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {r.message.body}
                      </Text>
                    </Blockquote>
                  )}
                  {!r.detail && !r.message && <Text c="dimmed">―</Text>}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={opened} onClose={() => setOpened(false)} title="この案件を、済みにしますか？">
        <Stack>
          <Select
            label="何をしたか"
            placeholder="選んでください"
            data={Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))}
            value={action}
            onChange={setAction}
            error={error}
          />
          {action === 'warned' && (
            <Textarea
              label="会員に送る注意の文（書くと、お知らせとして届く。書かなければ、記録だけ）"
              minRows={3}
              autosize
              value={warning}
              onChange={(e) => setWarning(e.currentTarget.value)}
            />
          )}
          <Textarea label="メモ（運営の中だけ）" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Text size="sm" c="dimmed">
            済みにしたあとに新しい通報が来ると、新しい案件になります。
          </Text>
          <Button loading={busy} onClick={close}>
            済みにする
          </Button>
        </Stack>
      </Modal>
      {notice}
    </Stack>
  )
}
