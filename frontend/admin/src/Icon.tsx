// 12 管理画面のアイコン（SVG・20px・線）。サイドバーの1か所の一覧（domains.tsx）が名前で指す
const PATHS: Record<string, string> = {
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users:
    'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  chat: 'M4 5h16v11H8l-4 4V5z',
  yen: 'M6 4l6 8 6-8M12 12v8M7 13h10M7 17h10',
  log: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
}

export default function Icon({ name }: { name: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
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
