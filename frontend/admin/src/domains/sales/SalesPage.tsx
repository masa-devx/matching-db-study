import { BarChart } from '@mantine/charts'
import { Button, Card, Group, Loader, Modal, NumberInput, Pagination, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useNotice } from '../../Notice'
import { toDate } from '../../date'

// 12 有料会員・売上（FR-ADMIN-008・009）。月ごとの売上のグラフと表・プランの値段（owner だけ変えられる）・購入の一覧
export default function SalesPage() {
  const [monthly, setMonthly] = useState<any[] | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [prices, setPrices] = useState<Record<number, number>>({})
  const [purchases, setPurchases] = useState<any>(null)
  const [page, setPage] = useState(1)
  // A3（#208）：値段を変える前に確かめる、プラン（null は、モーダルを閉じている）
  const [confirming, setConfirming] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [notice, notify] = useNotice()
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'
  const role = JSON.parse(sessionStorage.getItem('admin') ?? '{}').role
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
  }

  const loadMonthly = () =>
    fetch(`${api}/api/sales/monthly`, { headers })
      .then((r) => r.json())
      .then(setMonthly)

  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いたときに1回だけ読む
  useEffect(() => {
    loadMonthly()
    fetch(`${api}/api/plans`, { headers })
      .then((r) => r.json())
      .then((rows) => {
        setPlans(rows)
        setPrices(Object.fromEntries(rows.map((p: any) => [p.id, p.price])))
      })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: ページが変わったときだけ読む
  useEffect(() => {
    setPurchases(null)
    fetch(`${api}/api/purchases?page=${page}`, { headers })
      .then((r) => r.json())
      .then(setPurchases)
  }, [page])

  const savePrice = async (id: number) => {
    setBusy(true)
    const r = await fetch(`${api}/api/plans/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ price: prices[id] }),
    })
    setBusy(false)
    setConfirming(null)
    // A6（#208）：結果を知らせる。成功したら、表の「今の値段」も新しくする
    notify(r.ok ? '値段を変えました' : '値段を変えられませんでした', r.ok)
    if (r.ok) setPlans(plans.map((p) => (p.id === id ? { ...p, price: prices[id] } : p)))
    loadMonthly()
  }

  const last12 = (monthly ?? []).slice(-12).map((m) => ({ month: m.month, sales: Number(m.sales) }))

  return (
    <Stack>
      <Title order={2}>有料会員・売上</Title>
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          月ごとの売上（直近12か月）
        </Title>
        {!monthly ? (
          <Loader />
        ) : (
          <BarChart
            h={260}
            data={last12}
            dataKey="month"
            series={[{ name: 'sales', label: '売上（円）', color: 'grape.6' }]}
            valueFormatter={(v) => `${v.toLocaleString()}円`}
            yAxisProps={{ width: 110 }}
          />
        )}
      </Card>
      {/* A3（#208）：月ごとの売上の表（グラフでは、正確な数字と件数が読めない）。新しい月が上 */}
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          月ごとの売上（表）
        </Title>
        {monthly && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>月</Table.Th>
                <Table.Th ta="right">購入の件数</Table.Th>
                <Table.Th ta="right">売上</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...monthly]
                .reverse()
                .slice(0, 12)
                .map((m) => (
                  <Table.Tr key={m.month}>
                    <Table.Td>{m.month}</Table.Td>
                    <Table.Td ta="right">{Number(m.count).toLocaleString()}件</Table.Td>
                    <Table.Td ta="right">{Number(m.sales).toLocaleString()}円</Table.Td>
                  </Table.Tr>
                ))}
            </Table.Tbody>
          </Table>
        )}
        <Text size="sm" c="dimmed" mt="sm">
          売上は、今のプランの値段で計算しています（値段を変えると、過去の月の売上も変わります）。
        </Text>
      </Card>
      <Card withBorder radius="md">
        <Title order={4} mb="sm">
          プランの値段
        </Title>
        <Table>
          <Table.Tbody>
            {plans.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td w={120}>{p.name}</Table.Td>
                <Table.Td>
                  {role === 'owner' ? (
                    <Group>
                      <NumberInput
                        w={160}
                        value={prices[p.id]}
                        onChange={(v) => setPrices({ ...prices, [p.id]: Number(v) })}
                        suffix="円"
                        thousandSeparator=","
                      />
                      {/* A3（#208）：押してすぐには変えず、前と後の値段を見せて確かめる */}
                      <Button
                        variant="light"
                        disabled={Number(prices[p.id]) === Number(p.price)}
                        onClick={() => setConfirming(p)}
                      >
                        変える
                      </Button>
                    </Group>
                  ) : (
                    <Text>{Number(p.price).toLocaleString()}円</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
      <Card withBorder radius="md" padding={0}>
        <Title order={4} p="md">
          購入の一覧
        </Title>
        {!purchases ? (
          <Loader m="md" />
        ) : (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>買った日時</Table.Th>
                  <Table.Th>会員</Table.Th>
                  <Table.Th>プラン</Table.Th>
                  <Table.Th>値段</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {purchases.data.map((p: any, i: number) => (
                  <Table.Tr key={`${p.user_id}-${p.bought_at}-${i}`}>
                    <Table.Td>{toDate(p.bought_at).toLocaleString('ja-JP')}</Table.Td>
                    <Table.Td>
                      <Link to={`/members/${p.user_id}`}>{p.nickname ?? '―'}</Link>
                    </Table.Td>
                    <Table.Td>{p.plan}</Table.Td>
                    <Table.Td>{Number(p.price).toLocaleString()}円</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="center" p="md">
              <Pagination total={Math.ceil(purchases.total / 50)} value={page} onChange={setPage} />
            </Group>
          </>
        )}
      </Card>

      <Modal opened={confirming !== null} onClose={() => setConfirming(null)} title="値段を変えますか？">
        {confirming && (
          <Stack>
            <Text>
              {confirming.name}：{Number(confirming.price).toLocaleString()}円 →{' '}
              <b>{Number(prices[confirming.id]).toLocaleString()}円</b>
            </Text>
            <Text size="sm" c="dimmed">
              次に買う人から、新しい値段になります。
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirming(null)}>
                やめる
              </Button>
              <Button loading={busy} onClick={() => savePrice(confirming.id)}>
                変える
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      {notice}
    </Stack>
  )
}
