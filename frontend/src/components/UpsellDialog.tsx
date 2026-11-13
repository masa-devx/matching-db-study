import { useNavigate } from 'react-router'
import ConfirmDialog from './ConfirmDialog'

// 07：有料会員への誘導（FR-UI-040）。送る・身長の条件・11回目のいいねで出す
export default function UpsellDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <ConfirmDialog
      open={open}
      title="有料会員になると使えます"
      confirmLabel="有料会員になる"
      cancelLabel="閉じる"
      onConfirm={() => navigate('/plans', { viewTransition: true })}
      onClose={onClose}
    >
      <p>メッセージを送る・いいねを何回でも・身長で探す、が使えるようになります。</p>
    </ConfirmDialog>
  )
}
