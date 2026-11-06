// ============================================
// K̸I̸L̷L̴A̸ — Service Worker (Manifest V3)
// ============================================

// The content script can't read cookies itself, so the worker owns the
// .ROBLOSECURITY lookup. It is pulled on demand (the content script asks
// right before uploading) and also pushed on page load for convenience.
function getSecurityCookie(cb) {
    chrome.cookies.get(
        { url: 'https://create.roblox.com', name: '.ROBLOSECURITY' },
        (cookie) => {
            if (chrome.runtime.lastError) {
                console.warn('[KILLA] cookies.get failed:', chrome.runtime.lastError.message);
                cb(null);
                return;
            }
            cb(cookie && cookie.value ? `.ROBLOSECURITY=${cookie.value}` : null);
        }
    );
}

// ---------------------------------------------------------------
// Network proxy
// ---------------------------------------------------------------
// All asset-API traffic runs through the service worker. Requests made from
// the page's context (content script) are subject to the page's CORS and
// cookie behavior; requests made here carry the extension's host permissions
// for *.roblox.com, so nothing on the page side can block them.
function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function killaProxiedFetch(msg) {
    try {
        // Mirror the page fetch: the worker passes credentials through too
        // (chunk PUTs to presigned buckets must stay cookie-free, exactly
        // like the site's own fetch).
        const init = { method: msg.method || 'GET', credentials: msg.credentials || 'include' };
        const headers = Object.assign({}, msg.headers || {});
        if (msg.formData) {
            // Mirrors the site's client exactly: `request` as a JSON string,
            // `fileContent` as the file blob carrying its name.
            const fd = new FormData();
            fd.append('request', JSON.stringify(msg.formData.request));
            const bytes = msg.formData.fileBytes
                ? new Uint8Array(msg.formData.fileBytes)
                : b64ToBytes(msg.formData.fileB64 || '');
            const blob = new Blob([bytes], { type: msg.formData.fileType || 'application/octet-stream' });
            fd.append('fileContent', blob, msg.formData.fileName);
            init.body = fd;
        } else if (msg.bodyB64 || msg.bodyBytes) {
            // Presigned chunk PUTs: bare body, no Content-Type — adding one
            // changes the CORS preflight the bucket must answer.
            init.body = msg.bodyBytes
                ? new Uint8Array(msg.bodyBytes)
                : b64ToBytes(msg.bodyB64);
        } else if (msg.bodyJson) {
            init.body = JSON.stringify(msg.bodyJson);
            headers['Content-Type'] = 'application/json';
        }
        init.headers = headers;

        const res = await fetch(msg.url, init);
        const body = await res.text();
        return {
            ok: res.ok,
            status: res.status,
            body: body,
            csrf: res.headers.get('x-csrf-token'),
            retryAfter: res.headers.get('retry-after'),
            etag: res.headers.get('ETag'),
        };
    } catch (err) {
        return { error: String((err && err.message) || err) };
    }
}

// ---------------------------------------------------------------
// Main-world upload hook
// ---------------------------------------------------------------
// The content script runs in an isolated world and never sees the page's
// own fetch calls, so the site's "Upload assets" button was invisible to
// the daily counter. This runs in the MAIN world on the dashboard tab,
// wraps fetch/XMLHttpRequest, and postMessages back when a quota-counted
// create lands. The extension's own uploads use the isolated-world fetch,
// which this wrapper does not see — no double counting.
function mainWorldUploadHook() {
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
}

// ---------------------------------------------------------------
// Auto-monitor bridge to KILLA'S BOSS
// ---------------------------------------------------------------
// The content script sends the asset id of every upload it completes
// (regular or encoded); this POSTs it to the bot's local bridge, which
// starts a /monitor-style watcher and DMs the owner. Fire-and-forget: the
// bot may not be running, and an upload must never be affected by this.
const KILLA_BRIDGE_URL = 'http://127.0.0.1:8766/killa/monitor';
const KILLA_BRIDGE_TOKEN = 'killa-local-bridge';
const autoMonitorSent = new Set(); // ids already handed to the bridge this session

function sendToAutoMonitor(ids) {
    const fresh = (ids || []).filter((id) => id && !autoMonitorSent.has(id));
    if (!fresh.length) return;
    for (const id of fresh) autoMonitorSent.add(id);
    fetch(KILLA_BRIDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Killa-Token': KILLA_BRIDGE_TOKEN },
        body: JSON.stringify({ ids: fresh }),
    }).catch(() => { /* bot offline — silently ignored */ });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'killaAutoMonitor' && Array.isArray(message.ids)) {
        sendToAutoMonitor(message.ids);
        sendResponse({ ok: true });
        return false;
    }
    if (message && message.type === 'getCookie') {
        getSecurityCookie((cookie) => sendResponse({ cookie: cookie }));
        return true; // keep the channel open for the async response
    }
    if (message && message.type === 'killaFetch') {
        killaProxiedFetch(message).then((result) => sendResponse(result));
        return true;
    }
    if (message && message.type === 'killaMainHook') {
        if (_sender && _sender.tab && _sender.tab.id != null) {
            chrome.scripting.executeScript({
                target: { tabId: _sender.tab.id },
                world: 'MAIN',
                func: mainWorldUploadHook,
            }).catch(() => { /* tab may have navigated; the next load retries */ });
        }
        return false;
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (
        changeInfo.status === 'complete' &&
        tab.url &&
        (tab.url.includes('create.roblox.com/dashboard/creations') || tab.url.includes('create.roblox.com/dashboard/assets'))
    ) {
        getSecurityCookie((cookie) => {
            if (!cookie) return;
            // The content script may still be injecting; swallow "receiving
            // end does not exist" instead of throwing — it will pull the
            // cookie itself when it needs it.
            chrome.tabs.sendMessage(tabId, { cookie: cookie }, () => void chrome.runtime.lastError);
        });
    }
});

// ---------------------------------------------------------------
// Asset watchdog nudge
// ---------------------------------------------------------------
// MV3 suspends this worker, so tabs can't be trusted to keep their own
// timer alone. A 1-minute alarm wakes the worker, which pings every open
// dashboard tab; the content script runs a check only if one is due.
const WATCH_ALARM = 'killa-watch';
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(WATCH_ALARM, { periodInMinutes: 1 });
});
// Recreate after browser restarts / SW reloads (create() is idempotent).
try { chrome.alarms.create(WATCH_ALARM, { periodInMinutes: 1 }); } catch (_) { /* unavailable */ }
chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== WATCH_ALARM) return;
    chrome.tabs.query({ url: ['*://create.roblox.com/dashboard/*'] }, (tabs) => {
        for (const t of tabs || []) {
            chrome.tabs.sendMessage(t.id, { type: 'watchTick' }, () => void chrome.runtime.lastError);
        }
    });
});

// ---------------------------------------------------------------
// Extension icon: toggle the floating watchdog dropdown on the
// dashboard (or open the dashboard if no tab is on it).
// ---------------------------------------------------------------
chrome.action.onClicked.addListener((tab) => {
    const isDash = !!(tab && tab.url && tab.url.indexOf('create.roblox.com/dashboard') !== -1);
    if (isDash && tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'killaDropdownToggle' }, () => void chrome.runtime.lastError);
    } else {
        chrome.tabs.create({ url: 'https://create.roblox.com/dashboard/creations?activeTab=AudioTab' });
    }
});
