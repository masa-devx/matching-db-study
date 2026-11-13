import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useState } from 'react'

// 12 管理者のログイン（会員とは別）。トークンと名前・役割を sessionStorage に置く（会員の画面のレガシー版と同じ置き方）
export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const api = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    const res = await fetch(`${api}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) {
      setError(data.message)
      return
    }
    sessionStorage.setItem('adminToken', data.token)
    sessionStorage.setItem('admin', JSON.stringify(data.admin))
    onLogin()
  }

  return (
    <Center mih="100vh" bg="gray.0">
      <Paper withBorder shadow="sm" radius="md" p="xl" w={380}>
        <form onSubmit={submit}>
          <Stack>
            <Title order={3}>管理画面にログイン</Title>
            <TextInput label="メールアドレス" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
            <PasswordInput label="パスワード" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={sending}>
              ログイン
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
}
