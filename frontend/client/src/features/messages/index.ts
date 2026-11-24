// メッセージの機能が、ほかの機能と app/ に見せるもの（architecture-frontend.md の2章）。
// 今は、下のタブの数と、その数を読み直す関数（届いたいいねの画面が、スキップ・マッチ・元に戻すのあとに呼ぶ）。トークの一覧・トーク画面は、画面を移すチケットでここに足す
export { recountBadges, useBadgeCounts } from './hooks/useBadgeCounts'
export type { TabCounts } from './types'
