/**
 * Theme toggle.
 *
 * The default theme is the "pastel dark" one; the light theme is opt-in and the
 * choice is remembered in localStorage. This script is loaded synchronously in
 * <head> (not deferred) so the right theme is applied before the first paint.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "theme";
  var DEFAULT_THEME = "dark";
  var THEME_COLORS = { dark: "#1b181f", light: "#fdf8fa" };
  var root = document.documentElement;

  function isTheme(value) {
    return value === "dark" || value === "light";
  }

  function readStored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return isTheme(value) ? value : DEFAULT_THEME;
    } catch (error) {
      // localStorage throws in some private-browsing modes.
      return DEFAULT_THEME;
    }
  }

  function current() {
    return isTheme(root.dataset.theme) ? root.dataset.theme : DEFAULT_THEME;
  }

  function apply(theme, persist) {
    root.dataset.theme = theme;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = THEME_COLORS[theme];
    }

    var button = document.querySelector("[data-theme-toggle]");
    if (button) {
      var label = "Switch to " + (theme === "dark" ? "light" : "dark") + " theme";
      button.setAttribute("aria-label", label);
      button.title = label;
    }

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (error) {
        // Remembering the choice is a convenience; ignore failures.
      }
    }
  }

  apply(readStored(), false);

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector("[data-theme-toggle]");
    if (!button) {
      return;
    }

    // Sync the button label with the theme applied above.
    apply(current(), false);

    button.addEventListener("click", function () {
      apply(current() === "dark" ? "light" : "dark", true);
    });
  });
})();
