import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router'
import './App.css'
import BlocksPage from './BlocksPage'
import HomePage from './HomePage'
import LikesPage from './LikesPage'
import LoginPage from './LoginPage'
import MessagesFsPage from './MessagesFsPage'
import MessagesPage from './MessagesPage'
import PlansPage from './PlansPage'
import PurchasePage from './PurchasePage'
import RegisterPage from './RegisterPage'
import SearchPage from './SearchPage'
import TalkFsPage from './TalkFsPage'
import TalkPage from './TalkPage'
import UserPage from './UserPage'

// レガシー版（03b）。画面の切り替えと、ログインしたあとの枠（四角の枠と、その下のタブ）を、ここに全部書く。
// ログインしているかは、sessionStorage の token があるかだけで決める（期限切れでも「ログイン中」に見える）
export default function App() {
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'))

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to={token ? '/home' : '/login'} />} />
      <Route path="/login" element={<LoginPage setToken={setToken} />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<HomePage setToken={setToken} />} />
      <Route path="/users/:publicId" element={<UserPage />} />
      <Route path="/likes" element={<LikesPage />} />
      {/* マッチした相手は、メッセージのタブで見る（マッチだけの画面は作らない）。05 から、トークの一覧 */}
      <Route path="/messages" element={<MessagesPage />} />
      {/* 05 トーク画面。ルームは public_id（UUID）で指す */}
      <Route path="/messages/:roomId" element={<TalkPage />} />
      {/* 05c Firestore 版（手元の Emulator）。05 の画面と並べて比べる */}
      <Route path="/messages-fs" element={<MessagesFsPage />} />
      <Route path="/messages-fs/:roomId" element={<TalkFsPage />} />
      {/* 04 検索。条件は sessionStorage に置き、戻ってきても残す */}
      <Route path="/search" element={<SearchPage />} />
      <Route path="/blocks" element={<BlocksPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/plans/:planId" element={<PurchasePage />} />
      <Route path="*" element={<p>ページが見つかりません</p>} />
    </Routes>
  )

  // ログインしていない画面（ログイン・登録）は、真ん中に1列だけ
  if (!token) {
    return (
      <div className="app">
        <main className="main">{routes}</main>
      </div>
    )
  }

  // ログインしたあとは、四角の枠の中に画面とタブを入れる。タブは左から 検索・いいね・メッセージ・ホーム
  return (
    <div className="shell">
      <div className="frame">
        <main className="frame-main">{routes}</main>
        <nav className="tabs">
          <NavLink to="/search" className="tab">
            <span className="tab-icon">⌕</span>検索
          </NavLink>
          <NavLink to="/likes" className="tab">
            <span className="tab-icon">♥</span>いいね
          </NavLink>
          <NavLink to="/messages" className="tab">
            <span className="tab-icon">✉</span>メッセージ
          </NavLink>
          <NavLink to="/home" className="tab">
            <span className="tab-icon">●</span>ホーム
          </NavLink>
        </nav>
      </div>
    </div>
  )
}
