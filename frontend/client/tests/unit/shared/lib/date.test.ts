import { describe, expect, it } from 'vitest'
import { ageFromBirthday, monthDay } from '../../../../src/shared/lib/date'

// shared/lib/date.ts：生年月日からの年齢と、月日の表し方（FR-UI-064）

describe('生年月日から年齢を出す', () => {
  it('今年の誕生日の前の日は、年の差から1を引く', () => {
    expect(ageFromBirthday('1996-12-31', new Date(2026, 11, 30))).toBe(29)
  })

  it('今年の誕生日の日に、年の差の年齢になる', () => {
    expect(ageFromBirthday('1996-12-31', new Date(2026, 11, 31))).toBe(30)
  })

  it('誕生日の月が過ぎていれば、年の差の年齢', () => {
    expect(ageFromBirthday('1996-04-01', new Date(2026, 10, 24))).toBe(30)
  })

  it('誕生日の月が過ぎていれば、誕生日の日が今日の日より大きくても、年の差の年齢', () => {
    expect(ageFromBirthday('1996-04-15', new Date(2026, 10, 1))).toBe(30)
  })

  it('誕生日の月がまだ来ていなければ、年の差から1を引く（年が明けたばかり）', () => {
    expect(ageFromBirthday('1996-04-01', new Date(2027, 0, 1))).toBe(30)
  })
})

describe('月と日だけで表す', () => {
  it('「11/20」の形', () => {
    expect(monthDay(new Date(2026, 10, 20))).toBe('11/20')
  })
})
