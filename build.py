#!/usr/bin/env python3
"""index.html / style.css / mapdata.js / app.js を dist/index.html に1ファイル化する。

dist/index.html は Claude Artifact 用（doctype/html/head/body は公開時に自動付与
されるため含めない）。ふつうのWebサーバーに置くなら分割ファイルのまま使えばよい。
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))

def read(name):
    return open(os.path.join(HERE, name), encoding="utf-8").read()

src = read("index.html")

# <head> の中身から style.css のリンクを除いたもの（メタ・タイトル・フォント）
head = re.search(r"<head>\n(.*?)</head>", src, re.S).group(1)
head = re.sub(r'\s*<link rel="stylesheet" href="style.css">', "", head).strip()

# <body> の中身からローカル script タグを除いたもの
body = re.search(r"<body>\n(.*?)</body>", src, re.S).group(1)
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body).strip()

out = f"""{head}
<style>
{read('style.css').strip()}
</style>

{body}

<script>
{read('mapdata.js').strip()}

{read('app.js').strip()}
</script>
"""

os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
dest = os.path.join(HERE, "dist", "index.html")
open(dest, "w", encoding="utf-8").write(out)
print(f"built {dest} ({os.path.getsize(dest):,} bytes)")
