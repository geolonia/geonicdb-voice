import { PREFECTURES } from './prefectures.ts'

export interface SurveyFormData {
  name: string
  email: string
  age: string
  prefecture: string
  inquiry: string
}

export interface ValidationErrors {
  name?: string
  email?: string
  age?: string
  prefecture?: string
  inquiry?: string
}

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export function validateSurveyForm(data: SurveyFormData): ValidationErrors {
  const errors: ValidationErrors = {}

  // 氏名
  if (!data.name.trim()) {
    errors.name = '氏名を入力してください'
  } else if (data.name.length > 100) {
    errors.name = '氏名は100文字以内で入力してください'
  }

  // メールアドレス
  if (!data.email.trim()) {
    errors.email = 'メールアドレスを入力してください'
  } else if (data.email.length > 254) {
    errors.email = 'メールアドレスは254文字以内で入力してください'
  } else if (!EMAIL_PATTERN.test(data.email)) {
    errors.email = '有効なメールアドレスを入力してください'
  }

  // 年齢
  if (!data.age.trim()) {
    errors.age = '年齢を入力してください'
  } else {
    const ageNum = Number(data.age)
    if (!Number.isInteger(ageNum)) {
      errors.age = '年齢は整数で入力してください'
    } else if (ageNum < 0 || ageNum > 150) {
      errors.age = '年齢は0〜150の範囲で入力してください'
    }
  }

  // 都道府県
  if (!data.prefecture) {
    errors.prefecture = '都道府県を選択してください'
  } else if (!(PREFECTURES as readonly string[]).includes(data.prefecture)) {
    errors.prefecture = '有効な都道府県を選択してください'
  }

  // お問い合わせ内容
  if (!data.inquiry.trim()) {
    errors.inquiry = 'お問い合わせ内容を入力してください'
  } else if (data.inquiry.length > 2000) {
    errors.inquiry = 'お問い合わせ内容は2000文字以内で入力してください'
  }

  return errors
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some(Boolean)
}
