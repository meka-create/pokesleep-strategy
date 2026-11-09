"""E7 v55: a short load must never flash text; a real wait must remain visible."""
import functools
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/e7-preview/'
trace_script = """
(() => {
  if (window !== window.top) return;
  window.__loadingTrace = [];
  const install = () => {
    const status = document.getElementById('status');
    if (!status) return;
    const record = () => window.__loadingTrace.push({
      at: Math.round(performance.now()),
      hidden: status.hidden,
      message: status.dataset.showMessage
    });
    new MutationObserver(record).observe(status, {
      attributes: true, attributeFilter: ['hidden','data-show-message']
    });
    record();
  };
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
"""

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])

        # A delayed cold tab load still keeps the opaque safety overlay, but
        # the accessible loading text appears only when delay exceeds 350ms.
        context = browser.new_context(viewport={'width':393, 'height':852},
                                      timezone_id='Asia/Tokyo', service_workers='block')
        context.add_init_script(script=trace_script)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def slow_box(route):
            time.sleep(1.1)
            route.continue_()
        page.route('**/U4_Box_Preview_20261109_v50_E7.html*', slow_box)
        page.goto(base + '?tab=box', wait_until='domcontentloaded')
        status = page.locator('#status')
        page.wait_for_function("""()=>{
          const s=document.getElementById('status');
          return !s.hidden && s.dataset.showMessage==='false';
        }""", timeout=12000)
        page.wait_for_timeout(110)
        assert status.get_attribute('data-show-message') == 'false', 'Loading text flashed immediately'
        page.wait_for_function("""()=>{
          const s=document.getElementById('status');
          return !s.hidden && s.dataset.showMessage==='true';
        }""", timeout=12000)
        assert page.evaluate("window.__loadingTrace.some(x=>!x.hidden&&x.message==='true')"), \
               'A genuinely slow load must show its loading explanation'
        page.wait_for_function("""()=>document.getElementById('status').hidden &&
          document.documentElement.dataset.activeTab==='box'""", timeout=20000)
        assert status.get_attribute('data-show-message') == 'false', 'Timer not reset on load completion'

        # Rapid tab changes must cancel the old pending timer.
        page.locator('#tab-plan').click()
        page.locator('#tab-box').click()
        page.wait_for_timeout(420)
        assert status.is_hidden(), 'Stale loading overlay returned after quick navigation'
        assert status.get_attribute('data-show-message') == 'false'
        assert not errors, errors
        context.close()

        # Test a warm/local fast start without request throttling: the
        # message should never become visible, even for a single frame.
        quick = browser.new_context(viewport={'width':393, 'height':852},
                                    timezone_id='Asia/Tokyo', service_workers='block')
        quick.add_init_script(script=trace_script)
        fast = quick.new_page()
        fast_errors = []
        fast.on('pageerror', lambda error: fast_errors.append(str(error)))
        fast.goto(base + '?tab=box', wait_until='domcontentloaded')
        fast.wait_for_function("""()=>document.getElementById('status').hidden &&
          document.documentElement.dataset.activeTab==='box'""", timeout=20000)
        assert fast.locator('#status').get_attribute('data-show-message') == 'false'
        assert not fast.evaluate("window.__loadingTrace.some(x=>!x.hidden&&x.message==='true')"), \
               'Loading message flickered during fast startup'
        assert not fast_errors, fast_errors
        quick.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print('E7 v55 deferred label / slow-visible / fast-suppressed / tab cancellation: PASS')
