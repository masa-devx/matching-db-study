// A6（#216）：管理画面の API は、DB の日時を「2026-11-17 15:42:17」の形（時刻の帯の印なし。中身は UTC）で返す。
// そのまま new Date() に渡すと、ブラウザは手元の時刻として読むので、日本では 9時間前に出ていた。
// 印がなければ UTC として読む。API を直すのが本筋だが、レガシー版では、画面の側で読み替える
// （日時を出す所は、new Date() の代わりに、これを呼ぶ。呼び忘れた所は、ずれたまま）
export function toDate(value: string | null | undefined): Date {
  if (!value) return new Date(Number.NaN)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`)
  }
  return new Date(value)
}
