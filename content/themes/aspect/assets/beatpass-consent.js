/* BeatPass blog: shared consent and Google Consent Mode v2 (advanced). */
(function () {
    'use strict';

    if (window.BeatPassConsent) return;

    var measurementId = 'G-5K99X60DF6';
    var cookieName = 'bp_consent';
    var notice;
    var reopenControl;
    var currentChoice;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    function consentState(choice) {
        return {
            analytics_storage: choice,
            ad_storage: choice,
            ad_user_data: choice,
            ad_personalization: choice
        };
    }

    // This must run before loading gtag.js, config, or any event commands.
    window.gtag('consent', 'default', consentState('denied'));

    function readChoice() {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var parts = cookies[i].trim().split('=');
            if (parts[0] === cookieName && parts.length === 2 && (parts[1] === 'granted' || parts[1] === 'denied')) {
                return parts[1];
            }
        }
        return null;
    }

    function saveChoice(choice) {
        var expires = new Date();
        expires.setMonth(expires.getMonth() + 6);
        document.cookie = cookieName + '=' + choice + '; Domain=.beatpass.ca; Path=/; SameSite=Lax; Expires=' +
            expires.toUTCString() + (window.location.protocol === 'https:' ? '; Secure' : '');
    }

    function clearAnalyticsCookies() {
        // Remove parent-domain and old host-only GA cookies, including visible legacy paths.
        var names = document.cookie.split(';').map(function (cookie) {
            return cookie.trim().split('=')[0];
        }).filter(function (name) { return /^(?:_ga(?:_.+)?|_gid|_gat(?:_.+)?)$/.test(name); });
        var domains = ['', window.location.hostname, '.' + window.location.hostname, 'beatpass.ca', '.beatpass.ca'];
        var paths = ['/'];
        var segments = window.location.pathname.split('/');
        var path = '';
        for (var i = 1; i < segments.length; i++) {
            path += '/' + segments[i];
            paths.push(path, path + '/');
        }
        names.forEach(function (name) {
            domains.forEach(function (domain) {
                paths.forEach(function (cookiePath) {
                    document.cookie = name + '=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=' +
                        cookiePath + (domain ? '; Domain=' + domain : '') + '; SameSite=Lax' +
                        (window.location.protocol === 'https:' ? '; Secure' : '');
                });
            });
        });
    }

    currentChoice = readChoice();
    if (currentChoice === 'granted') {
        // Restore consent before config so shared client/session cookies can be reused.
        window.gtag('consent', 'update', consentState('granted'));
    } else {
        clearAnalyticsCookies();
    }

    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
        content_group: 'blog',
        cookie_domain: 'beatpass.ca',
        cookie_path: '/'
    });

    // Advanced mode: denied visitors receive cookieless pings, without GA storage.
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(tag);

    function hideNotice() {
        notice.hidden = true;
        if (reopenControl && document.contains(reopenControl)) reopenControl.focus();
    }

    function openNotice(control) {
        if (!notice) return;
        reopenControl = control || document.activeElement;
        notice.hidden = false;
        document.getElementById('bp-consent-title').focus();
    }

    function applyChoice(choice) {
        var withdrawing = currentChoice === 'granted' && choice !== 'granted';
        currentChoice = choice;
        // Stop pending full collection immediately during withdrawal, until the reload.
        if (withdrawing) window['ga-disable-' + measurementId] = true;
        window.gtag('consent', 'update', consentState(choice === 'granted' ? 'granted' : 'denied'));
        if (choice !== 'granted') clearAnalyticsCookies();
        if (withdrawing) window.location.reload();
        return withdrawing;
    }

    function syncSharedChoice() {
        var choice = readChoice();
        if (choice !== currentChoice && applyChoice(choice)) return;
        if (notice) notice.hidden = choice !== null;
    }

    function initNotice() {
        notice = document.getElementById('bp-consent-notice');
        if (!notice) return;
        notice.hidden = currentChoice !== null;

        document.addEventListener('click', function (event) {
            var button = event.target.closest('[data-bp-consent], [data-bp-privacy-preferences]');
            if (!button) return;
            if (button.hasAttribute('data-bp-privacy-preferences')) {
                event.preventDefault();
                openNotice(button);
                return;
            }
            var choice = button.getAttribute('data-bp-consent');
            if (choice !== 'granted' && choice !== 'denied') return;
            saveChoice(choice);
            if (!applyChoice(choice)) hideNotice();
        });

        // A restored page or a returning tab must respect changes made on another surface.
        window.addEventListener('pageshow', syncSharedChoice);
        window.addEventListener('focus', syncSharedChoice);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) syncSharedChoice();
        });
    }

    window.BeatPassConsent = { open: openNotice };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotice);
    } else {
        initNotice();
    }
})();
