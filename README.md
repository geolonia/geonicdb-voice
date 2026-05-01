# GeonicDB アンケートフォーム デモ

GeonicDB の Custom Data Models と書き込み専用 API キーを使ったシンプルなアンケートフォーム。フォームから送信されたデータは GeonicDB に NGSI-LD エンティティとして保存される。API キーには書き込み権限のみを付与し、データの読み取りはできない。

## 目次

- [利用している GeonicDB の機能](#利用している-geonicdb-の機能)
- [XACML（eXtensible Access Control Markup Language）](#xacmlextensible-access-control-markup-language)
- [DPoP（Demonstrating Proof-of-Possession）](#dpopdemonstrating-proof-of-possession)
- [Zod スキーマによるバリデーション](#zod-スキーマによるバリデーション)
- [前提条件](#前提条件)
- [セットアップ](#セットアップ)
  - [1. 依存パッケージのインストール](#1-依存パッケージのインストール)
  - [2. GeonicDB の設定（geonic CLI）](#2-geonicdb-の設定geonic-cli)
  - [3. Custom Data Model の登録](#3-custom-data-model-の登録)
  - [4. 書き込み専用ポリシーの作成](#4-書き込み専用ポリシーの作成)
  - [5. API キーの作成](#5-api-キーの作成)
  - [6. 開発サーバーの起動](#6-開発サーバーの起動)
- [ビルド](#ビルド)
- [技術スタック](#技術スタック)

## 利用している GeonicDB の機能

| 機能 | 説明 |
|------|------|
| Custom Data Models | `SurveyResponse` モデルを定義し、サーバーサイドでバリデーションを実行 |
| NGSI-LD API | `POST /ngsi-ld/v1/entities` でアンケート回答をエンティティとして保存 |
| API キー | 書き込み専用の API キーをフロントエンドに埋め込みデータ送信 |
| ポリシー (ABAC) | `SurveyResponse` の `POST` のみを許可するポリシーで API キーの権限を制限 |
| DPoP バインド | API キーに DPoP を必須化し、トークンの不正利用を防止 |

## XACML（eXtensible Access Control Markup Language）

### 目的

FIWARE の標準アーキテクチャでは、認可は Orion Context Broker 単体ではなく **PEP Proxy（Wilma）+ IdM（Keyrock）+ XACML PDP（AuthZForce）** という複数コンポーネントの組み合わせで実現する。柔軟性は高い反面、以下のような課題がある。

- 構成コンポーネントが多く、デプロイ・運用・障害切り分けのコストが高い
- API キーは FIWARE 仕様外であり、フロントエンドへの埋め込みを前提としたワークフローが整備されていない
- AuthZForce は XML ベースの XACML 記述が中心で、アプリ開発者にとって学習コストが大きい
- フロントエンド SDK との統合が薄く、「書き込み専用キーを発行してブラウザに埋め込む」という単純なユースケースでも大掛かりなセットアップが必要になる

GeonicDB はこの認可レイヤーを Context Broker 本体に統合し、**XACML 3.0 ベースの JSON ポリシー**を CLI 一発で API キーに紐付けられるようにした。リソース・アクション・属性ベースの細粒度な制御は維持したまま、PEP Proxy も外部 PDP も不要で、フロントエンドへ「最小権限の API キー」を直接埋め込める。

### 仕組み

GeonicDB のポリシーは Target（適用対象の絞り込み）と Rules（許可・拒否の判定）で構成される。

```text
リクエスト                                 PDP (Policy Decision Point)
─────────                                  ───────────────────────────
- subject:  role / userId / tenantId
- resource: path / entityType / entityId
- action:   HTTP method                    1. Target で対象ポリシーを抽出
- environment: time / sourceIp                （path glob 等でマッチング）
                          ───────────────▶
                                           2. Rules を順番に評価
                                              （ruleCombiningAlgorithm に従う）
                                                - Permit / Deny / NotApplicable
                                           3. デフォルトポリシーで最終判定
                                              （API キーは既定で全 Deny）
                          ◀───────────────
判定結果（Permit / Deny）が返り、
Permit のときのみリクエストが実行される
```

主な属性 (`attributeId`)：

| カテゴリ | 属性 | 例 |
|----------|------|-----|
| resource | `path` | `/ngsi-ld/v1/entities*`（glob マッチ可） |
| resource | `entityType` | `SurveyResponse` |
| resource | `entityId` | `urn:ngsi-ld:Survey:001` |
| action | `method` | `POST`, `GET`, `PATCH`, `DELETE` |
| subject | `role` | `user`, `api_key`, `tenant_admin` |
| environment | `currentTime` / `sourceIp` | 時刻・IP アドレス |

### このデモでの使い方

1. **書き込み専用ポリシーを定義**: `SurveyResponse` への `POST` のみ Permit、それ以外は Deny する `survey-write` ポリシーを作成（[セットアップ手順 4](#4-書き込み専用ポリシーの作成)）
2. **API キーへポリシーをバインド**: `geonic me api-keys create --policy survey-write` でキー発行時にポリシーを紐付ける
3. **デフォルト拒否**: GeonicDB の API キーは既定で全 Deny のため、ポリシーで明示的に Permit したアクションだけが許可される
4. **リクエストごとに PDP が評価**: アンケート送信時、サーバーは XACML 評価エンジンで「path・entityType・method がポリシーに合致するか」を判定し、Permit のときのみエンティティを作成する

### 効果

| シナリオ | XACML なし（フルアクセス API キー） | XACML あり（`survey-write`） |
|----------|----------|----------|
| `POST /ngsi-ld/v1/entities`（SurveyResponse） | 許可 | 許可 |
| `POST /ngsi-ld/v1/entities`（別の type） | 許可（意図せず書き込める） | Deny |
| `GET /ngsi-ld/v1/entities`（一覧取得） | 全データ取得可能 | Deny |
| `DELETE /ngsi-ld/v1/entities/{id}` | 削除可能 | Deny |
| `PATCH /ngsi-ld/v1/entities/{id}/attrs` | 改ざん可能 | Deny |

DPoP がキーの「持ち主」を保証するのに対し、XACML はそのキーで「何ができるか」を最小限に絞り込む。両者を組み合わせることで、漏洩リスクと権限スコープの両面から API キーを安全にフロントエンドへ埋め込める。

## DPoP（Demonstrating Proof-of-Possession）

### 目的

FIWARE の標準認証は Keyrock 経由の OAuth2 ベアラトークン、または PEP Proxy 経由の API キーである。いずれも文字列ベースの「持参人式（bearer）」トークンであり、以下の弱点を抱える。

- フロントエンドに埋め込んだトークン／API キーは DevTools やネットワークタブから容易に取得できる
- 取得したトークンを別環境からそのまま再利用できる（窃取・横展開リスク）
- TLS で守られていても、ブラウザ拡張・XSS・ログ流出などの経路で漏洩した時点で詰む
- DPoP（[RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449)）に対応した PEP Proxy は FIWARE の標準ラインナップにはなく、独自実装が必要

GeonicDB は API キーに **DPoP バインドを必須化するオプション** (`--dpop-required`) をネイティブに実装した。ブラウザ内で生成した秘密鍵を持っているクライアントだけがそのキーで API を叩けるため、キー文字列が漏れても不正利用が成立しない。鍵ペアの生成・DPoP Proof の作成・リクエストへの添付はすべて公式 SDK が自動で処理するため、アプリ側に追加実装は不要である。

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

## Zod スキーマによるバリデーション

### 目的

FIWARE Orion Context Broker は NGSI-LD/NGSIv2 仕様に準拠した形式チェック（id, type, attribute 構造）は行うが、**エンティティのフィールドレベルの制約検証は行わない**。Smart Data Models が JSON Schema として公開されているものの、Orion 自身はそれを強制せず、現場では以下のような問題に直面する。

- 型違いの値（数値が必要なところに文字列など）がそのまま DB に格納される
- `pattern`（メール形式）や `enum`（都道府県の許可リスト）といった制約はサーバー側で一切検証されない
- アプリごとに別途バリデーション層を実装する必要があり、エラー応答のフォーマットも実装ごとに違う
- 結果として「クライアント検証だけ」または「DB 制約頼み」になりやすく、サーバー側の信頼境界が曖昧になる（curl で直接叩かれた瞬間にデータ品質が崩れる）

GeonicDB は受信したリクエストを **2 層のサーバー側検証**で守る。共通部分（NGSI-LD エンベロープ）は Zod で型レベルに検証し、ユーザー定義部分（Custom Data Model のフィールド制約）は CDM バリデータが `propertyDetails.validation` の宣言に従って検証する。**モデル定義を更新するだけでサーバーのバリデーションが即時に切り替わる**ため、アプリ側に重複したバリデーションロジックを書かずに済む。

### 仕組み

```text
リクエスト ─▶ ① Zod (NGSI-LD エンベロープ検証) ─▶ ② CDM バリデータ (フィールド制約検証) ─▶ DB
              ・id / type / @context の有無と形式      ・型 (string / number / etc.)
              ・attributes の構造                       ・minLength / maxLength
                (Property / Relationship /              ・minimum / maximum
                 GeoProperty / LanguageProperty)        ・pattern (正規表現)
              ・各属性が value/object/observedAt 等       ・enum（許可リスト）
                を持つ正しい形をしているか              ・required / additionalProperties
```

**第 1 層: Zod による NGSI-LD エンベロープ検証**

`POST /ngsi-ld/v1/entities` のコントローラは、リクエストボディをまず Zod スキーマ（`CreateNgsiLdEntitySchema`）に通す。これにより、

- `id` / `type` / `@context` が存在し、正しい形式であること
- 各 attribute が NGSI-LD の Property / Relationship / GeoProperty / LanguageProperty いずれかの構造に従っていること
- `value` や `observedAt` など必須フィールドが揃っていること

を、業務ロジックに到達する前に弾く。Zod の型推論によりサーバーコードも型安全になり、controller / service 内では「正しい形のオブジェクト」を前提に書ける。

**第 2 層: Custom Data Model によるフィールド制約検証**

エンベロープが正しいことを確認した後、`type` で指定された Custom Data Model（このデモでは `SurveyResponse`）の `propertyDetails` を読み込み、各属性値を検証する。

| 制約 | 例（このデモ） |
|------|--------------|
| `valueType` | `name` は string、不一致なら拒否 |
| `minLength` / `maxLength` | `name` は 1〜100 文字 |
| `pattern` | `email` は RFC ライクな正規表現にマッチ |
| `enum` | `prefecture` は 47 都道府県のいずれか |
| `required` | 必須属性が欠けたら拒否 |
| `additionalProperties: false` | モデル外の属性はエラー |

検証に失敗すると、`400 Bad Request` で `details` 配列に違反した属性と理由が返る。クライアントはこれを見てフォームのエラー表示に使える。

### このデモでの使い方

1. **クライアント側 (`src/lib/validation.ts`)**: 送信前に氏名・メール・生年月日・都道府県・問い合わせ内容を即時検証して、UX を改善する
2. **サーバー側 (Zod + CDM)**: クライアント検証を通過したリクエストでも、GeonicDB が同じ制約を再チェックする
3. **モデル定義はサーバーが正**: `propertyDetails.validation` を変更すれば、サーバー側のバリデーションがその場で更新される（コードのデプロイ不要）

クライアント検証は省略可能だが、サーバー検証は省略できない。「クライアント検証を信用しない」というのがセキュリティ上の鉄則である。

### 効果

| 観点 | 手書きバリデーション | Zod + CDM |
|------|------------------|-----------|
| 型安全性 | ランタイムでしか分からない | コンパイル時に推論される |
| エンベロープ検証の網羅性 | エンドポイント毎に実装が必要 | 共通スキーマで一元化 |
| フィールド制約の更新 | コード変更・デプロイが必要 | CDM を更新すれば即時反映 |
| エラーメッセージの一貫性 | 実装毎にバラつく | スキーマ駆動で統一フォーマット |

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
