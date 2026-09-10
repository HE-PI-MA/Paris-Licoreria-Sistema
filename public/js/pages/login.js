(() => {
  "use strict";
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

  const form = document.querySelector("[data-login-form]");
  const submit = document.querySelector("[data-login-submit]");
  const errorBox = document.querySelector("[data-login-error]");
  const successBox = document.querySelector("[data-login-success]");
  const password = document.querySelector("#contrasena");
  const toggle = document.querySelector("[data-password-toggle]");
  const submitDefaultHtml = submit?.innerHTML || "";

  if (!form) return;

  const show = (element, message) => {
    element.textContent = message;
    element.hidden = false;
  };

  const hide = (element) => {
    element.textContent = "";
    element.hidden = true;
  };

  if (toggle && password) {
    toggle.addEventListener("click", () => {
      const visible = password.type === "text";

      password.type = visible ? "password" : "text";
      toggle.classList.toggle("is-visible", !visible);
      toggle.setAttribute("aria-pressed", String(!visible));
      toggle.setAttribute(
        "aria-label",
        visible ? "Mostrar contrasena" : "Ocultar contrasena"
      );

      password.focus();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    hide(errorBox);
    hide(successBox);

    const nombreUsuario = form.nombre_usuario.value.trim();
    const contrasena = form.contrasena.value;

    if (!nombreUsuario || !contrasena) {
      show(errorBox, "Completa el usuario y la contrasena.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Verificando...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        credentials: "same-origin",
        body: JSON.stringify({
          nombre_usuario: nombreUsuario,
          contrasena
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data.error === "SISTEMA_NO_ACTIVADO"
            ? "Este equipo no se encuentra activado."
            : data.error || "No se pudo iniciar sesion.";

        show(errorBox, message);
        return;
      }

      form.contrasena.value = "";
      show(successBox, "Inicio de sesion correcto. Redirigiendo...");

      window.setTimeout(() => {
        window.location.assign("/inicio");
      }, 450);
    } catch (error) {
      show(
        errorBox,
        "No fue posible comunicarse con el servidor. Intenta nuevamente."
      );
    } finally {
      submit.disabled = false;
      submit.innerHTML = submitDefaultHtml;
    }
  });
})();
