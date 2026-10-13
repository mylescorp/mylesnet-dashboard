(function () {
  const cookieName = "__mylesnet_theme";
  const storageKey = "mylesnet-dashboard-theme";
  // The theme cookie is intentionally readable by client code so it can apply before first paint.
  const cookieValue = document.cookie.split("; ").find((cookie) => cookie.startsWith(cookieName + "="))?.split("=")[1];
  let stored = cookieValue === "light" || cookieValue === "dark" || cookieValue === "system" ? cookieValue : null;
  if (!stored) {
    try {
      const legacy = localStorage.getItem(storageKey);
      if (legacy === "light" || legacy === "dark" || legacy === "system") {
        stored = legacy;
        document.cookie = cookieName + "=" + legacy + "; Path=/; Max-Age=31536000; Secure; SameSite=Lax";
        if (document.cookie.split("; ").some((cookie) => cookie === cookieName + "=" + legacy)) {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // Apply the system preference if browser storage is unavailable.
    }
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
