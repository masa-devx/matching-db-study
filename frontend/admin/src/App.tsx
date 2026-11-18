import { Anchor, AppShell, Badge, Breadcrumbs, Burger, Button, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import { DOMAINS, type Role } from './domains'
import Icon from './Icon'
import LoginPage from './LoginPage'
import MemberSearch from './MemberSearch'

// 12 管理画面の枠（よくある管理画面の形：左にサイドバー・上に帯）。項目とルートは domains.tsx の一覧から作る
export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('adminToken'))
  const [opened, { toggle, close }] = useDisclosure()
  const location = useLocation()
  // A6（#208）：ログインの画面に出す知らせ（期限が切れたとき）
  const [notice, setNotice] = useState('')
  // A6（#224）：サイドバーの「通報」に出す、まだ対応していない案件の数
  const [openCases, setOpenCases] = useState(0)

  // A6（#224）：画面を移るたびに、通報の案件の一覧（「まだ」の 20件）を読んで、全部の件数だけを使う
  // （数だけを返す API はない。82本の SQL が流れる）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 画面を移るたびに数え直す
  useEffect(() => {
    if (!sessionStorage.getItem('adminToken')) return
    fetch(`${import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:8100'}/api/report-cases?status=open`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
    })
      .then((r) => r.json())
      .then((d) => setOpenCases(Number(d.total ?? 0)))
      .catch(() => setOpenCases(0))
  }, [location.pathname, token])

  // A6：ログインの期限（8時間）が切れていたら、ログインの画面に戻す。前は、API が 500 を返し、
  // どの画面も読み込み中か真っ白のままだった。期限は、トークンの中身（exp）を画面で読んで決める
  // （署名は確かめない。本当に使えるかを決めるのは API）。画面を移るたびと、1分ごとに見る
  // biome-ignore lint/correctness/useExhaustiveDependencies: 画面を移るたびに見直す
  useEffect(() => {
    const check = () => {
      const now = sessionStorage.getItem('adminToken')
      if (!now) return
      let exp = 0
      try {
        exp = JSON.parse(atob(now.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp ?? 0
      } catch {
        exp = 0
      }
      if (exp * 1000 <= Date.now()) {
        sessionStorage.removeItem('adminToken')
        sessionStorage.removeItem('admin')
        setNotice('ログインの期限が切れました。もう一度ログインしてください')
        setToken(null)
      }
    }
    check()
    const timer = setInterval(check, 60000)
    return () => clearInterval(timer)
  }, [location.pathname, token])

  if (!token)
    return (
      <LoginPage
        notice={notice}
        onLogin={() => {
          setNotice('')
          setToken(sessionStorage.getItem('adminToken'))
        }}
      />
    )

  const admin = JSON.parse(sessionStorage.getItem('admin') ?? '{}') as { name?: string; role?: Role }
  const role = admin.role ?? 'viewer'
  const domains = DOMAINS.filter((d) => d.roles.includes(role))

  // A6（#224）：パンくず。サイドバーの項目（domains.tsx）から、今の URL に当たるものを探す。
  // 下の画面（詳細など）の名前は、ここに書いた（画面を足したら、ここにも足す）
  const parent = domains.find((d) => d.path !== '/' && location.pathname.startsWith(d.path))
  const CHILD_LABELS: [string, string][] = [
    ['/members/', '会員の詳細'],
    ['/reports/', '通報の案件'],
    ['/messages/rooms/', 'やり取り'],
  ]
  const child = CHILD_LABELS.find(([path]) => location.pathname.startsWith(path))
  const crumbs = parent
    ? [{ path: parent.path, label: parent.label }, ...(child ? [{ path: location.pathname, label: child[1] }] : [])]
    : []

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
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="メニュー" />
            <Text fw={700} visibleFrom="md" style={{ whiteSpace: 'nowrap' }}>
              マッチング 管理画面
            </Text>
          </Group>
          {/* A1（#224）：どの画面からでも、会員を探せる */}
          <MemberSearch />
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" visibleFrom="sm">
              {admin.name}
            </Text>
            <Badge variant="light" color={role === 'owner' ? 'grape' : 'gray'} visibleFrom="xs">
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
            // A6（#224）：通報の「まだ」の件数（0件のときは、出さない）
            rightSection={
              d.path === '/reports' && openCases > 0 ? (
                <Badge size="sm" color="red" aria-label={`まだ対応していない通報 ${openCases}件`}>
                  {openCases > 99 ? '99+' : openCases}
                </Badge>
              ) : null
            }
            active={d.path === '/' ? location.pathname === '/' : location.pathname.startsWith(d.path)}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        {/* A6（#224）：今どこにいるか（一覧の下の画面にいるときだけ出す。親の一覧へ戻れる） */}
        {crumbs.length > 1 && (
          <Breadcrumbs mb="sm" aria-label="今いる場所">
            {crumbs.map((c, i) =>
              i < crumbs.length - 1 ? (
                <Anchor key={c.path} component={Link} to={c.path} size="sm">
                  {c.label}
                </Anchor>
              ) : (
                <Text key={c.path} size="sm" c="dimmed">
                  {c.label}
                </Text>
              ),
            )}
          </Breadcrumbs>
        )}
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
