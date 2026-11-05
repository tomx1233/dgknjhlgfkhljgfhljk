// ============================================
// K̸I̸L̵L̴A̸ — Roblox Mass Asset Uploader v2.1
// ============================================

// --- Configuration ---
const CONFIG = {
    GROUP_ID: 685334311,
    POLL_INTERVAL_MS: 1500,
    MAX_UPLOAD_RETRIES: 2,
    SUPPORTED_AUDIO_EXT: ['.mp3', '.ogg', '.flac', '.wav'],
    SUPPORTED_IMAGE_EXT: ['.jpg', '.jpeg', '.png', '.bmp', '.tga'],
    DEFAULT_AUDIO_COUNT: 10,
    DEFAULT_DECAL_COUNT: 50,
    MAX_AUDIO_COUNT: 100,
    MAX_DECAL_COUNT: 1000,
    // The Creator Dashboard switches to multipart upload above this size
    // (3vvmtres__ysa.js: `t.fileSize > 5242880`), chunked at 5 MiB.
    MULTIPART_THRESHOLD: 5242880,
    MULTIPART_CHUNK_SIZE: 5242880,
    MULTIPART_CONCURRENCY: 3,
};

// Content types exactly as the Creator Dashboard maps them
// (Audio_files/3vvmtres__ysa.js.download, table `T`).
const MIME_TYPES = {
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.bmp': 'image/bmp',
    '.tga': 'image/x-tga',
};

const ASSETS_BASE = 'https://apis.roblox.com/assets/user-auth';

function mimeForFile(file) {
    const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

// --- State ---
let cookie = null;
let csrfTokenCache = null;
let injected = false;
let observer = null;
let ongoingOps = 0;

// ============================================
// NATIVE-STYLE UI (matches Roblox Creator Dashboard)
// ============================================
const BRAND_CSS = `
.killa-root {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 0 0 auto;
    min-width: 0;
    max-width: 380px;
    box-sizing: border-box;
    padding: 10px 12px;
    background: rgba(208, 217, 251, 0.04);
    border: 1px solid rgba(208, 217, 251, 0.12);
    border-radius: 10px;
}

.killa-btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.killa-btn {
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-style: normal;
    font-size: 14px;
    line-height: 100%;
    letter-spacing: 0em;
    text-transform: none;
    color: rgb(247, 247, 248);
    background-color: rgba(208, 217, 251, 0.12);
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    min-height: 36px;
    box-shadow: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    -webkit-tap-highlight-color: transparent;
    outline: 0;
    margin: 0;
    user-select: none;
    vertical-align: middle;
    appearance: none;
    text-decoration: none;
    box-sizing: border-box;
    flex: 0 1 auto;
    white-space: nowrap;
    transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.killa-btn:hover {
    background-color: rgba(208, 217, 251, 0.16);
}

.killa-btn:active {
    background-color: rgba(208, 217, 251, 0.12);
}

.killa-btn:disabled {
    color: rgb(188, 190, 200);
    background-color: rgba(208, 217, 251, 0.12);
    cursor: default;
    pointer-events: none;
}

.killa-btn--secondary {
    color: rgb(247, 247, 248);
    background-color: rgba(208, 217, 251, 0.08);
}

.killa-btn--secondary:hover {
    background-color: rgba(208, 217, 251, 0.12);
}

.killa-btn--secondary:active {
    background-color: rgba(208, 217, 251, 0.08);
}

.killa-btn--secondary:disabled {
    color: rgb(188, 190, 200);
    background-color: rgba(208, 217, 251, 0.08);
}

.killa-btn::after {
    content: 'K̸I̸L̵L̴A̸';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 3px;
    color: rgba(247, 247, 248, 0);
    pointer-events: none;
    transition: color 0.2s ease;
}

.killa-btn:hover::after {
    color: rgba(247, 247, 248, 0.15);
}

.killa-status {
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: rgb(188, 190, 200);
    min-height: 18px;
    line-height: 18px;
}

.killa-status--error { color: rgb(224, 68, 68); }
.killa-status--success { color: rgb(52, 168, 83); }
.killa-status--working { color: rgb(213, 215, 221); }

.killa-upload-count {
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: rgb(188, 190, 200);
}
.killa-upload-count--error { color: rgb(224, 68, 68); }

.killa-progress-bar {
    width: 100%;
    height: 10px;
    background: rgba(208, 217, 251, 0.08);
    border: 1px solid rgba(208, 217, 251, 0.14);
    border-radius: 6px;
    overflow: hidden;
    display: none;
    box-sizing: border-box;
}

.killa-progress-bar.active { display: block; }

.killa-progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, rgba(208, 217, 251, 0.35), rgba(148, 163, 255, 0.65));
    border-radius: 6px;
    width: 0%;
    transition: width 0.3s ease;
}

.killa-icon-cell img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s;
}

.killa-icon-cell img:hover {
    opacity: 0.8;
}

.killa-icon-header {
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: rgb(188, 190, 200) !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 12px 16px !important;
}

.killa-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: rgb(35, 36, 41);
    color: rgb(247, 247, 248);
    padding: 12px 20px;
    border-radius: 8px;
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.4);
    animation: killa-toast-in 0.2s ease;
}

.killa-toast--success { border-left: 4px solid rgb(52, 168, 83); }
.killa-toast--error { border-left: 4px solid rgb(224, 68, 68); }

@keyframes killa-toast-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

.killa-dialog-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 999998;
    display: flex;
    align-items: center;
    justify-content: center;
}

.killa-dialog {
    background: rgb(35, 36, 41);
    border-radius: 12px;
    padding: 24px;
    min-width: 320px;
    box-shadow: 0px 16px 48px rgba(0, 0, 0, 0.5);
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    color: rgb(247, 247, 248);
}

.killa-dialog h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    font-weight: 700;
}

.killa-dialog label {
    display: block;
    font-size: 14px;
    color: rgb(188, 190, 200);
    margin-bottom: 8px;
}

.killa-dialog input[type="number"] {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid rgba(208, 217, 251, 0.2);
    border-radius: 8px;
    background: rgba(208, 217, 251, 0.08);
    color: rgb(247, 247, 248);
    font-size: 16px;
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    box-sizing: border-box;
    outline: none;
    margin-bottom: 16px;
}

.killa-dialog input[type="number"]:focus {
    border-color: rgba(208, 217, 251, 0.4);
}

.killa-dialog-btns {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.killa-dialog-btns .killa-btn {
    flex: 0 0 auto;
    min-height: 36px;
    font-size: 14px;
    padding: 8px 20px;
}

/* --- long-press multi-select on asset cards --- */
.killa-selected-card {
    position: relative;
    outline: 3px solid rgb(63, 74, 150);
    outline-offset: 2px;
    border-radius: 8px;
}

.killa-id-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 6;
    background: rgb(63, 74, 150);
    color: rgb(247, 247, 248);
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.2;
    padding: 2px 6px;
    border-radius: 6px;
    pointer-events: none;
    white-space: nowrap;
}

.killa-pressing-card {
    filter: brightness(1.15);
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
}

.killa-btn--hidden {
    display: none;
}

.killa-copy-count {
    margin-left: 6px;
    background: rgba(247, 247, 248, 0.18);
    border-radius: 6px;
    padding: 1px 6px;
    font-size: 12px;
}

.killa-error-box {
    margin-top: 0;
    background: rgba(185, 28, 28, 0.18);
    border: 1px solid rgba(220, 38, 38, 0.55);
    border-radius: 8px;
    color: #fecaca;
    font-family: Consolas, Menlo, monospace;
    font-size: 12px;
    line-height: 1.45;
    padding: 10px 12px;
    max-height: 170px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
}

.killa-watch {
    margin-top: 0;
    padding-top: 2px;
}
.killa-watch-head {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 0;
    align-items: center;
}
.killa-watch-head .killa-btn {
    flex: 0 1 auto;
}
.killa-watch-toggle.killa-watch-on {
    border-color: rgba(52, 168, 83, 0.7);
    color: rgb(52, 168, 83);
}
.killa-watch-line {
    margin-top: 2px;
    font-size: 12px;
}
.killa-watch-settings {
    margin-top: 10px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.03);
}
.killa-watch-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: rgb(189, 192, 200);
    margin: 0;
    cursor: pointer;
}
.killa-watch-row > span {
    flex: 0 0 150px;
    line-height: 1.3;
}
.killa-watch-row input[type="text"],
.killa-watch-row input[type="password"],
.killa-watch-row input[type="number"] {
    flex: 1 1 auto;
    min-width: 0;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    color: #f1f2f4;
    padding: 6px 10px;
    font-size: 13px;
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    box-sizing: border-box;
}
.killa-watch-row input:focus {
    border-color: rgba(208, 217, 251, 0.5);
    outline: none;
}
.killa-watch-check {
    gap: 8px;
}
.killa-watch-hint {
    font-size: 11px;
    line-height: 1.5;
    color: rgba(189, 192, 200, 0.8);
}
.killa-watch-log {
    margin-top: 10px;
    font-family: Consolas, Menlo, monospace;
    font-size: 12px;
    line-height: 1.55;
    color: rgb(213, 215, 221);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 180px;
    overflow: auto;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 8px 10px;
    box-sizing: border-box;
}
/* Floating watchdog dropdown: opened from the extension icon, persists
   while you switch tabs, closes on outside click or Escape. */
.killa-watch-float {
    position: fixed;
    top: 72px;
    right: 20px;
    width: 340px;
    max-height: min(80vh, 560px);
    overflow-y: auto;
    z-index: 2147483000;
    display: none;
    flex-direction: column;
    gap: 2px;
    background: rgb(35, 36, 41);
    border: 1px solid rgba(208, 217, 251, 0.22);
    border-radius: 12px;
    padding: 12px 14px 14px;
    box-sizing: border-box;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
}
.killa-watch-float.open { display: flex; }
.killa-watch-float-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
}
.killa-watch-float-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: rgb(247, 247, 248);
}
.killa-watch-float-close {
    background: none;
    border: none;
    color: rgb(188, 190, 200);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 6px;
}
.killa-watch-float-close:hover {
    color: rgb(247, 247, 248);
    background: rgba(255, 255, 255, 0.08);
}
.killa-watch-float .killa-watch-row > span { flex: 0 0 118px; }
.killa-watch-float .killa-btn.killa-watch-on {
    border-color: rgba(52, 168, 83, 0.7);
    color: rgb(52, 168, 83);
}
/* Floating selection bar for the user-inventory audio page. */
.killa-inventory-bar {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 2147483000;
    display: flex;
    gap: 8px;
    padding: 8px;
    background: rgba(18, 20, 26, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
}
`;

// Inject brand styles once
(function injectStyles() {
    const style = document.createElement('style');
    style.id = 'killa-styles';
    style.textContent = BRAND_CSS;
    document.head.appendChild(style);
})();

// ============================================
// TAB / PAGE DETECTION
// ============================================

function getActiveTab() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('activeTab');
    if (tab) return tab.charAt(0).toUpperCase() + tab.slice(1).toLowerCase();
    const text = document.body.innerText.toLowerCase();
    if (text.includes('decal')) return 'Decal';
    if (text.includes('audio')) return 'Audio';
    return null;
}

function isDecalTab() { return getActiveTab() === 'Decal'; }
function isAudioTab() { return getActiveTab() === 'Audio'; }

function isValidTargetPage() {
    if (isInventoryPage()) return isInventoryAudioTab();
    const path = window.location.pathname;
    const isCreationsPage = path.includes('/creations') || path.includes('/assets');
    if (!isCreationsPage) return false;
    const activeTab = new URLSearchParams(window.location.search).get('activeTab');
    if (!activeTab) return false;
    const tab = activeTab.toLowerCase();
    return tab === 'audio' || tab === 'decal';
}

// The www.roblox.com user-inventory page (/users/inventory or
// /users/<id>/inventory, hash #!/audio) renders the account's own audio
// library as a.item-card-link cards inside ul#assetsItems; each card links
// to create.roblox.com/store/asset/<id>. The selection system works there
// too, reading ids straight off the DOM — nothing is hardcoded to an
// account, so it works for any account's inventory.
function isInventoryPage() {
    return /^\/users(\/\d+)?\/inventory\/?$/.test(window.location.pathname);
}

function isInventoryAudioTab() {
    return isInventoryPage() && /audio/.test(window.location.hash.toLowerCase());
}

// ============================================
// COOKIE / CSRF
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Only claim the messages that are actually ours. Returning true here
    // unconditionally told Chrome this listener would answer *every* message
    // the tab received (watchTick, killaDropdownToggle, watchCfgUpdated...),
    // so those ports stayed open past the reply the watchdog listener had
    // already sent and Chrome logged "The message port closed before a
    // response was received" every poll interval.
    if (!message || !message.cookie) return false;
    cookie = message.cookie;
    csrfTokenCache = null;
    console.log('[KILLA] Cookie received (push)');
    sendResponse({ received: true });
    return false;
});

// The old flow relied on background.js pushing the cookie once at page
// load, which races the content script's own registration — lose the race
// and every upload died with "No auth cookie". Pull it on demand instead.
//
// Important: the fetched cookie is only for diagnostics. The upload fetches
// authenticate with credentials:'include' (the browser attaches the real
// .ROBLOSECURITY itself), so a failed handshake must never block an upload.
function requestCookieFromBackground() {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => { if (!settled) { settled = true; resolve(value); } };
        let timed;
        try {
            // If the extension was reloaded while this tab stayed open, the
            // content script is orphaned and chrome.* calls fail — detect it
            // so the user can be told to refresh instead of seeing a generic
            // failure.
            timed = setTimeout(() => done({ cookie: null, orphaned: false }), 2500);
            chrome.runtime.sendMessage({ type: 'getCookie' }, (res) => {
                clearTimeout(timed);
                const err = chrome.runtime.lastError;
                if (err && /context invalidated/i.test(err.message || '')) {
                    done({ cookie: null, orphaned: true });
                } else if (err) {
                    done({ cookie: null, orphaned: false });
                } else {
                    done({ cookie: (res && res.cookie) || null, orphaned: false });
                }
            });
        } catch (err) {
            clearTimeout(timed);
            const orphaned = err && /context invalidated|Extension context/i.test(err.message || '');
            done({ cookie: null, orphaned: orphaned });
        }
    });
}

// Best effort only — see the comment above requestCookieFromBackground.
// Returns { ok, orphaned } instead of a boolean so callers can distinguish
// "cookie missing" from "the tab needs a refresh".
async function ensureCookie() {
    if (cookie) return { ok: true, orphaned: false };
    for (let attempt = 0; attempt < 3; attempt++) {
        const r = await requestCookieFromBackground();
        if (r.cookie) {
            cookie = r.cookie;
            csrfTokenCache = null;
            console.log('[KILLA] Cookie received (on demand)');
            return { ok: true, orphaned: false };
        }
        if (r.orphaned) return { ok: false, orphaned: true };
        await new Promise(rr => setTimeout(rr, 400));
    }
    return { ok: false, orphaned: false };
}

// ============================================
// NETWORK PROXY
// ============================================
// Every asset-API call runs through the background service worker
// (background.js `killaFetch`). Fetches made from the page's context are
// subject to the page's CORS/cookie handling; fetches made in the worker
// carry the extension's host permissions for *.roblox.com, which removes
// the whole class of page-side network failures.
//
// Response shape: { ok, status, body, csrf, etag } or { error }.
function bytesToB64(bytes) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
}

function proxiedFetch(msg) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (fn, value) => { if (!settled) { settled = true; fn(value); } };
        const timed = setTimeout(() => done(reject, new Error('Background fetch timed out')), 120000);
        // The worker rebuilds the body from base64 (its established format).
        // Convert here so the message only ever carries b64 + plain JSON —
        // no reliance on typed arrays surviving message serialization.
        const wire = Object.assign({}, msg);
        if (wire.formData && wire.formData.fileBytes && !wire.formData.fileB64) {
            wire.formData = Object.assign({}, wire.formData, { fileB64: bytesToB64(wire.formData.fileBytes) });
        }
        if (wire.bodyBytes && !wire.bodyB64) {
            wire.bodyB64 = bytesToB64(wire.bodyBytes);
        }
        try {
            chrome.runtime.sendMessage(Object.assign({ type: 'killaFetch' }, wire), (res) => {
                clearTimeout(timed);
                const err = chrome.runtime.lastError;
                if (err) {
                    if (/context invalidated/i.test(err.message || '')) {
                        done(reject, new Error('The extension was reloaded — refresh this page (F5).'));
                    } else {
                        done(reject, new Error(err.message || 'Background fetch failed'));
                    }
                    return;
                }
                if (!res) { done(reject, new Error('No response from background worker')); return; }
                if (res.error) { done(reject, new Error(res.error)); return; }
                done(resolve, res);
            });
        } catch (err) {
            clearTimeout(timed);
            done(reject, err instanceof Error ? err : new Error(String(err)));
        }
    });
}

// The asset APIs report failures as {"errors":[{"code":N,"message":"..."}]}
// (and some as {error:{message}}). Surface the real text instead of a bare
// HTTP status.
// Page-context fetch — this is what the site itself does, and the page
// cannot be suspended mid-upload the way a service worker can, so it is the
// PRIMARY path. Body fields: formData {request, fileName, fileType,
// fileBytes} | bodyJson | bodyBytes.
async function pageFetch(msg) {
    const init = { method: msg.method || 'GET', credentials: msg.credentials || 'include' };
    const headers = Object.assign({}, msg.headers || {});
    if (msg.formData) {
        const fd = new FormData();
        fd.append('request', JSON.stringify(msg.formData.request));
        const bytes = msg.formData.fileBytes;
        fd.append('fileContent', new File([bytes], msg.formData.fileName, { type: msg.formData.fileType || 'application/octet-stream' }), msg.formData.fileName);
        init.body = fd;
    } else if (msg.bodyBytes) {
        // Presigned chunk PUTs must mirror the site EXACTLY: a bare Blob body
        // with no Content-Type and no custom headers. The site sends
        // fetch(url, {method:'PUT', body:blob}) — any extra header (even
        // application/octet-stream) changes the CORS preflight the bucket has
        // to answer, and buckets configured for the site's exact preflight
        // will reject ours -> TypeError: Failed to fetch.
        init.body = new Blob([msg.bodyBytes]);
    } else if (msg.bodyJson) {
        init.body = JSON.stringify(msg.bodyJson);
        headers['Content-Type'] = 'application/json';
    }
    init.headers = headers;
    const res = await fetch(msg.url, init);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body, csrf: res.headers.get('x-csrf-token'), etag: res.headers.get('ETag') };
}

