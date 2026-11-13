import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// レガシー版（05c）。手元の Firebase Emulator（Docker の firebase）につなぐ。本物の Firebase にはつながない。
// プロジェクトは demo-matching。apiKey は Emulator が見ないので、決まった文字を入れる（秘密の値ではない）
const app = getApps().length
  ? getApp()
  : initializeApp({ projectId: 'demo-matching', apiKey: 'demo-key', authDomain: 'demo-matching.firebaseapp.com' })

export const auth = getAuth(app)
export const db = getFirestore(app)

// Emulator へのつなぎ先は、最初の1回だけ決める（2回呼ぶとエラーになる。開発用のサーバーの読み直しでも呼ばれる）
const w = window as any
if (!w.__emulatorConnected) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
  w.__emulatorConnected = true
}

// 本番なら課金される読み取りの数を、画面ごとに数える（Emulator は課金しないので、自分で数える）
export const countReads = (n: number) => {
  w.__fsReads = (w.__fsReads ?? 0) + n
  window.dispatchEvent(new Event('fs-reads'))
}

// Laravel にカスタムトークンをもらい、Firebase にログインする。uid は会員の public_id
export const signInFirebase = async (): Promise<string> => {
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const res = await fetch(`${api}/api/me/firebase-token`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
  }).then((r) => r.json())
  await signInWithCustomToken(auth, res.token)
  return res.uid
}
