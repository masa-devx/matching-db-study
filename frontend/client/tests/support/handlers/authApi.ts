import { HttpResponse, http } from 'msw'
import { apiUrl } from '../../../src/api/client'
import { setXsrfCookie } from '../cookies'

// Auth（src/api/authApi.ts）の偽の応答。形は docs/api/01b-auth.md の改善版の例と同じ。
// テストごとに違う応答（失敗・空）は、そのテストの中で server.use(...) で上書きする

// GET /sanctum/csrf-cookie で付ける CSRF のトークン（本物は毎回ちがう文字）
export const CSRF_TOKEN_FROM_API = 'xsrf-from-api'

// 419（CSRF のトークンが合わない）の本文
export const STALE_TOKEN_BODY = { message: '画面を読み込み直してください' }

// 2回目までは 419 を返し、3回目からは after の応答を返す偽物の中身。
// 送り直しを1回で止める印（src/api/client.ts）が抜けたときに、送り続けずに、3回目の応答ですぐテストが落ちるようにする
export const staleTokenTwiceThen = (after: () => Response): (() => Response) => {
  let answered = 0
  return () => {
    answered += 1
    return answered <= 2 ? HttpResponse.json(STALE_TOKEN_BODY, { status: 419 }) : after()
  }
}

export const authHandlers = [
  // CSRF のトークンの Cookie をもらう（204。JavaScript から読める Cookie XSRF-TOKEN を付ける）
  http.get(apiUrl('/sanctum/csrf-cookie'), () => {
    setXsrfCookie(CSRF_TOKEN_FROM_API)
    return new HttpResponse(null, { status: 204 })
  }),

  // ログアウト（204）
  http.post(apiUrl('/api/auth/logout'), () => new HttpResponse(null, { status: 204 })),

  // 確認のメールをもう一度送る（200）
  http.post(apiUrl('/api/email-verifications'), () => HttpResponse.json({ message: '確認のメールを送りました' })),

  // パスワードを変える（200）
  http.put(apiUrl('/api/me/password'), () => HttpResponse.json({ message: 'パスワードを変えました' })),
]
