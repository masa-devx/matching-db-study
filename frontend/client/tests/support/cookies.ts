// テストで、API が付ける CSRF のトークンの Cookie（XSRF-TOKEN）の代わりに置く・消す。
// 本物の API は、GET /sanctum/csrf-cookie の応答の Set-Cookie で付ける。jsdom は、偽の応答の Set-Cookie を document.cookie に入れないので、手で置く

export const setXsrfCookie = (value: string): void => {
  // biome-ignore lint/suspicious/noDocumentCookie: テストで、API が付ける Cookie の代わりに置く（jsdom には Cookie Store API がない）
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)}; path=/`
}

export const removeXsrfCookie = (): void => {
  // biome-ignore lint/suspicious/noDocumentCookie: テストで、API が付ける Cookie の代わりに消す（jsdom には Cookie Store API がない）
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}
