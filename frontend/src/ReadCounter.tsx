import { useEffect, useState } from 'react'

// 05c。本番の Firestore なら課金される読み取りの数を、画面の上に出す（この画面を開いてからの合計）。
// Emulator は課金しないので、取った件数とリスナーの docChanges() の数を、自分で数えている
export default function ReadCounter() {
  const w = window as any
  const [reads, setReads] = useState<number>(w.__fsReads ?? 0)
  useEffect(() => {
    const on = () => setReads(w.__fsReads ?? 0)
    window.addEventListener('fs-reads', on)
    return () => window.removeEventListener('fs-reads', on)
  }, [])
  return <p className="read-counter">本番なら読み取り {reads.toLocaleString()} 件分（ページを読み込んでからの合計）</p>
}
