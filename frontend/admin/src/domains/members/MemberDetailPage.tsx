import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useNotice } from '../../Notice'
import { toDate } from '../../date'

// 12 会員の詳細と、利用を止める・解く（FR-ADMIN-005・006）。止める・解くのボタンは owner にだけ出す（画面で隠すだけ）
export default function MemberDetailPage() {
  const { publicId } = useParams()
  const [m, setM] = useState<any>(null)
  const [opened, setOpened] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  // A7（#213）：お知らせを送るモーダルと、強制退会のモーダル
  const [noticeOpened, setNoticeOpened] = useState(false)
  const [notice0, setNotice0] = useState({ kind: 'warning', title: '', body: '' })
  const [banOpened, setBanOpened] = useState(false)
  const [banReason, setBanReason] = useState('')
  // A1（#216）：対応のメモの、書きかけ
  const [memo, setMemo] = useState('')
  const navigate = useNavigate()
  const [notice, notify] = useNotice()
  // A1（#208）：写真は、会員の側の API にある（管理画面の API は、パスだけを返す）
  const clientApi = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
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
    const r = await fetch(`${api}/api/members/${publicId}/suspension`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    })
    setBusy(false)
    setOpened(false)
    // A6（#208）：結果を知らせる（前は、何も出なかった）
    notify(r.ok ? '利用を止めました' : '止められませんでした', r.ok)
    load()
  }

  const unsuspend = async () => {
    setBusy(true)
    const r = await fetch(`${api}/api/members/${publicId}/suspension`, { method: 'DELETE', headers })
    setBusy(false)
    notify(r.ok ? '停止を解きました' : '解けませんでした', r.ok)
    load()
  }

  // A7（#213）：お知らせを送る。題と本文があるかは、画面だけで確かめる
  const sendNotice = async () => {
    if (!notice0.title.trim() || !notice0.body.trim()) {
      notify('題と本文を入れてください', false)
      return
    }
    setBusy(true)
    const r = await fetch(`${api}/api/members/${publicId}/notices`, {
      method: 'POST',
      headers,
      body: JSON.stringify(notice0),
    })
    setBusy(false)
    setNoticeOpened(false)
    notify(r.ok ? 'お知らせを送りました' : '送れませんでした', r.ok)
    if (r.ok) setNotice0({ kind: 'warning', title: '', body: '' })
    load()
  }

  // A1（#216）：対応のメモを足す。空でないかは、画面だけで確かめる
  const addMemo = async () => {
    if (!memo.trim()) return
    setBusy(true)
    const r = await fetch(`${api}/api/members/${publicId}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: memo }),
    })
    setBusy(false)
    notify(r.ok ? 'メモを書きました' : 'メモを書けませんでした', r.ok)
    if (r.ok) setMemo('')
    load()
  }

  // A7：強制退会にする。戻す操作はない
  const ban = async () => {
    setBusy(true)
    const r = await fetch(`${api}/api/members/${publicId}/ban`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: banReason }),
    })
    setBusy(false)
    setBanOpened(false)
    notify(r.ok ? '強制退会にしました' : '強制退会にできませんでした', r.ok)
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
          {/* A1（#208）：来た画面（絞り込んだ一覧・メッセージ・通報）に戻る。直接開いたときは、会員の一覧へ */}
          <Button variant="subtle" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/members'))}>
            ← 戻る
          </Button>
          <Title order={2}>{m.profile?.nickname ?? '―'}</Title>
          {m.is_paid && <Badge color="grape">有料</Badge>}
          {m.suspended_at && <Badge color="red">停止中</Badge>}
          {m.banned_at ? <Badge color="dark">強制退会</Badge> : m.deleted_at && <Badge color="gray">退会</Badge>}
        </Group>
        {role === 'owner' && (
          <Group>
            {/* A7（#213）：お知らせ（注意など）を送る・強制退会にする */}
            <Button variant="default" onClick={() => setNoticeOpened(true)}>
              お知らせを送る
            </Button>
            {m.suspended_at ? (
              <Button color="gray" loading={busy} onClick={unsuspend}>
                停止を解く
              </Button>
            ) : (
              <Button color="red" variant="light" onClick={() => setOpened(true)}>
                利用を止める
              </Button>
            )}
            {!m.banned_at && (
              <Button color="red" onClick={() => setBanOpened(true)}>
                強制退会にする
              </Button>
            )}
          </Group>
        )}
      </Group>

      {m.banned_at && (
        <Alert color="dark" title="強制退会にしています">
          {toDate(m.banned_at).toLocaleString('ja-JP')}・理由：{m.banned_reason ?? '―'}
        </Alert>
      )}

      {m.suspended_at && (
        <Alert color="red" title="利用を停止しています">
          {toDate(m.suspended_at).toLocaleString('ja-JP')}・理由：{m.suspended_reason ?? '―'}
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
              <Table.Th>メールアドレスの確認</Table.Th>
              <Table.Td>
                {m.email_verified_at ? (
                  `${toDate(m.email_verified_at).toLocaleString('ja-JP')} に確認`
                ) : (
                  <Badge color="yellow">まだ確認していない（検索に出ない）</Badge>
                )}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>登録日・最終ログイン</Table.Th>
              <Table.Td>
                {toDate(m.created_at).toLocaleDateString('ja-JP')}・
                {m.last_login_at ? toDate(m.last_login_at).toLocaleString('ja-JP') : '―'}
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
              <Table.Td>{m.paid_until ? toDate(m.paid_until).toLocaleDateString('ja-JP') : '―'}</Table.Td>
            </Table.Tr>
            {/* A1（#208）：検索に使う6項目（API は返していたが、出していなかった）。項目の名前を、会員の側からコピーした */}
            <Table.Tr>
              <Table.Th>体型・お仕事・年収</Table.Th>
              <Table.Td>
                {m.profile?.body_type ?? '―'}・{m.profile?.job ?? '―'}・{m.profile?.income ?? '―'}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>タバコ・お酒・結婚歴</Table.Th>
              <Table.Td>
                {m.profile?.smoking ?? '―'}・{m.profile?.drinking ?? '―'}・{m.profile?.marital_status ?? '―'}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Th>メッセージ</Table.Th>
              <Table.Td>
                <Anchor component={Link} to={`/messages?sender=${m.user_id}`}>
                  この会員が送ったメッセージを見る
                </Anchor>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      {/* A1（#208）：写真と自己紹介（通報や問い合わせのときに、中身を確かめるため） */}
      <Card withBorder radius="md">
        <Group align="flex-start" wrap="nowrap">
          {m.profile?.image ? (
            <Image
              src={`${clientApi}${m.profile.image}`}
              alt="プロフィールの写真"
              w={120}
              h={160}
              radius="md"
              fit="cover"
            />
          ) : (
            <Text c="dimmed" w={120}>
              写真なし
            </Text>
          )}
          <Stack gap={4}>
            <Title order={4}>自己紹介</Title>
            <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.profile?.introduction || 'まだ書いていません'}
            </Text>
          </Stack>
        </Group>
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
                  <Table.Td>{toDate(p.bought_at).toLocaleDateString('ja-JP')}</Table.Td>
                  <Table.Td>{p.plan}</Table.Td>
                  <Table.Td>{Number(p.price).toLocaleString()}円</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* A1（#216）：対応のメモ（運営の中だけ。会員には見せない）。書く欄は、owner にだけ出す（画面で隠すだけ） */}
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          対応のメモ
        </Title>
        {role === 'owner' && (
          <Group align="flex-end" mb="md">
            <Textarea
              style={{ flex: 1 }}
              label="メモを足す（会員には見えません）"
              placeholder="例：11/18 メールで問い合わせ。プランの期限について答えた"
              autosize
              minRows={2}
              value={memo}
              onChange={(e) => setMemo(e.currentTarget.value)}
            />
            <Button loading={busy} disabled={!memo.trim()} onClick={addMemo}>
              書く
            </Button>
          </Group>
        )}
        {(m.notes ?? []).length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Stack gap="xs">
            {m.notes.map((n: any) => (
              <Card key={n.id} withBorder radius="sm" padding="sm" bg="gray.0">
                <Text size="xs" c="dimmed">
                  {toDate(n.created_at).toLocaleString('ja-JP')}・{n.admin ?? '―'}
                </Text>
                <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.body}</Text>
              </Card>
            ))}
          </Stack>
        )}
      </Card>

      {/* A7（#213）：この会員に送ったお知らせと、読んだかどうか */}
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          送ったお知らせ
        </Title>
        {(m.notices ?? []).length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={170}>送った日時</Table.Th>
                <Table.Th w={90}>種類</Table.Th>
                <Table.Th>題・本文</Table.Th>
                <Table.Th w={120}>送った管理者</Table.Th>
                <Table.Th w={170}>読んだ日時</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {m.notices.map((n: any) => (
                <Table.Tr key={n.id}>
                  <Table.Td>{toDate(n.created_at).toLocaleString('ja-JP')}</Table.Td>
                  <Table.Td>
                    <Badge color={n.kind === 'warning' ? 'red' : 'blue'}>
                      {n.kind === 'warning' ? '注意' : 'お知らせ'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600}>{n.title}</Text>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {n.body}
                    </Text>
                  </Table.Td>
                  <Table.Td>{n.sent_by ?? '―'}</Table.Td>
                  <Table.Td>
                    {n.read_at ? (
                      toDate(n.read_at).toLocaleString('ja-JP')
                    ) : (
                      <Badge color="yellow">まだ読んでいない</Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* A1（#211）：停止の履歴（前は、解くと、理由と日時が消えていた） */}
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          停止の履歴
        </Title>
        {(m.suspensions ?? []).length === 0 ? (
          <Text c="dimmed">ありません</Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>止めた日時</Table.Th>
                <Table.Th>止めた管理者</Table.Th>
                <Table.Th>理由</Table.Th>
                <Table.Th>解いた日時</Table.Th>
                <Table.Th>解いた管理者</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {m.suspensions.map((s: any) => (
                <Table.Tr key={s.suspended_at}>
                  <Table.Td>{toDate(s.suspended_at).toLocaleString('ja-JP')}</Table.Td>
                  <Table.Td>{s.suspended_by ?? '―'}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.reason || '―'}</Table.Td>
                  <Table.Td>
                    {s.lifted_at ? toDate(s.lifted_at).toLocaleString('ja-JP') : <Badge color="red">止めている</Badge>}
                  </Table.Td>
                  <Table.Td>{s.lifted_by ?? '―'}</Table.Td>
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
      <Modal opened={noticeOpened} onClose={() => setNoticeOpened(false)} title="この会員に、お知らせを送りますか？">
        <Stack>
          <Select
            label="種類"
            data={[
              { value: 'warning', label: '注意' },
              { value: 'info', label: 'お知らせ' },
            ]}
            value={notice0.kind}
            onChange={(v) => setNotice0({ ...notice0, kind: v ?? 'warning' })}
            allowDeselect={false}
          />
          <TextInput
            label="題"
            value={notice0.title}
            onChange={(e) => setNotice0({ ...notice0, title: e.currentTarget.value })}
          />
          <Textarea
            label="本文"
            minRows={4}
            autosize
            value={notice0.body}
            onChange={(e) => setNotice0({ ...notice0, body: e.currentTarget.value })}
          />
          <Text size="sm" c="dimmed">
            会員の画面に、帯で知らせます。送ったあとは、直せません。
          </Text>
          <Button loading={busy} onClick={sendNotice}>
            送る
          </Button>
        </Stack>
      </Modal>

      <Modal opened={banOpened} onClose={() => setBanOpened(false)} title="強制退会にしますか？">
        <Stack>
          <Text size="sm">
            この会員はログインできなくなり、ほかの会員から見えなくなります。同じメールアドレスでは、登録し直せません。
            <b>元に戻す操作はありません。</b>
          </Text>
          <Textarea label="理由" value={banReason} onChange={(e) => setBanReason(e.currentTarget.value)} />
          <Button color="red" loading={busy} onClick={ban}>
            強制退会にする
          </Button>
        </Stack>
      </Modal>
      {notice}
    </Stack>
  )
}
