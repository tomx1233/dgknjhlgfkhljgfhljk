// ============================================
// K̸I̸L̵L̴A̸ — MRA (Creator Store asset pages)
// ============================================
// Adds an "MRA" button to the Creator Store asset page
// (create.roblox.com/store/asset/<id>), in the heading button row directly
// next to the Download button.
//
// The button opens a small modal: pick ONE report reason, optionally write a
// comment, then Submit. Submit files the report itself — the same request
// Roblox's own report form posts — and then refreshes the page. No new tab,
// no autofill, no manual second click.
// ============================================

(function () {
    'use strict';
    if (window.__KILLA_REPORT_HELPER__) return;
    window.__KILLA_REPORT_HELPER__ = true;

    const TYPES = window.KILLA_REPORT_TYPES;
    if (!TYPES) {
        console.warn('[KILLA] reportTypes.js did not load \u2014 MRA disabled');
        return;
    }

    const BUTTON_ID = 'killa-report-helper-btn';
    const OVERLAY_CLASS = 'killa-rh-overlay';
    const REPEAT_ID = 'killa-rh-repeat';

    // Repeat sending is capped, and the gap between sends is enforced, so a
    // build-up of reports can't hammer Roblox's endpoint.
    const MAX_REPEATS = 10;
    const SEND_GAP_MS = 2500;            // pause between consecutive sends
    const DEFAULT_RATE_LIMIT_MS = 30000; // polite wait when 429 gives no hint
    const MAX_RATE_LIMIT_MS = 5 * 60 * 1000; // never wait longer than this at once
    const MAX_RATE_LIMIT_WAITS = 6;      // per submission, across all sends
    const MAX_TOTAL_WAIT_MS = 5 * 60 * 1000; // total waiting budget, then stop

    const CSS = `
    .killa-rh-btn {
        display: flex; align-items: center; gap: 4px;
        background: transparent; border: none; cursor: pointer;
        padding: 0; margin-right: 10px; color: inherit;
        font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
        font-weight: 700; font-size: 14px; line-height: 100%;
        white-space: nowrap; -webkit-tap-highlight-color: transparent;
    }
    .killa-rh-btn:hover { text-decoration: underline; }
    .killa-rh-btn:disabled { opacity: .5; cursor: default; text-decoration: none; }
    .killa-rh-btn .killa-rh-ico {
        width: 24px; height: 24px; background-color: currentcolor;
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 1 21h22zm0 6 6.5 11.5h-13zM11 10h2v5h-2zm0 6.5h2v2h-2z'/%3E%3C/svg%3E") center center / contain no-repeat;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2 1 21h22zm0 6 6.5 11.5h-13zM11 10h2v5h-2zm0 6.5h2v2h-2z'/%3E%3C/svg%3E") center center / contain no-repeat;
        flex: 0 0 auto;
    }

    .killa-rh-overlay {
        position: fixed; inset: 0; z-index: 2147483000;
        background: rgba(0, 0, 0, .6);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Builder Sans', Helvetica, Arial, sans-serif;
    }
    .killa-rh-dialog {
        box-sizing: border-box; width: 520px; max-width: calc(100vw - 32px);
        max-height: calc(100vh - 64px); overflow-y: auto;
        background: rgb(35, 36, 41); color: rgb(247, 247, 248);
        border-radius: 12px; padding: 22px 24px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, .5);
    }
    .killa-rh-dialog h3 {
        margin: 0 0 14px 0; font-size: 18px; font-weight: 700;
    }
    .killa-rh-lbl {
        display: block; font-size: 13px; color: rgb(188, 190, 200);
        margin: 0 0 8px 0;
    }
    .killa-rh-list {
        display: flex; flex-direction: column; gap: 2px;
        margin-bottom: 18px;
    }
    .killa-rh-choice {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 7px 8px; border-radius: 8px; cursor: pointer;
        font-size: 14px; line-height: 1.35;
    }
    .killa-rh-choice:hover { background: rgba(208, 217, 251, .08); }
    .killa-rh-choice input {
        margin: 2px 0 0 0; flex: 0 0 auto; accent-color: rgb(63, 74, 150);
    }
    .killa-rh-text {
        box-sizing: border-box; width: 100%; resize: vertical;
        padding: 10px 12px; border-radius: 8px; font-size: 14px;
        font-family: inherit; line-height: 1.4;
        border: 1px solid rgba(208, 217, 251, .2);
        background: rgba(208, 217, 251, .08); color: rgb(247, 247, 248);
        outline: none; margin-bottom: 16px;
    }
    .killa-rh-text:focus { border-color: rgba(208, 217, 251, .5); }
    .killa-rh-repeat {
        display: flex; align-items: center; gap: 10px;
        margin: 0 0 14px 0; padding-top: 14px;
        border-top: 1px solid rgba(208, 217, 251, .12);
        font-size: 13px; color: rgb(188, 190, 200);
    }
    .killa-rh-repeat input[type="number"] {
        box-sizing: border-box; width: 68px; padding: 7px 9px;
        border-radius: 8px; font: inherit; font-weight: 700;
        color: rgb(247, 247, 248); text-align: center;
        border: 1px solid rgba(208, 217, 251, .2);
        background: rgba(208, 217, 251, .08); outline: none;
    }
    .killa-rh-repeat input[type="number"]:focus { border-color: rgba(208, 217, 251, .5); }
    .killa-rh-wait {
        margin: -8px 0 14px 0; font-size: 12px; line-height: 1.45;
        color: rgb(188, 190, 200);
    }
    .killa-rh-wait:empty { display: none; }
    .killa-rh-wait b { color: rgb(247, 247, 248); }
    .killa-rh-btns {
        display: flex; gap: 8px; justify-content: flex-end; align-items: center;
    }
    .killa-rh-btn-act {
        font-family: inherit; font-weight: 700; font-size: 14px;
        color: rgb(247, 247, 248); background-color: rgb(63, 74, 150);
        border: none; border-radius: 8px; padding: 9px 18px;
        min-height: 38px; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
    }
    .killa-rh-btn-act:hover { background-color: rgb(80, 92, 178); }
    .killa-rh-btn-act:disabled { opacity: .55; cursor: default; }
    .killa-rh-btn-act--secondary {
        background-color: rgba(208, 217, 251, .12);
    }
    .killa-rh-btn-act--secondary:hover { background-color: rgba(208, 217, 251, .18); }
    .killa-rh-status {
        margin-top: 12px; font-size: 13px; min-height: 18px;
        line-height: 1.4; color: rgb(188, 190, 200);
    }
    .killa-rh-status--error { color: #f87171; }
    .killa-rh-status--ok { color: #6ee7a8; }
    `;

    let styleEl = null;
    let buttonEl = null;
    let lastAssetId = null;

    // ---------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------

    function injectCss() {
        if (styleEl && styleEl.isConnected) return;
        styleEl = document.createElement('style');
        styleEl.id = 'killa-report-helper-styles';
        styleEl.textContent = CSS;
        (document.head || document.documentElement).appendChild(styleEl);
    }

    // The asset id is the last numeric path segment: /store/asset/<id>/<slug>
    function currentAssetId() {
        const m = window.location.pathname.match(/\/store\/asset\/(\d+)/);
        return m ? m[1] : null;
    }

    function isVisible(el) {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    // ---------------------------------------------------------------
    // Placement
    // ---------------------------------------------------------------
    // The heading row holds the site's own buttons (More options, Add to
    // Saved, the collection action) plus whatever a download helper adds. The
    // RoValra download button carries a stable id, so when it is present we
    // sit directly after it; otherwise we fall back to the row container
    // itself, then to the nearest known anchor button.
    function findButtonRow() {
        const download = document.getElementById('rovalra-download-asset-btn');
        if (download && download.parentElement) {
            return { row: download.parentElement, after: download };
        }
        const row = document.querySelector('[data-testid="assetButtonsTestId"] .headingButtonRow')
            || document.querySelector('[data-testid="assetButtonsTestId"]');
        if (row) return { row: row, after: null };

        const anchor = document.querySelector(
            '[data-testid="dropdownButton"], [data-testid="saveAssetButton"], [data-testid="getAssetButton"]'
        );
        if (anchor && anchor.parentElement) {
            return { row: anchor.parentElement, after: anchor };
        }
        return null;
    }

    function buildButton() {
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.className = 'killa-rh-btn';
        btn.title = 'File a Roblox report for this asset';
        const ico = document.createElement('span');
        ico.className = 'killa-rh-ico';
        const txt = document.createElement('span');
        txt.textContent = 'MRA';
        btn.appendChild(ico);
        btn.appendChild(txt);
        btn.addEventListener('click', openModal);
        return btn;
    }

    // Idempotent: creates the button if missing, and moves it back beside the
    // Download button if the site (or a download helper) re-rendered the row
    // underneath us.
    function placeButton() {
        if (!currentAssetId()) return false;
        const spot = findButtonRow();
        if (!spot) return false;

        if (!buttonEl || !buttonEl.isConnected) {
            buttonEl = document.getElementById(BUTTON_ID) || buildButton();
        }
        if (spot.after) {
            if (buttonEl.previousElementSibling !== spot.after) {
                spot.after.insertAdjacentElement('afterend', buttonEl);
            }
        } else if (buttonEl.parentElement !== spot.row) {
            spot.row.appendChild(buttonEl);
        }
        return true;
    }

    // ---------------------------------------------------------------
    // Asset type
    // ---------------------------------------------------------------
    // The report body has to name the asset's type (see buildSubmitBody). The
    // store page resolves it from the same toolbox details endpoint used here,
    // so the value matches what the site itself would send.
    function proxiedFetch(url) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(
                    { type: 'killaFetch', url: url, method: 'GET', credentials: 'include' },
                    (res) => {
                        void chrome.runtime.lastError;
                        resolve(res || null);
                    }
                );
            } catch (_) {
                resolve(null);
            }
        });
    }

    async function resolveAssetTypeId(assetId) {
        const res = await proxiedFetch(
            'https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=' + encodeURIComponent(assetId)
        );
        if (!res || !res.ok) return null;
        try {
            const json = JSON.parse(res.body);
            const item = json && Array.isArray(json.data) ? json.data[0] : null;
            const type = item && item.assetTypeId;
            if (type === undefined || type === null || type === '') return null;
            return String(type);
        } catch (_) {
            return null;
        }
    }

    // The report body is the one Roblox's own report form posts for an asset
    // (abuse-report-ui `getReportBody`): the v2 endpoint takes the report as
    // a map of report tags, and an asset's abuse vector is its asset TYPE
    // NAME (audio, model, decal, …) rather than the literal "asset". The
    // category is the abuse-category label exactly as the form renders it.
    function buildSubmitBody(assetId, type, typeId, comment, userId) {
        return {
            ENTRY_POINT: { valueList: [{ data: 'website' }] },
            REPORTED_ABUSE_CATEGORY: {
                valueList: [{ data: TYPES.normalize(type.robloxLabel) }],
            },
            REPORTED_ABUSE_VECTOR: { valueList: [{ data: TYPES.assetTypeName(typeId) }] },
            REPORTER_COMMENT: { valueList: [{ data: String(comment || '') }] },
            SUBMITTER_USER_ID: { valueList: [{ data: String(userId) }] },
            REPORT_TARGET_ASSET_ID: { valueList: [{ data: String(assetId) }] },
        };
    }

    // ---------------------------------------------------------------
    // Direct submit
    // ---------------------------------------------------------------

    function fetchAuthenticatedUserId() {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(
                    { type: 'killaFetch', url: 'https://users.roblox.com/v1/users/authenticated', method: 'GET', credentials: 'include' },
                    (res) => {
                        void chrome.runtime.lastError;
                        if (!res || !res.ok) return resolve(null);
                        try {
                            const json = JSON.parse(res.body);
                            resolve(json && json.id != null ? String(json.id) : null);
                        } catch (_) {
                            resolve(null);
                        }
                    }
                );
            } catch (_) {
                resolve(null);
            }
        });
    }

    function postJson(url, body, csrf) {
        return new Promise((resolve) => {
            const headers = { 'Content-Type': 'application/json' };
            if (csrf) headers['X-CSRF-Token'] = csrf;
            try {
                chrome.runtime.sendMessage(
                    {
                        type: 'killaFetch',
                        url: url,
                        method: 'POST',
                        credentials: 'include',
                        headers: headers,
                        bodyJson: body,
                    },
                    (res) => {
                        void chrome.runtime.lastError;
                        resolve(res || null);
                    }
                );
            } catch (_) {
                resolve(null);
            }
        });
    }

    // Roblox hands out an x-csrf-token on the 403 it returns to any
    // cookie-bearing POST that lacks one — so probing is just "post
    // something harmless, read the header". The report endpoint is probed
    // first (an empty report is rejected outright, nothing is filed); the
    // logout route is only a fallback, and it cannot succeed without a token
    // either, so neither probe changes any state.
    async function probeCsrfToken() {
        const probe = await postJson(TYPES.REPORT_ENDPOINTS.v2, {}, null);
        if (probe && probe.csrf) return probe.csrf;
        const alt = await postJson('https://auth.roblox.com/v2/logout', {}, null);
        return (alt && alt.csrf) || null;
    }

    function readJson(body) {
        if (!body) return null;
        try {
            return JSON.parse(body);
        } catch (_) {
            return null;
        }
    }

    // Pull a human sentence out of whatever the server returned so the modal
    // can show why a report did not go through.
    function serverMessage(res) {
        if (!res) return 'no response from Roblox';
        const json = readJson(res.body);
        if (json) {
            if (Array.isArray(json.errors) && json.errors.length) {
                const first = json.errors[0];
                if (first && first.message) return String(first.message);
            }
            if (typeof json.message === 'string' && json.message) return json.message;
            if (typeof json.error === 'string' && json.error) return json.error;
        }
        const snippet = String(res.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
        return snippet || 'HTTP ' + (res.status === undefined ? '?' : res.status);
    }

    // POST the report, retrying once with the token from a 403 (CSRF
    // rotation), then — only if the newer endpoint is missing/unsupported —
    // once more against the older web-platform route.
    async function postReport(body, opts, csrf) {
        let token = csrf;
        let last = null;

        for (let attempt = 0; attempt < 2; attempt++) {
            last = await postJson(TYPES.REPORT_ENDPOINTS.v2, body, token);
            if (last && last.ok) return { ok: true, res: last };
            if (last && last.status === 403 && last.csrf) {
                token = last.csrf; // CSRF rotation — retry with the fresh token
                continue;
            }
            break;
        }

        // The v2 body needs the asset type name; without it the report has no
        // abuse vector, and 404/405 mean the v2 route isn't there for this
        // account/build. Either way, fall through to the legacy route, which
        // takes the flat payload the old report form used.
        const noVector = !body.REPORTED_ABUSE_VECTOR.valueList[0].data;
        if (noVector || (last && (last.status === 404 || last.status === 405))) {
            const flat = {
                Id: body.REPORT_TARGET_ASSET_ID.valueList[0].data,
                Comment: body.REPORTER_COMMENT.valueList[0].data,
                ReportCategory: opts.categoryId,
                AssetTypeId: opts.typeId,
                AssetType: body.REPORTED_ABUSE_VECTOR.valueList[0].data || 'asset',
                RedirectUrl: 'https://create.roblox.com/',
            };
            const legacy = await postJson(TYPES.REPORT_ENDPOINTS.legacyAsset, flat, token || csrf);
            if (legacy && legacy.ok) return { ok: true, res: legacy };
            return { ok: false, res: legacy };
        }
        return { ok: false, res: last };
    }

    // ---------------------------------------------------------------
    // Repeat sends + rate limiting
    // ---------------------------------------------------------------

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // How long to wait after a 429. `Retry-After` wins when the server sends
    // one (seconds, or an HTTP date); otherwise fall back to the usual
    // rate-limit hints Roblox puts in the body.
    function rateLimitWaitMs(res) {
        let ms = null;
        if (res && res.retryAfter) {
            const raw = String(res.retryAfter).trim();
            if (/^\d+$/.test(raw)) {
                ms = parseInt(raw, 10) * 1000;
            } else {
                const when = Date.parse(raw);
                if (!Number.isNaN(when)) ms = when - Date.now();
            }
        }
        if (ms === null || !(ms > 0)) {
            const json = readJson(res && res.body);
            const text = json ? JSON.stringify(json) : String((res && res.body) || '');
            const m = text.match(/retry[^0-9]{0,20}(\d{1,5})\s*(?:s|sec|seconds?|ms)?\b/i);
            ms = m ? parseInt(m[1], 10) * 1000 : DEFAULT_RATE_LIMIT_MS;
        }
        return Math.min(Math.max(ms, 5000), MAX_RATE_LIMIT_MS);
    }

    // Sends `count` copies of the report, pacing each one and waiting out
    // rate limits instead of giving up. Anything other than a rate limit
    // stops the queue: retrying a rejected report just burns the user's
    // quota. `onProgress` gets (succeeded, attempted, count, waitMs|0, note).
    async function sendQueue(buildBody, opts, count, onProgress) {
        let csrf = await probeCsrfToken();
        let sent = 0;
        let attempted = 0;
        let waits = 0;
        let waitedMs = 0;
        let last = null;

        for (let i = 0; i < count; i++) {
            if (i > 0) await sleep(SEND_GAP_MS);

            // Keep going through rate limits; bail out of everything else.
            for (;;) {
                attempted++;
                last = await postReport(buildBody(), opts, csrf);
                if (last.ok) break;
                const res = last.res;
                if (res && res.csrf) csrf = res.csrf;

                if (res && res.status === 429) {
                    const waitMs = rateLimitWaitMs(res);
                    // Stop rather than stall forever: no more than a handful
                    // of waits, and never past the total budget.
                    if (waits >= MAX_RATE_LIMIT_WAITS || waitedMs + waitMs > MAX_TOTAL_WAIT_MS) {
                        return { ok: false, sent: sent, attempted: attempted, res: res, rateLimitedOut: true };
                    }
                    waits++;
                    waitedMs += waitMs;
                    onProgress(sent, attempted, count, waitMs, 'rate limited');
                    await sleep(waitMs);
                    continue;
                }
                return { ok: false, sent: sent, attempted: attempted, res: res, rateLimitedOut: false };
            }

            sent++;
            onProgress(sent, attempted, count, 0, 'sent');
        }
        return { ok: true, sent: sent, attempted: attempted, res: last && last.res };
    }

    // ---------------------------------------------------------------
    // Modal
    // ---------------------------------------------------------------

    function openModal() {
        injectCss();
        if (document.querySelector('.' + OVERLAY_CLASS)) return;

        const assetId = currentAssetId();
        const overlay = document.createElement('div');
        overlay.className = OVERLAY_CLASS;

        const dialog = document.createElement('div');
        dialog.className = 'killa-rh-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', 'MRA');

        const h3 = document.createElement('h3');
        h3.textContent = 'MRA';
        dialog.appendChild(h3);

        const listLbl = document.createElement('span');
        listLbl.className = 'killa-rh-lbl';
        listLbl.textContent = 'Report reason';
        dialog.appendChild(listLbl);

        const list = document.createElement('div');
        list.className = 'killa-rh-list';
        list.setAttribute('role', 'radiogroup');
        list.setAttribute('aria-label', 'Report reason');
        const radios = [];
        TYPES.ABUSE_TYPES.forEach((type) => {
            const choice = document.createElement('label');
            choice.className = 'killa-rh-choice';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = 'killa-rh-reason';
            input.value = String(type.id);
            const span = document.createElement('span');
            span.textContent = type.label;
            choice.appendChild(input);
            choice.appendChild(span);
            list.appendChild(choice);
            radios.push(input);
        });
        dialog.appendChild(list);

        const commentLbl = document.createElement('label');
        commentLbl.className = 'killa-rh-lbl';
        commentLbl.textContent = 'Comment (optional)';
        dialog.appendChild(commentLbl);

        const comment = document.createElement('textarea');
        comment.className = 'killa-rh-text';
        comment.rows = 3;
        comment.placeholder = 'Anything you want the reviewer to know (optional)';
        dialog.appendChild(comment);

        // Repeat count. One report is the normal thing to send; the field
        // exists for the cases where a report silently goes nowhere and you
        // want it filed more than once. It is capped, and every send is
        // paced — see sendQueue().
        const repeatRow = document.createElement('div');
        repeatRow.className = 'killa-rh-repeat';
        const repeatLabel = document.createElement('label');
        repeatLabel.setAttribute('for', REPEAT_ID);
        repeatLabel.textContent = 'Times to send';
        const repeat = document.createElement('input');
        repeat.id = REPEAT_ID;
        repeat.type = 'number';
        repeat.min = '1';
        repeat.max = String(MAX_REPEATS);
        repeat.step = '1';
        repeat.value = '1';
        repeat.setAttribute('inputmode', 'numeric');
        const repeatHint = document.createElement('span');
        repeatHint.textContent = 'max ' + MAX_REPEATS;
        repeatRow.appendChild(repeatLabel);
        repeatRow.appendChild(repeat);
        repeatRow.appendChild(repeatHint);
        dialog.appendChild(repeatRow);

        // Standing explanation for the field above — what the retry behaviour
        // actually does, so the countdown later isn't a surprise.
        const waitNote = document.createElement('div');
        waitNote.className = 'killa-rh-wait';
        waitNote.textContent = 'Sent one at a time, ' + Math.round(SEND_GAP_MS / 1000) +
            's apart. If Roblox rate limits, MRA waits it out and carries on.';
        dialog.appendChild(waitNote);

        const btnRow = document.createElement('div');
        btnRow.className = 'killa-rh-btns';
        const status = document.createElement('div');
        status.className = 'killa-rh-status';

        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.className = 'killa-rh-btn-act killa-rh-btn-act--secondary';
        btnCancel.textContent = 'Cancel';

        const btnSubmit = document.createElement('button');
        btnSubmit.type = 'button';
        btnSubmit.className = 'killa-rh-btn-act';
        btnSubmit.textContent = 'Submit report';

        btnRow.appendChild(btnCancel);
        btnRow.appendChild(btnSubmit);
        dialog.appendChild(btnRow);
        dialog.appendChild(status);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        function close() {
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown, true);
        }

        function setStatus(text, isError) {
            status.textContent = text || '';
            status.className = 'killa-rh-status' + (isError ? ' killa-rh-status--error' : '');
        }

        // Put the form back so a failed or stopped run can be retried without
        // retyping the reason and comment.
        function unlock() {
            btnSubmit.disabled = false;
            btnCancel.disabled = false;
            repeat.disabled = false;
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close();
            }
        }

        btnCancel.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', onKeyDown, true);

        btnSubmit.addEventListener('click', async () => {
            const picked = radios.find((r) => r.checked);
            if (!picked) {
                setStatus('Pick a reason first.', true);
                return;
            }
            if (!assetId) {
                setStatus('Could not read the asset id from the URL.', true);
                return;
            }
            const type = TYPES.byId(picked.value);
            if (!type) {
                setStatus('That reason is not recognised \u2014 reload the page and try again.', true);
                return;
            }

            // Clamp whatever was typed: 1..MAX_REPEATS, whole numbers only.
            let count = parseInt(repeat.value, 10);
            if (Number.isNaN(count) || count < 1) count = 1;
            count = Math.min(count, MAX_REPEATS);
            repeat.value = String(count);

            btnSubmit.disabled = true;
            btnCancel.disabled = true;
            repeat.disabled = true;
            setStatus(count > 1 ? 'Submitting 0 / ' + count + '\u2026' : 'Submitting\u2026');

            const typeId = await resolveAssetTypeId(assetId);
            const userId = await fetchAuthenticatedUserId();
            if (!userId) {
                unlock();
                setStatus('Could not read your Roblox account \u2014 are you still signed in?', true);
                return;
            }

            const text = comment.value.trim();
            const opts = { categoryId: String(type.id), typeId: typeId || '' };

            // A countdown is kept outside the queue so the modal shows how
            // long a rate-limit wait has left instead of just going quiet.
            let countdown = null;
            let remaining = { ms: 0 };
            const stopCountdown = () => {
                if (countdown) clearInterval(countdown);
                countdown = null;
            };

            const onProgress = (sent, attempted, total, waitMs) => {
                if (!waitMs) {
                    setStatus(total > 1 ? 'Submitting ' + sent + ' / ' + total + '\u2026' : 'Submitting\u2026');
                    return;
                }
                // Rate limited: say so, and tick the wait down.
                remaining = { ms: waitMs };
                const totalSecs = Math.round(waitMs / 1000);
                const paint = () => {
                    const secs = Math.max(0, Math.ceil(remaining.ms / 1000));
                    setStatus(
                        'Rate limited after ' + sent + ' of ' + total +
                        ' \u2014 waiting ' + secs + 's, then continuing\u2026'
                    );
                };
                paint();
                if (countdown) clearInterval(countdown);
                countdown = setInterval(() => {
                    remaining.ms -= 1000;
                    if (remaining.ms <= 0) {
                        if (countdown) clearInterval(countdown);
                        countdown = null;
                        return;
                    }
                    paint();
                }, 1000);
            };

            const result = await sendQueue(
                () => buildSubmitBody(assetId, type, typeId, text, userId),
                opts,
                count,
                onProgress
            );
            stopCountdown();

            if (!result.ok) {
                unlock();
                const reason = result.rateLimitedOut
                    ? 'still rate limited after ' + MAX_RATE_LIMIT_WAITS + ' waits'
                    : serverMessage(result.res);
                const done = result.sent ? result.sent + ' went through before this. ' : '';
                setStatus('Stopped after ' + result.sent + ' of ' + count + ' \u2014 ' + done + reason, true);
                console.warn('[KILLA] MRA stopped for asset ' + assetId + ':', result);
                return;
            }

            const json = readJson(result.res && result.res.body);
            const reportId = json && (json.reportId || json.id);
            setStatus(
                (count > 1 ? 'Submitted ' + count + ' reports' : 'Report submitted') +
                (reportId && count === 1 ? ' (#' + reportId + ')' : '') +
                ' \u2014 refreshing\u2026'
            );
            status.className = 'killa-rh-status killa-rh-status--ok';
            console.log('[KILLA] MRA filed ' + result.sent + ' report(s) for asset ' + assetId + ':', result.res && result.res.body);

            // Refresh once the last send has landed, so the page reflects it.
            setTimeout(() => {
                try {
                    window.location.reload();
                } catch (_) { /* ignore */ }
            }, 900);
        });

        radios[0].focus();
    }

    // ---------------------------------------------------------------
    // Boot + SPA navigation
    // ---------------------------------------------------------------

    function sync() {
        const id = currentAssetId();
        if (!id) {
            // Not an asset page any more (SPA moved on) — drop the button.
            if (buttonEl && buttonEl.parentElement) buttonEl.remove();
            lastAssetId = null;
            return;
        }
        if (id !== lastAssetId) {
            lastAssetId = id;
            const overlay = document.querySelector('.' + OVERLAY_CLASS);
            if (overlay) overlay.remove();
        }
        placeButton();
    }

    injectCss();
    sync();

    // The store page renders client-side and re-renders its heading row as
    // details arrive, so keep re-placing until the row survives a beat.
    let fastTicks = 0;
    const fastPoll = setInterval(() => {
        sync();
        if (++fastTicks > 40) clearInterval(fastPoll);
    }, 250);

    // The store page re-renders its heading row as details arrive, so the
    // button has to be re-placed when the row is replaced. The callback is
    // coalesced — this observes the whole document subtree on a React app
    // that mutates constantly, and an unthrottled re-place would run on every
    // one of those mutations.
    let observerQueued = false;
    const rowObserver = new MutationObserver(() => {
        if (observerQueued) return;
        observerQueued = true;
        setTimeout(() => {
            observerQueued = false;
            if (!document.getElementById(BUTTON_ID)) placeButton();
        }, 200);
    });
    rowObserver.observe(document.documentElement, { childList: true, subtree: true });

    // The store page swaps assets without a full reload.
    let lastHref = window.location.href;
    setInterval(() => {
        if (window.location.href === lastHref) return;
        lastHref = window.location.href;
        sync();
    }, 500);

    console.log('[KILLA] MRA active');
})();
