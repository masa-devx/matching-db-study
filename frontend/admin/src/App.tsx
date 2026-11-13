import { Badge, Card, Container, Group, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'

// 12 管理画面（#88 環境）。API（admin/backend の :8100）につながるかだけを見せる。
// サイドバー・ログイン・各ドメインの画面は #91 で作る
const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

export default function App() {
  const [health, setHealth] = useState<{ status: string; database: string } | null>(null)
  useEffect(() => {
    fetch(`${api}/api/health`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then(setHealth)
  }, [])

  return (
    <Container size="sm" py="xl">
      <Card withBorder radius="md" padding="lg">
        <Title order={2}>管理画面</Title>
        <Group mt="md">
          <Text>API</Text>
          <Badge color={health?.status === 'ok' ? 'green' : 'gray'}>{health?.status ?? '確かめ中'}</Badge>
          {health && <Text c="dimmed">{health.database}</Text>}
        </Group>
      </Card>
    </Container>
  )
}