// Primary entry point. Server-shaped responses (429/400/403...) are returned
// as-is; only network-level failures ("Failed to fetch", SW killed, etc.)
// fall back to the service-worker proxy.
async function robloxFetch(msg) {
    try {
        return await pageFetch(msg);
    } catch (err) {
        const message = (err && err.message) || String(err);
        if (/context invalidated/i.test(message)) throw err;
        console.warn('[KILLA] page fetch failed (' + message + '), retrying via service-worker proxy');
        try {
            return await proxiedFetch(msg);
        } catch (err2) {
            const m2 = (err2 && err2.message) || String(err2);
            // Keep the URL on the error so a stage-less failure still names
            // the exact request (e.g. the presigned chunk host) in the report.
            throw new Error(m2 + ' [' + msg.url + ']');
        }
    }
}

// robloxFetch + a precise failure record. Every upload stage goes through
// this so a network-level throw (not just a server rejection) lands in the
// red box with the stage and the exact URL — "unknown stage" tells us
// nothing about where the upload died.
async function robloxFetchStage(msg, stage, label) {
    try {
        return await robloxFetch(msg);
    } catch (err) {
        const message = (err && err.message) || String(err);
        noteFailure(stage, label || msg.url, 'no response captured', '', message);
        throw err;
    }
}

function parseApiError(status, bodyText) {
    try {
        const j = JSON.parse(bodyText);
        const list = (j.errors || (j.error ? [j.error] : [])).filter(Boolean);
        if (list.length && list[0].message) {
            const code = list[0].code != null ? ` (code ${list[0].code})` : '';
            return `${list[0].message}${code}`;
        }
    } catch (_) { /* not JSON */ }
    const trimmed = (bodyText || '').trim();
    return trimmed ? `HTTP ${status}: ${trimmed.slice(0, 160)}` : `HTTP ${status}`;
}

// --------------------------------------------
// Failure capture + on-page report
// --------------------------------------------
// Every network stage records what the server actually said, and the panel
// shows a red box with a one-click "Copy Error" so the reason can be shared
// without opening devtools.
const lastUploadError = {
    stage: null, url: null, status: null, body: null, time: null,
    cookie: null, assetType: null, message: null,
};

function noteFailure(stage, url, status, body, message) {
    lastUploadError.stage = stage;
    lastUploadError.url = url;
    lastUploadError.status = status;
    lastUploadError.body = (body || '').slice(0, 1200);
    lastUploadError.time = new Date().toLocaleTimeString();
    lastUploadError.cookie = cookie ? 'handshake ok' : 'handshake failed (browser cookies still used)';
    lastUploadError.assetType = getAssetType();
    lastUploadError.message = message || parseApiError(status, body);
    console.warn(`[KILLA] ${stage} failed:`, { url: url, status: status, body: lastUploadError.body });
}

function renderErrorBox(panel) {
    if (!panel || !panel.errorBox || !lastUploadError.stage) return;
    panel.errorBox.textContent =
        `stage:    ${lastUploadError.stage}\n` +
        `time:     ${lastUploadError.time}\n` +
        `url:      ${lastUploadError.url}\n` +
        `status:   ${lastUploadError.status}\n` +
        `server:   ${lastUploadError.body || '(no body)'}\n` +
        `cookie:   ${lastUploadError.cookie}\n` +
        `asset:    ${lastUploadError.assetType}`;
    panel.errorBox.style.display = 'block';
    if (panel.btnCopyError) panel.btnCopyError.classList.remove('killa-btn--hidden');
    // Best effort: put the report on the clipboard immediately so it can be
    // pasted straight into the chat (Copy Error is the reliable fallback).
    copyTextToClipboard(
        `KILLA upload error\nstage: ${lastUploadError.stage}\nstatus: ${lastUploadError.status}\n` +
        `server: ${lastUploadError.body || '(no body)'}\nurl: ${lastUploadError.url}`
    ).catch(() => {});
}

async function copyErrorReport() {
    const text =
        `KILLA upload error\n` +
        `stage:    ${lastUploadError.stage}\n` +
        `time:     ${lastUploadError.time}\n` +
        `url:      ${lastUploadError.url}\n` +
        `status:   ${lastUploadError.status}\n` +
        `server:   ${lastUploadError.body || '(no body)'}\n` +
        `cookie:   ${lastUploadError.cookie}\n` +
        `asset:    ${lastUploadError.assetType}\n` +
        `browser:  ${navigator.userAgent}`;
    const ok = await copyTextToClipboard(text);
    showToast(ok ? 'Error report copied \u2014 paste it back to the chat' : 'Could not copy \u2014 screenshot the red box instead', ok ? 'success' : 'error');
}

// --------------------------------------------
// Audio upload quota
// --------------------------------------------
// Roblox limits audio upload ATTEMPTS per day, and the number is NOT fixed:
// it varies per account (100 on the main account; the server's 429 body names
// the real one when you hit it). When spent, create returns 429
// RESOURCE_EXHAUSTED with a reset timestamp — every further attempt that day
// fails identically, so the batch stops instead of burning retries.
let quotaState = null; // { resetIso, resetLocal, resetMs, limit }

// The 429 body names the per-account limit in several wordings; take
// whatever number the server reports (never assume one).
function parseQuotaLimit(body) {
    const pats = [
        /(?:limit|maximum|max|cap)\s*(?:of\s*)?(\d+)/i,
        /(\d+)\s*(?:audio\s+)?uploads?\s*per\s*day/i,
        /(\d+)\s*attempts?/i,
    ];
    for (const p of pats) {
        const m = body.match(p);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > 0) return n;
        }
    }
    return null;
}

function detectQuotaExhaustion(status, bodyText) {
    if (status !== 429) return null;
    if (!/RESOURCE_EXHAUSTED/i.test(bodyText || '')) return null;
    const m = (bodyText || '').match(/try again at (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i);
    let resetIso = null, resetLocal = null, resetMs = 0;
    if (m) {
        // Trim fractional seconds to milliseconds so Date can parse it.
        const iso = m[1].replace(/(\.\d{3})\d+/, '$1');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
            resetIso = d.toISOString();
            resetLocal = d.toLocaleString();
            resetMs = d.getTime();
        } else {
            resetIso = m[1];
            resetLocal = m[1];
        }
    }
    const quota = { resetIso: resetIso, resetLocal: resetLocal, resetMs: resetMs, limit: parseQuotaLimit(bodyText || '') };
    console.warn('[KILLA] quota exhaustion detected:', quota, 'body:', (bodyText || '').slice(0, 200));
    return quota;
}

function quotaMessage() {
    if (!quotaState) return null;
    if (quotaState.resetMs && Date.now() >= quotaState.resetMs) {
        quotaState = null; // window has passed — uploads may work again
        return null;
    }
    const n = quotaState.limit || (uploadCountState && uploadCountState.limit) || UPLOAD_DAILY_LIMIT_DEFAULT;
    return 'Roblox audio upload quota reached (' + n + ' attempts). Resets at ' +
        (quotaState.resetLocal || quotaState.resetIso || 'the daily reset');
}

// Remember the quota the server reported (and its real limit) so the panel
// counter keeps using it after a reload.
function noteQuotaDetected(quota) {
    quotaState = quota;
    if (quota && quota.limit) {
        const st = uploadCountNow();
        if (!st.limit || st.limit !== quota.limit) {
            st.limit = quota.limit;
            void saveUploadCount();
        }
    }
}

// --------------------------------------------
// Daily upload counter (per account)
// --------------------------------------------
// The audio quota counts upload ATTEMPTS per day, so track them locally per
// account (keyed by authenticated user id) and show used/left in the panel.
const UPLOAD_COUNT_KEY = 'killaUploadCount';
const EXT_VERSION = '2.4.0'; // keep in sync with manifest.json
const UPLOAD_DAILY_LIMIT_DEFAULT = 100; // starting point; the server's 429 body overrides per account
let uploadCountEvents = []; // {op:'+1'|'-1', used, t:'HH:MM:SS'} — last few counter changes, for diagnostics
let uploadCountState = null; // { userId, date: 'YYYY-MM-DD', used, limit }
let lastCountRoot = null;   // most recently injected panel root (for the count-line refresher)
let uploadCountTicker = null;
let uploadCountVisBound = false;

function uploadTodayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function loadUploadCount() {
    return new Promise((resolve) => chrome.storage.local.get([UPLOAD_COUNT_KEY], (res) => {
        uploadCountState = (res && res[UPLOAD_COUNT_KEY]) || null;
        // v2.3.7 seeded "used" AND "limit" from the publish quota API, which
        // reports a MONTHLY marketplace-distribution quota — that poisoned
        // today's state (e.g. "0 used · 10 left" on an account with a
        // 100/day limit). One-time migration: drop any same-day used/limit
        // written before 2.3.9 (v2.3.7 was the only writer of an unstamped
        // same-day state with a quota-derived limit). The counter counts
        // only uploads it observes and learns the real limit from a 429.
        const st = uploadCountState;
        // v2.3.7 seeded "used" AND "limit" from the publish quota API, which
        // reports a MONTHLY marketplace-distribution quota — that poisoned
        // today's state (e.g. "0 used · 10 left" on an account with a
        // 100/day limit). v2.3.8 stamped v:2 without cleaning it, so the
        // 2.3.9 migration (gated on !st.v) never ran. Migrate any v<3 state:
        // clear a seeded limit, keep the used count the counter observed.
        if (st && (st.v || 0) < 3) {
            if (st.limit === 10) {
                st.limit = null;
                console.warn('[KILLA] migrated v2.3.7-quota state -> cleared seeded limit (10)');
            }
            st.v = 3;
            chrome.storage.local.set({ [UPLOAD_COUNT_KEY]: st }, () => {});
        }
        resolve(uploadCountState);
    }));
}

function saveUploadCount() {
    if (!uploadCountState) return Promise.resolve();
    return new Promise((resolve) => chrome.storage.local.set({ [UPLOAD_COUNT_KEY]: uploadCountState }, () => resolve()));
}

function uploadCountNow() {
    const today = uploadTodayKey();
    if (!uploadCountState || uploadCountState.date !== today) {
        uploadCountState = {
            userId: (uploadCountState && uploadCountState.userId) || null,
            date: today,
            used: 0,
            limit: (uploadCountState && uploadCountState.limit) || null,
        };
    }
    return uploadCountState;
}

async function bumpUploadCount(userId) {
    const st = uploadCountNow();
    if (userId && st.userId && st.userId !== userId) {
        st.userId = userId;
        st.used = 0; // switched account: fresh count and limit for this one
        st.limit = null;
    } else if (userId) {
        st.userId = userId;
    }
    st.used++;
    noteUploadCountEvent('+1', st.used);
    console.log('[KILLA] upload count +1 -> used =', st.used, 'userId =', st.userId);
    await saveUploadCount();
}

// Revert a file that was counted but never actually reached Roblox.
function unBumpUploadCount(userId) {
    const st = uploadCountNow();
    if (st.used > 0) {
        st.used--;
        noteUploadCountEvent('-1', st.used);
        console.log('[KILLA] upload count -1 -> used =', st.used);
        void saveUploadCount();
    }
}

// Record the last few counter changes so the panel line can report what
// actually happened (a failed display update is then distinguishable from a
// counter that never moved).
function noteUploadCountEvent(op, used) {
    const d = new Date();
    const t = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
    uploadCountEvents.push({ op: op, used: used, t: t });
    if (uploadCountEvents.length > 10) uploadCountEvents.shift();
}

// --------------------------------------------
// Server quota seed (the dashboard's own daily upload quota)
// --------------------------------------------
// The upload page shows "how many uploads u have left" from
// getAssetQuotas("RateLimitUpload", assetType) against
// publish.roblox.com/v1/asset-quotas (0pgi0r893gi3g.js) — the per-account
// upload quota, NOT the monthly marketplace-distribution one. Response item:
// {usage, capacity, duration, expirationTime}. Seed used/limit from it; the
// server is authoritative for uploads made today by ANY means (site button,
// other tabs/devices). Never lower the local count below what the counter
// itself observed, so a create that just landed locally isn't shown as lost
// while the server's number catches up.
const QUOTA_URL = 'https://publish.roblox.com/v1/asset-quotas?resourceType=RateLimitUpload&assetType=Audio';
let quotaSyncBusy = false;
let lastQuotaSyncMs = 0;
let lastSeedInfo = null; // {ok, counted, capacity, status, url, t} — mirrored on the count line

async function syncServerQuota() {
    if (quotaSyncBusy) return;
    quotaSyncBusy = true;
    const diag = { t: new Date().toISOString(), ok: false, counted: 0, capacity: 0, duration: null, resetTime: null, status: 0, url: QUOTA_URL };
    try {
        const res = await robloxFetch({ url: QUOTA_URL, method: 'GET' });
        if (!res || !res.ok) {
            diag.status = (res && res.status) || 0;
            console.warn('[KILLA] quota seed failed: status', diag.status, ((res && res.body) || '').slice(0, 200));
            return; // fall back to the local counter; diag shows why
        }
        const j = JSON.parse(res.body);
        const q = (j && j.quotas && j.quotas[0]) || null;
        if (!q || typeof q.usage !== 'number' || typeof q.capacity !== 'number') {
            diag.status = -2;
            console.warn('[KILLA] quota seed: unexpected shape', (res.body || '').slice(0, 200));
            return;
        }
        diag.counted = q.usage;
        diag.capacity = q.capacity;
        diag.duration = q.duration || null;
        diag.resetTime = q.expirationTime || null;
        diag.ok = true;
        console.log('[KILLA] quota seed -> usage', q.usage, '/ capacity', q.capacity, 'duration', q.duration);
        const st = uploadCountNow();
        if (q.usage > st.used) st.used = q.usage;
        if (q.capacity > 0) st.limit = q.capacity;
        st.v = 4;
        await saveUploadCount();
        refreshUploadCount(lastCountRoot);
    } catch (err) {
        diag.ok = false;
        diag.err = String((err && err.message) || err);
        console.warn('[KILLA] quota seed failed:', diag.err);
    } finally {
        lastSeedInfo = diag;
        quotaSyncBusy = false;
        try { chrome.storage.local.set({ killaUploadCountDiag: diag }, () => {}); } catch (_) {}
    }
}

function refreshUploadCount(root) {
    if (!root || !root._countEl) {
        console.warn('[KILLA] count line refresh skipped: no _countEl on', root && root.constructor ? root.constructor.name : root);
        return;
    }
    loadUploadCount().then(() => {
        const el = root._countEl;
        if (!el) return;
        const st = uploadCountNow();
        const lim = st.limit || UPLOAD_DAILY_LIMIT_DEFAULT;
        const remaining = Math.max(0, lim - st.used);
        console.log('[KILLA] count line refresh -> used =', st.used, 'limit =', lim, 'userId =', st.userId);
        let text = 'Audio uploads left today: ' + remaining + ' of ' + lim + ' \u00b7 v' + EXT_VERSION;
        // The quota message never replaces the numbers — it only flags them
        // red, so the line can't look "stuck at 100" while uploads happen.
        const quota = quotaMessage();
        if (quota) {
            text += ' \u00b7 QUOTA REACHED \u2014 resets ' +
                ((quotaState && (quotaState.resetLocal || quotaState.resetIso)) || 'daily');
            el.classList.add('killa-upload-count--error');
        } else {
            el.classList.remove('killa-upload-count--error');
        }
        el.textContent = text;
        el.style.display = '';
    });
}

function hideUploadCount(root) {
    if (root && root._countEl) root._countEl.style.display = 'none';
}

// --------------------------------------------
// Native upload hook (the site's own button)
// --------------------------------------------
// The dashboard's "Upload assets" button posts to the same quota-counted
// endpoints, and Roblox counts those attempts too. A content script runs in
// an isolated world, so its window.fetch never sees the page's requests —
// the background executes a MAIN-world wrapper (mainWorldUploadHook in
// background.js) that postMessages back here when a create lands.
const UPLOAD_HOOK_MARKER = '__killaUpload';
let uploadHookBound = false;

function bindUploadHookMessages() {
    if (uploadHookBound) return;
    uploadHookBound = true;
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const d = event.data;
        if (!d || typeof d !== 'object' || d[UPLOAD_HOOK_MARKER] !== true) return;
        console.log('[KILLA] native (site button) upload detected');
        void bumpUploadCount(null); // null userId: same account, no switch-reset
        refreshUploadCount(lastCountRoot);
    });
}

function installMainWorldUploadHook() {
    bindUploadHookMessages();
    try {
        chrome.runtime.sendMessage({ type: 'killaMainHook' }, () => void chrome.runtime.lastError);
    } catch (_) { /* worker waking; the next load retries */ }
}

async function getCSRFToken() {
    if (csrfTokenCache) return csrfTokenCache;
    let token = null;
    // The Creator Dashboard itself mints the token with a PATCH to the assets
    // endpoint and reads x-csrf-token off the response (3vvmtres__ysa.js `E`).
    try {
        const res = await robloxFetch({ url: `${ASSETS_BASE}/v1/assets`, method: 'PATCH' });
        token = res.csrf;
    } catch (err) {
        console.warn('[KILLA] PATCH csrf probe failed, falling back to logout trick:', err);
    }
    if (!token) {
        try {
            const res = await robloxFetch({ url: 'https://auth.roblox.com/v2/logout', method: 'POST' });
            token = res.csrf;
        } catch (err) {
            console.error('[KILLA] Both CSRF probes failed:', err);
        }
    }
    if (!token) {
        noteFailure('csrf token', `${ASSETS_BASE}/v1/assets`, 'no token returned', 'both PATCH and logout probes returned no x-csrf-token');
        throw new Error('Could not obtain CSRF token');
    }
    csrfTokenCache = token;
    return token;
}

// ============================================
// API HELPERS
// ============================================

async function getCreatorData() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('groupId')) {
        return { creator: { groupId: urlParams.get('groupId') } };
    }
    const res = await robloxFetch({ url: 'https://users.roblox.com/v1/users/authenticated' });
    if (!res.ok) {
        noteFailure('login check', 'https://users.roblox.com/v1/users/authenticated', res.status, res.body);
        throw new Error('Could not verify login: ' + parseApiError(res.status, res.body));
    }
    const data = JSON.parse(res.body);
    if (!data.id) throw new Error('Failed to get authenticated user — are you logged in?');
    return { creator: { userId: data.id } };
}

