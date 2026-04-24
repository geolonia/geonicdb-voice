/**
 * GeonicDB SDK ラッパー
 *
 * npm パッケージ @geolonia/geonicdb-sdk を使用する。
 * DPoP、PoW、トークン管理はすべて SDK が自動処理する。
 */

import GeonicDB from '@geolonia/geonicdb-sdk'
import type { SurveyFormData } from './validation.ts'

const GEONICDB_URL = ((import.meta.env.VITE_GEONICDB_URL as string) || '').replace(/\/+$/, '')
const GEONICDB_API_KEY = (import.meta.env.VITE_GEONICDB_API_KEY as string) || ''
const GEONICDB_TENANT = (import.meta.env.VITE_GEONICDB_TENANT as string) || ''

// 必須の環境変数が設定されていない場合は早期にエラーを出す
if (!GEONICDB_API_KEY) {
  throw new Error('VITE_GEONICDB_API_KEY が設定されていません。.env ファイルを確認してください。')
}

let _db: GeonicDB | null = null

function getDB(): GeonicDB {
  return _db ?? (_db = new GeonicDB({
    apiKey: GEONICDB_API_KEY,
    tenant: GEONICDB_TENANT || undefined,
    baseUrl: GEONICDB_URL || undefined,
  }))
}

export async function createSurveyResponse(data: SurveyFormData): Promise<void> {
  const db = getDB()
  await db.createEntity({
    id: `urn:ngsi-ld:SurveyResponse:${crypto.randomUUID()}`,
    type: 'SurveyResponse',
    name: { type: 'Property', value: data.name.trim() },
    email: { type: 'Property', value: data.email.trim() },
    birthDate: { type: 'Property', value: data.birthDate.trim() },
    prefecture: { type: 'Property', value: data.prefecture },
    inquiry: { type: 'Property', value: data.inquiry.trim() },
  })
}
