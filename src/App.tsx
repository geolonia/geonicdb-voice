import { useCallback, useEffect, useState } from 'react'
import {
  getVersion,
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
  age: '',
  prefecture: '',
  inquiry: '',
}

function App() {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<SurveyFormData>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({})

  const fetchVersion = useCallback(async () => {
    try {
      await getVersion()
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    fetchVersion()
    const interval = setInterval(fetchVersion, 10000)
    return () => clearInterval(interval)
  }, [fetchVersion])

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
      <header className="header">
        <h1>アンケートフォーム</h1>
        <div className="status">
          {connected ? (
            <span className="status-online">GeonicDB</span>
          ) : (
            <span className="status-offline">GeonicDB: 接続中...</span>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="survey-form">
        <h2>アンケート</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">氏名</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="山田太郎"
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
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="age">年齢</label>
            <input
              id="age"
              type="number"
              min="0"
              max="150"
              value={form.age}
              onChange={(e) => updateField('age', e.target.value)}
              placeholder="30"
            />
            {fieldErrors.age && <span className="field-error">{fieldErrors.age}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="prefecture">都道府県</label>
            <select
              id="prefecture"
              value={form.prefecture}
              onChange={(e) => updateField('prefecture', e.target.value)}
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
