(() => {
  "use strict";

  const button = document.querySelector("[data-logout]");
  const errorBox = document.querySelector("[data-logout-error]");

  if (!button) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    errorBox.hidden = true;
    errorBox.textContent = "";

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("LOGOUT_ERROR");
      }

      window.location.assign("/login");
    } catch (error) {
      errorBox.textContent = "No se pudo cerrar la sesion.";
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
})();
