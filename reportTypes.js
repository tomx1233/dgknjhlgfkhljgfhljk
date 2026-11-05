// ============================================
// K̸I̸L̵L̴A̸ — Shared report-reason table
// ============================================
// Single source of truth for MRA, loaded by both reportHelper.js (the
// asset-page button) and reportPrefill.js (the report page) so the two can
// never drift apart.
//
// `label`      — what the KILLA modal shows (the wording on Roblox's own
//                category list, minus its casing differences).
// `robloxLabel`— the exact string Roblox's report form renders for that
//                category, read off its report web platform build.
// `keyword`    — last-resort matcher if the form's rendered text shifts.
//
// These are Roblox's ten asset abuse categories, not a KILLA invention: the
// helper selects one of them inside Roblox's own form, it does not file
// anything by itself.
// ============================================

(function () {
    'use strict';
    if (window.KILLA_REPORT_TYPES) return;

    const ABUSE_TYPES = [
        {
            id: 1,
            label: 'Inappropriate Language - Profanity & Adult Content',
            robloxLabel: 'inappropriate language - profanity & adult content',
            keyword: 'profanity',
        },
        {
            id: 2,
            label: 'Asking for or Giving Private Information',
            robloxLabel: 'asking for or giving private information',
            keyword: 'private information',
        },
        {
            id: 3,
            label: 'Bullying, Harassment, Hate Speech',
            robloxLabel: 'bullying, harassment, hate speech',
            keyword: 'harassment',
        },
        {
            id: 4,
            label: 'Dating',
            robloxLabel: 'dating',
            keyword: 'dating',
        },
        {
            id: 5,
            label: 'Exploiting, Cheating, Scamming',
            robloxLabel: 'exploiting, cheating, scamming',
            keyword: 'scamming',
        },
        {
            id: 6,
            label: 'Account Theft - Phishing, Hacking, Trading',
            robloxLabel: 'account theft - phishing, hacking, trading',
            keyword: 'phishing',
        },
        {
            id: 7,
            label: 'Inappropriate Content - Place, Image, Model',
            robloxLabel: 'inappropriate content - place, image, model',
            keyword: 'image, model',
        },
        {
            id: 8,
            label: 'Real Life Threats & Suicide Threats',
            robloxLabel: 'real life threats & suicide threats',
            keyword: 'suicide',
        },
        {
            id: 12,
            label: 'Inaccurate Content Maturity (e.g. blood, violence)',
            // Roblox renamed this one; the current label is what the form
            // renders, so that is what the prefill has to match.
            robloxLabel: 'inaccurate age guidelines - blood, violence',
            keyword: 'blood',
        },
        {
            id: 9,
            label: 'Other rule violation',
            robloxLabel: 'other rule violation',
            keyword: 'rule violation',
        },
    ];

    // Loose comparison form: case, "&" vs "and", punctuation and spacing all
    // collapse, so a minor wording change on Roblox's side still matches.
    function normalize(text) {
        return String(text == null ? '' : text)
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    window.KILLA_REPORT_TYPES = {
        ABUSE_TYPES: ABUSE_TYPES,
        STORAGE_KEY: 'killaPendingReport',
        PENDING_TTL_MS: 10 * 60 * 1000,
        REPORT_URL: 'https://www.roblox.com/report-abuse/',
        normalize: normalize,
        byId: function (id) {
            const want = String(id);
            for (let i = 0; i < ABUSE_TYPES.length; i++) {
                if (String(ABUSE_TYPES[i].id) === want) return ABUSE_TYPES[i];
            }
            return null;
        },
    };
})();
