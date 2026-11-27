# Renders the share image and the logo from default.html and ../public/assets/icon.svg.
# Usage: python3 site/og/render.py   (Playwright for Python; set CHROME to a Chrome binary if needed)
import os, pathlib
from playwright.sync_api import sync_playwright

here = pathlib.Path(__file__).resolve().parent
assets = here.parent / 'public' / 'assets'
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    page = browser.new_page(viewport={'width': 1200, 'height': 630})
    page.goto((here / 'default.html').as_uri())
    page.evaluate('document.fonts.ready')
    page.screenshot(path=str(assets / 'og-default.png'))
    page = browser.new_page(viewport={'width': 512, 'height': 512})
    page.set_content(f'<body style="margin:0"><img src="{(assets / "icon.svg").as_uri()}" style="width:512px;height:512px;display:block">')
    page.screenshot(path=str(assets / 'logo-512.png'))
    browser.close()
