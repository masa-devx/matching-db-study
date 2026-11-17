import { useLocation, useNavigate } from 'react-router'
import ConfirmDialog from './ConfirmDialog'

// 07：有料会員への誘導（FR-UI-040）。送る・検索のこだわり条件（#150 で、身長から入れ替えた）・11回目のいいねで出す
export default function UpsellDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  // M8（#198）：どの画面から来たかを、プランの画面に渡す（買ったあと、その画面に戻すため）
  const location = useLocation()
  return (
    <ConfirmDialog
      open={open}
      title="有料会員になると使えます"
      confirmLabel="有料会員になる"
      cancelLabel="閉じる"
      onConfirm={() =>
        navigate('/plans', { viewTransition: true, state: { from: location.pathname + location.search } })
      }
      onClose={onClose}
    >
      <p>
        メッセージを送る・いいねを何回でも・検索のこだわり条件（最終ログイン・新しい会員・フリーワード・並び替え）、が使えるようになります。
      </p>
    </ConfirmDialog>
  )
}
