import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MaintenanceGate } from './MaintenanceGate'
import { enterMaintenance } from './maintenance'

// app/MaintenanceGate.tsx：メンテナンス中なら、どの画面の代わりにもメンテナンスの画面を出す（FR-MAINT-006）。
// メンテナンス中かは、ファイルの中に1つだけ持つ（入ったら戻らない）ので、このファイルのテストは1本にする

describe('会員が画面を使っている途中で、API が 503（メンテナンス中）を返す', () => {
  it('それまでの画面の代わりに「ただいまメンテナンス中です」を出し、読み上げのために見出しにフォーカスを移す（FR-MAINT-006）', async () => {
    render(
      <MaintenanceGate>
        <p>画面の中身</p>
      </MaintenanceGate>,
    )
    expect(screen.getByText('画面の中身')).toBeInTheDocument()

    await act(async () => {
      enterMaintenance()
    })

    const heading = screen.getByRole('heading', { name: 'ただいまメンテナンス中です' })
    expect(heading).toHaveFocus()
    expect(document.title).toBe('メンテナンス中｜matching')
    expect(screen.queryByText('画面の中身')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '読み込み直す' })).toBeInTheDocument()
  })
})
