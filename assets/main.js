/* ============================================================
   Portfolio 2026 — interactions
   Keep it lean: reveal, nav state, cursor, magnetic, copy, VT.
   Respects prefers-reduced-motion throughout.
   ============================================================ */
(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Nav border on scroll ---------- */
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Cursor indicator (fine pointer only) ---------- */
  /* Elements carrying data-cursor-label swap the ring for a labelled pill.
     Dispatch a "cursor-label" event to change that text while hovering. */
  if (!coarse && !prefersReduced) {
    const dot = document.createElement("div");
    dot.className = "cursor";
    const dotLabel = document.createElement("span");
    dotLabel.className = "cursor__label";
    dot.appendChild(dotLabel);
    document.body.appendChild(dot);
    /* Tells the stylesheet the pointer is carrying labels, so elements can
       drop their own static hover hints. */
    document.documentElement.classList.add("has-cursor");

    const label = (text) => {
      dot.classList.toggle("has-label", Boolean(text));
      if (!text) return;
      dotLabel.textContent = text;
      // Width has to be a number for the pill to animate out of the dot;
      // 11px mono advances ~7.3px per character, plus the pill's padding.
      dot.style.setProperty("--cursor-label-w", `${Math.round(text.length * 7.3 + 30)}px`);
    };
    document.addEventListener("cursor-label", (e) => label(e.detail));

    // A high-Hz mouse fires many move events per frame, and a real mouse fires
    // pointermove *and* mousemove — so writing transform per event meant
    // several style invalidations for a single painted frame. Record the
    // position on every event but write it once, in rAF, right before paint.
    let px = 0;
    let py = 0;
    let queued = false;
    const paint = () => {
      queued = false;
      dot.style.transform =
        `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    };
    const apply = (e) => {
      px = e.clientX;
      py = e.clientY;
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };
    // One source of truth: pointermove covers mice everywhere it exists.
    if (window.PointerEvent) {
      document.addEventListener("pointermove", apply, { passive: true });
    } else {
      document.addEventListener("mousemove", apply, { passive: true });
    }

    const enter = (e) => {
      dot.classList.add("is-link");
      label(e.currentTarget.dataset.cursorLabel);
    };
    const leave = () => {
      dot.classList.remove("is-link");
      label("");
    };
    document
      .querySelectorAll('a, button, [role="button"], .project-card, .work__item, .cs-next')
      .forEach((el) => {
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mouseleave", leave);
      });
  }

  /* ---------- Magnetic effect on primary CTAs ---------- */
  if (!coarse && !prefersReduced) {
    const magnets = document.querySelectorAll("[data-magnet]");
    magnets.forEach((el) => {
      const strength = parseFloat(el.dataset.magnet || "0.2");
      let rect = null;
      let mx = 0;
      let my = 0;
      let queued = false;
      const paint = () => {
        queued = false;
        el.style.transform = `translate(${mx}px, ${my}px)`;
      };
      // Measured once per hover. Reading it on every move forced a synchronous
      // reflow in the middle of the frame, and read-back the element's own
      // translation, so the pull damped itself as it moved.
      el.addEventListener("mouseenter", () => {
        rect = el.getBoundingClientRect();
      });
      el.addEventListener("mousemove", (e) => {
        if (!rect) rect = el.getBoundingClientRect();
        mx = (e.clientX - (rect.left + rect.width / 2)) * strength;
        my = (e.clientY - (rect.top + rect.height / 2)) * strength;
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
      });
      el.addEventListener("mouseleave", () => {
        rect = null;
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* ---------- View Transitions on internal links ---------- */
  const supportsVT = typeof document.startViewTransition === "function";
  if (supportsVT && !prefersReduced) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href) return;
      // Same-origin, non-hash navigations only
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      if (a.dataset.noVt === "true") return;

      e.preventDefault();
      document.startViewTransition(() => {
        window.location.href = a.href;
      });
    });
  }

  /* ---------- Copy-to-clipboard buttons ---------- */
  /* Only meaningful while the pointer is still on the button — otherwise the
     cursor has moved on and its label belongs to whatever it is over now. */
  const tellCursor = (btn, text) => {
    if (btn.dataset.cursorLabel && btn.matches(":hover")) {
      document.dispatchEvent(new CustomEvent("cursor-label", { detail: text }));
    }
  };

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const original = btn.querySelector("[data-copy-label]")?.textContent ?? btn.textContent;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.setAttribute("data-state", "copied");
        const label = btn.querySelector("[data-copy-label]");
        if (label) label.textContent = "Copied";
        tellCursor(btn, "Copied");
        setTimeout(() => {
          btn.removeAttribute("data-state");
          if (label) label.textContent = original;
          tellCursor(btn, btn.dataset.cursorLabel);
        }, 1400);
      } catch {
        /* fail silently — no alert */
      }
    });
  });

  /* ---------- Role swap (hero headline, typewriter) ---------- */
  const roleSwap = document.querySelector(".role-swap");
  if (roleSwap && !prefersReduced) {
    const roles = (roleSwap.dataset.roles || "").split("|").map((s) => s.trim()).filter(Boolean);
    const textEl = roleSwap.querySelector(".role-swap__text");
    if (roles.length > 1 && textEl) {
      const HOLD_MS = 1200;
      const TYPE_MS = 42;
      const DELETE_MS = 26;
      const RETYPE_MS = 500;
      let i = 0;

      // Reserve width for the widest role so the rest of the headline
      // doesn't follow the caret as the text types/erases. The probe is
      // appended inside the actual heading so it inherits the real
      // cascade (font-size clamp, letter-spacing, etc.) instead of
      // relying on a copied `font` shorthand, which Safari can return empty.
      const reserveWidth = () => {
        const probe = document.createElement("span");
        probe.className = textEl.className;
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.whiteSpace = "pre";
        roleSwap.parentElement.appendChild(probe);
        let widest = 0;
        roles.forEach((r) => {
          probe.textContent = r;
          widest = Math.max(widest, probe.offsetWidth);
        });
        probe.remove();
        roleSwap.style.minWidth = `${widest}px`;
      };
      reserveWidth();
      window.addEventListener("resize", reserveWidth);

      const type = (str, pos, done) => {
        textEl.textContent = str.slice(0, pos);
        if (pos < str.length) {
          setTimeout(() => type(str, pos + 1, done), TYPE_MS);
        } else {
          done();
        }
      };

      const erase = (str, pos, done) => {
        textEl.textContent = str.slice(0, pos);
        if (pos > 0) {
          setTimeout(() => erase(str, pos - 1, done), DELETE_MS);
        } else {
          done();
        }
      };

      const advance = () => {
        setTimeout(() => {
          erase(roles[i], roles[i].length, () => {
            i = (i + 1) % roles.length;
            // Beat on the empty line before the next title starts typing.
            setTimeout(() => type(roles[i], 0, advance), RETYPE_MS);
          });
        }, HOLD_MS);
      };

      advance();
    }
  }

  /* ---------- Deferred-source modals (in-page, no new tab) ----------
     The heavy asset inside carries data-src and only loads on first open, so
     a page that merely links to a PDF or a poster doesn't pay for it upfront.
     Used by the resume PDF and the MEC ethnography poster. */
  const bindModal = (modalId, openSel, closeSel) => {
    const modal = document.getElementById(modalId);
    const opener = document.querySelector(openSel);
    if (!modal || !opener) return;
    const media = modal.querySelector("[data-src]");
    const scroller = modal.querySelector(".pdf-modal__scroll");
    let lastFocused = null;
    const open = () => {
      if (media && !media.src) media.src = media.dataset.src;
      lastFocused = document.activeElement;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      document.documentElement.classList.add("has-modal");
      modal.querySelector(closeSel)?.focus();
    };
    const close = () => {
      modal.hidden = true;
      document.body.style.overflow = "";
      document.documentElement.classList.remove("has-modal");
      media?.classList.remove("is-zoomed");
      if (scroller) scroller.scrollTo(0, 0);
      lastFocused?.focus();
    };

    /* Click-to-zoom. A dense poster fitted to a laptop viewport is unreadable,
       and browser zoom scales the whole page instead. Toggling to the image's
       native pixel width inside a scroller keeps the reading where it belongs.
       Target dimensions are computed rather than measured, so the CSS width
       transition doesn't get read mid-flight. */
    if (scroller && media && media.tagName === "IMG") {
      media.addEventListener("click", (e) => {
        const rect = media.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width;
        const fy = (e.clientY - rect.top) / rect.height;
        const zoomIn = !media.classList.contains("is-zoomed");
        const w = zoomIn ? media.naturalWidth : scroller.clientWidth;
        const h = w / (media.naturalWidth / media.naturalHeight || 1);
        media.classList.toggle("is-zoomed", zoomIn);
        requestAnimationFrame(() => {
          scroller.scrollLeft = fx * w - scroller.clientWidth / 2;
          scroller.scrollTop = fy * h - scroller.clientHeight / 2;
        });
      });
    }

    opener.addEventListener("click", open);
    modal.querySelectorAll(closeSel).forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) close();
    });
  };
  bindModal("pdf-modal", "[data-pdf-open]", "[data-pdf-close]");
  bindModal("poster-modal", "[data-poster-open]", "[data-poster-close]");

  /* ---------- Case-study section rail (sub-navigation) ----------
     Wide screens: fixed vertical rail. Narrow: sticky chip bar.
     Active item is derived from scroll position, not click state, so it
     stays honest whether the user scrolls, jumps, or lands on a #hash. */
  const toc = document.querySelector(".cs-toc");
  if (toc) {
    const list = toc.querySelector(".cs-toc__list");
    const items = Array.from(toc.querySelectorAll(".cs-toc__link"))
      .map((link) => {
        const id = (link.getAttribute("href") || "").slice(1);
        return { link, target: id ? document.getElementById(id) : null };
      })
      .filter((it) => it.target);

    if (items.length) {
      const wide = window.matchMedia("(min-width: 1200px)");
      const root = document.documentElement;

      // Native smooth anchor scrolling — paired with scroll-margin-top in CSS.
      if (!prefersReduced) root.style.scrollBehavior = "smooth";

      /* Measure the sticky chrome so scroll-margin-top and the sticky
         offset track the real nav height instead of a guessed constant. */
      const measure = () => {
        const navH = document.querySelector(".nav")?.offsetHeight;
        if (navH) root.style.setProperty("--nav-h", `${Math.round(navH)}px`);
        if (!wide.matches) {
          root.style.setProperty("--toc-bar-h", `${Math.round(toc.offsetHeight)}px`);
        }
      };

      const centerChip = (link) => {
        if (!list || wide.matches) return;
        const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
        list.scrollTo({ left, behavior: prefersReduced ? "auto" : "smooth" });
      };

      let active = -1;
      const setActive = (idx) => {
        if (idx === active || idx < 0) return;
        active = idx;
        items.forEach((it, i) => {
          const on = i === idx;
          it.link.classList.toggle("is-active", on);
          if (on) it.link.setAttribute("aria-current", "true");
          else it.link.removeAttribute("aria-current");
        });
        centerChip(items[idx].link);
      };

      const update = () => {
        const y = window.scrollY;
        // The "reading line" sits about a third of the way down the viewport.
        const line = y + window.innerHeight * 0.32;
        let idx = 0;
        for (let i = 0; i < items.length; i++) {
          if (items[i].target.getBoundingClientRect().top + y <= line) idx = i;
        }
        // Bottom of the document always resolves to the final section.
        if (y + window.innerHeight >= root.scrollHeight - 4) idx = items.length - 1;
        setActive(idx);

        // Fade the rail in only once the hero is behind us.
        if (wide.matches) {
          toc.classList.toggle("is-hidden", y < window.innerHeight * 0.45);
        } else {
          toc.classList.remove("is-hidden");
        }
      };

      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          update();
        });
      };

      // Clicking sets the state immediately; the scroll pass confirms it.
      items.forEach((it, i) => {
        it.link.addEventListener("click", () => setActive(i));
      });

      const refresh = () => {
        measure();
        active = -1;
        update();
      };

      measure();
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", refresh, { passive: true });
      if (typeof wide.addEventListener === "function") {
        wide.addEventListener("change", refresh);
      }
      window.addEventListener("load", refresh);
    }
  }

  /* ---------- Year stamp ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Local time stamp (hero ticker) ---------- */
  const clockEl = document.querySelector("[data-clock]");
  if (clockEl) {
    const tz = clockEl.dataset.clock || undefined;
    const update = () => {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-US", {
        hour: "numeric", minute: "2-digit", hour12: false,
        timeZone: tz,
      });
      clockEl.textContent = fmt.format(now);
    };
    update();
    setInterval(update, 15000);
  }
})();
