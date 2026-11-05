// ============================================
// K̸I̸L̵L̴A̸ — DistroKid "Upload Roblox" Automator
// --------------------------------------------
// Adds a single button under the DistroKid "Services" section that:
//   1. Applies every setting required for a Roblox-only release
//   2. Collects the audio, song title, artist and release date via popups
//   3. Injects the album cover + audio file and submits the release
// Brought to you by K̸I̸L̵L̴A̸.
// ============================================

(function () {
    'use strict';
    if (window.__KILLA_DK_LOADED__) return;
    window.__KILLA_DK_LOADED__ = true;

    // ------------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------------
    const COVER_ASSET = 'assets/roblox-cover.png';
    const COVER_FILENAME = 'KillaCover.png';

    // Roblox accepts mp3, ogg, flac and wav. OGG is a first-class Roblox
    // format, so it belongs in the "good for both" set alongside mp3/wav/flac.
    const AUDIO_EXTS_ROBLOX = ['.mp3', '.ogg', '.flac', '.wav'];
    // DistroKid's upload input accepts these (see its accept="" attribute).
    const AUDIO_EXTS_DISTROKID = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aif', '.aiff', '.wma'];
    // The union is what the picker allows; the intersection is the safe choice.
    const AUDIO_EXTS = Array.from(new Set(AUDIO_EXTS_DISTROKID.concat(AUDIO_EXTS_ROBLOX)));
    const AUDIO_EXTS_BOTH = AUDIO_EXTS_ROBLOX.filter((e) => AUDIO_EXTS_DISTROKID.indexOf(e) !== -1);
    const fmtExts = (arr) => arr.map((e) => e.slice(1).toUpperCase()).join(', ');

    // Stores to DESELECT (everything except Roblox).
    const STORES_OFF = [
        'chkspotify', 'chkapplemusic', 'chkitunes', 'chkbeatport', 'chkfacebook',
        'chktiktok', 'chkgoogle', 'chkamazon', 'chkrdio', 'chkdeezer', 'chktidal',
        'chkiheart', 'chkqobuz', 'chksaavn', 'chkboomplay', 'chkanghami',
        'chknetease', 'chktencent', 'chkmassivemusic', 'chkimusica', 'chkjoox',
        'chkkuackmedia', 'chkfeedfm', 'chkflo', 'chkbeats', 'chksnap',
    ];

    const SONGWRITER_ROLE_MUSIC = '125';   // "Music"
    const SONGWRITER_FIRST = 'Killa';
    const SONGWRITER_LAST = 'Uploader';

    // ------------------------------------------------------------------
    // Styles (KILLA brand, matches the Roblox-side extension buttons)
    // ------------------------------------------------------------------
    const CSS = `
    .killa-dk-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin: 14px 0 6px 0; }
    .killa-btn {
        font-family:'Builder Sans',Helvetica,Arial,sans-serif; font-weight:700; font-size:16px;
        line-height:100%; color:rgb(247,247,248); background-color:rgb(63,74,150);
        border:none; border-radius:8px; padding:10px 18px; min-height:40px; cursor:pointer;
        display:inline-flex; align-items:center; justify-content:center; position:relative;
        user-select:none; box-sizing:border-box; transition:background-color 150ms cubic-bezier(.4,0,.2,1);
    }
    .killa-btn:hover { background-color:rgb(80,92,178); }
    .killa-btn:active { background-color:rgb(56,66,134); }
    .killa-btn:disabled { background-color:rgba(208,217,251,.12); color:rgb(188,190,200); cursor:default; }
    .killa-btn--secondary { background-color:rgba(208,217,251,.12); color:rgb(247,247,248); }
    .killa-btn--secondary:hover { background-color:rgba(208,217,251,.18); }
    .killa-dk-status { font-family:'Builder Sans',Helvetica,Arial,sans-serif; font-size:14px; color:#4b5563; margin-top:6px; min-height:20px; line-height:20px; white-space:pre-line; }
    .killa-dk-status--error { color:#b91c1c; }
    .killa-dk-status--success { color:#15803d; }
    .killa-dk-status--working { color:#374151; }

    .killa-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:2147483000; display:flex; align-items:center; justify-content:center; }
    .killa-dialog {
        background:rgb(35,36,41); color:rgb(247,247,248); border-radius:12px; padding:24px;
        width:440px; max-width:calc(100vw - 32px); box-shadow:0 16px 48px rgba(0,0,0,.5);
        font-family:'Builder Sans',Helvetica,Arial,sans-serif; box-sizing:border-box;
    }
    .killa-dialog h3 { margin:0 0 6px 0; font-size:18px; font-weight:700; }
    .killa-dialog .killa-sub { font-size:13px; color:rgb(188,190,200); margin-bottom:16px; line-height:1.4; }
    .killa-dialog label.killa-lbl { display:block; font-size:13px; color:rgb(188,190,200); margin:0 0 6px 0; }
    .killa-dialog input[type=text], .killa-dialog input[type=date], .killa-dialog input[type=time], .killa-dialog select {
        width:100%; padding:10px 12px; border:1px solid rgba(208,217,251,.2); border-radius:8px;
        background:rgba(208,217,251,.08); color:rgb(247,247,248); font-size:15px; box-sizing:border-box;
        outline:none; margin-bottom:14px; font-family:inherit;
    }
    .killa-dialog input:focus, .killa-dialog select:focus { border-color:rgba(208,217,251,.5); }
    .killa-dialog .killa-choice { display:flex; gap:8px; align-items:flex-start; margin-bottom:10px; font-size:14px; cursor:pointer; }
    .killa-dialog .killa-choice input { margin-top:3px; }
    .killa-dialog .killa-btns { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
    .killa-dialog .killa-btns .killa-btn { min-height:38px; font-size:14px; padding:8px 20px; }
    .killa-drop {
        border:2px dashed rgba(208,217,251,.35); border-radius:10px; padding:22px; text-align:center;
        font-size:14px; color:rgb(188,190,200); margin-bottom:14px; cursor:pointer; transition:border-color .15s, background-color .15s;
    }
    .killa-drop:hover, .killa-drop.drag { border-color:rgba(208,217,251,.7); background:rgba(208,217,251,.06); }
    .killa-drop .killa-file { color:rgb(247,247,248); font-weight:700; margin-top:8px; word-break:break-all; }
    .killa-note { font-size:12px; color:rgb(188,190,200); line-height:1.45; }
    .killa-warn { font-size:12px; color:#fbbf24; margin-top:8px; line-height:1.45; }
    `;
    (function injectCss() {
        const s = document.createElement('style');
        s.id = 'killa-dk-styles';
        s.textContent = CSS;
        (document.head || document.documentElement).appendChild(s);
    })();

    // ------------------------------------------------------------------
    // Small DOM helpers
    // ------------------------------------------------------------------
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function visible(el) {
        if (!el) return false;
        if (el.offsetParent !== null) return true;
        // offsetParent is null for position:fixed elements
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function fire(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }

    function setChecked(el, want) {
        if (!el) return false;
        if (el.checked !== want) {
            // .click() runs the site's own onclick/onchange handlers
            el.click();
        }
        return true;
    }

    function selectRadio(el) {
        if (!el) return false;
        if (!el.checked) el.click();
        return true;
    }

    function setSelect(el, value) {
        if (!el) return false;
        el.value = value;
        fire(el, 'input');
        fire(el, 'change');
        return true;
    }

    function setText(el, value) {
        if (!el) return false;
        el.value = value;
        fire(el, 'input');
        fire(el, 'keyup');
        fire(el, 'change');
        fire(el, 'blur');
        return true;
    }

    function waitFor(selector, timeout) {
        return new Promise((resolve) => {
            const found = $(selector);
            if (found) return resolve(found);
            const obs = new MutationObserver(() => {
                const el = $(selector);
                if (el) { obs.disconnect(); resolve(el); }
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            setTimeout(() => { obs.disconnect(); resolve($(selector)); }, timeout || 15000);
        });
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // ------------------------------------------------------------------
    // Modal system
    // ------------------------------------------------------------------
    function buildDialog(title, sub) {
        const overlay = document.createElement('div');
        overlay.className = 'killa-overlay';
        const dlg = document.createElement('div');
        dlg.className = 'killa-dialog';
        const h = document.createElement('h3');
        h.textContent = title;
        dlg.appendChild(h);
        if (sub) {
            const p = document.createElement('div');
            p.className = 'killa-sub';
            p.textContent = sub;
            dlg.appendChild(p);
        }
        const btns = document.createElement('div');
        btns.className = 'killa-btns';
        dlg.appendChild(btns);
        overlay.appendChild(dlg);
        document.body.appendChild(overlay);
        return { overlay, dlg, btns };
    }

    function addButton(parent, label, cls) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'killa-btn' + (cls ? ' ' + cls : '');
        b.textContent = label;
        parent.appendChild(b);
        return b;
    }

    // Text / date prompt
    function promptText(opts) {
        return new Promise((resolve) => {
            const { overlay, dlg, btns } = buildDialog(opts.title, opts.sub);
            const lbl = document.createElement('label');
            lbl.className = 'killa-lbl';
            lbl.textContent = opts.label || '';
            dlg.insertBefore(lbl, btns);
            const input = document.createElement('input');
            input.type = opts.type || 'text';
            input.value = opts.value || '';
            if (opts.placeholder) input.placeholder = opts.placeholder;
            if (opts.min) input.min = opts.min;
            if (opts.max) input.max = opts.max;
            dlg.insertBefore(input, btns);
            if (opts.note) {
                const n = document.createElement('div');
                n.className = 'killa-note';
                n.textContent = opts.note;
                dlg.insertBefore(n, btns);
            }
            const cancel = addButton(btns, 'Cancel', 'killa-btn--secondary');
            const ok = addButton(btns, opts.okLabel || 'OK');
            const close = (val) => { overlay.remove(); resolve(val); };
            cancel.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            ok.addEventListener('click', () => {
                const v = input.value.trim();
                if (opts.required && !v) { input.focus(); return; }
                close(v);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') ok.click();
                if (e.key === 'Escape') close(null);
            });
            setTimeout(() => { input.focus(); input.select && input.select(); }, 30);
        });
    }

    // Audio file picker (drag & drop + browse) with format validation
    function promptAudioFile() {
        return new Promise((resolve) => {
            const { overlay, dlg, btns } = buildDialog(
                'Import audio file',
                'Choose the song to release to Roblox.'
            );
            const drop = document.createElement('div');
            drop.className = 'killa-drop';
            drop.innerHTML = '<div>Click to choose a file, or drag one here</div><div class="killa-file"></div>';
            const fileEl = drop.querySelector('.killa-file');
            dlg.insertBefore(drop, btns);

            const note = document.createElement('div');
            note.className = 'killa-note';
            note.innerHTML = 'Roblox accepts: <b>' + fmtExts(AUDIO_EXTS_ROBLOX) + '</b><br>' +
                'DistroKid accepts: <b>' + fmtExts(AUDIO_EXTS_DISTROKID) + '</b><br>' +
                'Best for both: <b>' + fmtExts(AUDIO_EXTS_BOTH) + '</b>.';
            dlg.insertBefore(note, btns);

            const warn = document.createElement('div');
            warn.className = 'killa-warn';
            warn.style.display = 'none';
            dlg.insertBefore(warn, btns);

            const picker = document.createElement('input');
            picker.type = 'file';
            picker.accept = AUDIO_EXTS.join(',');
            picker.style.display = 'none';
            dlg.appendChild(picker);

            let chosen = null;
            const ext = (name) => (name.match(/\.[^.]+$/) || [''])[0].toLowerCase();

            function accept(file) {
                if (!file) return;
                const e = ext(file.name);
                if (AUDIO_EXTS.indexOf(e) === -1) {
                    warn.style.display = 'block';
                    warn.textContent = 'Unsupported format "' + (e || file.name) + '". Please pick ' + AUDIO_EXTS.join(', ') + '.';
                    return;
                }
                chosen = file;
                fileEl.textContent = file.name + '  (' + (file.size / 1048576).toFixed(1) + ' MB)';
                // Only warn for formats Roblox can't take (m4a, aif, wma).
                const okForRoblox = AUDIO_EXTS_ROBLOX.indexOf(e) !== -1;
                warn.style.display = okForRoblox ? 'none' : 'block';
                if (!okForRoblox) {
                    warn.textContent = 'Heads up: ' + e + ' is accepted by DistroKid but not by Roblox. ' +
                        'For a Roblox release, use ' + fmtExts(AUDIO_EXTS_BOTH) + '.';
                }
            }

            drop.addEventListener('click', () => picker.click());
            picker.addEventListener('change', (ev) => accept(ev.target.files && ev.target.files[0]));
            ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => {
                e.preventDefault(); drop.classList.add('drag');
            }));
            ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => {
                e.preventDefault(); drop.classList.remove('drag');
            }));
            drop.addEventListener('drop', (e) => {
                const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                accept(f);
            });

            const cancel = addButton(btns, 'Cancel', 'killa-btn--secondary');
            const ok = addButton(btns, 'Continue');
            const close = (val) => { overlay.remove(); resolve(val); };
            cancel.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            ok.addEventListener('click', () => {
                if (!chosen) { drop.classList.add('drag'); return; }
                close(chosen);
            });
        });
    }

    // Artist name picker (saved value or custom)
    function promptArtist(saved) {
        return new Promise((resolve) => {
            const { overlay, dlg, btns } = buildDialog(
                'Artist name',
                'This is the artist credited on the release.'
            );
            const wrap = document.createElement('div');
            wrap.innerHTML =
                '<label class="killa-choice"><input type="radio" name="killa-artist" value="saved"> ' +
                '<span>Use saved artist: <b>' + escapeHtml(saved || '(none)') + '</b></span></label>' +
                '<label class="killa-choice"><input type="radio" name="killa-artist" value="custom"> ' +
                '<span>Use a custom artist name</span></label>';
            dlg.insertBefore(wrap, btns);
            const custom = document.createElement('input');
            custom.type = 'text';
            custom.placeholder = 'Custom artist name';
            custom.value = '';
            custom.disabled = true;
            dlg.insertBefore(custom, btns);

            const radios = Array.from(wrap.querySelectorAll('input[name="killa-artist"]'));
            radios[0].checked = !!saved;
            if (!saved) radios[1].checked = true;
            custom.disabled = radios[0].checked;
            radios.forEach((r) => r.addEventListener('change', () => {
                custom.disabled = radios[0].checked;
                if (!custom.disabled) custom.focus();
            }));

            const note = document.createElement('div');
            note.className = 'killa-note';
            note.textContent = 'A brand-new artist name creates a new artist profile on DistroKid ' +
                '(they may charge an artist-rename fee). Reusing the saved name is free.';
            dlg.insertBefore(note, btns);

            const cancel = addButton(btns, 'Cancel', 'killa-btn--secondary');
            const ok = addButton(btns, 'Continue');
            const close = (val) => { overlay.remove(); resolve(val); };
            cancel.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            ok.addEventListener('click', () => {
                const mode = radios.find((r) => r.checked).value;
                if (mode === 'saved') return close(saved || '');
                const v = custom.value.trim();
                if (!v) { custom.focus(); return; }
                close(v);
            });
            setTimeout(() => { if (!custom.disabled) custom.focus(); }, 30);
        });
    }

    // Release date + time picker
    function promptReleaseDate() {
        return new Promise((resolve) => {
            const { overlay, dlg, btns } = buildDialog(
                'Release date & time',
                'When should this release go live through Roblox?'
            );
            const today = new Date().toISOString().slice(0, 10);
            const maxD = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);

            const l1 = document.createElement('label');
            l1.className = 'killa-lbl';
            l1.textContent = 'Release date';
            dlg.insertBefore(l1, btns);
            const date = document.createElement('input');
            date.type = 'date';
            date.value = today;
            date.min = today;
            date.max = maxD;
            dlg.insertBefore(date, btns);

            const l2 = document.createElement('label');
            l2.className = 'killa-lbl';
            l2.textContent = 'Release time (optional)';
            dlg.insertBefore(l2, btns);
            const time = document.createElement('input');
            time.type = 'time';
            time.value = '00:00';
            dlg.insertBefore(time, btns);

            const note = document.createElement('div');
            note.className = 'killa-note';
            note.textContent = 'Note: a future release date requires a Musician Plus plan. ' +
                'On the free Musician plan the release goes live "Today".';
            dlg.insertBefore(note, btns);

            const cancel = addButton(btns, 'Cancel', 'killa-btn--secondary');
            const ok = addButton(btns, 'Continue');
            const close = (val) => { overlay.remove(); resolve(val); };
            cancel.addEventListener('click', () => close(null));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            ok.addEventListener('click', () => close({ date: date.value || today, time: time.value || '00:00' }));
        });
    }

    function confirmDialog(title, lines, okLabel) {
        return new Promise((resolve) => {
            const { overlay, dlg, btns } = buildDialog(title, '');
            const ul = document.createElement('div');
            ul.className = 'killa-note';
            ul.style.marginBottom = '14px';
            ul.innerHTML = lines.map((l) => '• ' + escapeHtml(l)).join('<br>');
            dlg.insertBefore(ul, btns);
            const cancel = addButton(btns, 'Cancel', 'killa-btn--secondary');
            const ok = addButton(btns, okLabel || 'Upload');
            const close = (v) => { overlay.remove(); resolve(v); };
            cancel.addEventListener('click', () => close(false));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
            ok.addEventListener('click', () => close(true));
        });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    // ------------------------------------------------------------------
    // Status line
    // ------------------------------------------------------------------
    let statusEl = null;
    function setStatus(text, type) {
        if (!statusEl) return;
        statusEl.className = 'killa-dk-status' + (type ? ' killa-dk-status--' + type : '');
        statusEl.textContent = text;
    }

    // ------------------------------------------------------------------
    // The auto-selection engine
    // ------------------------------------------------------------------

    // Tick every *visible* "Important checkboxes (mandatory)" box and return
    // how many were newly ticked.
    //
    // This has to be re-runnable: DistroKid reveals some of these boxes only
    // once the form is filled in, so the ones that matter are hidden during
    // the first pass. #nonStandardCapsCheckbox, for example, is shown by
    // handleNonStandardCapCheckbox() from the artist name — long after the
    // initial sweep — and an unticked mandatory box blocks the submit.
    function checkMandatoryBoxes() {
        let boxes = 0;
        $$('input.areyousure').forEach((el) => {
            const container = el.closest('.checkbox-grid-cols');
            if (container && !visible(container)) return; // hidden = not applicable
            if (!el.checked) { el.click(); boxes++; }
        });
        return boxes;
    }

    function applyAutoSelections() {
        const done = [];
        const miss = [];

        // Every field is applied in isolation. A single unexpected failure
        // (missing element, renamed handler, a bad reference) must not abort
        // the rest of the run — an earlier hard error meant the Roblox store
        // never got selected and the whole upload silently stopped here.
        const step = (label, fn) => {
            try {
                if (fn()) { done.push(label); return true; }
                miss.push(label);
            } catch (e) {
                console.warn('[KILLA-DK] step failed: ' + label, e);
                miss.push(label + ' (threw)');
            }
            return false;
        };

        // --- Services: everything off ---
        STORES_OFF.forEach((id) => {
            step('deselect ' + id, () => {
                const el = document.getElementById(id);
                if (!el) return false;
                setChecked(el, false);
                return true;
            });
        });
        // Roblox itself is selected in acceptRobloxTerms(), because the site
        // opens an eligibility modal that must be confirmed first.

        // --- Number of songs = 1 (a single) ---
        step('1 song (a single)', () => setSelect(document.getElementById('howManySongsOnThisAlbum'), '1'));

        // --- Monetize on social media = OFF (both copies) ---
        ['socialmediapack', 'socialmediapack_alternate'].forEach((id) => {
            step('monetize off (' + id + ')', () => {
                const el = document.getElementById(id);
                if (!el) return false;
                setChecked(el, false);
                return true;
            });
        });

        // --- Previously released = No ---
        step('not previously released', () => selectRadio($('input.distroPreviouslyReleased[value="0"]')));

        // --- Instagram = No, Facebook = No ---
        step('Instagram: No', () => selectRadio(document.getElementById('js-instagramProfile-artist-id-zero-matches-new')));
        step('Facebook: No', () => selectRadio(document.getElementById('js-facebookProfile-artist-id-zero-matches-new')));
        // Apple Music / YouTube Music: leave untouched (deselected as stores above).

        // --- Language = English ---
        step('language: English', () => setSelect(document.getElementById('language'), '10'));

        // --- Primary genre = Afrobeat (secondary untouched) ---
        step('genre: Afrobeat', () => setSelect(document.getElementById('genrePrimary'), '58'));

        // --- Featured artist = No ---
        step('no featured artist', () => selectRadio($('input.distroFeat[value="0"]')));

        // --- Version info = No ---
        step('normal version', () => selectRadio($('input.distroVersion[value=""]')) || selectRadio($('#track-1-version-no')));

        // --- Dolby Atmos = No ---
        step('no Dolby Atmos', () => selectRadio($('input.distroDolbyAtmos[value="0"]')));

        // --- Songwriter / Cover Song = original ---
        // This must run before the songwriter names below: clickedCoverSong()
        // shows .songwritersRealNameRow only for original songs.
        step('original song', () => selectRadio($('input.distroCoverSong[value="0"]')));

        // --- Songwriter real name: role Music, Killa / Uploader ---
        step('songwriter role: Music', () => setSelect($('select.songwriter_real_name_role'), SONGWRITER_ROLE_MUSIC));
        step('songwriter first name', () => setText($('input.songwriter_real_name_first'), SONGWRITER_FIRST));
        step('songwriter last name', () => setText($('input.songwriter_real_name_last'), SONGWRITER_LAST));

        // --- Explicit = No ---
        step('not explicit', () => selectRadio($('input.distroExplicit[value="0"]')));

        // --- Radio edit = No ---
        step('not a radio edit', () => selectRadio($('input.distroCleaned[value="0"]')));

        // --- Instrumental = Yes ---
        step('instrumental', () => selectRadio($('input.distroInstrumental[value="1"]')));

        // --- AI-generated = No ---
        step('no AI', () => selectRadio($('input.distroAiGate[value="0"]')));

        // --- Preview clip start = let streaming services decide ---
        step('preview: streaming decides', () => selectRadio($('input[name^="previewStart_"][value="no"]')));

        // --- Extras: nothing selected (nothing that can charge the card) ---
        // The Extras block mixes class="extras" with class="distroStore"
        // (Discovery Pack, Audiomack), so sweep the whole section.
        step('extras cleared', () => {
            let extrasOff = 0;
            const extrasRoot = $('.upload-extras') || $('#extrasTr2');
            if (extrasRoot) {
                $$('input[type="checkbox"]', extrasRoot).forEach((el) => {
                    if (!el.checked) return;
                    el.click();                 // runs the site's own onchange
                    if (el.checked) el.checked = false; // blocked by an alert() handler
                    extrasOff++;
                });
            } else {
                $$('input.extras').forEach((el) => { if (el.checked) { el.click(); extrasOff++; } });
            }
            console.log('[KILLA-DK] extras cleared:', extrasOff);
            return !!extrasRoot;
        });

        // --- Important checkboxes: all visible ones checked ---
        step('mandatory checkboxes', () => {
            console.log('[KILLA-DK] mandatory checkboxes ticked (pass 1):', checkMandatoryBoxes());
            return true;
        });

        return { done, miss };
    }

    // ------------------------------------------------------------------
    // Roblox selection + eligibility modal
    // ------------------------------------------------------------------
    // Ticking the Roblox store opens a SweetAlert2 "Roblox Eligibility
    // Requirements" dialog with four confirmations and a disabled CONTINUE
    // button. The store only stays checked once CONTINUE is pressed, so it
    // has to be confirmed here rather than in applyAutoSelections().
    async function acceptRobloxTerms() {
        const roblox = document.getElementById('chkroblox');
        if (!roblox) return { ok: false, reason: 'Roblox store option not found' };
        if (roblox.checked) return { ok: true };

        const hadModal = !!document.getElementById('confirm-chk-1');
        roblox.click();

        const first = await waitFor('#confirm-chk-1', 6000);
        if (!first || (hadModal && !first.closest('.swal2-container'))) {
            // No modal appeared — the store may just have toggled straight on.
            await sleep(150);
            return { ok: !!roblox.checked, reason: roblox.checked ? '' : 'Roblox requirements dialog did not appear' };
        }

        for (const id of ['confirm-chk-1', 'confirm-chk-2', 'confirm-chk-3', 'confirm-chk-4']) {
            const cb = document.getElementById(id);
            if (cb && !cb.checked) cb.click();
        }
        await sleep(80);

        const cont = document.querySelector('.roblox-sa-continue-button');
        if (!cont || cont.disabled) {
            return { ok: false, reason: 'Could not enable the Roblox CONTINUE button' };
        }
        cont.click();
        await sleep(250);
        return { ok: !!roblox.checked, reason: roblox.checked ? '' : 'Roblox store was not selected' };
    }

    // ------------------------------------------------------------------
    // File injection
    // ------------------------------------------------------------------
    function makeFile(blob, name, type) {
        return new File([blob], name, { type: type || blob.type || 'application/octet-stream' });
    }

    function injectFile(input, file) {
        if (!input) return false;
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        fire(input, 'input');
        fire(input, 'change');
        return true;
    }

    async function injectCover() {
        const input = document.getElementById('artwork');
        if (!input) return false;
        try {
            const url = chrome.runtime.getURL(COVER_ASSET);
            const res = await fetch(url);
            const blob = await res.blob();
            return injectFile(input, makeFile(blob, COVER_FILENAME, 'image/png'));
        } catch (e) {
            console.warn('[KILLA-DK] cover fetch failed', e);
            return false;
        }
    }

    function injectAudio(file) {
        const input = document.getElementById('js-track-upload-1') || $('input.trackupload_1') || $('input.trackupload');
        return injectFile(input, file);
    }

    // ------------------------------------------------------------------
    // Fill title / artist / release date
    // ------------------------------------------------------------------
    function fillSongTitle(title) {
        const input = $('input.uploadFileTitle') || $('[data-field-name="song title"]');
        return setText(input, title);
    }

    function fillArtist(name) {
        const hidden = document.getElementById('artistName');
        if (!hidden) return false;
        // DistroKid keeps the artist name in a hidden input; set it and fire change
        hidden.value = name;
        hidden.setAttribute('oldvalue', name);
        fire(hidden, 'input');
        fire(hidden, 'change');
        return true;
    }

    // DistroKid only honours a custom date/time on the Musician Plus plan.
    // On the free Musician plan the date picker is hidden and the release
    // goes live "Today", so report which of the two actually applied.
    function fillReleaseDate(rel) {
        const applied = { date: false, time: false };
        const dp = document.getElementById('release-date-dp');
        if (dp && rel && rel.date && visible(dp)) {
            dp.value = rel.date;
            fire(dp, 'input');
            fire(dp, 'change');
            applied.date = true;
        }
        const h = document.getElementById('releaseHour');
        const m = document.getElementById('releaseMinute');
        if (rel && rel.time && h && m && visible(h) && visible(m)) {
            const [hh, mm] = rel.time.split(':');
            setSelect(h, String(parseInt(hh, 10)));
            setSelect(m, String(parseInt(mm, 10)));
            applied.time = true;
        }
        return applied;
    }

    // ------------------------------------------------------------------
    // Progress watcher
    // ------------------------------------------------------------------
    function watchProgress() {
        const container = document.getElementById('distroProgressBarContainer');
        if (!container) return;
        const obs = new MutationObserver(() => {
            const bars = $$('.distroProgressBar', container);
            const parts = bars.map((b) => {
                const lbl = b.querySelector('.distroProgressBarLabel');
                const pct = b.querySelector('.distroProgressBarLabelRight');
                return (lbl ? lbl.textContent.trim() : '') + ' ' + (pct ? pct.textContent.trim() : '');
            }).filter(Boolean);
            if (parts.length) setStatus('Uploading…\n' + parts.join('\n'), 'working');
        });
        obs.observe(container, { subtree: true, childList: true, characterData: true, attributes: true });
        // Also surface the container becoming visible
        if (visible(container)) setStatus('Uploading…', 'working');
    }

    // ------------------------------------------------------------------
    // Main flow
    // ------------------------------------------------------------------
    let running = false;

    async function runUploadRoblox() {
        if (running) return;
        running = true;
        const btn = document.getElementById('killa-dk-btn');
        if (btn) btn.disabled = true;
        try {
            // 1) Auto-selections
            setStatus('Applying Roblox release settings…', 'working');
            const res = applyAutoSelections();
            await sleep(120);
            if (res.miss.length) {
                console.warn('[KILLA-DK] Fields that did not apply:', res.miss);
            }

            // Roblox store + its eligibility confirmation
            setStatus('Confirming Roblox eligibility…', 'working');
            const rb = await acceptRobloxTerms();
            if (!rb.ok) {
                setStatus('Roblox was not selected: ' + rb.reason, 'error');
                return;
            }
            setStatus('Settings applied. Starting upload…', 'working');

            // 2) Popups
            const audio = await promptAudioFile();
            if (!audio) { setStatus('Cancelled.', ''); return; }

            const savedArtist = (document.getElementById('artistName') || {}).value || '';
            const title = await promptText({
                title: 'Audio name / Song title',
                sub: 'This becomes the song title on the release.',
                label: 'Song title',
                placeholder: 'e.g. My Song',
                required: true,
                okLabel: 'Continue',
            });
            if (title == null) { setStatus('Cancelled.', ''); return; }

            const artist = await promptArtist(savedArtist);
            if (artist == null) { setStatus('Cancelled.', ''); return; }

            const rel = await promptReleaseDate();
            if (rel == null) { setStatus('Cancelled.', ''); return; }

            // 3) Apply everything
            setStatus('Filling in the release…', 'working');
            fillSongTitle(title);
            if (artist) fillArtist(artist);
            const dateApplied = fillReleaseDate(rel);
            const coverOk = await injectCover();
            await sleep(150);
            const audioOk = injectAudio(audio);

            if (!audioOk) {
                setStatus('Could not attach the audio file — please add it manually.', 'error');
            }

            // Re-sweep the mandatory boxes now that the title/artist are set:
            // DistroKid reveals extra ones (e.g. the non-standard capitalization
            // box, triggered off the artist name) only after the fields are
            // filled, and an unticked box blocks the submit.
            await sleep(400);                       // let the site's validators run
            let lateBoxes = checkMandatoryBoxes();
            if (lateBoxes) {
                await sleep(150);
                lateBoxes += checkMandatoryBoxes();  // catch anything revealed by the first pass
                console.log('[KILLA-DK] mandatory checkboxes ticked late:', lateBoxes);
            }

            // 4) Confirm
            const summary = [
                'Stores: Roblox only',
                'Song title: ' + title,
                'Artist: ' + (artist || savedArtist || '(unchanged)'),
                'Release date: ' + rel.date + ' ' + rel.time +
                    (dateApplied.date ? '' : ' (this plan forces "Today")'),
                'Audio: ' + audio.name,
                'Cover: ' + (coverOk ? COVER_FILENAME : 'not set'),
                'Extras: none (no card charge)',
                'Mandatory checkboxes: all ticked' + (lateBoxes ? ' (' + lateBoxes + ' on the second pass)' : ''),
            ];
            if (res.miss.length) {
                summary.push('NOT APPLIED: ' + res.miss.join(', ') + ' — check these by hand before uploading');
            }
            const ok = await confirmDialog('Ready to upload', summary, 'Upload Roblox');
            if (!ok) { setStatus('Cancelled at confirmation.', ''); return; }

            // 5) Submit + progress
            setStatus('Submitting…', 'working');
            // Last chance: the site's own validation can reveal further
            // mandatory boxes right up to submit.
            checkMandatoryBoxes();
            const doneBtn = document.getElementById('doneButton');
            if (doneBtn) {
                doneBtn.click();
                watchProgress();
                setTimeout(() => {
                    const err = document.querySelector('#uploadPageLoggedOutError');
                    if (err && visible(err)) {
                        setStatus('Not logged in to DistroKid — please log in and retry.', 'error');
                        return;
                    }
                    // An unticked mandatory box shows as a red highlight rather
                    // than the logged-out panel — surface it instead of claiming
                    // success.
                    const stillUnticked = $$('input.areyousure').filter((el) => {
                        const c = el.closest('.checkbox-grid-cols');
                        return (!c || visible(c)) && !el.checked;
                    });
                    if (stillUnticked.length) {
                        setStatus('DistroKid still wants ' + stillUnticked.length +
                            ' mandatory checkbox(es) ticked — scroll to "Important checkboxes" and finish those by hand.',
                            'error');
                        return;
                    }
                    setStatus('Submitted. Follow the on-screen prompts to finish the release.', 'success');
                }, 2500);
            } else {
                setStatus('Could not find the Continue button.', 'error');
            }
        } catch (err) {
            console.error('[KILLA-DK]', err);
            setStatus('Error: ' + err.message, 'error');
        } finally {
            running = false;
            if (btn) btn.disabled = false;
        }
    }

    // ------------------------------------------------------------------
    // UI injection
    // ------------------------------------------------------------------
    function buildPanel() {
        const row = document.createElement('div');
        row.className = 'killa-dk-row';
        row.id = 'killa-dk-panel';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'killa-btn';
        btn.id = 'killa-dk-btn';
        btn.textContent = 'Upload Roblox';
        btn.title = 'Configure this release for Roblox only and upload it';
        btn.addEventListener('click', runUploadRoblox);
        row.appendChild(btn);

        const status = document.createElement('div');
        status.className = 'killa-dk-status';
        row.appendChild(status);
        statusEl = status;

        return row;
    }

    function inject() {
        if (document.getElementById('killa-dk-panel')) return true;
        // Place it directly below the "Services" section
        const services = document.getElementById('storeSelectTr');
        if (!services) return false;
        const panel = buildPanel();
        services.insertAdjacentElement('afterend', panel);
        console.log('[KILLA-DK] Upload Roblox button injected');
        return true;
    }

    function init() {
        if (!/distrokid\.com\/new/.test(location.href)) return;
        inject();
        if (!document.getElementById('killa-dk-panel')) {
            let tries = 0;
            const t = setInterval(() => {
                if (inject() || ++tries > 100) clearInterval(t);
            }, 200);
            const obs = new MutationObserver(() => {
                if (inject()) obs.disconnect();
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            setTimeout(() => obs.disconnect(), 30000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
