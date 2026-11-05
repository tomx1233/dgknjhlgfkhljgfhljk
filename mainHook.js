// ============================================
// K̸I̸L̷L̴A̸ — MAIN-world upload hook (runs in the page context)
// ============================================
// The dashboard's "Upload assets" button posts to the same quota-counted
// endpoints, and Roblox counts those attempts too. content.js runs in an
// isolated world, so its window.fetch never sees the page's requests. This
// script is declared in the manifest with world:"MAIN" + run_at:
// document_start, so window.fetch is wrapped BEFORE the dashboard's generated
// API client captures it at module load — that is what made the older
// document_idle injection miss most of the site's uploads. It postMessages
// back when a quota-counted create lands; content.js listens for it. The
// extension's own uploads use the isolated-world fetch, which this wrapper
// does not see — no double counting.
(function () {
    if (window.__killaUlHook) return;
    window.__killaUlHook = true;
    var CREATE_RE = /\/assets\/user-auth\/v1\/assets(?::multipartUpload)?(?:[?#].*)?$/;
    var notify = function () {
        try { window.postMessage({ __killaUpload: true }, '*'); } catch (_) {}
    };
    var origFetch = window.fetch;
    if (origFetch) {
        window.fetch = function (input, init) {
            var p = origFetch.apply(this, arguments);
            try {
                var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
                var url = typeof input === 'string' ? input : (input && input.url) || '';
                if (method === 'POST' && CREATE_RE.test(url)) {
                    p.then(function (res) { if (res && res.ok) notify(); }, function () {});
                }
            } catch (_) {}
            return p;
        };
    }
    try {
        var XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype) {
            var origOpen = XHR.prototype.open;
            var origSend = XHR.prototype.send;
            XHR.prototype.open = function (method, url) {
                this.__killaUlUrl = String(url || '');
                this.__killaUlMethod = String(method || '').toUpperCase();
                return origOpen.apply(this, arguments);
            };
            XHR.prototype.send = function () {
                try {
                    if (this.__killaUlMethod === 'POST' && CREATE_RE.test(this.__killaUlUrl)) {
                        this.addEventListener('load', function () {
                            try { if (this.status >= 200 && this.status < 300) notify(); } catch (_) {}
                        });
                    }
                } catch (_) {}
                return origSend.apply(this, arguments);
            };
        }
    } catch (_) {}
})();
