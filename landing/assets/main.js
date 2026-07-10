// Chambeabot landing — form submission + small UX touches
(() => {
  "use strict";

  // ── Lead form ────────────────────────────────────────
  const form = document.getElementById("lead-form");
  if (form) {
    const status = document.getElementById("lead-status");
    const submit = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.className = "lead-status";
      status.textContent = "";

      const data = Object.fromEntries(new FormData(form).entries());
      submit.disabled = true;
      const originalLabel = submit.textContent;
      submit.textContent = "Enviando…";

      try {
        // Goes to the Rails API on crm-web via the public Railway domain.
        // /api/leads is a public endpoint we built into the chatwoot app:
        // POST → 201 Contact + tag lead_website, no auth required.
        const response = await fetch("https://crm.chambeabot.com/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        }

        status.classList.add("success");
        status.textContent =
          "¡Listo! Tu solicitud fue recibida. Te contactaremos por WhatsApp en menos de 24 horas hábiles.";
        form.reset();
      } catch (err) {
        status.classList.add("error");
        status.textContent =
          "No pudimos enviar tu solicitud. Escríbenos directo a hola@chambeabot.com o al +52 55 1234 5678.";
        console.error(err);
      } finally {
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    });
  }

  // ── Smooth scroll for anchor links ───────────────────
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // ── Animated count-up for trust metrics ─────────────
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = Number(el.dataset.count);
          const duration = 1400;
          const start = performance.now();
          const animate = (now) => {
            const elapsed = now - start;
            const pct = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - pct, 3);
            el.textContent = Math.round(target * eased).toLocaleString("es-MX");
            if (pct < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          observer.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => observer.observe(c));
  }
})();