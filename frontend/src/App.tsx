import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router'
import './App.css'
import HomePage from './HomePage'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import UserPage from './UserPage'

// レガシー版（03b）。画面の切り替え・枠（横のメニュー・上の帯・下のタブ）・ログアウトを、ここに全部書く。
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

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to={token ? '/home' : '/login'} />} />
      <Route path="/login" element={<LoginPage setToken={setToken} />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/users/:id" element={<UserPage />} />
      {/* /likes・/matches は #37 で足す */}
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

  // ログインしたあとの枠。PC は横のメニュー、タブレットとスマホは上の帯と下のタブ（CSS で出し分ける）
  // 同じリンクを、横のメニューと下のタブの2か所に書く
  return (
    <div className="shell">
      <aside className="side">
        <span className="logo">matching</span>
        <nav className="side-nav">
          <NavLink to="/home" className="side-link">
            <span className="tab-icon">●</span>ホーム
          </NavLink>
          <NavLink to="/likes" className="side-link">
            <span className="tab-icon">♥</span>送ったいいね
          </NavLink>
          <NavLink to="/matches" className="side-link">
            <span className="tab-icon">✦</span>マッチ
          </NavLink>
        </nav>
        <button className="button button-small button-ghost" onClick={logout}>
          ログアウト
        </button>
      </aside>

      <header className="header">
        <span className="logo">matching</span>
        <button className="button button-small button-ghost" onClick={logout}>
          ログアウト
        </button>
      </header>

      <main className="shell-main">{routes}</main>

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
    </div>
  )
}
