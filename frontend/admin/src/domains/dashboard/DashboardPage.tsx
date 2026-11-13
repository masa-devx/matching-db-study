import { BarChart, LineChart } from '@mantine/charts'
import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'

// 12 ダッシュボード（FR-ADMIN-003）。数のカード・直近30日の折れ線・12か月の売上の棒。
// レガシー版：API の呼び出しを画面に直接書く（送り先・トークンの読み出しを画面ごとに写す）
const CARDS: [string, string, string][] = [
  ['members', '会員（退会を除く）', '人'],
  ['registered_today', '今日の登録', '人'],
  ['matches', 'マッチ', '組'],
  ['messages', 'メッセージ', '件'],
  ['paid_members', '有料会員', '人'],
  ['sales_this_month', '今月の売上', '円'],
]

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  useEffect(() => {
    fetch(`${api}/api/dashboard`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then(setData)
  }, [api])

  if (!data) return <Loader />

  return (
    <Stack>
      <Title order={2}>ダッシュボード</Title>
      <SimpleGrid cols={{ base: 2, md: 3, xl: 6 }}>
        {CARDS.map(([key, label, unit]) => (
          <Card key={key} withBorder radius="md" padding="md">
            <Text size="sm" c="dimmed">
              {label}
            </Text>
            <Group gap={4} align="baseline">
              <Text fz={26} fw={700}>
                {Number(data.cards[key]).toLocaleString()}
              </Text>
              <Text size="sm" c="dimmed">
                {unit}
              </Text>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      <Card withBorder radius="md" padding="md">
        <Title order={4} mb="sm">
          直近30日（日ごと）
        </Title>
        <LineChart
          h={280}
          data={data.days.map((d: any) => ({ ...d, day: d.day.slice(5) }))}
          dataKey="day"
          withLegend
          series={[
            { name: 'registrations', label: '登録', color: 'blue.6' },
            { name: 'matches', label: 'マッチ', color: 'pink.6' },
            { name: 'messages', label: 'メッセージ', color: 'teal.6' },
          ]}
          curveType="monotone"
        />
      </Card>
      <Card withBorder radius="md" padding="md">
        <Title order={4} mb="sm">
          月ごとの売上（直近12か月）
        </Title>
        <BarChart
          h={280}
          data={data.months.map((m: any) => ({ month: m.month, sales: Number(m.sales) }))}
          dataKey="month"
          series={[{ name: 'sales', label: '売上（円）', color: 'grape.6' }]}
          valueFormatter={(v) => `${v.toLocaleString()}円`}
          yAxisProps={{ width: 110 }}
        />
      </Card>
    </Stack>
  )
}
