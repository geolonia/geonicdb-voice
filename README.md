# GeonicDB アンケートフォーム デモ

GeonicDB の Custom Data Models と書き込み専用 API キーを使ったシンプルなアンケートフォーム。フォームから送信されたデータは GeonicDB に NGSI-LD エンティティとして保存される。API キーには書き込み権限のみを付与し、データの読み取りはできない。

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
      "validation": { "minLength": 1, "maxLength": 100 }
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
      }
    },
    "age": {
      "ngsiType": "Property",
      "valueType": "number",
      "example": 30,
      "required": true,
      "description": "年齢",
      "validation": { "minimum": 0, "maximum": 150 }
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
  "target": {
    "resources": [
      { "attributeId": "path", "matchValue": "/ngsi-ld/v1/entities*", "matchFunction": "glob" },
      { "attributeId": "entityType", "matchValue": "SurveyResponse" }
    ]
  },
  "rules": [
    {
      "ruleId": "allow-post",
      "effect": "Permit",
      "target": {
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
geonic me api-keys create '{"name":"survey-demo","policyId":"survey-write","allowedOrigins":["*"],"dpopRequired":true}'
```

発行された API キーを `index.html` の `data-api-key` に設定する。

```html
<script
  src="https://geonicdb.geolonia.com/sdk/v1/geonicdb.js"
  data-api-key="ここにAPIキーを設定"
  data-tenant="miya">
</script>
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