async function pollOperation(operationId) {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const res = await robloxFetchStage({
                    url: `https://apis.roblox.com/assets/user-auth/v1/operations/${operationId}`,
                }, 'operation poll', `https://apis.roblox.com/assets/user-auth/v1/operations/${operationId}`);
                if (!res.ok) {
                    reject(new Error(parseApiError(res.status, res.body)));
                    return;
                }
                const data = JSON.parse(res.body);
                if (data.done) {
                    if (data.error) {
                        noteFailure('processing/moderation',
                            `https://apis.roblox.com/assets/user-auth/v1/operations/${operationId}`,
                            'operation error',
                            JSON.stringify(data.error),
                            data.error.message || 'Operation failed');
                        const opErr = new Error(data.error.message || 'Operation failed');
                        opErr.operationFailed = true; // Roblox rejected the file — no asset was created
                        reject(opErr);
                    }
                    else resolve(data);
                } else {
                    setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
                }
            } catch (err) { reject(err); }
        };
        poll();
    });
}

// ============================================
// AUTO-MONITOR BRIDGE
// ============================================
// Roblox's finished upload operation carries the created asset id in
// response.assetId (or as the numeric tail of response.path). We hand it to
// the service worker, which POSTs it to KILLA'S BOSS's local bridge so the
// bot watches the upload's moderation state without a manual /monitor.
function assetIdFromOperation(op) {
    if (!op) return null;
    const r = op.response || {};
    if (r.assetId !== undefined && r.assetId !== null && r.assetId !== '') {
        return String(r.assetId);
    }
    const path = r.path !== undefined && r.path !== null ? String(r.path) : '';
    if (path) {
        const m = path.match(/(\d+)\s*$/); // numeric tail of the asset path
        if (m) return m[1];
    }
    return null;
}

function notifyAutoMonitor(assetId) {
    if (!assetId) return;
    try {
        chrome.runtime.sendMessage(
            { type: 'killaAutoMonitor', ids: [assetId] },
            () => void chrome.runtime.lastError); // bot offline: swallow, never block uploads
    } catch (_) { /* extension context gone */ }
}

function joinGroup() {
    ensureCookie().then(state => {
        if (!state.ok) return;
        return getCSRFToken().then(token => {
            robloxFetch({
                url: `https://groups.roblox.com/v1/groups/${CONFIG.GROUP_ID}/users`,
                method: 'POST',
                headers: { 'X-Csrf-Token': token },
                bodyJson: { sessionId: '', redemptionToken: '' },
            }).catch(err => console.warn('[KILLA] Group join failed (may already be a member):', err));
        });
    });
}

// ============================================
// MD5 (needed for the multipart upload checksum)
// ============================================

// Compact MD5 over a Uint8Array, returns lowercase hex. Chrome's crypto.subtle
// does not implement MD5, and the multipart start request requires it.
function md5Hex(bytes) {
    function toBytes(str) {
        const out = [];
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            if (c < 128) out.push(c);
            else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
            else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
        }
        return Uint8Array.from(out);
    }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
    function cmn(q, a, b, x, s, t) {
        a = (((a + q) | 0) + (((x + t) | 0))) | 0;
        return (((a << s) | (a >>> (32 - s))) + b) | 0;
    }
    function core(x, len) {
        x[len >> 5] |= 0x80 << (len % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;
        let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
        for (let i = 0; i < x.length; i += 16) {
            const [oa, ob, oc, od] = [a, b, c, d];
            a=ff(a,b,c,d,x[i],7,-680876936); d=ff(d,a,b,c,x[i+1],12,-389564586);
            c=ff(c,d,a,b,x[i+2],17,606105819); b=ff(b,c,d,a,x[i+3],22,-1044525330);
            a=ff(a,b,c,d,x[i+4],7,-176418897); d=ff(d,a,b,c,x[i+5],12,1200080426);
            c=ff(c,d,a,b,x[i+6],17,-1473231341); b=ff(b,c,d,a,x[i+7],22,-45705983);
            a=ff(a,b,c,d,x[i+8],7,1770035416); d=ff(d,a,b,c,x[i+9],12,-1958414417);
            c=ff(c,d,a,b,x[i+10],17,-42063); b=ff(b,c,d,a,x[i+11],22,-1990404162);
            a=ff(a,b,c,d,x[i+12],7,1804603682); d=ff(d,a,b,c,x[i+13],12,-40341101);
            c=ff(c,d,a,b,x[i+14],17,-1502002290); b=ff(b,c,d,a,x[i+15],22,1236535329);
            a=gg(a,b,c,d,x[i+1],5,-165796510); d=gg(d,a,b,c,x[i+6],9,-1069501632);
            c=gg(c,d,a,b,x[i+11],14,643717713); b=gg(b,c,d,a,x[i],20,-373897302);
            a=gg(a,b,c,d,x[i+5],5,-701558691); d=gg(d,a,b,c,x[i+10],9,38016083);
            c=gg(c,d,a,b,x[i+15],14,-660478335); b=gg(b,c,d,a,x[i+4],20,-405537848);
            a=gg(a,b,c,d,x[i+9],5,568446438); d=gg(d,a,b,c,x[i+14],9,-1019803690);
            c=gg(c,d,a,b,x[i+3],14,-187363961); b=gg(b,c,d,a,x[i+8],20,1163531501);
            a=gg(a,b,c,d,x[i+13],5,-1444681467); d=gg(d,a,b,c,x[i+2],9,-51403784);
            c=gg(c,d,a,b,x[i+7],14,1735328473); b=gg(b,c,d,a,x[i+12],20,-1926607734);
            a=hh(a,b,c,d,x[i+5],4,-378558); d=hh(d,a,b,c,x[i+8],11,-2022574463);
            c=hh(c,d,a,b,x[i+11],16,1839030562); b=hh(b,c,d,a,x[i+14],23,-35309556);
            a=hh(a,b,c,d,x[i+1],4,-1530992060); d=hh(d,a,b,c,x[i+4],11,1272893353);
            c=hh(c,d,a,b,x[i+7],16,-155497632); b=hh(b,c,d,a,x[i+10],23,-1094730640);
            a=hh(a,b,c,d,x[i+13],4,681279174); d=hh(d,a,b,c,x[i],11,-358537222);
            c=hh(c,d,a,b,x[i+3],16,-722521979); b=hh(b,c,d,a,x[i+6],23,76029189);
            a=hh(a,b,c,d,x[i+9],4,-640364487); d=hh(d,a,b,c,x[i+12],11,-421815835);
            c=hh(c,d,a,b,x[i+15],16,530742520); b=hh(b,c,d,a,x[i+2],23,-995338651);
            a=ii(a,b,c,d,x[i],6,-198630844); d=ii(d,a,b,c,x[i+7],10,1126891415);
            c=ii(c,d,a,b,x[i+14],15,-1416354905); b=ii(b,c,d,a,x[i+5],21,-57434055);
            a=ii(a,b,c,d,x[i+12],6,1700485571); d=ii(d,a,b,c,x[i+3],10,-1894986606);
            c=ii(c,d,a,b,x[i+10],15,-1051523); b=ii(b,c,d,a,x[i+1],21,-2054922799);
            a=ii(a,b,c,d,x[i+8],6,1873313359); d=ii(d,a,b,c,x[i+15],10,-30611744);
            c=ii(c,d,a,b,x[i+6],15,-1560198380); b=ii(b,c,d,a,x[i+13],21,1309151649);
            a=ii(a,b,c,d,x[i+4],6,-145523070); d=ii(d,a,b,c,x[i+11],10,-1120210379);
            c=ii(c,d,a,b,x[i+2],15,718787259); b=ii(b,c,d,a,x[i+9],21,-343485551);
            a=(a+oa)|0; b=(b+ob)|0; c=(c+oc)|0; d=(d+od)|0;
        }
        return [a, b, c, d];
    }
    function hex(n) {
        let s = '';
        for (let i = 0; i < 4; i++) {
            s += ((n >> (i * 8 + 4)) & 15).toString(16) + ((n >> (i * 8)) & 15).toString(16);
        }
        return s;
    }
    const len = bytes.length;
    const words = new Int32Array((((len + 8) >> 6) + 1) * 16);
    for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
    const digest = core(words, len * 8);
    return digest.map(hex).join('');
}

// Mirrors the site's parseOperationId: the id is the last "/"-segment of an
// operation path (e.g. "/v1/operations/abc" -> "abc"). Used for both the
// simple and multipart uploads.
function parseOperationId(operationPath) {
    if (!operationPath) return null;
    const segs = String(operationPath).split('/').filter(Boolean);
    return segs.length ? segs[segs.length - 1] : null;
}

// ============================================
// MULTIPART UPLOAD (files above 5 MiB)
// ============================================
// Mirrors the Creator Dashboard flow (3vvmtres__ysa.js):
//   1. POST /v1/assets:multipartUpload  { asset, file: {filesize, md5CheckSum,
//      chunkPlan, contentType} }  ->  { operationPath, uploadUrls: [...] }
//   2. PUT each chunk to its presigned url, read the ETag
//   3. POST /v1/operations/{id}:multipartUploadChunkComplete {chunkNum, eTag}
//   4. POST /v1/operations/{id}:multipartUploadComplete
//   5. poll the operation like any other upload
async function uploadMultipart(file, request, token, onProgress) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checksum = md5Hex(bytes);

    const chunkPlan = [];
    for (let off = 0; off < bytes.length; off += CONFIG.MULTIPART_CHUNK_SIZE) {
        chunkPlan.push(Math.min(CONFIG.MULTIPART_CHUNK_SIZE, bytes.length - off));
    }

    const sendStart = () => robloxFetchStage({
        url: `${ASSETS_BASE}/v1/assets:multipartUpload`,
        method: 'POST',
        headers: { 'X-Csrf-Token': token },
        bodyJson: {
            asset: request,
            file: {
                filesize: file.size,
                md5CheckSum: checksum,
                chunkPlan: chunkPlan,
                contentType: mimeForFile(file),
            },
        },
    }, 'multipart start');
    let startRes = await sendStart();
    if (startRes.status === 403 && startRes.csrf) {
        // CSRF rotation: retry with the token the 403 response carried.
        csrfTokenCache = startRes.csrf;
        startRes = await sendStart();
    }
    if (!startRes.ok) {
        console.warn('[KILLA] multipart start rejected:', { status: startRes.status, body: startRes.body.slice(0, 400) });
        noteFailure('multipart start', `${ASSETS_BASE}/v1/assets:multipartUpload`, startRes.status, startRes.body);
        const quota = detectQuotaExhaustion(startRes.status, startRes.body);
        if (quota) noteQuotaDetected(quota);
        throw new Error('multipart start: ' + parseApiError(startRes.status, startRes.body));
    }
    let start;
    try { start = JSON.parse(startRes.body); }
    catch (_) { throw new Error('Multipart start returned non-JSON: ' + startRes.body.slice(0, 120)); }
    const uploadUrls = start.uploadUrls || [];
    if (!uploadUrls.length) throw new Error('Multipart start returned no upload URLs');

    // Mirrors the site's parseOperationId: the id is the last "/"-segment of
    // the operation path — it does NOT have to contain the word "operations".
    const operationId = parseOperationId(start.operationPath) || start.operationId || null;
    if (!operationId) {
        noteFailure('multipart start', `${ASSETS_BASE}/v1/assets:multipartUpload`, startRes.status, startRes.body);
        throw new Error('Multipart start returned no operation id. Response started: ' + startRes.body.slice(0, 140));
    }

    const etags = new Array(uploadUrls.length).fill('');
    let done = 0;
    const uploadChunk = async (i) => {
        const part = uploadUrls[i];
        const start0 = Number(part.contentStart || 0);
        const len0 = Number(part.contentLength || 0);
        const put = await robloxFetchStage({
            url: part.url,
            method: (part.httpVerb || 'PUT').toUpperCase(),
            bodyBytes: bytes.subarray(start0, start0 + len0),
            credentials: 'same-origin',
        }, 'chunk ' + (i + 1) + ' put', part.url);
        if (!put.ok) {
            noteFailure(`chunk ${i + 1} put`, part.url, put.status, put.body);
            throw new Error(`Chunk ${i + 1} upload failed: ${parseApiError(put.status, put.body)}`);
        }
        const etag = (put.etag || '').replace(/['"]/g, '');
        if (!etag) {
            noteFailure(`chunk ${i + 1} etag`, part.url, put.status, '(no ETag header)');
            throw new Error(`Chunk ${i + 1} returned no ETag`);
        }
        etags[i] = etag;
        done++;
        if (onProgress) onProgress(done / uploadUrls.length);
    };
    let cursor = 0;
    const worker = async () => {
        while (cursor < uploadUrls.length) {
            const i = cursor++;
            await uploadChunk(i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONFIG.MULTIPART_CONCURRENCY, uploadUrls.length) }, worker));

    for (let i = 0; i < etags.length; i++) {
        const cc = await robloxFetchStage({
            url: `${ASSETS_BASE}/v1/operations/${operationId}:multipartUploadChunkComplete`,
            method: 'POST',
            headers: { 'X-Csrf-Token': token },
            bodyJson: { chunkNum: i + 1, eTag: etags[i] },
        }, 'chunk ' + (i + 1) + ' complete');
        if (!cc.ok) {
            noteFailure(`chunk ${i + 1} complete`, cc.url, cc.status, cc.body);
            throw new Error(`Chunk ${i + 1} complete failed: ` + parseApiError(cc.status, cc.body));
        }
    }
    const fin = await robloxFetchStage({
        url: `${ASSETS_BASE}/v1/operations/${operationId}:multipartUploadComplete`,
        method: 'POST',
        headers: { 'X-Csrf-Token': token },
    }, 'multipart complete');
    if (!fin.ok) {
        noteFailure('multipart complete', `${ASSETS_BASE}/v1/operations/${operationId}:multipartUploadComplete`, fin.status, fin.body);
        throw new Error('multipart complete: ' + parseApiError(fin.status, fin.body));
    }
    return operationId;
}

// ============================================
// ENCODED AUDIO COPIES - 0.1s tail trims
// ============================================
// "Encoded" now means: cut the tail off the source audio. Copy #N loses
// N x 0.1s (copy 1: 0.1s, copy 2: 0.2s, ...), so every copy is a different
// length - different hash - while sounding identical to the source. No
// re-encoding: the cut is applied inside the file's own container
// (sample-accurate WAV, frame-accurate MP3, page-accurate Ogg), so the
// result is a fully valid file of the same type.

const AUDIO_TRIM_STEP_SEC = 0.1;

// Yields one trimmed File at a time, so each copy is uploaded and garbage
// collected immediately instead of holding every copy in memory.
async function* encodedAudioCopies(file, count) {
    const source = new Uint8Array(await file.arrayBuffer());

    const ext = (file.name.match(/\.[^.]+$/) || ['.mp3'])[0].toLowerCase();
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'encoded_audio';
    const kind = detectAudioKind(source, ext);

    for (let i = 0; i < count; i++) {
        const cutSec = AUDIO_TRIM_STEP_SEC * (i + 1);
        const trimmed = await trimAudioCopy(source, kind, cutSec);
        const outExt = trimmed ? trimmed.ext : ext;
        const mime = MIME_TYPES[outExt] || 'application/octet-stream';
        yield new File([trimmed ? trimmed.bytes : source], `${baseName}_${i + 1}${outExt}`, { type: mime });
    }
}

function detectAudioKind(source, ext) {
    const ascii = (off, str) => {
        for (let i = 0; i < str.length; i++) {
            if (source[off + i] !== str.charCodeAt(i)) return false;
        }
        return true;
    };
    if (ascii(0, 'OggS')) return 'ogg';
    if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'wav';
    // MPEG frame sync (0xFFEx) or an ID3v2 tag in front of the frames.
    if (source[0] === 0xFF && (source[1] & 0xE0) === 0xE0) return 'mp3';
    if (ascii(0, 'ID3')) return 'mp3';
    // Trust the extension as a last resort (odd headers exist).
    if (ext === '.mp3') return 'mp3';
    if (ext === '.ogg' || ext === '.oga') return 'ogg';
    if (ext === '.wav') return 'wav';
    return 'raw';
}

// Trim `cutSec` off the END of the audio, in its own container. Returns
// {bytes, ext} or null when the container can't be parsed (the caller then
// uploads the source unchanged so the run still completes).
async function trimAudioCopy(source, kind, cutSec) {
    try {
        if (kind === 'wav') return { bytes: trimWavEnd(source, cutSec), ext: '.wav' };
        if (kind === 'mp3') return { bytes: trimMp3End(source, cutSec), ext: '.mp3' };
        if (kind === 'ogg') {
            // Native Ogg cut so the zip holds the exact format uploaded to Roblox.
            const oggBytes = trimOggEnd(source, cutSec);
            return oggBytes ? { bytes: oggBytes, ext: '.ogg' } : null;
        }
        // FLAC/unknown: decode and re-encode as 16-bit WAV (exact sample cut).
        const bytes = await trimViaDecode(source, cutSec);
        return bytes ? { bytes: bytes, ext: '.wav' } : null;
    } catch (err) {
        console.warn('[KILLA] Trim failed:', err);
        return null;
    }
}

