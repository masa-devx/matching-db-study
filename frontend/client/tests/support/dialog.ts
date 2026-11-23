// jsdom は <dialog> の showModal() と close() を持たないので、開いた・閉じたの印（open の属性）だけを付ける。
// ダイアログを開く画面のテストの beforeAll で1回呼ぶ
export const stubDialog = (): void => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
}
