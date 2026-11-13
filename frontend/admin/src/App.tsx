import { AppShell, Badge, Burger, Button, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { DOMAINS, type Role } from './domains'
import Icon from './Icon'
import LoginPage from './LoginPage'

// 12 管理画面の枠（よくある管理画面の形：左にサイドバー・上に帯）。項目とルートは domains.tsx の一覧から作る
export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('adminToken'))
  const [opened, { toggle, close }] = useDisclosure()
  const location = useLocation()

  if (!token) return <LoginPage onLogin={() => setToken(sessionStorage.getItem('adminToken'))} />

  const admin = JSON.parse(sessionStorage.getItem('admin') ?? '{}') as { name?: string; role?: Role }
  const role = admin.role ?? 'viewer'
  const domains = DOMAINS.filter((d) => d.roles.includes(role))

  const logout = () => {
    sessionStorage.removeItem('adminToken')
    sessionStorage.removeItem('admin')
    setToken(null)
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 230, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="メニュー" />
            <Text fw={700}>マッチング 管理画面</Text>
          </Group>
          <Group gap="sm">
            <Text size="sm">{admin.name}</Text>
            <Badge variant="light" color={role === 'owner' ? 'grape' : 'gray'}>
              {role === 'owner' ? 'すべてできる' : '見るだけ'}
            </Badge>
            <Button variant="subtle" size="xs" onClick={logout}>
              ログアウト
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {domains.map((d) => (
          <NavLink
            key={d.path}
            component={Link}
            to={d.path}
            label={d.label}
            leftSection={<Icon name={d.icon} />}
            active={d.path === '/' ? location.pathname === '/' : location.pathname.startsWith(d.path)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Routes>
          {domains.flatMap((d) => [
            <Route key={d.path} path={d.path} element={d.element} />,
            ...(d.children ?? []).map((c) => <Route key={c.path} path={c.path} element={c.element} />),
          ])}
          <Route path="*" element={<Text>ページが見つかりません（見る権限がないか、ない画面です）</Text>} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  )
}
