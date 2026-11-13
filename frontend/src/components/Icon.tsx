// 03c：アイコン（SVG・24px・線の太さ 1.75。docs/design.md の「タブバー」）。Web フォントや画像を使わない
const PATHS: Record<string, string> = {
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm9 16-4.35-4.35',
  heart: 'M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z',
  chat: 'M4 5h16v11H8l-4 4V5z',
  home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4v-9z',
  back: 'M15 5l-7 7 7 7',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
}

export default function Icon({ name, size = 24, filled = false }: { name: string; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
