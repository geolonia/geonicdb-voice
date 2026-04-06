/**
 * GeonicDB JavaScript SDK 型定義
 *
 * <script src=".../sdk/v1/geonicdb.js"> で読み込まれるグローバル GeonicDB クラス
 */

interface GeonicDBOptions {
  apiKey?: string
  tenant?: string
  baseUrl?: string
}

interface GetEntitiesParams {
  type?: string
  limit?: number
  offset?: number
  q?: string
}

interface GeonicDBInstance {
  createEntity(entity: Record<string, unknown>): Promise<{ created: true }>
  getEntity(entityId: string): Promise<Record<string, unknown>>
  getEntities(params?: GetEntitiesParams): Promise<Record<string, unknown>[]>
  updateEntity(entityId: string, attrs: Record<string, unknown>): Promise<{ updated: true }>
  deleteEntity(entityId: string): Promise<{ deleted: true }>
  request(method: string, path: string, body?: unknown): Promise<Response>
  connect(): Promise<void>
  reconnect(): Promise<void>
  disconnect(): void
  isConnected(): boolean
  subscribe(options?: { entityTypes?: string[]; idPattern?: string }): void
  on(event: string, callback: (...args: unknown[]) => void): GeonicDBInstance
  off(event: string, callback?: (...args: unknown[]) => void): GeonicDBInstance
  login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>
  setCredentials(opts: { token: string; tokenType?: string; expiresIn?: number; refreshToken?: string }): GeonicDBInstance
  onTokenRefresh(callback: (creds: { token: string; tokenType: string; expiresIn: number; refreshToken: string }) => void): GeonicDBInstance
  logout(): void
}

interface GeonicDBConstructor {
  new (options?: GeonicDBOptions): GeonicDBInstance
}

declare const GeonicDB: GeonicDBConstructor
