import { useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router'
import './App.css'
import RequireAuth from './app/RequireAuth'
import BlocksPage from './BlocksPage'
import NoticeBanner from './components/NoticeBanner'
import TabBar from './components/TabBar'
import { ToastProvider } from './components/Toast'
import VerifyBanner from './components/VerifyBanner'
import ForgotPasswordPage from './ForgotPasswordPage'
import HomePage from './HomePage'
import InfoPage from './InfoPage'
import LikesPage from './LikesPage'
import LoginPage from './LoginPage'
import MessagesFsPage from './MessagesFsPage'
import MessagesPage from './MessagesPage'
import NoticesPage from './NoticesPage'
import PlansPage from './PlansPage'
import PurchasePage from './PurchasePage'
import RegisterPage from './RegisterPage'
import ResetPasswordPage from './ResetPasswordPage'
import SearchConditionsPage from './SearchConditionsPage'
import SearchPage from './SearchPage'
import SentLikesPage from './SentLikesPage'
import SettingsPage from './SettingsPage'
import { useSession } from './shared/session/SessionProvider'
import TalkFsPage from './TalkFsPage'
import TalkPage from './TalkPage'
import UserPage from './UserPage'
import VerifyPage from './VerifyPage'

// M9（#198）：ブラウザのタブに出す題。URL の頭と、題の組を、上から順に当てる（画面を足したら、ここにも足す）
const TITLES: [string, string][] = [
  ['/search/conditions', '検索の条件'],
  ['/search', '検索'],
  ['/likes/sent', '送ったいいね'],
  ['/likes', 'いいね'],
  ['/messages', 'メッセージ'],
  ['/home', 'ホーム'],
  ['/users/', 'プロフィール'],
  ['/settings', '設定'],
  ['/notices', '運営からのお知らせ'],
  ['/info/', '案内'],
  ['/blocks', 'ブロックした相手'],
  ['/plans', '有料会員'],
  ['/login', 'ログイン'],
  ['/register', '登録'],
  ['/verify/', 'メールアドレスの確認'],
  ['/forgot-password', 'パスワードの再設定'],
  ['/reset-password/', '新しいパスワード'],
]

// レガシー版（03b）。画面の切り替えと、ログインしたあとの枠（四角の枠と、その下のタブ）を、ここに全部書く。
// ログインしているかは、起動のときの GET /api/me で決める（shared/session の SessionProvider）。ログインが要る画面は RequireAuth の下に置く（#257 の 2-2）
export default function App() {
  const { session } = useSession()
  const signedIn = session.status === 'signedIn'
  const location = useLocation()

  // M9：画面ごとに、タブの題を変える（前は、どの画面も同じ題で、タブを並べると見分けられなかった）
  useEffect(() => {
    const found = TITLES.find(([path]) => location.pathname.startsWith(path))
    document.title = found ? `${found[1]}｜matching` : 'matching'
  }, [location.pathname])

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to={signedIn ? '/home' : '/login'} />} />
      {/* M2（#193）：ログインしたまま開いたら、ホームへ移す（前は、タブの付いた枠の中に、ログインの画面が出ていた） */}
      <Route path="/login" element={signedIn ? <Navigate to="/home" /> : <LoginPage />} />
      <Route path="/register" element={signedIn ? <Navigate to="/home" /> : <RegisterPage />} />
      {/* M2：確認のメールのリンクが開く画面。ログインしていなくても開ける */}
      <Route path="/verify/:token" element={<VerifyPage />} />
      {/* M2（#196）：パスワードを忘れたとき。メールアドレスを入れる画面と、メールのリンクが開く画面 */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      {/* #257 の 2-2：ここから下は、ログインが要る画面（RequireAuth が守る） */}
      <Route element={<RequireAuth />}>
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
        <Route path="/settings" element={<SettingsPage />} />
        {/* A7（#213）：運営からのお知らせ。ホームのベルと、未読の帯から来る */}
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/blocks" element={<BlocksPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/:planId" element={<PurchasePage />} />
      </Route>
      {/* 案内（ヘルプ・規約など）は、ログインしていなくても開ける */}
      <Route path="/info/:slug" element={<InfoPage />} />
      {/* M9（#198）：ない URL。戻る先を出す（前は、文だけで、どこにも行けなかった） */}
      <Route
        path="*"
        element={
          <div className="empty">
            <p className="empty-text">ページが見つかりません</p>
            <Link className="button" to={signedIn ? '/home' : '/login'}>
              {signedIn ? 'ホームへ' : 'ログインへ'}
            </Link>
          </div>
        }
      />
    </Routes>
  )

  // ログインしていない画面（ログイン・登録）は、真ん中に1列だけ
  if (!signedIn) {
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
          {/* A7（#213）：運営からのお知らせに、未読があるときの帯 */}
          <NoticeBanner />
          <main className="frame-main">{routes}</main>
          <TabBar />
        </div>
      </div>
    </ToastProvider>
  )
}
