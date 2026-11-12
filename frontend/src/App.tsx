import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router'
import './App.css'
import HomePage from './HomePage'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import UserPage from './UserPage'

// レガシー版（03b）。画面の切り替え・上の帯・下のタブ・ログアウトを、ここに全部書く。
// ログインしているかは、sessionStorage の token があるかだけで決める（期限切れでも「ログイン中」に見える）
export default function App() {
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'))
  const navigate = useNavigate()

  const logout = () => {
    // 送り先とトークンの読み出しを、ここにも書く
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
    // 応答を待たずに消す。サーバーは何もしないので、消す前に写したトークンは30日使える
    sessionStorage.removeItem('token')
    setToken(null)
    navigate('/login')
  }

  return (
    <div className={token ? 'app app-with-tabs' : 'app'}>
      {token && (
        <header className="header">
          <span className="logo">matching</span>
          <button className="button button-small button-ghost" onClick={logout}>
            ログアウト
          </button>
        </header>
      )}
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to={token ? '/home' : '/login'} />} />
          <Route path="/login" element={<LoginPage setToken={setToken} />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/users/:id" element={<UserPage />} />
          {/* /likes・/matches は #37 で足す */}
          <Route path="*" element={<p>ページが見つかりません</p>} />
        </Routes>
      </main>
      {token && (
        // スマホのアプリによくある、下に固定したタブ
        <nav className="tabs">
          <NavLink to="/home" className="tab">
            <span className="tab-icon">●</span>ホーム
          </NavLink>
          <NavLink to="/likes" className="tab">
            <span className="tab-icon">♥</span>いいね
          </NavLink>
          <NavLink to="/matches" className="tab">
            <span className="tab-icon">✦</span>マッチ
          </NavLink>
        </nav>
      )}
    </div>
  )
}
