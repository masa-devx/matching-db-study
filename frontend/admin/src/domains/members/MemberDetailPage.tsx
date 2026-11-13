import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

// 12 会員の詳細と、利用を止める・解く（FR-ADMIN-005・006）。止める・解くのボタンは owner にだけ出す（画面で隠すだけ）
export default function MemberDetailPage() {
  const { publicId } = useParams()
  const [m, setM] = useState<any>(null)
  const [opened, setOpened] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'
  const role = JSON.parse(sessionStorage.getItem('admin') ?? '{}').role
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
  }

  const load = () =>
    fetch(`${api}/api/members/${publicId}`, { headers })
      .then((r) => r.json())
      .then(setM)

  // biome-ignore lint/correctness/useExhaustiveDependencies: 会員が変わったときだけ読む
  useEffect(() => {
    load()
  }, [publicId])

  const suspend = async () => {
    setBusy(true)
    await fetch(`${api}/api/members/${publicId}/suspension`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    })
    setBusy(false)
    setOpened(false)
    load()
  }

  const unsuspend = async () => {
    setBusy(true)
    await fetch(`${api}/api/members/${publicId}/suspension`, { method: 'DELETE', headers })
    setBusy(false)
    load()
  }

  if (!m) return <Loader />
  if (!m.user_id) return <Alert color="red">{m.message ?? '会員が見つかりません'}</Alert>

  const stats: [string, number][] = [
    ['送ったいいね', m.likes_sent],
    ['もらったいいね', m.likes_received],
    ['マッチ', m.matches],
    ['ブロックした', m.blocks_made],
    ['ブロックされた', m.blocks_received],
    ['購入', m.purchases.length],
  ]

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" onClick={() => navigate('/members')}>
            ← 会員の一覧
          </Button>
          <Title order={2}>{m.profile?.nickname ?? '―'}</Title>
          {m.is_paid && <Badge color="grape">有料</Badge>}
          {m.suspended_at && <Badge color="red">停止中</Badge>}
          {m.deleted_at && <Badge color="gray">退会</Badge>}
        </Group>
        {role === 'owner' &&
          (m.suspended_at ? (
            <Button color="gray" loading={busy} onClick={unsuspend}>
              停止を解く
            </Button>
          ) : (
            <Button color="red" onClick={() => setOpened(true)}>
              利用を止める
            </Button>
          ))}
      </Group>

      {m.suspended_at && (
        <Alert color="red" title="利用を停止しています">
          {new Date(m.suspended_at).toLocaleString('ja-JP')}・理由：{m.suspended_reason ?? '―'}
        </Alert>
      )}

      <Card withBorder radius="md">
        <Table>
          <Table.Tbody>
            <Table.Tr>
              <Table.Th w={180}>メールアドレス</Table.Th>
              <Table.Td>{m.email}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>登録日・最終ログイン</Table.Th>
              <Table.Td>
                {new Date(m.created_at).toLocaleDateString('ja-JP')}・
                {m.last_login_at ? new Date(m.last_login_at).toLocaleString('ja-JP') : '―'}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>プロフィール</Table.Th>
              <Table.Td>
                {m.profile?.gender}・{m.profile?.birthday}・{m.profile?.prefecture}・{m.profile?.height}cm
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>有料の期限</Table.Th>
              <Table.Td>{m.paid_until ? new Date(m.paid_until).toLocaleDateString('ja-JP') : '―'}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      <SimpleGrid cols={{ base: 2, md: 3, xl: 6 }}>
        {stats.map(([label, n]) => (
          <Card key={label} withBorder radius="md">
            <Text size="sm" c="dimmed">
              {label}
            </Text>
            <Text fz={22} fw={700}>
              {n}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          購入の記録
        </Title>
        {m.purchases.length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Table>
            <Table.Tbody>
              {m.purchases.map((p: any) => (
                <Table.Tr key={p.bought_at}>
                  <Table.Td>{new Date(p.bought_at).toLocaleDateString('ja-JP')}</Table.Td>
                  <Table.Td>{p.plan}</Table.Td>
                  <Table.Td>{Number(p.price).toLocaleString()}円</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Modal opened={opened} onClose={() => setOpened(false)} title="利用を止めますか？">
        <Stack>
          <Text size="sm">止めると、この会員はログインできなくなります。</Text>
          <Textarea label="理由" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Button color="red" loading={busy} onClick={suspend}>
            止める
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