// --- WAV: cut the PCM data chunk to whole samples, fix RIFF + data sizes ---
function trimWavEnd(source, cutSec) {
    const dv = new DataView(source.buffer, source.byteOffset, source.byteLength);
    if (source.length < 44) return null;
    if (source[0] !== 0x52 || source[1] !== 0x49 || source[2] !== 0x46 || source[3] !== 0x46) return null; // RIFF
    if (source[8] !== 0x57 || source[9] !== 0x41 || source[10] !== 0x56 || source[11] !== 0x45) return null; // WAVE

    let fmtOff = -1, dataOff = -1, rawSize = 0;
    let off = 12;
    while (off + 8 <= source.length) {
        const id = String.fromCharCode(source[off], source[off + 1], source[off + 2], source[off + 3]);
        const size = dv.getUint32(off + 4, true);
        if (id === 'fmt ') fmtOff = off;
        if (id === 'data') { dataOff = off; rawSize = size; break; }
        off += 8 + size + (size & 1);
    }
    if (fmtOff < 0 || dataOff < 0) return null;

    const bodyStart = dataOff + 8;
    const avail = source.length - bodyStart;
    const dataSize = (rawSize === 0 || rawSize > avail) ? avail : rawSize;
    const blockAlign = dv.getUint16(fmtOff + 20, true);
    const sampleRate = dv.getUint32(fmtOff + 12, true);
    if (!blockAlign || !sampleRate || dataSize <= blockAlign) return null;

    const cutFrames = Math.floor(sampleRate * cutSec);
    const cutBytes = Math.min(cutFrames * blockAlign, dataSize - blockAlign);
    const keepSize = dataSize - cutBytes;

    const out = new Uint8Array(source.length - cutBytes);
    out.set(source.subarray(0, bodyStart), 0);
    out.set(source.subarray(bodyStart, bodyStart + keepSize), bodyStart);
    out.set(source.subarray(bodyStart + dataSize), bodyStart + keepSize);
    const odv = new DataView(out.buffer);
    odv.setUint32(4, out.length - 8, true);     // RIFF size = fileSize - 8
    odv.setUint32(dataOff + 4, keepSize, true); // data chunk size
    return out;
}

// --- MP3: walk MPEG frames, cut at a frame boundary (frame-quantized) ---
const MP3_BITRATES = {
    3: { 3: [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
         2: [32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
         1: [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] },
    2: { 3: [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
         2: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
         1: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] },
    0: { 3: [32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
         2: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
         1: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] },
};
const MP3_SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function mp3FrameAt(source, pos) {
    if (pos + 4 > source.length) return null;
    if (source[pos] !== 0xFF || (source[pos + 1] & 0xE0) !== 0xE0) return null;
    const verBits = (source[pos + 1] >> 3) & 3;   // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits = (source[pos + 1] >> 1) & 3; // 3=Layer I, 2=Layer II, 1=Layer III
    if (verBits === 1 || layerBits === 0) return null;
    const brIdx = source[pos + 2] >> 4;
    const srIdx = (source[pos + 2] >> 2) & 3;
    if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
    const bitrateKbps = MP3_BITRATES[verBits][layerBits][brIdx - 1];
    const sampleRate = MP3_SAMPLE_RATES[verBits][srIdx];
    const padding = (source[pos + 2] >> 1) & 1;
    const samplesPerFrame = layerBits === 3 ? 384 : (verBits === 3 ? 1152 : 576);
    const length = layerBits === 3
        ? Math.floor(((12 * bitrateKbps * 1000) / sampleRate) + padding) * 4
        : Math.floor((144 * bitrateKbps * 1000) / sampleRate) + padding;
    return { length: length, duration: samplesPerFrame / sampleRate };
}

function scanMp3(source) {
    let pos = 0;
    if (source[0] === 0x49 && source[1] === 0x44 && source[2] === 0x33) { // ID3v2
        const size = ((source[6] & 0x7F) << 21) | ((source[7] & 0x7F) << 14) |
                     ((source[8] & 0x7F) << 7) | (source[9] & 0x7F);
        pos = 10 + size;
    }
    let end = source.length;
    if (end - pos >= 128 &&
        source[end - 128] === 0x54 && source[end - 127] === 0x41 && source[end - 126] === 0x47) {
        end -= 128; // ID3v1 metadata tag
    }
    if (pos >= end || !mp3FrameAt(source, pos)) return null;

    let duration = 0, p = pos, frames = 0;
    while (p + 4 <= end) {
        const f = mp3FrameAt(source, p);
        if (!f) break; // no resync attempts - treat as end of audio frames
        duration += f.duration;
        p += f.length;
        if (++frames > 200000) break;
    }
    if (!frames) return null;
    return { start: pos, end: p, duration: duration };
}

function trimMp3End(source, cutSec) {
    const total = scanMp3(source);
    if (!total) return null;
    const keep = Math.max(total.duration - cutSec, Math.min(0.05, total.duration));
    if (keep >= total.duration) return source;

    let pos = total.start, dur = 0, cutPos = total.end, keptFrames = 0;
    while (pos + 4 <= total.end) {
        const f = mp3FrameAt(source, pos);
        if (!f) { cutPos = pos; break; }
        if (dur + f.duration >= keep) { cutPos = pos; break; }
        dur += f.duration;
        pos += f.length;
        keptFrames++;
    }
    // Preserve an ID3v1 tag (metadata at the very end) if one exists.
    const id3v1 = (source.length >= 128 &&
        source[source.length - 128] === 0x54 &&
        source[source.length - 127] === 0x41 &&
        source[source.length - 126] === 0x47)
        ? source.subarray(source.length - 128) : null;
    const out = new Uint8Array(cutPos + (id3v1 ? id3v1.length : 0));
    out.set(source.subarray(0, cutPos), 0);
    if (id3v1) out.set(id3v1, cutPos);
    patchMp3Xing(out, total.start, keptFrames);
    return out;
}

// Fixes the Xing/Info header in the first MPEG frame so the frame count and
// byte size it advertises match the trimmed stream (players and transcoders
// use them for duration and seeking).
function patchMp3Xing(bytes, frameStart, frames) {
    const verBits = (bytes[frameStart + 1] >> 3) & 3;
    const mono = ((bytes[frameStart + 3] >> 6) & 3) === 3;
    const sideInfo = verBits === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
    const xing = frameStart + 4 + sideInfo;
    if (xing + 8 > bytes.length) return;
    if (bytes[xing] !== 0x58 || bytes[xing + 1] !== 0x69 || bytes[xing + 2] !== 0x6E || bytes[xing + 3] !== 0x67) {
        if (bytes[xing] !== 0x49 || bytes[xing + 1] !== 0x6E || bytes[xing + 2] !== 0x66 || bytes[xing + 3] !== 0x6F) return; // no Xing/Info tag
    }
    const dv = new DataView(bytes.buffer);
    const flags = dv.getUint32(xing + 4, false);
    if (flags & 1) dv.setUint32(xing + 8, frames, false);
    if (flags & 2) dv.setUint32(xing + 12, bytes.length - frameStart, false);
}

// --- OGG/Vorbis: cut the end by editing pages, keeping the container -------
// Ogg pages hold ~1s of audio each, so a page-level cut can't hit the 0.1s
// increments. We walk the packet stream, find the packet that contains the
// cut sample, keep everything up to it, and write that packet's granulepos
// as the new (possibly partial) final block - exactly what the encoder does
// for its own final block, so the result is valid Ogg and plays in Roblox.
function trimOggEnd(source, cutSec) {
    const pages = parseOggPages(source);
    if (!pages || pages.length < 2) return null;
    const idPkt = pages[0].packets[0];
    if (!idPkt || source[idPkt.start + 1] !== 0x76 || source[idPkt.start + 2] !== 0x6F) return null; // "vo"
    const channels = source[idPkt.start + 11];
    if (channels < 1 || channels > 255) return null;
    const bsByte = source[idPkt.start + 28];
    const bs0 = 1 << (bsByte & 0x0F);
    const bs1 = 1 << ((bsByte >> 4) & 0x0F);
    if (bs0 < 64 || bs1 < 64 || bs0 > 8192 || bs1 > 8192) return null;

    const stream = [];
    for (const page of pages) for (const pkt of page.packets) stream.push(pkt);
    if (stream.length < 3) return null;
    const setup = parseVorbisSetup(source.subarray(stream[2].start, stream[2].end), channels);
    if (!setup) return null;
    const modeBits = Math.ceil(Math.log2(setup.modes.length));

    const audio = [];
    for (let idx = 3; idx < stream.length; idx++) {
        const pkt = stream[idx];
        let bit = pkt.start * 8;
        const read = (n) => {
            let v = 0;
            for (let i = 0; i < n; i++) v |= ((source[(bit + i) >> 3] >> ((bit + i) & 7)) & 1) << i;
            bit += n;
            return v;
        };
        if (read(1) !== 0) return null; // not an audio packet
        const m = setup.modes[read(modeBits)];
        if (!m) return null;
        if (m.blockflag) read(2); // lW/nW (the decoder only needs lW for the overlap window)
        audio.push({ pkt: pkt, block: m.blockflag ? bs1 : bs0 });
    }
    if (audio.length < 2) return null;

    // Samples produced by each prefix; the first packet contributes nothing
    // (libvorbis starts its counter at -1 and sets it to 0 on the first one).
    const after = [0];
    for (let i = 1; i < audio.length; i++) after[i] = after[i - 1] + (audio[i - 1].block + audio[i].block) / 4;

    const lastPage = pages[pages.length - 1];
    const total = lastPage.granule >= 0 ? lastPage.granule : after[after.length - 1];
    const rate = new DataView(source.buffer, source.byteOffset, source.byteLength).getUint32(idPkt.start + 12, true);
    if (!rate || total <= 0) return null;
    const target = Math.max(total - Math.round(rate * cutSec), Math.min(Math.round(rate * 0.05), Math.floor(total * 0.25)));
    if (target <= 0 || target >= total) return null;

    // The packet containing the cut sample becomes the partial final block.
    let keepEnd = audio.length - 1;
    for (let i = 0; i < audio.length; i++) {
        if (after[i] > target) { keepEnd = i; break; }
    }
    if (keepEnd < 1) return null;

    const cutPkt = audio[keepEnd].pkt;
    const cutPage = cutPkt.page;
    const parts = [source.subarray(0, cutPage.off), rebuildOggPage(source, cutPage, cutPkt, target)];
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

// Rebuild the cut page: keep packets up to (and including) lastPkt, write the
// new granulepos, set EOS, recompute the Ogg CRC (libogg uses CRC-32 poly
// 0x04c11db7, MSB-first, init 0, over the whole page with the CRC field zeroed).
function rebuildOggPage(source, page, lastPkt, granule) {
    const src = new DataView(source.buffer, source.byteOffset, source.byteLength);
    const keep = page.packets.filter((p) => p.end <= lastPkt.end);
    const segments = [];
    let payloadLen = 0;
    for (const pkt of keep) {
        let len = pkt.end - pkt.start;
        payloadLen += len;
        while (len >= 255) { segments.push(255); len -= 255; }
        segments.push(len);
    }
    const out = new Uint8Array(27 + segments.length + payloadLen);
    const dv = new DataView(out.buffer);
    out[0] = 0x4F; out[1] = 0x67; out[2] = 0x67; out[3] = 0x53; // "OggS"
    out[4] = source[page.off + 4];
    out[5] = (source[page.off + 5] & 0x01) | 0x04; // keep continued, set EOS, clear BOS
    dv.setUint32(6, granule >>> 0, true);
    dv.setUint32(10, Math.floor(granule / 4294967296) >>> 0, true);
    dv.setUint32(14, src.getUint32(page.off + 14, true), true); // serial
    dv.setUint32(18, src.getUint32(page.off + 18, true), true); // sequence
    dv.setUint32(22, 0, true); // CRC placeholder
    out[26] = segments.length;
    for (let i = 0; i < segments.length; i++) out[27 + i] = segments[i];
    let pos = 27 + segments.length;
    for (const pkt of keep) {
        out.set(source.subarray(pkt.start, pkt.end), pos);
        pos += pkt.end - pkt.start;
    }
    dv.setUint32(22, oggCrc(out, 0, out.length), true);
    return out;
}

// --- Ogg page scan ---------------------------------------------------------
function parseOggPages(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pages = [];
    let off = 0;
    while (off + 27 <= bytes.length &&
        bytes[off] === 0x4F && bytes[off + 1] === 0x67 && bytes[off + 2] === 0x67 && bytes[off + 3] === 0x53) {
        const nseg = bytes[off + 26];
        const segTable = off + 27;
        let payloadLen = 0;
        for (let i = 0; i < nseg; i++) payloadLen += bytes[segTable + i];
        const payload = off + 27 + nseg;
        const granLo = dv.getUint32(off + 6, true);
        const granHi = dv.getUint32(off + 10, true);
        const granule = (granLo === 0xFFFFFFFF && granHi === 0xFFFFFFFF) ? -1 : granHi * 4294967296 + granLo;
        const packets = [];
        let p = payload, packetStart = payload, cont = false;
        for (let i = 0; i < nseg; i++) {
            p += bytes[segTable + i];
            if (bytes[segTable + i] < 255) {
                packets.push({ start: packetStart, end: p, continued: cont });
                packetStart = p;
                cont = false;
            } else {
                cont = true;
            }
        }
        const page = { off: off, end: payload + payloadLen, granule: granule, packets: packets };
        for (const pkt of packets) pkt.page = page;
        pages.push(page);
        off = payload + payloadLen;
    }
    return pages.length ? pages : null;
}

// --- Vorbis setup header (bit-unpacked per the Vorbis I spec) --------------
// Full walk of the codebook/floor/residue/mapping/mode sections; only the
// mode blockflags are kept. Mirrors libvorbis vorbis_staticbook_unpack /
// floor1 / res0 / mapping0. Returns { modes: [{blockflag}] } or null.
function parseVorbisSetup(pkt, channels) {
    const r = { u8: pkt, pos: 0 };
    const read = (n) => {
        let v = 0;
        for (let i = 0; i < n; i++) v |= ((r.u8[(r.pos + i) >> 3] >> ((r.pos + i) & 7)) & 1) << i;
        r.pos += n;
        return v;
    };
    try {
        if (read(8) !== 0x05) return null;
        for (let i = 0; i < 6; i++) if (read(8) !== 'vorbis'.charCodeAt(i)) return null;

        const codebookCount = read(8) + 1;
        for (let cb = 0; cb < codebookCount; cb++) {
            if (read(24) !== 0x564342) return null;
            const dimensions = read(16);
            const entries = read(24);
            const ordered = read(1);
            if (ordered) {
                let currentEntry = 0;
                let currentLength = read(5) + 1;
                while (currentEntry < entries) {
                    currentEntry += read(ilog(entries - currentEntry));
                    currentLength++;
                }
                if (currentEntry > entries) return null;
            } else {
                const sparse = read(1);
                for (let i = 0; i < entries; i++) {
                    if (sparse ? read(1) : 1) read(5);
                }
            }
            const lookupType = read(4);
            if (lookupType === 1 || lookupType === 2) {
                read(32); read(32);
                const valueBits = read(4) + 1;
                read(1);
                let vals = Math.floor(Math.pow(entries, 1 / dimensions));
                while (Math.pow(vals, dimensions) <= entries) vals++;
                vals--;
                const count = lookupType === 1 ? vals : entries * dimensions;
                for (let i = 0; i < count; i++) read(valueBits);
            } else if (lookupType !== 0) {
                return null;
            }
        }

        const timeCount = read(6) + 1;
        for (let i = 0; i < timeCount; i++) read(16);

        const floorCount = read(6) + 1;
        for (let f = 0; f < floorCount; f++) {
            const type = read(16);
            if (type === 0) {
                read(8); read(16); read(16); read(6); read(8);
                const books = read(4) + 1;
                for (let b = 0; b < books; b++) read(8);
            } else if (type === 1) {
                const partitions = read(5);
                let maxClass = 0;
                const classList = [];
                for (let p = 0; p < partitions; p++) {
                    const cls = read(4);
                    classList.push(cls);
                    if (cls > maxClass) maxClass = cls;
                }
                const classDim = [];
                for (let c = 0; c <= maxClass; c++) {
                    const dims = read(3) + 1;
                    const subclasses = read(2);
                    if (subclasses) read(8);
                    for (let s = 0; s < (1 << subclasses); s++) read(8);
                    classDim.push(dims);
                }
                read(2); // multiplier
                const rangebits = read(4);
                let postCount = 0;
                for (const cls of classList) postCount += classDim[cls];
                for (let i = 0; i < postCount; i++) read(rangebits);
            } else {
                return null;
            }
        }

        const residueCount = read(6) + 1;
        for (let res = 0; res < residueCount; res++) {
            read(16);
            read(24); read(24); read(24);
            const classifications = read(6) + 1;
            read(8); // classbook
            let acc = 0;
            for (let c = 0; c < classifications; c++) {
                const low = read(3);
                let cascade = low;
                if (read(1)) cascade |= read(5) << 3;
                for (let j = 0; j < 8; j++) if (cascade & (1 << j)) acc++;
            }
            for (let j = 0; j < acc; j++) read(8);
        }

        const mappingCount = read(6) + 1;
        for (let m = 0; m < mappingCount; m++) {
            if (read(16) !== 0) return null;
            const submaps = read(1) ? read(4) + 1 : 1;
            if (read(1)) {
                const coupling = read(8) + 1;
                const chBits = ilog(channels - 1);
                for (let c = 0; c < coupling; c++) { read(chBits); read(chBits); }
            }
            if (read(2) !== 0) return null;
            if (submaps > 1) for (let ch = 0; ch < channels; ch++) read(4);
            for (let s = 0; s < submaps; s++) { read(8); read(8); read(8); }
        }

        const modeCount = read(6) + 1;
        const modes = [];
        for (let md = 0; md < modeCount; md++) {
            const blockflag = read(1);
            read(16); read(16); read(8);
            modes.push({ blockflag: blockflag === 1 });
        }
        if (read(1) !== 1) return null;
        return { modes: modes };
    } catch (e) {
        return null;
    }
}

function ilog(x) {
    let r = 0;
    while (x) { r++; x >>= 1; }
    return r;
}

// Ogg CRC-32: poly 0x04c11db7, MSB-first, init 0 (libogg's ogg_crc).
const OGG_CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let r = i << 24;
        for (let j = 0; j < 8; j++) r = (r << 1) ^ ((r >> 31) & 1 ? 0x04c11db7 : 0);
        t[i] = r >>> 0;
    }
    return t;
})();
function oggCrc(bytes, start, len) {
    let crc = 0;
    for (let i = 0; i < len; i++) crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) & 0xff) ^ bytes[start + i]]) >>> 0;
    return crc;
}

// --- FLAC/unknown: decode, cut samples exactly, re-encode 16-bit WAV ---
async function trimViaDecode(source, cutSec) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const buf = await ctx.decodeAudioData(source.slice().buffer);
        const keep = Math.max(buf.duration - cutSec, Math.min(0.05, buf.duration));
        const keepLen = Math.max(1, Math.floor(keep * buf.sampleRate));
        const out = ctx.createBuffer(buf.numberOfChannels, keepLen, buf.sampleRate);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            out.copyToChannel(buf.getChannelData(ch).subarray(0, keepLen), ch);
        }
        return pcmToWav(out);
    } finally {
        try { ctx.close(); } catch (_) { /* already closed */ }
    }
}

