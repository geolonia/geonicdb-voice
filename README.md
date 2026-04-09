# GeonicDB アンケートフォーム デモ

GeonicDB の Custom Data Models と書き込み専用 API キーを使ったシンプルなアンケートフォーム。フォームから送信されたデータは GeonicDB に NGSI-LD エンティティとして保存される。API キーには書き込み権限のみを付与し、データの読み取りはできない。

## 利用している GeonicDB の機能

| 機能 | 説明 |
|------|------|
| Custom Data Models | `SurveyResponse` モデルを定義し、サーバーサイドでバリデーションを実行 |
| NGSI-LD API | `POST /ngsi-ld/v1/entities` でアンケート回答をエンティティとして保存 |
| API キー | 書き込み専用の API キーをフロントエンドに埋め込みデータ送信 |
| ポリシー (ABAC) | `SurveyResponse` の `POST` のみを許可するポリシーで API キーの権限を制限 |
| DPoP バインド | API キーに DPoP を必須化し、トークンの不正利用を防止 |

## DPoP（Demonstrating Proof-of-Possession）

### 目的

通常の API キー認証では、キーの文字列さえ知っていれば誰でもリクエストを送信できる。フロントエンドに埋め込まれた API キーは DevTools などで簡単に取得できるため、悪意のある第三者がキーをコピーして別の環境から不正にリクエストを送信するリスクがある。

DPoP はこの問題を解決する。API キーの利用者が「秘密鍵を持っていること」を毎回のリクエストで証明することで、キー文字列の漏洩だけでは不正利用できない仕組みを提供する。

### 仕組み

```text
ブラウザ (SDK)                               GeonicDB サーバー
─────────────────                           ──────────────────
1. 公開鍵・秘密鍵ペアを生成（ブラウザ内で保持）

2. DPoP Proof（JWT）を作成
   - ヘッダー: 公開鍵 (JWK)
   - ペイロード: HTTP メソッド、URL、タイムスタンプ、ノンス
   - 秘密鍵で署名
                          ───────────────▶
3. リクエスト送信
   - Authorization: DPoP <API キー>
   - DPoP: <DPoP Proof JWT>
                                            4. サーバーが検証
                                               - JWT 署名を公開鍵で検証
                                               - メソッド・URL が一致するか確認
                                               - タイムスタンプが有効期間内か確認
                                               - トークンと鍵の紐付けを確認
                          ◀───────────────
5. 検証 OK ならレスポンス返却
```

### このデモでの使い方

1. **API キー作成時** に `--dpop-required` フラグを指定すると、そのキーを使うリクエストには DPoP Proof の添付が必須になる
2. **GeonicDB JavaScript SDK** が鍵ペアの生成・DPoP Proof の作成・リクエストへの添付をすべて自動で処理するため、アプリケーションコードでの追加実装は不要

### 効果

| 脅威 | DPoP なし | DPoP あり |
|------|-----------|-----------|
| API キーの窃取・再利用 | キー文字列だけで不正利用可能 | 秘密鍵がなければリクエスト不可 |
| トークンの中間者攻撃 | 盗んだトークンをそのまま使える | 別のクライアントからは署名検証に失敗 |
| リプレイ攻撃 | 過去のリクエストを再送可能 | タイムスタンプとノンスで無効化 |

## 前提条件

- Node.js 20 以上
- [geonic CLI](https://github.com/geolonia/geonicdb-cli) がインストール済み
- GeonicDB サーバー（`https://geonicdb.geolonia.com`）へのアクセス権

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. GeonicDB の設定（geonic CLI）

```bash
geonic config set url https://geonicdb.geolonia.com
geonic auth login
```

### 3. Custom Data Model の登録

```bash
geonic models create '{
  "type": "SurveyResponse",
  "domain": "Survey",
  "description": "アンケート回答データモデル",
  "propertyDetails": {
    "name": {
      "ngsiType": "Property",
      "valueType": "string",
      "example": "山田太郎",
      "required": true,
      "description": "氏名",
      "validation": { "minLength": 1, "maxLength": 100 },
      "@context": "https://schema.org/name"
    },
    "email": {
      "ngsiType": "Property",
      "valueType": "string",
      "example": "taro@example.com",
      "required": true,
      "description": "メールアドレス",
      "validation": {
        "pattern": "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$",
        "maxLength": 254
      },
      "@context": "https://schema.org/email"
    },
    "birthDate": {
      "ngsiType": "Property",
      "valueType": "string",
      "example": "1990-01-15",
      "required": true,
      "description": "生年月日",
      "validation": { "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
      "@context": "https://schema.org/birthDate"
    },
    "prefecture": {
      "ngsiType": "Property",
      "valueType": "string",
      "example": "東京都",
      "required": true,
      "description": "都道府県",
      "validation": {
        "enum": [
          "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
          "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
          "新潟県","富山県","石川県","福井県","山梨県","長野県",
          "岐阜県","静岡県","愛知県","三重県",
          "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
          "鳥取県","島根県","岡山県","広島県","山口県",
          "徳島県","香川県","愛媛県","高知県",
          "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
        ]
      }
    },
    "inquiry": {
      "ngsiType": "Property",
      "valueType": "string",
      "example": "製品について質問があります",
      "required": true,
      "description": "お問い合わせ内容",
      "validation": { "minLength": 1, "maxLength": 2000 }
    }
  }
}'
```

### 4. 書き込み専用ポリシーの作成

SurveyResponse エンティティの POST のみを許可するポリシーを作成する。

```bash
geonic me policies create '{
  "policyId": "survey-write",
  "ruleCombiningAlgorithm": "first-applicable",
  "target": {
    "resources": [
      { "attributeId": "path", "matchValue": "/ngsi-ld/v1/entities*", "matchFunction": "glob" }
    ]
  },
  "rules": [
    {
      "ruleId": "allow-post-survey",
      "effect": "Permit",
      "target": {
        "resources": [
          { "attributeId": "entityType", "matchValue": "SurveyResponse" }
        ],
        "actions": [{ "attributeId": "method", "matchValue": "POST" }]
      }
    },
    { "ruleId": "deny-rest", "effect": "Deny" }
  ]
}'
```

### 5. API キーの作成

ポリシーをバインドした API キーを発行する。

```bash
geonic me api-keys create \
  --name survey-demo \
  --origins http://localhost:8080,https://geolonia.github.io \
  --policy survey-write \
  --dpop-required
```

発行された API キーを `.env` に設定する。

```bash
cp .env.example .env
```

```dotenv
VITE_GEONICDB_URL=https://geonicdb.geolonia.com
VITE_GEONICDB_API_KEY=ここにAPIキーを設定
VITE_GEONICDB_TENANT=あなたのテナント名
```

### 6. 開発サーバーの起動

```bash
npm run dev
```

## バリデーション

フォーム入力は2層でバリデーションされる。

| 層 | 処理場所 | タイミング |
|----|----------|------------|
| クライアント | `src/lib/validation.ts` | 送信ボタン押下時 |
| サーバー | GeonicDB Custom Data Model | `POST /ngsi-ld/v1/entities` 時 |

## ビルド

```bash
npm run build
```

`dist/` に静的ファイルが出力される。

## 技術スタック

- Vite + React + TypeScript
- [GeonicDB JavaScript SDK](https://geonicdb.geolonia.com/sdk/v1/geonicdb.js)（PoW / トークン管理を自動処理）
- NGSI-LD API
- Custom Data Models によるサーバーサイドバリデーション
