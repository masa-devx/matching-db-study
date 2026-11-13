import { BarChart } from '@mantine/charts'
import { Button, Card, Group, Loader, NumberInput, Pagination, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

// 12 有料会員・売上（FR-ADMIN-008・009）。月ごとの売上のグラフと表・プランの値段（owner だけ変えられる）・購入の一覧
export default function SalesPage() {
  const [monthly, setMonthly] = useState<any[] | null>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [prices, setPrices] = useState<Record<number, number>>({})
  const [purchases, setPurchases] = useState<any>(null)
  const [page, setPage] = useState(1)
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
    await fetch(`${api}/api/plans/${id}`, { method: 'PUT', headers, body: JSON.stringify({ price: prices[id] }) })
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
                      <Button variant="light" onClick={() => savePrice(p.id)}>
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
                    <Table.Td>{new Date(p.bought_at).toLocaleString('ja-JP')}</Table.Td>
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
    </Stack>
  )
}
