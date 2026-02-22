/**
 * Jask Code Suggestion - Admin Configuration Page JS
 * This is loaded when the Soy-based admin page is used.
 * Falls back to inline JS in AdminConfigServlet's raw HTML.
 */
(function ($) {
    'use strict';

    // Soy-based admin config initialization
    $(document).ready(function () {
        if ($('.jask-admin-config').length) {
            console.log('Jask Code Suggestion - Admin config page loaded (Soy)');
        }
    });
})(AJS.$);
