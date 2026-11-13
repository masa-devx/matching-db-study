// 03c：丸いアバター（FR-UI-031）。写真がなければ、ニックネームの1文字目をグラデーションの上に白で出す
export default function Avatar({
  image,
  name,
  size = 48,
}: {
  image?: string | null
  name?: string | null
  size?: number
}) {
  const api = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }
  if (image) return <img className="avatar" src={`${api}${image}`} alt="" style={style} />
  return (
    <span className="avatar avatar-initial" style={style} aria-hidden="true">
      {(name ?? '?').slice(0, 1)}
    </span>
  )
}
