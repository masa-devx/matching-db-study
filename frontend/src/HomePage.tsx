import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

// レガシー版（03b）。ログインしたあとに移る先（/home）。プロフィールを見る・直すは #36 で足す
export default function HomePage() {
  const [me, setMe] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // ログインが要るかの守りを、画面ごとに書く
    if (!sessionStorage.getItem('token')) {
      navigate('/login')
      return
    }
    // 読み込み中・失敗・401 は考えない（StrictMode なので、開発中は2本呼ばれる）
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'}/api/me`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setMe)
  }, [])

  return (
    <div className="card">
      <h1 className="title">自分のプロフィール</h1>
      {me && <p>ログイン中：{me.email}</p>}
    </div>
  )
}
