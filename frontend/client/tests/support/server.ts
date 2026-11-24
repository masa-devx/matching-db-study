import { setupServer } from 'msw/node'
import { authHandlers } from './handlers/authApi'
import { matchingHandlers } from './handlers/matchingApi'
import { messagingHandlers } from './handlers/messagingApi'
import { profileHandlers } from './handlers/profileApi'

// テストの API の偽物（MSW。architecture-frontend.md の7章）。ネットワークの手前で要求を受け、tests/support/handlers/ の偽の応答を返す。
// 準備と片付け（listen・resetHandlers・close）は tests/support/setup.ts が呼ぶ。
// テストごとに違う応答は、そのテストの中で server.use(...) で上書きする（テストが終わると resetHandlers で戻る）
export const server = setupServer(...authHandlers, ...profileHandlers, ...messagingHandlers, ...matchingHandlers)

// 送った要求。テストで「どの API を何本呼んだか」「何を送ったか」を見るために覚える（テストが終わると消す）
const sent: Request[] = []
// 偽の応答を置いていない要求（呼ぶはずのない API）。テストが終わったときに、1つでもあれば誤りにする
const unhandled: string[] = []

server.events.on('request:start', ({ request }) => {
  sent.push(request.clone())
})

server.events.on('request:unhandled', ({ request }) => {
  unhandled.push(`${request.method} ${request.url}`)
})

// method と path（例：'POST'・'/api/auth/logout'）が合う、送った要求を、送った順に返す
export const sentRequests = (method: string, path: string): Request[] => {
  return sent.filter((request) => request.method === method && new URL(request.url).pathname === path)
}

// 送った要求の、method と path の一覧（例：'GET /api/me'）。何をどの順で呼んだかを、まとめて確かめるとき
export const sentPaths = (): string[] => {
  return sent.map((request) => `${request.method} ${new URL(request.url).pathname}`)
}

// テストが終わったときに呼ぶ。覚えた要求を消し、偽の応答を置いていない要求の一覧を返す
export const takeUnhandled = (): string[] => {
  sent.length = 0
  return unhandled.splice(0)
}
