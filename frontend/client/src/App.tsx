import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import './App.css'
import BlocksPage from './BlocksPage'
import TabBar from './components/TabBar'
import VerifyBanner from './components/VerifyBanner'
import { ToastProvider } from './components/Toast'
import ForgotPasswordPage from './ForgotPasswordPage'
import HomePage from './HomePage'
import InfoPage from './InfoPage'
import LikesPage from './LikesPage'
import LoginPage from './LoginPage'
import MessagesFsPage from './MessagesFsPage'
import MessagesPage from './MessagesPage'
import PlansPage from './PlansPage'
import PurchasePage from './PurchasePage'
import RegisterPage from './RegisterPage'
import ResetPasswordPage from './ResetPasswordPage'
import SearchConditionsPage from './SearchConditionsPage'
import SearchPage from './SearchPage'
import SentLikesPage from './SentLikesPage'
import SettingsPage from './SettingsPage'
import TalkFsPage from './TalkFsPage'
import TalkPage from './TalkPage'
import UserPage from './UserPage'
import VerifyPage from './VerifyPage'

// レガシー版（03b）。画面の切り替えと、ログインしたあとの枠（四角の枠と、その下のタブ）を、ここに全部書く。
// ログインしているかは、sessionStorage の token があるかだけで決める（期限切れでも「ログイン中」に見える）
export default function App() {
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'))

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to={token ? '/home' : '/login'} />} />
      {/* M2（#193）：ログインしたまま開いたら、ホームへ移す（前は、タブの付いた枠の中に、ログインの画面が出ていた） */}
      <Route path="/login" element={token ? <Navigate to="/home" /> : <LoginPage setToken={setToken} />} />
      <Route path="/register" element={token ? <Navigate to="/home" /> : <RegisterPage />} />
      {/* M2：確認のメールのリンクが開く画面。ログインしていなくても開ける */}
      <Route path="/verify/:token" element={<VerifyPage />} />
      {/* M2（#196）：パスワードを忘れたとき。メールアドレスを入れる画面と、メールのリンクが開く画面 */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/users/:publicId" element={<UserPage />} />
      {/* M3（#184）：いいねのタブは、届いたいいね。送ったいいねは、設定から開く */}
      <Route path="/likes" element={<LikesPage />} />
      <Route path="/likes/sent" element={<SentLikesPage />} />
      {/* マッチした相手は、メッセージのタブで見る（マッチだけの画面は作らない）。05 から、トークの一覧 */}
      <Route path="/messages" element={<MessagesPage />} />
      {/* 05 トーク画面。ルームは public_id（UUID）で指す */}
      <Route path="/messages/:roomId" element={<TalkPage />} />
      {/* 05c Firestore 版（手元の Emulator）。05 の画面と並べて比べる */}
      <Route path="/messages-fs" element={<MessagesFsPage />} />
      <Route path="/messages-fs/:roomId" element={<TalkFsPage />} />
      {/* 04 検索。今の条件は URL のクエリ（04b）。なければ sessionStorage の最後の条件に戻す */}
      <Route path="/search" element={<SearchPage />} />
      {/* #147 検索の条件の画面。条件の欄と、保存した検索条件（04b）は、ここにだけ出す */}
      <Route path="/search/conditions" element={<SearchConditionsPage />} />
      {/* M1 設定（#181）。ホームの歯車から来る。案内の画面（ヘルプ・規約など）は /info/<名前> */}
      <Route path="/settings" element={<SettingsPage setToken={setToken} />} />
      <Route path="/info/:slug" element={<InfoPage />} />
      <Route path="/blocks" element={<BlocksPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/plans/:planId" element={<PurchasePage />} />
      <Route path="*" element={<p>ページが見つかりません</p>} />
    </Routes>
  )

  // ログインしていない画面（ログイン・登録）は、真ん中に1列だけ
  if (!token) {
    return (
      <ToastProvider>
        <div className="app">
          <main className="main">{routes}</main>
        </div>
      </ToastProvider>
    )
  }

  // ログインしたあとは、四角の枠の中に画面とタブを入れる。タブは左から 検索・いいね・メッセージ・ホーム
  // 03c：トーストはどの画面からも出せるように、枠の外側で1つだけ持つ。タブは部品（components/TabBar）にした
  return (
    <ToastProvider>
      <div className="shell">
        <div className="frame">
          {/* M2（#193）：メールアドレスを確認していない会員への帯。どの画面でも、いちばん上に出る */}
          <VerifyBanner />
          <main className="frame-main">{routes}</main>
          <TabBar />
        </div>
      </div>
    </ToastProvider>
  )
}
