/**
 * GeonicDB SDK ラッパー
 *
 * <script> タグで読み込まれた GeonicDB SDK を使用する。
 * DPoP、PoW、トークン管理はすべて SDK が自動処理する。
 */

import type { SurveyFormData } from './validation.ts'

const GEONICDB_URL = ((import.meta.env.VITE_GEONICDB_URL as string) || '').replace(/\/+$/, '')
const GEONICDB_API_KEY = (import.meta.env.VITE_GEONICDB_API_KEY as string) || ''
const GEONICDB_TENANT = (import.meta.env.VITE_GEONICDB_TENANT as string) || ''

let _db: GeonicDBInstance | null = null

function getDB(): GeonicDBInstance {
  if (typeof GeonicDB === 'undefined') {
    throw new Error('GeonicDB SDK が読み込まれていません')
  }
  return _db ?? (_db = new GeonicDB({
    apiKey: GEONICDB_API_KEY || undefined,
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

