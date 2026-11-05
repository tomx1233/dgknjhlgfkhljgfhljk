// ============================================
// K̸I̸L̵L̴A̸ — Report form prefill (roblox.com/report-abuse)
// ============================================
// The other half of MRA. When the asset page hands off a pending
// reason + comment, this fills them into Roblox's own report form: it sets
// the comment and selects the matching category, then gets out of the way.
//
// It deliberately stops there. The report is filed by Roblox's own Submit
// button, pressed by hand — nothing here submits, repeats, or batches a
// report. The pending entry is one-shot and expires, so it can only ever
// land on the single report it was queued for.
// ============================================

(function () {
    'use strict';
    if (window.__KILLA_REPORT_PREFILL__) return;
    window.__KILLA_REPORT_PREFILL__ = true;

    const TYPES = window.KILLA_REPORT_TYPES;
    if (!TYPES) return;

    const normalize = TYPES.normalize;
    const NOTICE_ID = 'killa-report-prefill-notice';

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function isVisible(el) {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function clickEl(el) {
        try { el.click(); } catch (_) { /* ignore */ }
    }

    // Some popovers ignore a bare click and want a pointer sequence; used only
    // as a second attempt so a working click never gets doubled.
    function pointerClick(el) {
        const opts = { bubbles: true, cancelable: true, composed: true, view: window };
        try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (_) {}
        try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (_) {}
        clickEl(el);
    }

    // React tracks the value on the DOM node, so assigning `.value` directly
    // is ignored by its change detection. Go through the prototype setter and
    // fire the events React listens for.
    function setNativeValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function loadPending() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get([TYPES.STORAGE_KEY], (res) => {
                    void chrome.runtime.lastError;
                    resolve((res && res[TYPES.STORAGE_KEY]) || null);
                });
            } catch (_) {
                resolve(null);
            }
        });
    }

    function clearPending() {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.remove([TYPES.STORAGE_KEY], () => {
                    void chrome.runtime.lastError;
                    resolve();
                });
            } catch (_) {
                resolve();
            }
        });
    }

    // ---------------------------------------------------------------
    // Form driving
    // ---------------------------------------------------------------

    function findCommentBox() {
        return document.querySelector('textarea[data-testid="text-area-container"]')
            || document.querySelector('textarea');
    }

    function fillComment(text) {
        const box = findCommentBox();
        if (!box) return false;
        // Never stomp on something the user already wrote.
        if (box.value && box.value.trim()) return true;
        setNativeValue(box, text);
        return true;
    }

    // The category control is a custom listbox: a button showing
    // "Please select a category" until something is chosen.
    function findCategoryTrigger() {
        const buttons = document.querySelectorAll('button, [role="combobox"]');
        for (let i = 0; i < buttons.length; i++) {
            const el = buttons[i];
            const text = (el.textContent || '').trim().toLowerCase();
            if (text && text.indexOf('select a category') !== -1) return el;
        }
        return null;
    }

    function waitForOptions(timeoutMs) {
        return new Promise((resolve) => {
            const deadline = Date.now() + timeoutMs;
            const tick = () => {
                const opts = Array.prototype.slice
                    .call(document.querySelectorAll('[role="option"]'))
                    .filter((o) => isVisible(o) && (o.textContent || '').trim());
                if (opts.length) return resolve(opts);
                if (Date.now() >= deadline) return resolve([]);
                setTimeout(tick, 80);
            };
            tick();
        });
    }

    function pickOption(options, type) {
        const wanted = normalize(type.robloxLabel);
        const keyword = normalize(type.keyword);
        const rows = options.map((el) => ({ el: el, text: normalize(el.textContent) }));

        let hit = rows.find((r) => r.text === wanted);
        if (!hit) {
            hit = rows.find((r) => r.text.indexOf(wanted) !== -1 || wanted.indexOf(r.text) !== -1);
        }
        if (!hit && keyword) {
            hit = rows.find((r) => r.text.indexOf(keyword) !== -1);
        }
        return hit ? hit.el : null;
    }

    function closePopover() {
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        } catch (_) { /* ignore */ }
    }

    async function selectCategory(type) {
        const trigger = findCategoryTrigger();
        if (!trigger) return false;

        // Roblox's category control is a Radix listbox (aria-controls="radix-0",
        // data-state="closed"), and Radix opens on pointerdown rather than a bare
        // click -- so the pointer sequence goes first. pointerClick ends in a
        // plain click as well, so a non-Radix dropdown still opens from the same
        // call; the bare click is only a fallback if nothing appeared.
        pointerClick(trigger);
        let options = await waitForOptions(900);
        if (!options.length) {
            clickEl(trigger);
            options = await waitForOptions(1600);
        }
        if (!options.length) return false;

        const target = pickOption(options, type);
        if (!target) {
            closePopover();
            return false;
        }
        clickEl(target);
        // Give the listbox a beat to close before anything else looks at the DOM.
        await sleep(120);
        return true;
    }

    // ---------------------------------------------------------------
    // Notice
    // ---------------------------------------------------------------

    function showNotice(type, categorySet) {
        if (document.getElementById(NOTICE_ID)) return;
        const box = document.createElement('div');
        box.id = NOTICE_ID;
        box.style.cssText = [
            'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483000',
            'max-width:340px', 'box-sizing:border-box', 'padding:12px 14px',
            'border-radius:10px', 'background:rgb(35,36,41)', 'color:rgb(247,247,248)',
            'font-family:\'Builder Sans\',Helvetica,Arial,sans-serif',
            'font-size:13px', 'line-height:1.45',
            'box-shadow:0 10px 30px rgba(0,0,0,.45)',
        ].join(';');

        const head = document.createElement('div');
        head.style.cssText = 'font-weight:700;margin-bottom:4px;';
        head.textContent = categorySet ? 'KILLA \u2014 report prepared' : 'KILLA \u2014 comment filled in';

        const body = document.createElement('div');
        body.textContent = categorySet
            ? 'Reason set to \u201c' + type.label + '\u201d and your comment is in. Review it, then press Roblox\u2019s Submit.'
            : 'Your comment is in, but the reason could not be selected automatically \u2014 pick \u201c'
                + type.label + '\u201d yourself, then press Roblox\u2019s Submit.';

        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Dismiss';
        close.style.cssText = [
            'margin-top:8px', 'padding:5px 10px', 'border:none', 'border-radius:6px',
            'background:rgba(208,217,251,.14)', 'color:inherit', 'font:inherit',
            'font-weight:700', 'cursor:pointer',
        ].join(';');
        close.addEventListener('click', () => box.remove());

        box.appendChild(head);
        box.appendChild(body);
        box.appendChild(close);
        document.body.appendChild(box);
        setTimeout(() => { if (box.isConnected) box.remove(); }, 45000);
    }

    // ---------------------------------------------------------------
    // Run
    // ---------------------------------------------------------------

    async function run() {
        const pending = await loadPending();
        if (!pending) return;

        if (!pending.ts || Date.now() - pending.ts > TYPES.PENDING_TTL_MS) {
            await clearPending();
            return;
        }

        const params = new URLSearchParams(window.location.search);
        if (String(params.get('targetId') || '') !== String(pending.assetId)) {
            // Queued for a different target — leave it for the right tab (or
            // let it expire).
            return;
        }

        const type = TYPES.byId(pending.abuseTypeId);
        if (!type) {
            await clearPending();
            return;
        }

        let commentDone = !pending.comment;
        let categoryDone = false;
        let categoryAttempts = 0;
        const deadline = Date.now() + 20000;

        while (Date.now() < deadline) {
            if (!commentDone) commentDone = fillComment(pending.comment);
            if (!categoryDone && categoryAttempts < 4) {
                if (findCategoryTrigger()) {
                    categoryAttempts++;
                    categoryDone = await selectCategory(type);
                }
            }
            if (commentDone && categoryDone) break;
            await sleep(600);
        }

        await clearPending();
        if (commentDone || categoryDone) showNotice(type, categoryDone);
    }

    // The report page hydrates after load; wait for the form before starting.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { void run(); });
    } else {
        void run();
    }
})();
