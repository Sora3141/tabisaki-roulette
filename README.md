# 旅先ルーレット 🗾

日本地図の上を光が駆け巡り、次の旅の行き先をランダムに決めるWebサイトです。

**デモ:** https://sora3141.github.io/tabisaki-roulette/

## 機能

- **抽選対象**: 全国1,747市区町村（北方領土の6村を含む） / 全国8,988駅 の2モード
- **演出**: スタート→ストップ式のルーレット。対象の市区町村は実際の行政区域の形で、駅は光点で地図上を駆け巡り、ストップ後に減速して確定 → 当選地へズームイン
- **二段階モード**: まず都道府県ルーレット → 当選県にズーム → 県内ルーレット
- **範囲絞り込み**: 全国 / 8地方 / 都道府県単位
- **行った県の除外**: 地図上で都道府県を塗って抽選から除外（localStorageに保存）
- **結果表示**: 市区町村は縦書き短冊（ふりがな付き）＋人口・面積・人口密度、駅は駅名標風の看板（ひらがな・ローマ字自動生成）＋路線名
- 依存ライブラリなし（Vanilla JS + SVG）。Google Fonts以外の外部通信なし

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | ページ構造 |
| `style.css` | スタイル |
| `app.js` | ロジック（地図描画・ルーレット・ズームなど） |
| `mapdata.js` | 生成済みの地図・市区町村・駅データ（約1.6MB） |
| `build.py` | 上記4ファイルを単一HTML（`dist/index.html`）に束ねるスクリプト |

そのまま静的ホスティング（GitHub Pagesなど）に置けば動きます。

```bash
# ローカルで見る
python3 -m http.server 8000
# → http://localhost:8000/
```

## データ出典

| データ | 出典 |
|---|---|
| 都道府県の形状 | [dataofjapan/land](https://github.com/dataofjapan/land) |
| 市区町村の形状 | [smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography)（国土交通省「国土数値情報 行政区域データ」の簡略化版） |
| 市区町村の名称・よみ・役場位置 | [code4fukui/localgovjp](https://github.com/code4fukui/localgovjp) |
| 人口 | 総務省「[住民基本台帳に基づく人口、人口動態及び世帯数](https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000389.html)」（令和7年1月1日現在） |
| 面積 | 国土地理院「[全国都道府県市区町村別面積調](https://www.gsi.go.jp/KOKUJYOHO/MENCHO-title.htm)」（令和8年4月1日時点） |
| 駅・路線 | [Seo-4d696b75/station_database](https://github.com/Seo-4d696b75/station_database)（駅データ.jp由来のオープンデータ） |

`mapdata.js` はこれらを加工して生成したものです。各データの利用条件は出典元に従います。

## ライセンス

このリポジトリのコード（`index.html` / `style.css` / `app.js` / `build.py`）は MIT License です。
`mapdata.js` に含まれるデータの権利は上記出典元に帰属します。