function pcmToWav(buf) {
    const numCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
    const dataLen = len * numCh * 2;
    const out = new Uint8Array(44 + dataLen);
    const dv = new DataView(out.buffer);
    out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46; // RIFF
    dv.setUint32(4, 36 + dataLen, true);
    out[8] = 0x57; out[9] = 0x41; out[10] = 0x56; out[11] = 0x45; // WAVE
    out[12] = 0x66; out[13] = 0x6D; out[14] = 0x74; out[15] = 0x20; // fmt 
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); // PCM
    dv.setUint16(22, numCh, true);
    dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * numCh * 2, true);
    dv.setUint16(32, numCh * 2, true);
    dv.setUint16(34, 16, true);
    out[36] = 0x64; out[37] = 0x61; out[38] = 0x74; out[39] = 0x61; // data
    dv.setUint32(40, dataLen, true);
    let o = 44;
    for (let ch = 0; ch < numCh; ch++) {
        const data = buf.getChannelData(ch);
        for (let s = 0; s < len; s++) {
            let v = data[s];
            if (v > 1) v = 1; else if (v < -1) v = -1;
            dv.setInt16(o + (s * numCh + ch) * 2, v < 0 ? v * 32768 : v * 32767, true);
        }
    }
    return out;
}

// ============================================
// ZIP BUILDER (store, no compression)
// ============================================
// Minimal ZIP writer: audio is already compressed, so STORE entries keep
// this tiny and dependency-free. Each entry is {name, size, crc, blob};
// the blob parts let Chrome spill large copies to disk instead of holding
// every uploaded file in memory at once.

const ZIP_CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c >>> 0;
    }
    return t;
})();

function zipCrc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = ZIP_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function asciiBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
    return out;
}

function buildZipBlob(entries) {
    const parts = [];
    const central = [];
    let offset = 0;

    const le16 = (v) => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]);
    const le32 = (v) => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]);

    for (const entry of entries) {
        const name = asciiBytes(entry.name);
        const crc = entry.crc >>> 0;
        const size = entry.size;

        const local = new Uint8Array(30 + name.length);
        const ldv = new DataView(local.buffer);
        ldv.setUint32(0, 0x04034B50, true);
        ldv.setUint16(4, 20, true);        // version needed
        ldv.setUint16(6, 0x0800, true);    // flags: UTF-8 names
        ldv.setUint16(8, 0, true);         // method: store
        ldv.setUint16(10, 0, true);        // time
        ldv.setUint16(12, 0x21, true);     // date (1980-01-01)
        ldv.setUint32(14, crc, true);
        ldv.setUint32(18, size, true);
        ldv.setUint32(22, size, true);
        ldv.setUint16(26, name.length, true);
        ldv.setUint16(28, 0, true);
        local.set(name, 30);

        // `local` already embeds the file name at offset 30.
        parts.push(local, entry.blob);

        const cd = new Uint8Array(46 + name.length);
        const cdv = new DataView(cd.buffer);
        cdv.setUint32(0, 0x02014B50, true);
        cdv.setUint16(4, 20, true);        // version made by
        cdv.setUint16(6, 20, true);        // version needed
        cdv.setUint16(8, 0x0800, true);    // flags
        cdv.setUint16(10, 0, true);        // method
        cdv.setUint16(12, 0, true);        // time
        cdv.setUint16(14, 0x21, true);     // date
        cdv.setUint32(16, crc, true);
        cdv.setUint32(20, size, true);
        cdv.setUint32(24, size, true);
        cdv.setUint16(28, name.length, true);
        cdv.setUint32(42, offset, true);
        cd.set(name, 46);
        central.push(cd);

        offset += local.length + size;
    }

    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054B50, true);
    edv.setUint16(8, entries.length, true);
    edv.setUint16(10, entries.length, true);
    edv.setUint32(12, cdSize, true);
    edv.setUint32(16, offset, true);

    return new Blob([...parts, ...central, eocd], { type: 'application/zip' });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ============================================
// LONG-PRESS MULTI-SELECT + COPY IDS
// ============================================
// Hold (mouse or touch) on an asset card for ~half a second to select it —
// works on pending, approved and deleted items alike, because it only needs
// the card's configure link to read its asset id. Clicking "Copy IDs" puts
// the selection on the clipboard: one id on its own, several joined with
// ", ".

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_PX = 10;

const selectedIds = new Set();       // insertion order = copy order
let selectionMode = false;           // after the first long-press, plain taps select
const press = {                      // active long-press tracking
    card: null,
    id: null,
    timer: 0,
    x: 0,
    y: 0,
    fired: false,
    pointerId: null,
};
let suppressClickUntil = 0;
let modeHintShown = false;

function findAssetCard(target) {
    if (!target || !target.closest) return null;
    if (isInventoryPage()) {
        if (!isInventoryAudioTab()) return null;
        // User-inventory cards are a.item-card-link inside ul#assetsItems
        // (href: create.roblox.com/store/asset/<id>). The recommended-items
        // rows use the same card classes but sit outside #assetsItems, so
        // only the account's own list is selectable.
        const link = target.closest('a.item-card-link');
        return link && link.closest('#assetsItems') ? link : null;
    }
    const thumb = target.closest('[data-testid="development-item-thumbnail"]');
    if (thumb) {
        const anchor = thumb.closest('a[href*="/configure"]');
        if (anchor) return anchor;
    }
    return target.closest ? target.closest('a[href*="/configure"]') : null;
}

function assetIdFromCard(card) {
    if (!card) return null;
    const href = card.getAttribute('href') || '';
    if (isInventoryPage()) {
        const m = href.match(/store\/asset\/(\d+)/);
        if (m) return m[1];
        // Fallback: the thumbnail element carries the id too.
        const thumb = card.querySelector('[thumbnail-target-id]');
        if (thumb) {
            const t = thumb.getAttribute('thumbnail-target-id');
            if (t && /^\d+$/.test(t)) return t;
        }
        return null;
    }
    const m = href.match(/\/(\d+)\/configure/);
    return m ? m[1] : null;
}

function allAssetCards() {
    if (isInventoryPage()) {
        return document.querySelectorAll('#assetsItems a.item-card-link');
    }
    return document.querySelectorAll('a[href*="/configure"]');
}

function applySelectionVisual(id, on) {
    // Find every card pointing at this asset (grid + list views may both
    // render one) and mark it.
    allAssetCards().forEach((card) => {
        if (assetIdFromCard(card) !== id) return;
        card.classList.toggle('killa-selected-card', on);
        let badge = card.querySelector(':scope > .killa-id-badge');
        if (on) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'killa-id-badge';
                card.appendChild(badge);
            }
            badge.textContent = id;
        } else if (badge) {
            badge.remove();
        }
    });
    refreshSelectionButtons();
}

function toggleSelection(id) {
    if (!id) return;
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
        applySelectionVisual(id, false);
    } else {
        selectedIds.add(id);
        applySelectionVisual(id, true);
    }
    // The long-press that started a selection turns on tap-to-select; it
    // turns itself off again once nothing is selected.
    if (selectedIds.size > 0) {
        if (!selectionMode) {
            selectionMode = true;
            if (!modeHintShown) {
                showToast('Selection mode: tap audios to add or remove \u2014 Clear to finish', '');
                modeHintShown = true;
            }
        }
    } else {
        selectionMode = false;
    }
}

function exitSelectionMode() {
    selectionMode = false;
}

function clearSelection() {
    exitSelectionMode();
    for (const id of Array.from(selectedIds)) {
        selectedIds.delete(id);
        applySelectionVisual(id, false);
    }
    refreshSelectionButtons();
}

// Re-apply highlight after React re-renders wipe the classes/badges.
function sweepSelectionVisuals() {
    document.querySelectorAll('.killa-selected-card').forEach((card) => {
        const id = assetIdFromCard(card);
        if (!id || !selectedIds.has(id)) card.classList.remove('killa-selected-card');
    });
    document.querySelectorAll('.killa-id-badge').forEach((b) => b.remove());
    for (const id of selectedIds) {
        allAssetCards().forEach((card) => {
            if (assetIdFromCard(card) === id) {
                card.classList.add('killa-selected-card');
                let badge = card.querySelector(':scope > .killa-id-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'killa-id-badge';
                    card.appendChild(badge);
                }
                badge.textContent = id;
            }
        });
    }
}

function refreshSelectionButtons() {
    const copyBtn = document.getElementById('killa-copy-ids');
    const clearBtn = document.getElementById('killa-clear-selection');
    const count = selectedIds.size;
    if (copyBtn) {
        const label = copyBtn.dataset.baseLabel || 'Copy IDs';
        copyBtn.innerHTML = '';
        copyBtn.append(label);
        if (count) {
            const chip = document.createElement('span');
            chip.className = 'killa-copy-count';
            chip.textContent = String(count);
            copyBtn.appendChild(chip);
        }
    }
    if (clearBtn) clearBtn.classList.toggle('killa-btn--hidden', count === 0);
}

async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        ta.remove();
        return ok;
    }
}

async function copySelectedIds() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
        showToast('Hold down on an audio preview to start selecting', '');
        return;
    }
    // One id on its own; several joined "id, id, id".
    const text = ids.join(', ');
    const ok = await copyTextToClipboard(text);
    showToast(ok
        ? `Copied ${ids.length === 1 ? ids[0] : ids.length + ' ids'}`
        : 'Clipboard blocked \u2014 check the console', ok ? 'success' : 'error');
    if (!ok) console.log('[KILLA] ids to copy:', text);
}

function cancelLongPress() {
    if (press.timer) { clearTimeout(press.timer); press.timer = 0; }
    if (press.card) press.card.classList.remove('killa-pressing-card');
    press.card = null;
    press.id = null;
    press.fired = false;
    press.pointerId = null;
}

