(() => {
  "use strict";
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

  const form = document.querySelector("[data-activation-form]");
  const submit = document.querySelector("[data-activation-submit]");
  const errorBox = document.querySelector("[data-activation-error]");
  const successBox = document.querySelector("[data-activation-success]");

  if (!form || !submit) return;

  const show = (element, message) => {
    element.textContent = message;
    element.hidden = false;
  };

  const hide = (element) => {
    element.textContent = "";
    element.hidden = true;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hide(errorBox);
    hide(successBox);

    const codigo = form.codigo.value.trim();

    if (!codigo) {
      show(errorBox, "Introduce el codigo de activacion.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Activando...";

    try {
      const response = await fetch("/api/licencia/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ codigo })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const messages = {
          ACTIVACION_CODIGO_INVALIDO: "El codigo de activacion no es valido.",
          ACTIVACION_CODIGO_REQUERIDO: "Introduce el codigo de activacion.",
          LICENCIA_NO_INSTALADA: "No existe una licencia instalada.",
          LICENCIA_FIRMA_INVALIDA: "La licencia instalada no es autentica.",
          LICENCIA_EQUIPO_NO_AUTORIZADO: "La licencia no corresponde a esta computadora.",
          LICENCIA_EXPIRADA: "La licencia instalada ha expirado."
        };

        show(
          errorBox,
          messages[data.error] || "No se pudo completar la activacion."
        );
        return;
      }

      form.codigo.value = "";
      show(successBox, "Equipo activado. Abriendo el Login...");

      window.setTimeout(() => {
        window.location.assign("/login");
      }, 650);
    } catch (error) {
      show(errorBox, "No fue posible comunicarse con el servidor.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Activar esta computadora";
    }
  });
})();
