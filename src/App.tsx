import { useState } from 'react'
import {
  createSurveyResponse,
} from './lib/ngsi.ts'
import {
  validateSurveyForm,
  hasErrors,
  type SurveyFormData,
  type ValidationErrors,
} from './lib/validation.ts'
import { PREFECTURES } from './lib/prefectures.ts'

const INITIAL_FORM: SurveyFormData = {
  name: '',
  email: '',
  birthDate: '',
  prefecture: '',
  inquiry: '',
}

/** 今日の日付を YYYY-MM-DD 形式で返す（date input の max 属性用） */
function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function App() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<SurveyFormData>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({})

  const updateField = (field: keyof SurveyFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const errors = validateSurveyForm(form)
    setFieldErrors(errors)
    if (hasErrors(errors)) return

    setLoading(true)
    try {
      await createSurveyResponse(form)
      setForm(INITIAL_FORM)
      setFieldErrors({})
      setSuccess('アンケートを送信しました')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="survey-form">
        <h1 style={{ marginBottom: '2rem' }}>アンケート</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">氏名</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="山田太郎"
              disabled={loading}
            />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="taro@example.com"
              disabled={loading}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="birthDate">生年月日</label>
            <input
              id="birthDate"
              type="date"
              max={todayString()}
              value={form.birthDate}
              onChange={(e) => updateField('birthDate', e.target.value)}
              disabled={loading}
            />
            {fieldErrors.birthDate && <span className="field-error">{fieldErrors.birthDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="prefecture">都道府県</label>
            <select
              id="prefecture"
              value={form.prefecture}
              onChange={(e) => updateField('prefecture', e.target.value)}
              disabled={loading}
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((pref) => (
                <option key={pref} value={pref}>{pref}</option>
              ))}
            </select>
            {fieldErrors.prefecture && <span className="field-error">{fieldErrors.prefecture}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="inquiry">お問い合わせ内容</label>
            <textarea
              id="inquiry"
              rows={5}
              value={form.inquiry}
              onChange={(e) => updateField('inquiry', e.target.value)}
              placeholder="お問い合わせ内容を入力してください"
              disabled={loading}
            />
            {fieldErrors.inquiry && <span className="field-error">{fieldErrors.inquiry}</span>}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? '送信中...' : '送信'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default App