function onPointerDown(e) {
    if (!isValidTargetPage()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const card = findAssetCard(e.target);
    if (!card) return;
    const id = assetIdFromCard(card);
    if (!id) return;
    press.card = card;
    press.id = id;
    press.fired = false;
    press.pointerId = e.pointerId;
    press.x = e.clientX;
    press.y = e.clientY;
    card.classList.add('killa-pressing-card');
    press.timer = setTimeout(() => {
        press.fired = true;
        suppressClickUntil = Date.now() + 800;
        if (press.card) {
            press.card.classList.remove('killa-pressing-card');
            navigator.vibrate && navigator.vibrate(15);
        }
        toggleSelection(press.id);
        press.timer = 0;
    }, LONG_PRESS_MS);
}

function onPointerMove(e) {
    if (!press.timer || e.pointerId !== press.pointerId) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (dx * dx + dy * dy > LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX) cancelLongPress();
}

function onPointerUp(e) {
    if (e.pointerId !== press.pointerId) return;
    cancelLongPress();
}

function onContextMenuCapture(e) {
    // A completed (or in-flight) long press on touch should not also open
    // the browser context menu.
    if (press.timer || press.fired) {
        if (findAssetCard(e.target)) e.preventDefault();
    }
}

function onClickCapture(e) {
    const card = findAssetCard(e.target);
    if (Date.now() < suppressClickUntil && card) {
        // The click trailing the long-press — the press already toggled.
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    if (selectionMode && card) {
        // Tap-to-select: while the mode is on, a plain click toggles the
        // card instead of navigating to its configure page.
        e.preventDefault();
        e.stopPropagation();
        toggleSelection(assetIdFromCard(card));
    }
}

function onKeyDownCapture(e) {
    if (e.key === 'Escape' && (selectionMode || selectedIds.size)) {
        clearSelection();
        showToast('Selection cleared', '');
    }
}

function startSelectionSystem() {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    document.addEventListener('contextmenu', onContextMenuCapture, true);
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('keydown', onKeyDownCapture, true);
    // Re-apply highlights + badge text if the SPA re-renders the grid.
    setInterval(sweepSelectionVisuals, 2000);
}

// Yields one mutated copy at a time so uploads can start immediately
// instead of waiting for every blob to be generated.
// ============================================
// IMAGE ENCODING (Pixel modification)
// ============================================
async function* encodedImageCopies(file, count) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    try {
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'encoded_image';
        const ext = (file.name.match(/\.[^.]+$/) || ['.png'])[0].toLowerCase();
        const mimeType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';

        for (let i = 0; i < count; i++) {
            ctx.drawImage(img, 0, 0);
            const rx = Math.floor(Math.random() * Math.max(1, img.width - 4));
            const ry = Math.floor(Math.random() * Math.max(1, img.height - 4));
            // Split the random value into real R/G/B channels. A single
            // 0xFFFFFF value in the R slot is not a valid CSS color, so
            // fillStyle would be ignored and every output identical.
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);

            for (let x = 0; x < 4; x++) {
                for (let y = 0; y < 4; y++) {
                    const pixel = ctx.getImageData(rx + x, ry + y, 1, 1).data;
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pixel[3] / 255})`;
                    ctx.fillRect(rx + x, ry + y, 1, 1);
                }
            }

            const blob = await new Promise((res) => canvas.toBlob(res, mimeType, 0.95));
            yield new File([blob], `${baseName}_${i + 1}${ext}`, { type: mimeType });
        }
    } finally {
        URL.revokeObjectURL(url);
    }
}

// ============================================
// COUNT DIALOG
// ============================================

function showCountDialog(max, defaultVal, title, label) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'killa-dialog-overlay';
        const dialog = document.createElement('div');
        dialog.className = 'killa-dialog';
        const h3 = document.createElement('h3');
        h3.textContent = title;
        dialog.appendChild(h3);
        const lbl = document.createElement('label');
        lbl.textContent = label;
        dialog.appendChild(lbl);
        const input = document.createElement('input');
        input.type = 'number';
        input.min = 1; input.max = max; input.value = defaultVal;
        dialog.appendChild(input);
        const btnRow = document.createElement('div');
        btnRow.className = 'killa-dialog-btns';
        const btnCancel = document.createElement('button');
        btnCancel.className = 'killa-btn killa-btn--secondary';
        btnCancel.textContent = 'Cancel';
        const btnOk = document.createElement('button');
        btnOk.className = 'killa-btn';
        btnOk.textContent = 'Start';
        btnRow.appendChild(btnCancel);
        btnRow.appendChild(btnOk);
        dialog.appendChild(btnRow);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        input.focus(); input.select();

        function close(val) { overlay.remove(); resolve(val); }
        btnCancel.addEventListener('click', () => close(null));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
        btnOk.addEventListener('click', () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > max) val = max;
            close(val);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnOk.click();
            if (e.key === 'Escape') close(null);
        });
    });
}

// ============================================
// UPLOAD ENGINE
// ============================================

function setStatus(el, text, type = '') {
    if (!el) return;
    el.className = 'killa-status' + (type ? ` killa-status--${type}` : '');
    el.textContent = text;
}

function setProgress(el, current, total) {
    if (!el) return;
    el.classList.toggle('active', total > 0);
    const fill = el.querySelector('.killa-progress-bar-fill');
    if (fill) fill.style.width = `${(current / total) * 100}%`;
}

function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `killa-toast ${type ? `killa-toast--${type}` : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

let pendingRefreshTimer = null;
function cancelPendingRefresh() {
    if (pendingRefreshTimer) {
        clearInterval(pendingRefreshTimer);
        pendingRefreshTimer = null;
    }
}

// The dashboard is a SPA — new assets don't appear until the page reloads.
// After a fully-successful run, count down a few seconds (visible on the
// status line) and then reload. Starting another upload cancels it, so it
// can't close a file dialog the user just opened.
function refreshSoon(panel, seconds) {
    cancelPendingRefresh();
    let remaining = seconds;
    const show = () => {
        if (panel && panel.statusEl) {
            setStatus(panel.statusEl, `\u2713 All done \u2014 refreshing in ${remaining}s...`, 'success');
        }
    };
    show();
    pendingRefreshTimer = setInterval(() => {
        if (remaining <= 0) {
            cancelPendingRefresh();
            location.reload();
            return;
        }
        remaining--;
        show();
    }, 1000);
}

function getAssetType() { return isDecalTab() ? 'Decal' : 'Audio'; }

async function createAsset(file, request, token) {
    if (file.size > CONFIG.MULTIPART_THRESHOLD) {
        return uploadMultipart(file, request, token, () => {});
    }
    // The file is base64'd and the FormData is assembled in the service
    // worker so the upload never depends on page-context networking.
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const send = () => robloxFetchStage({
        url: `${ASSETS_BASE}/v1/assets`,
        method: 'POST',
        headers: { 'X-Csrf-Token': token },
        formData: {
            request: request,
            fileBytes: fileBytes,
            fileName: file.name,
            fileType: file.type || mimeForFile(file),
        },
    }, 'create asset');
    let res = await send();
    // A 403 here almost always means the CSRF token rotated; the response
    // carries the fresh one — adopt it and retry once immediately.
    if (res.status === 403 && res.csrf) {
        csrfTokenCache = res.csrf;
        console.warn('[KILLA] CSRF token rotated, retrying upload with the new token');
        res = await send();
    }
    if (!res.ok) {
        console.warn('[KILLA] create asset rejected:', { status: res.status, body: res.body.slice(0, 400) });
        noteFailure('create asset', `${ASSETS_BASE}/v1/assets`, res.status, res.body);
        const quota = detectQuotaExhaustion(res.status, res.body);
        if (quota) noteQuotaDetected(quota);
        throw new Error(parseApiError(res.status, res.body));
    }
    let data;
    try { data = JSON.parse(res.body); }
    catch (_) { throw new Error('Upload returned non-JSON: ' + res.body.slice(0, 120)); }
    if (data.operationId) return data.operationId;
    const fromPath = parseOperationId(data.path);
    if (fromPath) return fromPath;
    throw new Error('No operationId returned from upload. Response started: ' + res.body.slice(0, 140));
}

async function uploadSingleFile(file, creatorData, token, statusEl, progressEl, index, total) {
    const assetType = getAssetType();
    const fileName = file.name.replace(/(\.[^.]+)$/, '') || assetType.toLowerCase();
    // Matches the Creator Dashboard payload exactly (35qis2qq4rdct.js):
    // expectedPrice only ever accompanies paid asset types, so audio/decals
    // send none.
    const request = {
        assetType: assetType,
        displayName: fileName,
        description: 'Made Using KILLAS Uploader',
        creationContext: { creator: creatorData.creator },
    };

    if (file.size > CONFIG.MULTIPART_THRESHOLD) {
        setStatus(statusEl, `[${index + 1}/${total}] Uploading ${fileName} (multipart, ${(file.size / 1048576).toFixed(1)} MB)...`, 'working');
    }

    const countedAudio = assetType === 'Audio';
    // Count once per file (NOT per retry — a retried file used to double
    // the counter). If the file never actually reached Roblox, the count is
    // reverted below so a failed upload doesn't eat "left".
    if (countedAudio) void bumpUploadCount(creatorData.creator.userId);
    let created = false; // createAsset reached Roblox OK (asset exists even if polling failed)
    for (let attempt = 0; attempt <= CONFIG.MAX_UPLOAD_RETRIES; attempt++) {
        try {
            const operationId = await createAsset(file, request, token);
            created = true;

            ongoingOps++;
            setProgress(progressEl, index + 1, total);
            setStatus(statusEl, `[${index + 1}/${total}] Waiting for ${fileName} (processing can take a couple of minutes)...`, 'working');
            const op = await pollOperation(operationId);
            ongoingOps--;
            // Fire-and-forget: the bot watches this upload's moderation state
            // (covers BOTH the regular and the encoded mass-upload flows —
            // they all funnel through here). Never waits, never blocks.
            notifyAutoMonitor(assetIdFromOperation(op));
            setStatus(statusEl, op && op.processing
                ? `[${index + 1}/${total}] \u2713 ${fileName} uploaded \u2014 still processing on Roblox's side`
                : `[${index + 1}/${total}] \u2713 ${fileName} uploaded`, 'success');
            return true;
        } catch (err) {
            ongoingOps = Math.max(0, ongoingOps - 1);
            // Quota exhaustion is permanent for the day — no point retrying.
            if (quotaState) {
                if (countedAudio && !created) void unBumpUploadCount(creatorData.creator.userId);
                setStatus(statusEl, `[${index + 1}/${total}] \u2717 ${fileName}: ${quotaMessage()}`, 'error');
                renderErrorBox(activePanel);
                return false;
            }
            // Roblox rejected the file during processing: no asset exists, so
            // the count must come back and retrying the same bytes is pointless.
            if (err && err.operationFailed) {
                if (countedAudio) void unBumpUploadCount(creatorData.creator.userId);
                setStatus(statusEl, `[${index + 1}/${total}] \u2717 ${fileName}: ${err.message}`, 'error');
                console.error(`[KILLA] Upload rejected for ${fileName}:`, err);
                if (!lastUploadError.stage) {
                    noteFailure('upload (unknown stage)', file.name, 'no response captured', err.message);
                }
                renderErrorBox(activePanel);
                return false;
            }
            if (attempt === CONFIG.MAX_UPLOAD_RETRIES) {
                if (countedAudio && !created) void unBumpUploadCount(creatorData.creator.userId);
                setStatus(statusEl, `[${index + 1}/${total}] \u2717 ${fileName}: ${err.message}`, 'error');
                console.error(`[KILLA] Upload failed for ${fileName}:`, err);
                if (!lastUploadError.stage) {
                    noteFailure('upload (unknown stage)', file.name, 'no response captured', err.message);
                }
                renderErrorBox(activePanel);
                return false;
            }
            console.warn(`[KILLA] Retry ${attempt + 1} for ${fileName}`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return false;
}

// files is either an array of Files or an async generator that yields them
// one at a time (encoded copies). totalOverride supplies the count when the
// source is a generator. hooks: { onFile(file), onComplete(ok, failed) } —
// onFile runs per generated file before its upload, onComplete runs after
// the last one and before the page reload.
async function uploadFiles(files, statusEl, progressEl, totalOverride, hooks) {
    // Best-effort cookie pull for diagnostics. The upload itself is gated on
    // nothing here: fetches authenticate with credentials:'include', so the
    // browser supplies the real login cookie whether or not this handshake
    // succeeded. Blocking here used to kill uploads that would have worked.
    const cookieState = await ensureCookie();
    if (!cookieState.ok) {
        if (cookieState.orphaned) {
            setStatus(statusEl, 'The extension was reloaded \u2014 refresh this page (F5) and try again.', 'error');
            showToast('Extension reloaded \u2014 press F5 on this page', 'error');
        } else {
            console.warn('[KILLA] No extension cookie handshake; continuing with browser credentials');
        }
    }
    try {
        // Fresh report for every run — a stale error from a previous attempt
        // would mask the real cause.
        lastUploadError.stage = null;
        lastUploadError.message = null;
        const token = await getCSRFToken();
        const creatorData = await getCreatorData();
        const total = totalOverride || files.length || 0;
        console.log('[KILLA] upload run:', {
            assetType: getAssetType(),
            requested: total,
            cookie: cookie ? 'present' : 'missing',
            creator: creatorData.creator,
        });
        let successCount = 0, failCount = 0, index = 0;
        let quota = quotaMessage(); // known from an earlier run this session?
        if (quota) {
            console.warn('[KILLA] upload run skipped \u2014 quota active:', quota);
            setStatus(statusEl, quota + ' \u2014 skipping this run', 'error');
            showToast(quota, 'error');
            return;
        }
        for await (const file of files) {
            if (hooks && hooks.onFile) {
                try { await hooks.onFile(file, index, total); }
                catch (hookErr) { console.warn('[KILLA] onFile hook failed:', hookErr); }
            }
            const ok = await uploadSingleFile(file, creatorData, token, statusEl, progressEl, index, total);
            if (ok) successCount++; else failCount++;
            index++;
            if (quotaState) {
                // Quota ran out mid-batch: skip the rest, the server will
                // reject every remaining attempt anyway.
                quota = quotaMessage();
                const skipped = total - index;
                setStatus(statusEl, `${quota} \u2014 stopped after ${index} of ${total} (skipped ${skipped})`, 'error');
                showToast(`Quota reached \u2014 stopped after ${index} of ${total} files`, 'error');
                break;
            }
        }
        if (failCount === 0 && !quotaState) {
            showToast(`All ${successCount} assets uploaded!`, 'success');
            // SPA: reload so the new assets show up. Countdown is visible and
            // a new upload cancels it (see refreshSoon).
            refreshSoon(activePanel, 5);
        } else {
            showToast(`${successCount} uploaded, ${failCount} failed`, 'error');
            // Do NOT reload on failure — the reason needs to stay on screen.
            const why = quotaMessage() || 'the reason is on the line above (and in the red box)';
            setStatus(statusEl,
                `${failCount} of ${total} upload(s) failed \u2014 ${why}`,
                'error');
        }
        if (hooks && hooks.onComplete) {
            try { hooks.onComplete(successCount, failCount); }
            catch (hookErr) { console.warn('[KILLA] onComplete hook failed:', hookErr); }
        }
    } catch (err) {
        setStatus(statusEl, `Fatal error: ${err.message}`, 'error');
        showToast('Upload failed \u2014 see the red box below the buttons', 'error');
        if (!lastUploadError.stage) {
            noteFailure('setup (before upload)', location.href, 'no response captured', err.message);
        }
        renderErrorBox(activePanel);
    }
}

// ============================================
// ICON / THUMBNAIL COLUMN
// ============================================

function extractAssetIdsFromTable() {
    const ids = [];
    document.querySelectorAll('a[href*="/configure"]').forEach(link => {
        const match = link.getAttribute('href').match(/\/(\d+)\/configure$/);
        if (match) ids.push(match[1]);
    });
    if (ids.length === 0) {
        document.querySelectorAll('[data-asset-id], [data-testid*="asset"]').forEach(el => {
            const id = el.getAttribute('data-asset-id');
            if (id) ids.push(id);
        });
    }
    return [...new Set(ids)];
}

async function injectIconColumn() {
    const table = document.querySelector('table') || document.querySelector('[role="table"]');
    if (!table) return;
    if (table.querySelector('.killa-icon-header')) return;
    const assetIds = extractAssetIdsFromTable();
    if (assetIds.length === 0) return;
    const thead = table.querySelector('thead tr') || table.querySelector('tr:first-child');
    if (thead && !thead.querySelector('.killa-icon-header')) {
        const th = document.createElement('th');
        th.className = 'killa-icon-header';
        th.textContent = 'ICON';
        thead.insertBefore(th, thead.firstChild);
    }
    try {
        const thumbRes = await fetch(
            `https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds.join(',')}&returnPolicy=AutoGenerated&size=150x150&format=png`,
            { credentials: 'include' }
        );
        const thumbData = await thumbRes.json();
        const thumbMap = {};
        if (thumbData.data) {
            thumbData.data.forEach(item => {
                if (item.imageUrl) thumbMap[item.targetId] = item.imageUrl;
            });
        }
        const rows = table.querySelectorAll('tbody tr, tr');
        rows.forEach((row, index) => {
            if (row.querySelector('.killa-icon-cell')) return;
            const assetId = assetIds[index];
            if (!assetId) return;
            const td = document.createElement('td');
            td.className = 'killa-icon-cell';
            if (thumbMap[assetId]) {
                const img = document.createElement('img');
                img.src = thumbMap[assetId];
                img.alt = `Asset ${assetId}`;
                img.title = `Open asset ${assetId}`;
                img.addEventListener('click', () => {
                    window.open(`https://create.roblox.com/assets/${assetId}/configure`, '_blank');
                });
                td.appendChild(img);
            }
            row.insertBefore(td, row.firstChild);
        });
    } catch (err) {
        console.warn('[KILLA] Thumbnail fetch failed:', err);
    }
}

// ============================================
// DOM HELPERS
// ============================================

// The site's own primary control in the assets toolbar ("Upload assets").
// Anchoring next to it keeps the KILLA buttons in the toolbar on the new
// Creator Dashboard instead of drifting into whatever flex container the
// generic text search happens to find.
function findSiteUploadButton() {
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
        const text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (text === 'upload assets' || text === 'upload') return btn;
    }
    return null;
}

function findUploadButtonContainer() {
    const allButtons = document.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
        const text = (btn.textContent || '').toLowerCase().trim();
        if (text.includes('upload') || text.includes('create asset') || text.includes('browse')) {
            let parent = btn.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                const style = window.getComputedStyle(parent);
                if (style.display === 'flex' || style.display === 'inline-flex') return parent;
                parent = parent.parentElement;
            }
            return btn.parentElement;
        }
    }
    return null;
}

// ============================================
// UI INJECTION
// ============================================

function createKillaPanel() {
    const decal = isDecalTab();
    const root = document.createElement('div');
    root.className = 'killa-root';
    const btnRow = document.createElement('div');
    btnRow.className = 'killa-btn-row';
    const btnUpload = document.createElement('button');
    btnUpload.className = 'killa-btn';
    btnUpload.textContent = decal ? 'Upload Multiple Images' : 'Upload Multiple';
    btnUpload.title = decal ? 'Select up to 50 image files \u2014 Roblox\u2019s bulk uploader handles them' : 'Select up to 50 audio files \u2014 Roblox\u2019s bulk uploader handles them';
    const btnMass = document.createElement('button');
    btnMass.className = 'killa-btn killa-btn--secondary';
    btnMass.textContent = decal ? 'Mass Upload Images (Encoded)' : 'Mass Upload (Encoded)';
    btnMass.title = decal ? 'Select one image \u2014 generates unique copies and uploads them' : 'Select one audio (mp3/ogg/wav) \u2014 uploads copies with 0.1s trimmed off the end (0.1s, 0.2s, ...), plus a zip of the exact files';

    const btnCopyIds = document.createElement('button');
    btnCopyIds.className = 'killa-btn killa-btn--secondary';
    btnCopyIds.id = 'killa-copy-ids';
    btnCopyIds.dataset.baseLabel = 'Copy IDs';
    btnCopyIds.textContent = 'Copy IDs';
    btnCopyIds.title = 'Hold down on audio previews to select them, then copy their asset ids (one id alone, several as "id, id, id")';
    const btnClear = document.createElement('button');
    btnClear.className = 'killa-btn killa-btn--secondary killa-btn--hidden';
    btnClear.id = 'killa-clear-selection';
    btnClear.textContent = 'Clear';
    btnClear.title = 'Deselect every selected audio';
    btnRow.appendChild(btnUpload);
    btnRow.appendChild(btnMass);
    btnRow.appendChild(btnCopyIds);
    btnRow.appendChild(btnClear);
    root.appendChild(btnRow);
    const count = document.createElement('div');
    count.className = 'killa-upload-count';
    if (!decal) root.appendChild(count); // audio limit only; not shown on the images tab
    const status = document.createElement('div');
    status.className = 'killa-status';
    root.appendChild(status);
    const progress = document.createElement('div');
    progress.className = 'killa-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'killa-progress-bar-fill';
    progress.appendChild(progressFill);
    root.appendChild(progress);
    // Red diagnostic box + one-click copy, shown after any upload failure.
    const errorBox = document.createElement('div');
    errorBox.className = 'killa-error-box';
    errorBox.style.display = 'none';
    root.appendChild(errorBox);
    const btnCopyError = document.createElement('button');
    btnCopyError.className = 'killa-btn killa-btn--secondary killa-btn--hidden';
    btnCopyError.textContent = 'Copy Error';
    btnCopyError.title = 'Copies the full failure report (stage, url, status, server response) to the clipboard';
    root.appendChild(btnCopyError);

    root._countEl = count;
    root._statusEl = status;
    root._progressEl = progress;
    root._errorBox = errorBox;
    root._btnCopyError = btnCopyError;
    root._btnUpload = btnUpload;
    root._btnMass = btnMass;
    root._btnCopyIds = btnCopyIds;
    root._btnClear = btnClear;
    return root;
}

// Hidden file pickers, created once and reused. Re-creating them on every
// injection would stack up orphaned inputs (and their change listeners)
// whenever the SPA re-render knocks the panel out.
let hiddenInputs = null;
let activePanel = null;

function getHiddenInputs() {
    if (hiddenInputs) return hiddenInputs;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const encodeInput = document.createElement('input');
    encodeInput.type = 'file';
    encodeInput.style.display = 'none';
    document.body.appendChild(encodeInput);

    fileInput.addEventListener('change', onFilesPicked);
    encodeInput.addEventListener('change', onEncodePicked);

    // If the file dialog is closed without picking anything, Chrome returns
    // focus to the window: re-enable the buttons so the panel never sticks
    // in a disabled state (but never mid-upload).
    window.addEventListener('focus', () => {
        if (!activePanel || activePanel.busy) return;
        setTimeout(() => {
            if (!activePanel.busy) {
                activePanel.btnUpload.disabled = false;
                activePanel.btnMass.disabled = false;
            }
        }, 150);
    });

    hiddenInputs = { fileInput, encodeInput };
    return hiddenInputs;
}

// Small floating Copy/Clear bar for the user-inventory page (the dashboard
// panel is not injected there). Reuses the same element ids as the dashboard
// buttons, so refreshSelectionButtons/copySelectedIds/clearSelection work
// unchanged.
function injectInventorySelectionBar() {
    if (document.getElementById('killa-inventory-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'killa-inventory-bar';
    bar.className = 'killa-inventory-bar';
    const copy = document.createElement('button');
    copy.className = 'killa-btn killa-btn--secondary';
    copy.id = 'killa-copy-ids';
    copy.dataset.baseLabel = 'Copy IDs';
    copy.textContent = 'Copy IDs';
    copy.title = 'Hold down on audio items to select them, then copy their asset ids (one id alone, several as "id, id, id")';
    const clear = document.createElement('button');
    clear.className = 'killa-btn killa-btn--secondary killa-btn--hidden';
    clear.id = 'killa-clear-selection';
    clear.textContent = 'Clear';
    clear.title = 'Deselect every selected audio';
    bar.appendChild(copy);
    bar.appendChild(clear);
    document.body.appendChild(bar);
    copy.addEventListener('click', copySelectedIds);
    clear.addEventListener('click', clearSelection);
}

function injectUI() {
    if (injected) return;
    if (isInventoryPage()) return; // selection-only on the user inventory page
    if (!isValidTargetPage()) return;

    // Preferred anchor: right next to the site's "Upload assets" button so
    // the panel lives in the assets toolbar. Fall back to the generic flex
    // container, then to main. Never fall back to body - wait for the SPA
    // to render instead.
    const siteBtn = findSiteUploadButton();
    let target = siteBtn || findUploadButtonContainer();
    if (!target) target = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!target) {
        console.log('[KILLA] No suitable container yet, waiting...');
        return;
    }
    const anchorAfterButton = !!siteBtn;

    const killaRoot = createKillaPanel();
    const statusEl = killaRoot._statusEl;
    const progressEl = killaRoot._progressEl;
    const btnUpload = killaRoot._btnUpload;
    const btnMass = killaRoot._btnMass;
    const decal = isDecalTab();
    const acceptedExts = decal ? CONFIG.SUPPORTED_IMAGE_EXT : CONFIG.SUPPORTED_AUDIO_EXT;

    const { fileInput, encodeInput } = getHiddenInputs();
    fileInput.accept = acceptedExts.join(',');
    fileInput.multiple = true;
    encodeInput.accept = decal ? '.png,.jpg,.jpeg' : '.mp3,.ogg,.wav';

    // The hidden inputs are created once and reused across re-injections, so
    // the panel they talk to is tracked here rather than closed over. The
    // window focus listener is likewise bound once (see getHiddenInputs).
    activePanel = {
        statusEl, progressEl, btnUpload, btnMass, decal, encodeInput,
        errorBox: killaRoot._errorBox, btnCopyError: killaRoot._btnCopyError,
        // The count line lives on killaRoot; refresh/hide calls receive
        // activePanel, so it must see the same element or they no-op.
        _countEl: killaRoot._countEl,
    };

    btnUpload.addEventListener('click', () => fileInput.click());
    btnMass.addEventListener('click', async () => {
        const maxCount = decal ? CONFIG.MAX_DECAL_COUNT : CONFIG.MAX_AUDIO_COUNT;
        const defaultCount = decal ? CONFIG.DEFAULT_DECAL_COUNT : CONFIG.DEFAULT_AUDIO_COUNT;
        const count = await showCountDialog(maxCount, defaultCount, decal ? 'Mass Image Upload' : 'Mass Audio Upload', `How many copies? (1-${maxCount})`);
        if (count === null) return;
        encodeInput._killaCount = count;
        encodeInput.click();
    });
    killaRoot._btnCopyIds.addEventListener('click', copySelectedIds);
    killaRoot._btnClear.addEventListener('click', clearSelection);
    killaRoot._btnCopyError.addEventListener('click', copyErrorReport);
    if (lastUploadError.stage) renderErrorBox(killaRoot);
    refreshSelectionButtons();
    refreshUploadCount(killaRoot);

    // Keep the "used · left" line honest even if this tab stays open across
    // the daily reset — otherwise yesterday's number lingers in the DOM.
    lastCountRoot = killaRoot;
    if (!uploadCountTicker) {
        uploadCountTicker = setInterval(() => {
            if (lastCountRoot && document.visibilityState === 'visible' && !(activePanel && activePanel.busy)) {
                refreshUploadCount(lastCountRoot);
                if (Date.now() - lastQuotaSyncMs > 60000) {
                    lastQuotaSyncMs = Date.now();
                    void syncServerQuota();
                }
            }
        }, 10000);
    }
    if (!uploadCountVisBound) {
        uploadCountVisBound = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && lastCountRoot && !(activePanel && activePanel.busy)) {
                refreshUploadCount(lastCountRoot);
            }
        });
    }

    if (anchorAfterButton) {
        target.insertAdjacentElement('afterend', killaRoot);
    } else {
        target.prepend(killaRoot);
    }
    injected = true;
    console.log('[KILLA] Injected on', getActiveTab(), 'tab');
    injectIconColumn();
}
// ============================================
// ASSET WATCHDOG
// ============================================
// Runs while a dashboard tab is open: lists every asset of the watched
// owners (the group + optionally the user's own), reads each asset's
// moderation status, and archives anything Roblox marked "Moderated" using
// the Open Cloud archive API (x-api-key). It keeps a local log of everything
// it did or noticed. Accepted assets are NEVER touched: archiving is the
// only write this code performs, it fires only on the exact 'Moderated'
// status, and archived assets can always be brought back with Roblox's
// restore endpoint.
//
// Endpoints (the same ones the dashboard SPA uses):
//   GET  creator-inventory-api/v1/creations/get-assets?assetType=&isArchived=
//        &groupId=&limit=100&cursor=   (browser cookie auth)
//   POST creator-inventory-api/v1/creations/get-asset-details {AssetIds:[]}
//        -> [{assetId, name, status, isArchived, assetType, ...}]
//   POST assets/v1/assets/{id}:archive                (API key REQUIRED)
// status enum: Unknown, ReviewPending, Moderated, ReviewApproved, OnSale,
//              OffSale, DelayedRelease, Free

const WATCH_CFG_KEY = 'killaWatchCfg';
const WATCH_STATE_KEY = 'killaWatchState';
const WATCH_LOG_MAX = 300;
const WATCH_SEEN_MAX = 6000;      // max tracked asset ids across all buckets
const WATCH_LIST_URL = 'https://itemconfiguration.roblox.com/v1/creations/get-assets';
const WATCH_DETAILS_URL = 'https://itemconfiguration.roblox.com/v1/creations/get-asset-details';
// itemconfiguration accepts the type by name or numeric id (3=Audio, 10=Model,
// 13=Decal, 38=Plugin, 40=MeshPart, 62=Video); whichever works is remembered.
const WATCH_TYPE_IDS = { Audio: '3', Decal: '13', Model: '10', Plugin: '38', MeshPart: '40', Video: '62' };

let watchCfg = null;
let watchState = null;
let watchUi = null;
let watchInFlight = false;
let watchTimerId = null;
let watchSaveTimer = null;

function watchDefaultCfg() {
    return {
        enabled: true,       // on by default; it only logs until keys are set
        autoArchive: true,   // archive assets whose status is exactly Moderated
        pollMin: 5,
        groupId: '',
        groupKey: '',
        userKey: '',
        watchUser: true,     // also watch the user's own (non-group) uploads
        types: 'Audio,Decal,Model,MeshPart,Video',
        typeFmt: {},         // per type: 'name' | 'id' once probed
    };
}

function watchDefaultState() {
    return { lastRun: 0, seen: {}, log: [] };
}

function watchGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, (res) => resolve(res || {})));
}
function watchSet(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, () => resolve(!chrome.runtime.lastError)));
}

