import type { ReactNode } from 'react'
import AuditLogsPage from './domains/audit-logs/AuditLogsPage'
import DashboardPage from './domains/dashboard/DashboardPage'
import MemberDetailPage from './domains/members/MemberDetailPage'
import MembersPage from './domains/members/MembersPage'
import MessagesPage from './domains/messages/MessagesPage'
import SalesPage from './domains/sales/SalesPage'

// 12 管理画面の「1か所の一覧」（FR-ADMIN-002・NFR-ADMIN-004）。サイドバーの項目とルートは、ここから作る。
// ドメインを足すときは、src/domains/<名前>/ に画面を作って、ここに1行足すだけ（App.tsx は直さない）。
// roles に入っていない役割には、サイドバーに出さず、ルートも作らない（ただし API は別に確かめる。画面で隠すだけでは守れない）
export type Role = 'owner' | 'viewer'

export type Domain = {
  path: string
  label: string
  icon: string
  roles: Role[]
  element: ReactNode
  // サイドバーには出さないが、そのドメインの中で開く画面（詳細など）
  children?: { path: string; element: ReactNode }[]
}

export const DOMAINS: Domain[] = [
  { path: '/', label: 'ダッシュボード', icon: 'chart', roles: ['owner', 'viewer'], element: <DashboardPage /> },
  {
    path: '/members',
    label: '会員',
    icon: 'users',
    roles: ['owner', 'viewer'],
    element: <MembersPage />,
    children: [{ path: '/members/:publicId', element: <MemberDetailPage /> }],
  },
  { path: '/messages', label: 'メッセージ', icon: 'chat', roles: ['owner', 'viewer'], element: <MessagesPage /> },
  { path: '/sales', label: '有料会員・売上', icon: 'yen', roles: ['owner', 'viewer'], element: <SalesPage /> },
  { path: '/audit-logs', label: '監査ログ', icon: 'log', roles: ['owner'], element: <AuditLogsPage /> },
]
