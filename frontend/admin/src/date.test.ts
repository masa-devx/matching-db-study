import { describe, expect, it } from 'vitest'
import { toDate } from './date'

// date.ts の toDate：管理画面の API が返す、時刻の帯の印がない日時を、UTC として読む（A6。#216）。画面のテストの見本（#114）

describe('管理画面の API が返した日時を、日付に直す', () => {
  it('時刻の帯の印がない「2026-11-17 15:42:17」は、UTC として読む（日本で9時間ずれない）', () => {
    expect(toDate('2026-11-17 15:42:17').toISOString()).toBe('2026-11-17T15:42:17.000Z')
  })

  it('印がある日時（Z・+09:00）は、その印のとおりに読む', () => {
    expect(toDate('2026-11-17T15:42:17Z').toISOString()).toBe('2026-11-17T15:42:17.000Z')
    expect(toDate('2026-11-17T15:42:17+09:00').toISOString()).toBe('2026-11-17T06:42:17.000Z')
  })

  it('空や null なら、日付として読めない値（Invalid Date）になる', () => {
    expect(Number.isNaN(toDate(null).getTime())).toBe(true)
    expect(Number.isNaN(toDate('').getTime())).toBe(true)
  })
})