async function bootWatchdog() {
    try {
        const res = await watchGet([WATCH_CFG_KEY, WATCH_STATE_KEY]);
        watchCfg = Object.assign(watchDefaultCfg(), res[WATCH_CFG_KEY] || {});
        watchCfg.types = String(watchCfg.types || '').split(',').map((s) => s.trim())
            .filter((s) => s && WATCH_TYPE_IDS[s]).join(',') || 'Audio';
        watchCfg.typeFmt = watchCfg.typeFmt || {};
        watchState = Object.assign(watchDefaultState(), res[WATCH_STATE_KEY] || {});
        watchState.seen = watchState.seen || {};
        watchState.log = watchState.log || [];
        armWatchTimer();
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            // Nudge from the service worker alarm: run a check if one is due.
            if (message && message.type === 'watchTick') {
                if (message.trigger === 'manual') {
                    // Explicit "Check now" (float UI) runs even when the
                    // watchdog is toggled off — the user asked for it.
                    runWatchCheck('manual');
                } else if (watchCfg.enabled) {
                    runWatchCheck('alarm');
                }
                sendResponse({ ok: true });
                return;
            }
            // Extension icon clicked: toggle the floating watchdog dropdown.
            if (message && message.type === 'killaDropdownToggle') {
                toggleWatchFloat();
                sendResponse({ ok: true });
                return;
            }
            // The Settings form edits/clears watchdog state in chrome.storage.local; the
            // content script caches cfg+state in memory, so pull the new values.
            if (message && message.type === 'watchCfgUpdated') {
                watchGet([WATCH_CFG_KEY, WATCH_STATE_KEY]).then((res) => {
                    watchCfg = Object.assign(watchDefaultCfg(), res[WATCH_CFG_KEY] || {});
                    watchCfg.types = String(watchCfg.types || '').split(',').map((s) => s.trim())
                        .filter((s) => s && WATCH_TYPE_IDS[s]).join(',') || 'Audio';
                    watchCfg.typeFmt = watchCfg.typeFmt || {};
                    watchState = Object.assign(watchDefaultState(), res[WATCH_STATE_KEY] || {});
                    watchState.seen = watchState.seen || {};
                    watchState.log = watchState.log || [];
                    armWatchTimer();
                    sendResponse({ ok: true });
                });
                return true;
            }
        });
        buildWatchFloatUi();
        runWatchCheck('boot');
    } catch (err) {
        console.warn('[KILLA] Watchdog boot failed:', err);
    }
}

function armWatchTimer() {
    if (watchTimerId) clearInterval(watchTimerId);
    const ms = Math.max(1, Number(watchCfg.pollMin) || 5) * 60000;
    watchTimerId = setInterval(() => {
        if (watchCfg && watchCfg.enabled) runWatchCheck('timer');
    }, ms);
}

async function watchSaveCfg() {
    if (!watchCfg) return;
    await watchSet(watchStateKeyed(WATCH_CFG_KEY, watchCfg));
}
async function watchSaveState() {
    if (!watchState) return;
    pruneWatchSeen();
    await watchSet(watchStateKeyed(WATCH_STATE_KEY, watchState));
}
function watchStateKeyed(key, value) {
    const o = {};
    o[key] = value;
    return o;
}
function watchSaveStateSoon() {
    if (watchSaveTimer) return;
    watchSaveTimer = setTimeout(() => {
        watchSaveTimer = null;
        watchSaveState();
    }, 500);
}

function pruneWatchSeen() {
    let total = 0;
    for (const b of Object.keys(watchState.seen)) total += Object.keys(watchState.seen[b]).length;
    if (total <= WATCH_SEEN_MAX) return;
    // Drop the oldest ids (by last-seen) until under the cap.
    const all = [];
    for (const b of Object.keys(watchState.seen)) {
        for (const id of Object.keys(watchState.seen[b])) {
            all.push({ b: b, id: id, ts: watchState.seen[b][id].ts || 0 });
        }
    }
    all.sort((a, z) => a.ts - z.ts);
    const drop = new Set(all.slice(0, total - WATCH_SEEN_MAX).map((x) => x.b + '|' + x.id));
    for (const key of drop) {
        const b = key.slice(0, key.indexOf('|'));
        const id = key.slice(key.indexOf('|') + 1);
        delete watchState.seen[b][id];
    }
}

function watchLogAdd(entry) {
    const e = Object.assign({ ts: Date.now(), action: 'info', name: '', id: '', detail: '' }, entry);
    const log = watchState.log;
    // Suppress exact repeats of the same id+action inside 6h (status changes
    // re-arm it), so a stuck asset can't flood the log on every poll.
    for (let i = log.length - 1; i >= 0 && i >= log.length - 20; i--) {
        const o = log[i];
        if (o.action === e.action && o.id === e.id && e.ts - o.ts < 6 * 3600000) return;
    }
    log.push(e);
    if (log.length > WATCH_LOG_MAX) log.splice(0, log.length - WATCH_LOG_MAX);
}

function watchParseApiError(res) {
    try {
        const j = JSON.parse(res.body);
        if (j && Array.isArray(j.errors) && j.errors.length) {
            const msgs = j.errors.map((e) => e.message || ('code ' + e.code)).filter(Boolean).join('; ');
            return 'HTTP ' + res.status + ' \u2014 ' + msgs;
        }
    } catch (_) { /* not JSON */ }
    return null;
}

// ---------------------------------------------------------------
// Owner list: the group (by id) and optionally the user's own assets.
// ---------------------------------------------------------------
function watchOwners() {
    const owners = [];
    const gid = String(watchCfg.groupId || '').trim();
    if (gid && /^\d+$/.test(gid)) {
        owners.push({ key: 'g' + gid, groupId: gid, ownerKey: watchCfg.groupKey || '' });
    }
    if (watchCfg.watchUser) {
        owners.push({ key: 'user', groupId: '', ownerKey: watchCfg.userKey || '' });
    }
    return owners;
}

// List one owner+type (paginated, 100/page). `wantArchived` selects the
// archived shelf. Returns {items:[{id,name}], error, invalidType}.
async function watchFetchList(owner, type, fmt, wantArchived) {
    const t = fmt === 'id' ? (WATCH_TYPE_IDS[type] || type) : type;
    let cursor = null;
    const items = [];
    for (let page = 0; page < 50; page++) {
        let url = WATCH_LIST_URL +
            '?assetType=' + encodeURIComponent(t) +
            '&isArchived=' + (wantArchived ? 'true' : 'false') +
            '&limit=100';
        if (owner.groupId) url += '&groupId=' + encodeURIComponent(owner.groupId);
        if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
        const res = await robloxFetch({ url: url, method: 'GET', credentials: 'include' });
        if (!res.ok) {
            return { items: null, error: watchParseApiError(res) || ('HTTP ' + res.status), invalidType: res.status === 400 };
        }
        let j;
        try { j = JSON.parse(res.body); } catch (_) { return { items: null, error: 'get-assets returned invalid JSON' }; }
        const data = Array.isArray(j.data) ? j.data : [];
        for (const it of data) {
            if (it && it.assetId !== undefined && it.assetId !== null) {
                items.push({ id: String(it.assetId), name: it.name || '' });
            }
        }
        cursor = j.nextPageCursor || null;
        if (!cursor) break;
    }
    return { items: items, error: null };
}

// Batch moderation status for a list of ids. Chunks of 50; halves on
// "too many asset ids" (HTTP 414) per the API's documented error.
async function watchFetchDetails(ids) {
    const map = {};
    let chunk = 50;
    let i = 0;
    let token = null;
    try { token = await getCSRFToken(); } catch (_) { token = null; }
    while (i < ids.length) {
        const slice = ids.slice(i, i + chunk);
        const post = (tok) => robloxFetch({
            url: WATCH_DETAILS_URL,
            method: 'POST',
            credentials: 'include',
            headers: tok ? { 'X-Csrf-Token': tok } : {},
            bodyJson: { AssetIds: slice.map(Number) },
        });
        let res = await post(token);
        if (!res.ok && /xsrf/i.test(watchParseApiError(res) || '')) {
            // The details endpoint requires a CSRF token; ours may be stale —
            // refresh it once and retry the same slice.
            csrfTokenCache = null;
            try { token = await getCSRFToken(); } catch (_) { token = null; }
            if (token) res = await post(token);
        }
        if (!res.ok) {
            const msg = watchParseApiError(res) || ('HTTP ' + res.status);
            if ((res.status === 414 || res.status === 400) && /too many/i.test(msg) && chunk > 5) {
                chunk = Math.floor(chunk / 2);
                continue;
            }
            return { map: map, error: msg };
        }
        let arr;
        try { arr = JSON.parse(res.body); } catch (_) { return { map: map, error: 'get-asset-details returned invalid JSON' }; }
        if (Array.isArray(arr)) {
            for (const d of arr) {
                if (d && d.assetId !== undefined && d.assetId !== null) map[String(d.assetId)] = d;
            }
        }
        i += slice.length;
    }
    return { map: map, error: null };
}

// Archive via Open Cloud. Requires an API key with asset:read + asset:write
// (cookie-only requests are rejected by this endpoint).
async function watchArchive(id, apiKey) {
    const res = await robloxFetch({
        url: 'https://apis.roblox.com/assets/v1/assets/' + id + ':archive',
        method: 'POST',
        credentials: 'include',
        headers: { 'x-api-key': apiKey },
    });
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, error: watchParseApiError(res) || ('HTTP ' + res.status) };
}

async function runWatchCheck(trigger) {
    if (!watchCfg || !watchState || watchInFlight) return;
    const now = Date.now();
    const minMs = Math.max(1, Number(watchCfg.pollMin) || 5) * 60000;
    if (trigger !== 'manual' && now - (watchState.lastRun || 0) < minMs) return;
    watchInFlight = true;
    const body = async () => {
        try {
            await watchRunAll();
        } catch (err) {
            console.warn('[KILLA] Watchdog run failed:', err);
            watchLogAdd({ action: 'error', name: 'Check failed', detail: String((err && err.message) || err) });
        } finally {
            watchInFlight = false;
            watchState.lastRun = Date.now();
            await watchSaveState();
            watchRefreshUi();
        }
    };
    if (navigator.locks && navigator.locks.request) {
        // One check at a time across every open dashboard tab.
        navigator.locks.request('killa-watchdog', { ifAvailable: true }, async (lock) => {
            if (!lock) { watchInFlight = false; return; }
            await body();
        });
    } else {
        await body();
    }
}

async function watchRunAll() {
    const owners = watchOwners();
    if (!owners.length) return;
    const types = String(watchCfg.types).split(',').map((s) => s.trim()).filter(Boolean);
    for (const owner of owners) {
        for (const type of types) {
            await watchCheckOwnerType(owner, type);
        }
    }
}

// Full check for one owner+type: diff the fresh lists against the tracked
// state, archive Moderated assets, log everything notable.
async function watchCheckOwnerType(owner, type) {
    const bucketKey = owner.key + '|' + type;
    const prev = watchState.seen[bucketKey] || {};
    let fmt = watchCfg.typeFmt[type] || 'name';
    const loadList = async (wantArchived) => {
        let r = await watchFetchList(owner, type, fmt, wantArchived);
        if (r.error && r.invalidType) {
            const alt = fmt === 'name' ? 'id' : 'name';
            const r2 = await watchFetchList(owner, type, alt, wantArchived);
            if (!r2.error) {
                fmt = alt;
                watchCfg.typeFmt[type] = alt;
                await watchSaveCfg();
            }
            return r2;
        }
        return r;
    };

    const un = await loadList(false);
    if (un.error) {
        // A failed read must never look like "everything vanished".
        watchLogAdd({ action: 'listerror', name: type + ' list failed', id: owner.key, detail: un.error });
        return;
    }
    const ar = await loadList(true);
    const fresh = un.items.slice();
    const archIds = {};
    if (!ar.error) {
        for (const it of ar.items) { archIds[it.id] = true; fresh.push(it); }
    }

    // Moderation status comes from the details batch (only needed for assets
    // that are not already archived).
    const needDetails = fresh.filter((it) => !archIds[it.id]).map((it) => it.id);
    let details = {};
    if (needDetails.length) {
        const d = await watchFetchDetails(needDetails);
        details = d.map;
        if (d.error) watchLogAdd({ action: 'detailserror', name: type + ' details failed', id: owner.key, detail: d.error });
    }

    const now = Date.now();
    const freshIds = {};
    for (const it of fresh) freshIds[it.id] = true;
    const next = {};
    const events = [];

    for (const it of fresh) {
        const det = details[it.id] || null;
        const isArchived = (det && det.isArchived) || !!archIds[it.id];
        const name = (det && det.name) || it.name || (prev[it.id] ? prev[it.id].n : '') || '';
        const status = isArchived ? 'Archived' : (det && det.status) || 'Listed';
        next[it.id] = { n: name, s: status, ts: now };
        const prevS = prev[it.id] ? prev[it.id].s : null;
        if (isArchived) continue; // already archived -> keep tracking, never touch again

        if (status === 'Moderated') {
            if (!watchCfg.autoArchive) {
                if (prevS !== 'Moderated') events.push({ action: 'moderated', id: it.id, name: name, detail: 'Roblox marked it Moderated (auto-archive is off)' });
            } else if (!owner.ownerKey) {
                if (prevS !== 'Moderated') events.push({ action: 'nokey', id: it.id, name: name, detail: 'Moderated \u2014 add the API key for this owner in Watchdog settings' });
            } else {
                watchRefreshUi('Archiving "' + (name || it.id) + '"...');
                const r = await watchArchive(it.id, owner.ownerKey);
                if (r.ok) {
                    events.push({ action: 'archived', id: it.id, name: name, detail: 'Roblox status was Moderated' });
                    next[it.id].s = 'Archived';
                } else {
                    events.push({ action: 'archivefail', id: it.id, name: name, detail: r.error + (r.status ? ' (HTTP ' + r.status + ')' : '') });
                }
            }
        } else if (status === 'ReviewPending' && prevS !== 'ReviewPending') {
            events.push({ action: 'review', id: it.id, name: name, detail: 'Under review by Roblox' });
        } else if (prevS && prevS !== status && prevS !== 'Listed' && status !== 'Listed') {
            events.push({ action: 'status', id: it.id, name: name, detail: prevS + ' \u2192 ' + status });
        }
    }

    // Tracked ids that vanished from BOTH shelves were deleted or removed.
    for (const id of Object.keys(prev)) {
        if (freshIds[id]) continue;
        const was = prev[id];
        if (now - (was.ts || 0) > 30 * 86400000) continue; // long gone: forget quietly
        events.push({ action: 'missing', id: id, name: was.n, detail: 'Left the ' + type + ' list (deleted or removed by Roblox)' });
    }

    watchState.seen[bucketKey] = next;
    for (const ev of events) watchLogAdd(ev);
    if (events.length) watchSaveStateSoon();
    watchRefreshUi();
}

