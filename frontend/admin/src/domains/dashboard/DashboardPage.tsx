import { BarChart, LineChart } from '@mantine/charts'
import { Alert, Card, Group, Loader, SimpleGrid, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

// 12 ダッシュボード（FR-ADMIN-003）。数のカード・直近30日の折れ線・12か月の売上の棒。
// レガシー版：API の呼び出しを画面に直接書く（送り先・トークンの読み出しを画面ごとに写す）
// A5（#224）：カードに、押したときの行き先と、比べる相手（前の期間）を足した
const CARDS: { key: string; label: string; unit: string; to?: string; note?: string }[] = [
  { key: 'members', label: '会員（退会を除く）', unit: '人', to: '/members' },
  { key: 'registered_today', label: '今日の登録', unit: '人', to: '/members' },
  { key: 'matches', label: 'マッチ', unit: '組' },
  { key: 'messages', label: 'メッセージ', unit: '件', to: '/messages' },
  { key: 'paid_active', label: '有料会員（期限の中）', unit: '人', to: '/members?plan=paid' },
  { key: 'sales_this_month', label: '今月の売上', unit: '円', to: '/sales' },
]

// 前の期間より、どれだけ増えた・減ったか（前が 0 のときは、出さない）
function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before)
    return (
      <Text size="xs" c="dimmed">
        {label} {before.toLocaleString()}
      </Text>
    )
  const rate = Math.round(((now - before) / before) * 100)
  return (
    <Text size="xs" c={rate >= 0 ? 'teal' : 'red'}>
      {label} {before.toLocaleString()}（{rate >= 0 ? '+' : ''}
      {rate}%）
    </Text>
  )
}

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

  // A5（#224）：今日やること（数が 0 のものは、出さない）
  const todos = [
    {
      label: '通報：まだ',
      hint: 'だれも対応していない案件',
      count: data.todo?.open_cases ?? 0,
      to: '/reports',
      color: 'red',
    },
    {
      label: '通報：対応中',
      hint: '済みにしていない案件',
      count: data.todo?.in_progress_cases ?? 0,
      to: '/reports?status=in_progress',
      color: 'yellow',
    },
    {
      label: 'もうすぐ切れる有料会員',
      hint: 'あと7日以内',
      count: data.todo?.expiring_paid ?? 0,
      to: '/members?plan=expiring',
      color: 'orange',
    },
    {
      label: '期限が過ぎた有料会員',
      hint: '有料の印が付いたまま',
      count: data.todo?.expired_paid ?? 0,
      to: '/members?plan=expired',
      color: 'grape',
    },
  ].filter((t) => t.count > 0)

  return (
    <Stack>
      <Title order={2}>ダッシュボード</Title>
      {/* A5（#224）：今日やること。数が 0 のものは、出さない。押すと、その一覧へ */}
      {todos.length > 0 ? (
        <Card withBorder radius="md" padding="md">
          <Title order={4} mb="sm">
            今日やること
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {todos.map((t) => (
              <UnstyledButton key={t.label} component={Link} to={t.to} aria-label={`${t.label} ${t.count}件`}>
                <Card withBorder radius="md" padding="sm" bg={`${t.color}.0`}>
                  <Group justify="space-between" wrap="nowrap">
                    <div>
                      <Text size="sm" fw={600}>
                        {t.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t.hint}
                      </Text>
                    </div>
                    <Text fz={24} fw={700} c={`${t.color}.8`} style={{ whiteSpace: 'nowrap' }}>
                      {t.count.toLocaleString()}
                      <Text span size="sm" fw={400}>
                        件
                      </Text>
                    </Text>
                  </Group>
                </Card>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Card>
      ) : (
        <Alert color="teal">今日やることは、ありません</Alert>
      )}
      <SimpleGrid cols={{ base: 2, md: 3, xl: 6 }}>
        {CARDS.map((c) => {
          const body = (
            <Card withBorder radius="md" padding="md" h="100%">
              <Text size="sm" c="dimmed">
                {c.label}
              </Text>
              <Group gap={4} align="baseline">
                <Text fz={26} fw={700}>
                  {Number(data.cards[c.key]).toLocaleString()}
                </Text>
                <Text size="sm" c="dimmed">
                  {c.unit}
                </Text>
              </Group>
              {c.key === 'registered_today' && (
                <Delta
                  now={data.cards.registered_today}
                  before={data.compare?.registered_yesterday ?? 0}
                  label="昨日"
                />
              )}
              {c.key === 'sales_this_month' && (
                <Text size="xs" c="dimmed">
                  先月（1か月ぶん）{Number(data.compare?.sales_last_month ?? 0).toLocaleString()}円
                </Text>
              )}
              {c.key === 'paid_active' && (
                <Text size="xs" c="dimmed">
                  有料の印がある会員は {Number(data.cards.paid_members).toLocaleString()}人（期限が過ぎた人を入れて）
                </Text>
              )}
            </Card>
          )
          return c.to ? (
            <UnstyledButton key={c.key} component={Link} to={c.to} aria-label={`${c.label}の一覧へ`}>
              {body}
            </UnstyledButton>
          ) : (
            <div key={c.key}>{body}</div>
          )
        })}
      </SimpleGrid>
      {/* A5（#224）：この30日の合計と、その前の30日との比べ */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {(
          [
            ['registrations', '登録（この30日）', '人'],
            ['matches', 'マッチ（この30日）', '組'],
            ['messages', 'メッセージ（この30日）', '件'],
          ] as const
        ).map(([key, label, unit]) => {
          const now = data.days.reduce((sum: number, d: any) => sum + Number(d[key]), 0)
          return (
            <Card key={key} withBorder radius="md" padding="md">
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <Group gap={4} align="baseline">
                <Text fz={22} fw={700}>
                  {now.toLocaleString()}
                </Text>
                <Text size="sm" c="dimmed">
                  {unit}
                </Text>
              </Group>
              <Delta now={now} before={data.compare?.[`${key}_prev30`] ?? 0} label="前の30日" />
            </Card>
          )
        })}
      </SimpleGrid>
      <Card withBorder radius="md" padding="md">
        {/* A5（#208）：折れ線を2つに分けた。前は、メッセージ（1日 千件ほど）と登録・マッチ（数十件）を
            同じ目盛りに載せていて、登録とマッチが底に張り付いて読めなかった */}
        <Title order={4} mb="sm">
          登録とマッチ（直近30日・日ごと）
        </Title>
        <LineChart
          h={240}
          data={data.days.map((d: any) => ({ ...d, day: d.day.slice(5) }))}
          dataKey="day"
          withLegend
          series={[
            { name: 'registrations', label: '登録', color: 'blue.6' },
            { name: 'matches', label: 'マッチ', color: 'pink.6' },
          ]}
          curveType="monotone"
          valueFormatter={(v) => `${v.toLocaleString()}`}
        />
      </Card>
      <Card withBorder radius="md" padding="md">
        <Title order={4} mb="sm">
          メッセージ（直近30日・日ごと）
        </Title>
        <LineChart
          h={240}
          data={data.days.map((d: any) => ({ ...d, day: d.day.slice(5) }))}
          dataKey="day"
          series={[{ name: 'messages', label: 'メッセージ', color: 'teal.6' }]}
          curveType="monotone"
          valueFormatter={(v) => `${v.toLocaleString()}件`}
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