// ---------------------------------------------------------------
// Watchdog UI — floating dropdown (opened from the extension icon)
// ---------------------------------------------------------------
function watchRefreshUi(working) {
    if (!watchUi || !watchCfg || !watchState || !watchUi.root || !watchUi.root.isConnected) return;
    const cfg = watchCfg, st = watchState;
    watchUi.btnToggle.textContent = cfg.enabled ? 'Watchdog: ON' : 'Watchdog: OFF';
    watchUi.btnToggle.classList.toggle('killa-watch-on', !!cfg.enabled);
    let tracked = 0, archived = 0, missing = 0;
    for (const b of Object.keys(st.seen)) tracked += Object.keys(st.seen[b]).length;
    for (const ev of st.log) {
        if (ev.action === 'archived') archived++;
        if (ev.action === 'missing') missing++;
    }
    const mins = st.lastRun ? Math.round((Date.now() - st.lastRun) / 60000) : null;
    const last = mins === null ? 'never' : (mins <= 0 ? 'just now' : mins + 'm ago');
    watchUi.line.textContent = working ||
        (cfg.enabled
            ? 'Last check ' + last + ' \u00b7 ' + tracked + ' tracked \u00b7 ' + archived + ' archived \u00b7 ' + missing + ' missing'
            : 'Watchdog is off');
    const rows = st.log.slice(-10).reverse().map((ev) => {
        const d = new Date(ev.ts);
        const time = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        return time + ' \u00b7 ' + (ev.name || ev.id || '?') + ' \u00b7 ' + ev.action + (ev.detail ? ' \u00b7 ' + ev.detail : '');
    });
    watchUi.logEl.textContent = rows.length ? rows.join('\n') : 'No events yet.';
}

function buildWatchFloatUi() {
    if (watchUi && watchUi.root && watchUi.root.isConnected) return;
    const root = document.createElement('div');
    root.className = 'killa-watch-float';

    const head = document.createElement('div');
    head.className = 'killa-watch-float-head';
    const title = document.createElement('span');
    title.className = 'killa-watch-float-title';
    title.textContent = 'KILLA \u2014 Asset Watchdog v' + EXT_VERSION;
    const btnClose = document.createElement('button');
    btnClose.className = 'killa-watch-float-close';
    btnClose.textContent = '\u00d7';
    btnClose.title = 'Close';
    head.appendChild(title);
    head.appendChild(btnClose);
    root.appendChild(head);

    const btns = document.createElement('div');
    btns.className = 'killa-watch-head';
    const btnToggle = document.createElement('button');
    btnToggle.className = 'killa-btn killa-btn--secondary';
    btnToggle.title = 'Watch your group (and optionally your own) uploads: archives anything Roblox moderates and logs deletions. Accepted assets are never touched.';
    const btnNow = document.createElement('button');
    btnNow.className = 'killa-btn killa-btn--secondary';
    btnNow.textContent = 'Check now';
    btnNow.title = 'Run an asset check immediately';
    const btnCfg = document.createElement('button');
    btnCfg.className = 'killa-btn killa-btn--secondary';
    btnCfg.textContent = 'Settings';
    btns.appendChild(btnToggle);
    btns.appendChild(btnNow);
    btns.appendChild(btnCfg);
    root.appendChild(btns);

    const line = document.createElement('div');
    line.className = 'killa-status killa-watch-line';
    root.appendChild(line);

    // --- settings panel (hidden until Settings is clicked) ---
    const settings = document.createElement('div');
    settings.className = 'killa-watch-settings';
    settings.style.display = 'none';
    const mkField = (labelText, input) => {
        const row = document.createElement('label');
        row.className = 'killa-watch-row';
        const span = document.createElement('span');
        span.textContent = labelText;
        row.appendChild(span);
        row.appendChild(input);
        return row;
    };
    const inGroup = document.createElement('input');
    inGroup.type = 'text';
    inGroup.placeholder = 'e.g. 101224973';
    inGroup.title = 'The group whose assets should be watched (the number in roblox.com/groups/ID/...)';
    const inGroupKey = document.createElement('input');
    inGroupKey.type = 'password';
    inGroupKey.placeholder = 'Open Cloud API key with asset:read + asset:write';
    inGroupKey.title = 'Used to archive moderated group assets. Stored only in this browser (chrome.storage.local).';
    const inUserKey = document.createElement('input');
    inUserKey.type = 'password';
    inUserKey.placeholder = 'Optional: API key for your own uploads';
    inUserKey.title = 'Only needed if you want moderated personal assets archived too.';
    const inPoll = document.createElement('input');
    inPoll.type = 'number';
    inPoll.min = '1';
    inPoll.max = '60';
    inPoll.title = 'Minutes between checks';
    const inTypes = document.createElement('input');
    inTypes.type = 'text';
    inTypes.title = 'Asset types to watch (Audio, Decal, Model, MeshPart, Video, Plugin)';
    const chkAuto = document.createElement('input');
    chkAuto.type = 'checkbox';
    chkAuto.title = 'Archive assets as soon as Roblox marks them Moderated';
    const chkUser = document.createElement('input');
    chkUser.type = 'checkbox';
    chkUser.title = 'Also watch assets uploaded to your own account (not the group)';
    settings.appendChild(mkField('Group ID', inGroup));
    settings.appendChild(mkField('Group API key', inGroupKey));
    settings.appendChild(mkField('User API key (optional)', inUserKey));
    settings.appendChild(mkField('Check every (min)', inPoll));
    settings.appendChild(mkField('Types', inTypes));
    const mkCheck = (labelText, input) => {
        const row = document.createElement('label');
        row.className = 'killa-watch-row killa-watch-check';
        row.appendChild(input);
        const span = document.createElement('span');
        span.textContent = labelText;
        row.appendChild(span);
        return row;
    };
    settings.appendChild(mkCheck('Auto-archive moderated assets', chkAuto));
    settings.appendChild(mkCheck('Also watch my own uploads', chkUser));
    const btnHelp = document.createElement('div');
    btnHelp.className = 'killa-watch-hint';
    btnHelp.textContent = 'Create a key: Creator Dashboard \u2192 Credentials \u2192 API Keys \u2192 Create API Key \u2192 select the Assets API system + asset:read and asset:write scopes \u2192 Save & Generate. The key is shown once \u2014 paste it above. Stored locally only.';
    settings.appendChild(btnHelp);
    const btnSave = document.createElement('button');
    btnSave.className = 'killa-btn';
    btnSave.textContent = 'Save settings';
    settings.appendChild(btnSave);
    root.appendChild(settings);

    // --- event log ---
    const logEl = document.createElement('div');
    logEl.className = 'killa-watch-log';
    root.appendChild(logEl);
    const logBtns = document.createElement('div');
    logBtns.className = 'killa-watch-head';
    const btnCopyLog = document.createElement('button');
    btnCopyLog.className = 'killa-btn killa-btn--secondary';
    btnCopyLog.textContent = 'Copy log';
    const btnClearLog = document.createElement('button');
    btnClearLog.className = 'killa-btn killa-btn--secondary';
    btnClearLog.textContent = 'Clear log';
    logBtns.appendChild(btnCopyLog);
    logBtns.appendChild(btnClearLog);
    root.appendChild(logBtns);

    document.body.appendChild(root);
    watchUi = { root: root, btnToggle: btnToggle, btnNow: btnNow, btnCfg: btnCfg, line: line, settings: settings, logEl: logEl };

    const fillFields = () => {
        inGroup.value = watchCfg.groupId || '';
        inGroupKey.value = watchCfg.groupKey || '';
        inUserKey.value = watchCfg.userKey || '';
        inPoll.value = String(watchCfg.pollMin || 5);
        inTypes.value = watchCfg.types || 'Audio';
        chkAuto.checked = !!watchCfg.autoArchive;
        chkUser.checked = !!watchCfg.watchUser;
    };
    fillFields();

    btnClose.addEventListener('click', hideWatchFloat);
    btnToggle.addEventListener('click', async () => {
        watchCfg.enabled = !watchCfg.enabled;
        await watchSaveCfg();
        armWatchTimer();
        watchRefreshUi();
        if (watchCfg.enabled) runWatchCheck('toggle');
    });
    btnNow.addEventListener('click', () => runWatchCheck('manual'));
    btnCfg.addEventListener('click', () => {
        const show = settings.style.display === 'none';
        settings.style.display = show ? '' : 'none';
        if (show) fillFields();
    });
    btnSave.addEventListener('click', async () => {
        const gid = String(inGroup.value || '').trim();
        watchCfg.groupId = /^\d+$/.test(gid) ? gid : '';
        watchCfg.groupKey = String(inGroupKey.value || '').trim();
        watchCfg.userKey = String(inUserKey.value || '').trim();
        watchCfg.pollMin = Math.min(60, Math.max(1, parseInt(inPoll.value, 10) || 5));
        watchCfg.types = String(inTypes.value || '').split(',').map((s) => s.trim())
            .filter((s) => s && WATCH_TYPE_IDS[s]).join(',') || 'Audio';
        watchCfg.autoArchive = chkAuto.checked;
        watchCfg.watchUser = chkUser.checked;
        await watchSaveCfg();
        armWatchTimer();
        const old = btnSave.textContent;
        btnSave.textContent = 'Saved \u2713';
        setTimeout(() => { btnSave.textContent = old; }, 1200);
        watchRefreshUi();
        if (watchCfg.enabled) runWatchCheck('save');
    });
    btnCopyLog.addEventListener('click', async () => {
        const text = JSON.stringify({ cfg: { groupId: watchCfg.groupId, types: watchCfg.types, pollMin: watchCfg.pollMin, autoArchive: watchCfg.autoArchive }, log: watchState.log }, null, 2);
        try { await navigator.clipboard.writeText(text); btnCopyLog.textContent = 'Copied \u2713'; } catch (_) { btnCopyLog.textContent = 'Copy failed'; }
        setTimeout(() => { btnCopyLog.textContent = 'Copy log'; }, 1200);
    });
    btnClearLog.addEventListener('click', async () => {
        watchState.log = [];
        await watchSaveState();
        watchRefreshUi();
    });

    // Clicking anywhere else on the page (or pressing Escape) closes it.
    document.addEventListener('mousedown', (e) => {
        if (!watchUi.root.classList.contains('open')) return;
        if (!watchUi.root.contains(e.target)) hideWatchFloat();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideWatchFloat();
    });

    watchRefreshUi();
}

function showWatchFloat() {
    if (!watchUi) buildWatchFloatUi();
    if (!watchUi) return;
    watchUi.root.classList.add('open');
    watchRefreshUi();
}
function hideWatchFloat() {
    if (watchUi) watchUi.root.classList.remove('open');
}
function toggleWatchFloat() {
    if (!watchUi) buildWatchFloatUi();
    if (!watchUi) return;
    if (watchUi.root.classList.contains('open')) hideWatchFloat();
    else showWatchFloat();
}



// ============================================
// PICKER HANDLERS (bound once, in getHiddenInputs)
// ============================================

function onFilesPicked(e) {
    const panel = activePanel;
    const files = Array.from(e.target.files);
    e.target.value = ''; // allow re-picking the same file later
    if (!panel || files.length === 0) return;
    cancelPendingRefresh(); // a new run overrides any pending auto-reload
    panel.btnUpload.disabled = true;
    panel.btnMass.disabled = true;
    panel.busy = true;
    hideUploadCount(panel); // keep it out of the way of the progress bar
    setStatus(panel.statusEl, `Uploading ${files.length} files...`, 'working');
    uploadFiles(files, panel.statusEl, panel.progressEl).finally(() => {
        panel.busy = false;
        panel.btnUpload.disabled = false;
        panel.btnMass.disabled = false;
        refreshUploadCount(panel);
    });
}

function onEncodePicked(e) {
    const panel = activePanel;
    const file = e.target.files[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!panel || !file) return;
    cancelPendingRefresh(); // a new run overrides any pending auto-reload
    const count = panel.encodeInput._killaCount ||
        (panel.decal ? CONFIG.DEFAULT_DECAL_COUNT : CONFIG.DEFAULT_AUDIO_COUNT);
    panel.btnUpload.disabled = true;
    panel.btnMass.disabled = true;
    panel.busy = true;
    hideUploadCount(panel); // keep it out of the way of the progress bar

    // Copy generation is an async generator, so each copy is created,
    // uploaded and released one at a time instead of holding all
    // `count` copies in memory at once.
    const label = panel.decal ? 'images' : 'audio files';
    setStatus(panel.statusEl, `Uploading ${count} encoded ${label}...`, 'working');

    // The exact locally-modified files are captured as they are generated,
    // then packaged into a zip and downloaded after the last upload. Each
    // copy is re-wrapped as a Blob (Chrome spills large ones to disk), so
    // the zip does not keep every copy's bytes live in the JS heap.
    const zipEntries = [];
    const hooks = panel.decal ? null : {
        onFile: async (copy) => {
            const bytes = new Uint8Array(await copy.arrayBuffer());
            zipEntries.push({
                name: copy.name,
                size: bytes.length,
                crc: zipCrc32(bytes),
                blob: new Blob([bytes], { type: copy.type || 'application/octet-stream' }),
            });
            bytes.fill(0); // release the working copy promptly
        },
        onComplete: (ok, failed) => encodeZipFinish(panel, file.name, zipEntries, ok, failed),
    };

    const copies = panel.decal ? encodedImageCopies(file, count) : encodedAudioCopies(file, count);
    uploadFiles(copies, panel.statusEl, panel.progressEl, count, hooks).catch((err) => {
        setStatus(panel.statusEl, `Encoding error: ${err.message}`, 'error');
        console.error('[KILLA] Encoding error:', err);
    }).finally(() => {
        panel.busy = false;
        panel.btnUpload.disabled = false;
        panel.btnMass.disabled = false;
        refreshUploadCount(panel);
    });
}

// Shared zip finisher for the direct (non-site) encoded paths: only deliver
// the zip when every requested file made it.
function encodeZipFinish(panel, sourceName, zipEntries, ok, failed) {
    if (failed > 0) {
        const reason = lastUploadError.message || (lastUploadError.body || '').slice(0, 80) || 'see the red box';
        setStatus(panel.statusEl, `${ok} uploaded, ${failed} failed \u2014 ${lastUploadError.stage || 'reason in red box'}: ${reason}`, 'error');
        showToast(`${failed} upload(s) failed \u2014 no zip downloaded. Press Copy Error and paste it to me`, 'error');
        return;
    }
    if (!zipEntries.length) return;
    const base = sourceName.replace(/\.[^.]+$/, '') || 'audio';
    setStatus(panel.statusEl, `Packing ${zipEntries.length} uploaded files into a zip...`, 'working');
    try {
        const zip = buildZipBlob(zipEntries);
        downloadBlob(zip, `KILLA-encoded-audio-${base}-${zipEntries.length}.zip`);
        showToast(`Downloading zip of ${zipEntries.length} exact uploaded files`, 'success');
        setStatus(panel.statusEl, `\u2713 ${zipEntries.length} files uploaded \u2014 zip downloaded`, 'success');
        refreshSoon(panel, 5);
    } catch (err) {
        console.error('[KILLA] Zip build failed:', err);
        setStatus(panel.statusEl, `Uploads done, but the zip failed: ${err.message}`, 'error');
        refreshSoon(panel, 5); // still reload so the uploaded assets appear
    }
}

// ============================================
// INITIALIZATION
// ============================================

function initKILLA() {
    if (isInventoryPage()) {
        console.log('[KILLA] build v' + EXT_VERSION + ' loaded \u2014 inventory selection active');
        startSelectionSystem();
        if (isInventoryAudioTab()) injectInventorySelectionBar();
        // The inventory is an AngularJS hash router: entering #!/audio shows
        // the bar, leaving it hides it and drops any in-progress selection.
        window.addEventListener('hashchange', () => {
            const active = isInventoryAudioTab();
            const bar = document.getElementById('killa-inventory-bar');
            if (active) {
                if (!bar) injectInventorySelectionBar();
                else bar.style.display = '';
            } else if (bar) {
                bar.style.display = 'none';
                if (selectedIds.size) clearSelection();
            }
        });
        return;
    }
    console.log('[KILLA] build v' + EXT_VERSION + ' loaded \u2014 upload counter active');
    // Try immediately - if URL is right, inject right away into body if needed
    injectUI();
    startSelectionSystem();
    installMainWorldUploadHook(); // count the site's own upload button too
    void syncServerQuota(); // seed used/left from the server's daily quota

    // Fast polling every 100ms for 5 seconds to catch SPA render
    if (!injected) {
        let attempts = 0;
        const fastPoll = setInterval(() => {
            injectUI();
            if (injected || ++attempts > 50) clearInterval(fastPoll);
        }, 100);
    }

    // Also observe DOM for slower renders
    const domObserver = new MutationObserver(() => {
        if (injected) { domObserver.disconnect(); return; }
        injectUI();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => domObserver.disconnect(), 10000);

    // Watch for SPA tab switches
    let lastUrl = location.href;
    const navObserver = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            const oldRoot = document.querySelector('.killa-root');
            if (oldRoot) oldRoot.remove();
            injected = false;
            setTimeout(() => injectUI(), 200);
        }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });

    // The dashboard can re-render the toolbar at any time and drop the
    // injected panel with it. Re-inject if the panel disappears while the
    // URL still points at an assets tab.
    setInterval(() => {
        if (!isValidTargetPage()) return;
        if (document.querySelector('.killa-root')) return;
        injected = false;
        injectUI();
    }, 2000);

    if (cookie) joinGroup();

    // Asset watchdog: loads cfg/state, arms the poll timer, first check.
    bootWatchdog();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKILLA);
} else {
    initKILLA();
}