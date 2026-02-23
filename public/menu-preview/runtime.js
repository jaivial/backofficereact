(function () {
  const MENU_TYPES = ["closed_conventional", "a_la_carte", "closed_group", "a_la_carte_group", "special"];
  const root = document.getElementById("vc-preview-root");
  const themeLink = document.getElementById("vc-theme-style");

  const HERO_DEFAULT_IMAGE =
    "https://villacarmenmedia.b-cdn.net/images/comida/9%3A16/ChatGPT%20Image%2017%20feb%202026%2C%2002_28_04%20%281%29.webp";
  const MEDIA_CDN_BASE = "https://villacarmenmedia.b-cdn.net";
  const HERO_SLIDER_IMAGES = [
    "https://villacarmenmedia.b-cdn.net/images/comida/9%3A16/ChatGPT%20Image%2017%20feb%202026%2C%2002_28_04%20%281%29.webp",
    "https://villacarmenmedia.b-cdn.net/images/comida/9%3A16/ChatGPT%20Image%2017%20feb%202026%2C%2002_32_50.webp",
    "https://villacarmenmedia.b-cdn.net/images/comida/9%3A16/comid9_16_4.webp",
    "https://villacarmenmedia.b-cdn.net/images/comida/9%3A16/comida9_16_2.webp",
    "https://villacarmenmedia.b-cdn.net/images/comida/9%3A16/croquetas9_16.webp",
  ];

  const ALLERGEN_ICONS = {
    Gluten: "/media/images/gluten.png",
    Crustaceos: "/media/images/crustaceos.png",
    Huevos: "/media/images/huevos.png",
    Pescado: "/media/images/pescado.png",
    Cacahuetes: "/media/images/cacahuetes.png",
    Soja: "/media/images/soja.png",
    Leche: "/media/images/leche.png",
    "Frutos de cascara": "/media/images/frutoscascara.png",
    Apio: "/media/images/apio.png",
    Mostaza: "/media/images/mostaza.png",
    Sesamo: "/media/images/sesamo.png",
    Sulfitos: "/media/images/sulfitos.png",
    Altramuces: "/media/images/altramuces.png",
    Moluscos: "/media/images/moluscos.png",
  };

  const ALLERGEN_LABELS = {
    Gluten: "Gluten",
    Crustaceos: "Crustáceos",
    Huevos: "Huevos",
    Pescado: "Pescado",
    Cacahuetes: "Cacahuetes",
    Soja: "Soja",
    Leche: "Leche",
    "Frutos de cascara": "Frutos de cáscara",
    Apio: "Apio",
    Mostaza: "Mostaza",
    Sesamo: "Sésamo",
    Sulfitos: "Sulfitos",
    Altramuces: "Altramuces",
    Moluscos: "Moluscos",
  };

  const ALLERGEN_ORDER = [
    "Gluten",
    "Crustaceos",
    "Huevos",
    "Pescado",
    "Cacahuetes",
    "Soja",
    "Leche",
    "Frutos de cascara",
    "Apio",
    "Mostaza",
    "Sesamo",
    "Sulfitos",
    "Altramuces",
    "Moluscos",
  ];

  const state = {
    themeId: "villa-carmen",
    menuType: "closed_conventional",
    menu: null,
    templateHtml: "",
  };
  let heroSliderInterval = null;
  let heroSliderPrevTimeout = null;
  let dishLightboxNode = null;
  let dishLightboxEscHandler = null;

  function normalizeThemeAlias(rawTheme) {
    const raw = String(rawTheme || "").trim().toLowerCase();
    if (!raw) return "";
    const replaced = raw.replace(/[_\s]+/g, "-");
    const collapsed = replaced
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return collapsed;
  }

  function normalizeThemeId(themeId) {
    const raw = String(themeId || "").trim();
    if (!raw) return "villa-carmen";
    const alias = normalizeThemeAlias(raw);
    const compact = alias.replace(/-/g, "");
    if (alias === "preact-copy" || alias === "preactcopy") return "villa-carmen";
    if (alias === "villa-carmen" || compact === "villacarmen" || compact === "villacaren") return "villa-carmen";
    return alias || raw.toLowerCase();
  }

  function safeType(menuType) {
    return MENU_TYPES.includes(menuType) ? menuType : "closed_conventional";
  }

  function prefersReducedMotion() {
    if (typeof window === "undefined") return true;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clearHeroSliderTimers() {
    if (heroSliderInterval != null) {
      window.clearInterval(heroSliderInterval);
      heroSliderInterval = null;
    }
    if (heroSliderPrevTimeout != null) {
      window.clearTimeout(heroSliderPrevTimeout);
      heroSliderPrevTimeout = null;
    }
  }

  function setSlot(name, html) {
    const node = root.querySelector('[data-slot="' + name + '"]');
    if (!node) return;
    node.innerHTML = html;
  }

  function bindText(key, value) {
    const node = root.querySelector('[data-bind="' + key + '"]');
    if (!node) return;
    node.textContent = value;
  }

  function bindHtml(key, html) {
    const node = root.querySelector('[data-bind="' + key + '"]');
    if (!node) return;
    node.innerHTML = html;
  }

  function toMoney(raw) {
    const n = Number(String(raw || "").replace(",", "."));
    if (!Number.isFinite(n)) return String(raw || "-");
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
  }

  function formatMenuPrice(raw) {
    const n = Number(String(raw || "").replace(",", "."));
    if (!Number.isFinite(n)) return String(raw || "");
    const out = n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
    return out;
  }

  function formatEuro(value) {
    if (!Number.isFinite(value)) return "";
    const rounded = Math.round(value * 100) / 100;
    const out = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2);
    return out + "€";
  }

  function renderDishPriceLabel(price) {
    const n = Number(price);
    if (!Number.isFinite(n)) return "";
    return "+" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)) + "€";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function applyTokens(template, tokens) {
    let out = String(template || "");
    Object.keys(tokens || {}).forEach(function (key) {
      const marker = "{{" + key + "}}";
      out = out.split(marker).join(String(tokens[key] == null ? "" : tokens[key]));
    });
    return out;
  }

  function parseLooseBool(value, fallback) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const s = String(value == null ? "" : value).trim().toLowerCase();
    if (!s) return fallback;
    if (s === "1" || s === "true" || s === "yes" || s === "si" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
    return fallback;
  }

  function encodeMediaPath(rawPath) {
    return String(rawPath || "")
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean)
      .map(function (segment) {
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch (_err) {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
  }

  function resolveMediaURL(raw) {
    const src = String(raw || "").trim();
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;
    if (/^\/\//.test(src)) return (typeof window !== "undefined" && window.location ? window.location.protocol : "https:") + src;
    if (/^(data:|blob:)/i.test(src)) return src;
    const path = encodeMediaPath(src);
    if (!path) return "";
    return MEDIA_CDN_BASE + "/" + path;
  }

  function dishImageFallbackIconSvg() {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chef-hat-icon lucide-chef-hat">' +
      '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/>' +
      '<path d="M6 17h12"/>' +
      "</svg>"
    );
  }

  function dishImageFallbackMarkup() {
    return '<div class="dishCardMediaFallback" aria-hidden="true">' + dishImageFallbackIconSvg() + "</div>";
  }

  function setDishCardMediaFallback(mediaNode) {
    if (!mediaNode) return;
    if (mediaNode.classList.contains("is-fallback")) return;
    mediaNode.classList.add("is-fallback");
    mediaNode.innerHTML = dishImageFallbackMarkup();
  }

  function closeDishLightbox() {
    if (dishLightboxEscHandler) {
      window.removeEventListener("keydown", dishLightboxEscHandler);
      dishLightboxEscHandler = null;
    }
    if (dishLightboxNode && dishLightboxNode.parentNode) {
      dishLightboxNode.parentNode.removeChild(dishLightboxNode);
    }
    dishLightboxNode = null;
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.remove("vc-modal-open");
    }
  }

  function openDishLightbox(src, alt) {
    const imageSrc = String(src || "").trim();
    if (!imageSrc || typeof document === "undefined" || !document.body) return;

    closeDishLightbox();

    const overlay = document.createElement("div");
    overlay.className = "vc-menuLightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Imagen del plato");
    overlay.innerHTML =
      '<button type="button" class="vc-menuLightboxClose" aria-label="Cerrar">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M18 6L6 18M6 6l12 12" />' +
      "</svg>" +
      "</button>" +
      '<div class="vc-menuLightboxContent">' +
      '<img class="vc-menuLightboxImg" src="' + escapeHtml(imageSrc) + '" alt="' + escapeHtml(String(alt || "")) + '" loading="eager" decoding="async" />' +
      "</div>";

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeDishLightbox();
    });

    const closeBtn = overlay.querySelector(".vc-menuLightboxClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (event) {
        event.preventDefault();
        closeDishLightbox();
      });
    }

    const content = overlay.querySelector(".vc-menuLightboxContent");
    if (content) {
      content.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }

    dishLightboxEscHandler = function (event) {
      if (event.key === "Escape") closeDishLightbox();
    };
    window.addEventListener("keydown", dishLightboxEscHandler);

    document.body.classList.add("vc-modal-open");
    document.body.appendChild(overlay);
    dishLightboxNode = overlay;
  }

  function attachDishCardLightboxHandlers() {
    if (!root) return;
    const mediaButtons = root.querySelectorAll(".dishCardMediaBtn");
    mediaButtons.forEach(function (button) {
      if (!button || button.dataset.vcLightboxBound === "1") return;
      button.dataset.vcLightboxBound = "1";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        const src = resolveMediaURL(button.getAttribute("data-full-src") || "");
        const alt = button.getAttribute("data-full-alt") || "";
        openDishLightbox(src, alt);
      });
    });
  }

  function attachDishCardImageFallbackHandlers() {
    if (!root) return;
    const images = root.querySelectorAll(".dishCardMediaImage");
    images.forEach(function (img) {
      const mediaNode = img.closest(".dishCardMedia");
      if (!mediaNode) return;
      const onError = function () {
        setDishCardMediaFallback(mediaNode);
      };
      img.addEventListener("error", onError, { once: true });
      if (img.complete && img.naturalWidth === 0) {
        onError();
      }
    });
  }

  function normalizeMenu(menu) {
    const fallback = {
      menu_title: "Menu sin titulo",
      menu_subtitle: [],
      menu_type: state.menuType,
      price: "0",
      show_dish_images: false,
      settings: {
        comments: [],
        beverage: { type: "no_incluida", price_per_person: null, has_supplement: false, supplement_price: null },
        included_coffee: false,
        min_party_size: 8,
      },
      sections: [],
      special_menu_image_url: "",
    };
    if (!menu || typeof menu !== "object") return fallback;
    return {
      ...fallback,
      ...menu,
      settings: {
        ...fallback.settings,
        ...(menu.settings || {}),
        beverage: { ...fallback.settings.beverage, ...((menu.settings || {}).beverage || {}) },
      },
      sections: Array.isArray(menu.sections) ? menu.sections : [],
      menu_subtitle: Array.isArray(menu.menu_subtitle) ? menu.menu_subtitle : [],
      show_dish_images: parseLooseBool(menu.show_dish_images, fallback.show_dish_images),
    };
  }

  function parsePosition(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function dishFromRaw(dish, index) {
    const descripcion = String((dish && dish.title) || "").trim();
    const description = String((dish && dish.description) || "").trim();
    const fotoURL = String((dish && (dish.foto_url || dish.image_url)) || "").trim();
    const alergenosRaw = (dish && dish.allergens) || [];
    const alergenos = Array.isArray(alergenosRaw)
      ? alergenosRaw.map(function (a) {
          return String(a || "").trim();
        }).filter(Boolean)
      : [];
    const supplementPriceRaw = dish && dish.supplement_price;
    const supplementPriceNum = supplementPriceRaw == null || supplementPriceRaw === ""
      ? null
      : Number(supplementPriceRaw);
    const supplementPrice = Number.isFinite(supplementPriceNum) ? supplementPriceNum : null;

    return {
      id: dish && dish.id ? dish.id : index,
      descripcion: descripcion,
      description: description,
      description_enabled: parseLooseBool(dish && dish.description_enabled, true) && description.length > 0,
      alergenos: alergenos,
      supplement_enabled: parseLooseBool(dish && dish.supplement_enabled, false),
      supplement_price: supplementPrice,
      active: parseLooseBool(dish && dish.active, true),
      price: dish && dish.price != null ? Number(dish.price) : null,
      position: parsePosition(dish && dish.position, index),
      foto_url: fotoURL,
      ai_requested: parseLooseBool(dish && (dish.ai_requested ?? dish.ai_requested_img), false),
      ai_generating: parseLooseBool(dish && (dish.ai_generating ?? dish.ai_generating_img), false),
    };
  }

  function normalizeSectionAnnotations(raw) {
    return (Array.isArray(raw) ? raw : [])
      .map(function (item) { return String(item || "").trim(); })
      .filter(Boolean);
  }

  function getMenuViewSections(menu) {
    const rows = Array.isArray(menu.sections) ? menu.sections : [];
    const sortedRows = rows.slice().sort(function (a, b) {
      return parsePosition(a && a.position, 0) - parsePosition(b && b.position, 0);
    });
    const out = [];

    sortedRows.forEach(function (row, rowIdx) {
      const title = String((row && row.title) || "").trim();
      if (!title) return;

      const rawDishes = Array.isArray(row && row.dishes)
        ? row.dishes
            .slice()
            .sort(function (a, b) {
              return parsePosition(a && a.position, 0) - parsePosition(b && b.position, 0);
            })
            .map(function (dish, dIdx) {
              return dishFromRaw(dish, dIdx);
            })
        : [];
      const dishes = rawDishes.filter(function (dish) {
        return Boolean(dish.descripcion) && dish.active !== false;
      });
      if (dishes.length === 0) return;

      const rawId = row && row.id;
      out.push({
        id: Number.isFinite(rawId) ? rawId : rowIdx,
        title: title,
        kind: String((row && row.kind) || "").toLowerCase().trim() || "custom",
        annotations: normalizeSectionAnnotations(row && row.annotations),
        dishes: dishes,
        position: parsePosition(row && row.position, rowIdx),
      });
    });

    return out;
  }

  function splitClosedConventionalSections(menu) {
    const sections = getMenuViewSections(menu);
    const starters = [];
    const mains = [];
    const rice = [];
    const others = [];
    let mainsTitle = "";

    sections.forEach(function (section) {
      const titleLower = String(section.title || "").toLowerCase();
      const kind = String(section.kind || "").toLowerCase();

      if (kind === "entrantes" || titleLower.includes("entrante")) {
        starters.push.apply(starters, section.dishes);
        return;
      }
      if (kind === "principales" || titleLower.includes("principal")) {
        if (!mainsTitle) mainsTitle = section.title;
        mains.push.apply(mains, section.dishes);
        return;
      }
      if (kind === "arroces" || titleLower.includes("arroz")) {
        rice.push.apply(rice, section.dishes);
        return;
      }
      others.push(section);
    });

    return {
      starters: starters,
      mains: mains,
      mainsTitle: mainsTitle,
      rice: rice,
      others: others,
    };
  }

  function beverageLabel(settings) {
    const beverage = (settings && settings.beverage) || {};
    const t = String(beverage.type || "no_incluida").toLowerCase();
    if (t === "ilimitada") return "Bebida ilimitada";
    if (t === "opcion") return "Opción de bebida ilimitada";
    return "Bebida no incluida";
  }

  function groupBeverageLines(menu) {
    const beverage = (menu.settings && menu.settings.beverage) || {};
    const t = String(beverage.type || "no_incluida").toLowerCase();
    const pricePerPax = Number(beverage.price_per_person || 8);
    const priceTag = "+" + formatEuro(Number.isFinite(pricePerPax) ? pricePerPax : 8) + " pax";

    if (t === "ilimitada") {
      return [
        "Bebida ilimitada " + priceTag,
        "(A mesa completa)",
        "Incluye bebidas desde el entrante hasta servir el postre.",
        "(Incluye agua, refrescos, cerveza de barril y vinos valencianos)",
      ];
    }
    if (t === "opcion") {
      return [
        "Opción a bebida ilimitada " + priceTag,
        "(A mesa completa)",
        "Incluye bebidas desde el entrante hasta servir el postre.",
        "(Incluye agua, refrescos, cerveza de barril y vinos valencianos)",
      ];
    }
    return ["Bebida a parte"];
  }

  function allergenLabel(raw) {
    const key = String(raw || "").trim();
    if (!key) return "";
    return ALLERGEN_LABELS[key] || key;
  }

  function renderAllergenIcons(alergenos) {
    const unique = Array.from(new Set((alergenos || []).map(function (a) { return String(a || "").trim(); }).filter(Boolean)));
    const rows = unique
      .map(function (k) {
        const src = ALLERGEN_ICONS[k];
        if (!src) return "";
        const label = allergenLabel(k);
        return '<img src="' + escapeHtml(src) + '" class="allergenIcon" alt="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" loading="lazy" decoding="async" />';
      })
      .join("");
    if (!rows) return "";
    return '<div class="dishAllergenRow" aria-label="Al&eacute;rgenos">' + rows + "</div>";
  }

  function supplementLabel(dish) {
    if (!dish || !dish.supplement_enabled) return "";
    if (Number.isFinite(dish.supplement_price)) {
      return "Suplemento +" + formatEuro(dish.supplement_price);
    }
    return "Suplemento";
  }

  function renderDishMetaBlocks(dish, options) {
    const blocks = [];
    if (dish && dish.description_enabled && dish.description) {
      blocks.push('<div class="dishDescriptionExtra">' + escapeHtml(dish.description) + "</div>");
    }
    const supplement = supplementLabel(dish);
    if (supplement) {
      blocks.push('<div class="dishSupplementInfo">' + escapeHtml(supplement) + "</div>");
    }
    if (options && options.showPriceLabel) {
      const price = renderDishPriceLabel(dish && dish.price);
      if (price) {
        blocks.push('<div class="dishSupplementInfo">' + escapeHtml(price) + "</div>");
      }
    }
    return blocks.join("");
  }

  function renderDishListExtras(dish, options) {
    const parts = [];
    if (dish && dish.description_enabled && dish.description) {
      parts.push('<div class="menuDishMeta">' + escapeHtml(dish.description) + "</div>");
    }
    const supplement = supplementLabel(dish);
    if (supplement) {
      parts.push('<div class="menuDishMeta">' + escapeHtml(supplement) + "</div>");
    }
    if (options && options.showPriceLabel) {
      const price = renderDishPriceLabel(dish && dish.price);
      if (price) {
        parts.push('<div class="menuDishText menuMuted">' + escapeHtml(price) + "</div>");
      }
    }
    return parts.join("");
  }

  function renderMenuDishItem(dish, options) {
    if (dish && dish.active === false) return "";
    const withAllergens = !options || options.withAllergens !== false;
    return (
      '<li class="menuDish">' +
      '<div class="menuDishText">' + escapeHtml((dish && dish.descripcion) || "") + "</div>" +
      (withAllergens ? renderAllergenIcons(dish && dish.alergenos) : "") +
      renderDishListExtras(dish, options || {}) +
      "</li>"
    );
  }

  function renderDishCardMedia(dish) {
    if (dish && dish.ai_generating) {
      return (
        '<div class="dishCardMedia dishCardMedia--aiLoading" aria-label="Generando imagen con IA">' +
        '<div class="dishCardMediaSkeleton" aria-hidden="true"></div>' +
        "</div>"
      );
    }
    const src = resolveMediaURL((dish && (dish.foto_url || dish.image_url)) || "");
    if (!src) {
      return '<div class="dishCardMedia is-fallback">' + dishImageFallbackMarkup() + "</div>";
    }
    const alt = String((dish && (dish.descripcion || dish.title)) || "").trim();
    return (
      '<div class="dishCardMedia">' +
      '<button type="button" class="dishCardMediaBtn" aria-label="Ver imagen de plato" data-full-src="' + escapeHtml(src) + '" data-full-alt="' + escapeHtml(alt) + '">' +
      '<img class="dishCardMediaImage" src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy" decoding="async" />' +
      "</button>" +
      "</div>"
    );
  }

  function renderDishGrid(dishes, options) {
    if (!Array.isArray(dishes) || dishes.length === 0) return "";
    const visibleDishes = dishes.filter(function (dish) {
      return !(dish && dish.active === false);
    });
    if (visibleDishes.length === 0) return "";
    const pickable = !!(options && options.pickable);
    const showImages = !!(options && options.showImages);
    const cards = visibleDishes
      .map(function (dish) {
        const addBtn = pickable
          ? '<button type="button" class="dishAddBtn" aria-label="A&ntilde;adir a tu lista" title="A&ntilde;adir a tu lista"><svg xmlns="http://www.w3.org/2000/svg" class="dishAddIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>'
          : "";
        if (showImages) {
          const cls = pickable ? "dishCard dishCard--withImage is-revealed dishCard--pickable" : "dishCard dishCard--withImage is-revealed";
          return (
            '<li class="' + cls + '">' +
            '<div class="dishCardMain">' +
            renderDishCardMedia(dish) +
            '<div class="dishCardInfo">' +
            '<div class="dishCardBody">' +
            '<div class="dishDescription">' + escapeHtml(dish.descripcion) + "</div>" +
            renderDishMetaBlocks(dish, options || {}) +
            "</div>" +
            renderAllergenIcons(dish.alergenos) +
            "</div>" +
            "</div>" +
            addBtn +
            "</li>"
          );
        }

        const cls = pickable ? "dishCard is-revealed dishCard--pickable" : "dishCard is-revealed";
        return (
          '<li class="' + cls + '">' +
          '<div class="dishDescription">' + escapeHtml(dish.descripcion) + "</div>" +
          renderDishMetaBlocks(dish, options || {}) +
          renderAllergenIcons(dish.alergenos) +
          addBtn +
          "</li>"
        );
      })
      .join("");
    return '<ul class="dishGrid" role="list">' + cards + "</ul>";
  }

  function renderSectionAnnotations(annotations) {
    if (!Array.isArray(annotations) || annotations.length === 0) return "";
    const rows = annotations
      .map(function (annotation) { return '<li class="menuSectionAnnotation">' + escapeHtml(annotation) + "</li>"; })
      .join("");
    return rows ? '<ul class="menuSectionAnnotations" role="list">' + rows + "</ul>" : "";
  }

  function renderMenuSectionVC(title, dishes, notes, options) {
    if (!Array.isArray(dishes) || dishes.length === 0) return "";
    const notesHtml = Array.isArray(notes) && notes.length
      ? '<ul class="menuSectionNotes" role="list">' + notes.map(function (note) { return '<li class="menuSectionNote">' + escapeHtml(note) + "</li>"; }).join("") + "</ul>"
      : "";
    const annotationsHtml = renderSectionAnnotations(options && options.annotations);
    return '<section class="menuSection"><h2 class="menuSectionHeading">' + escapeHtml(title) + "</h2>" + renderDishGrid(dishes, options) + notesHtml + annotationsHtml + "</section>";
  }

  function renderMenuPriceCardVC(priceLabel) {
    return (
      '<section class="menuAsideCard">' +
      '<h2 class="menuAsideTitle">Precio</h2>' +
      '<div class="menuPriceNotes">' +
      '<div class="menuPriceNote">Postre o caf&eacute; a elegir</div>' +
      '<div class="menuPriceNote">(Bebida no incluida)</div>' +
      '</div>' +
      '<div class="menuPriceValue">' + (priceLabel ? escapeHtml(priceLabel) + " &euro;" : "-") + '</div>' +
      '<div class="menuImportantBox">' +
      '<h3 class="menuImportantTitle">Informaci&oacute;n importante</h3>' +
      '<p class="menuImportantText">Consumo m&iacute;nimo: 1 men&uacute; por plaza reservada en la mesa, independientemente de la edad de los comensales.</p>' +
      '<p class="menuImportantText">No hay men&uacute; infantil.</p>' +
      '<p class="menuImportantText menuImportantText--takeaway">Envases para llevar: 1&euro; (Cobro obligatorio por Ley de Residuos 7/2020).</p>' +
      '</div>' +
      '</section>'
    );
  }

  function renderAllergensLegendVC() {
    const items = ALLERGEN_ORDER
      .map(function (key) {
        const src = ALLERGEN_ICONS[key];
        if (!src) return "";
        const label = allergenLabel(key);
        return '<div class="allergensLegendItem"><img src="' + escapeHtml(src) + '" class="allergenIcon" alt="' + escapeHtml(label) + '" loading="lazy" decoding="async" /><span class="allergensLegendLabel">' + escapeHtml(label) + "</span></div>";
      })
      .join("");

    return '<section class="allergensLegend" aria-label="Leyenda de al&eacute;rgenos"><h2 class="allergensLegendTitle">Leyenda de al&eacute;rgenos</h2><div class="allergensLegendGrid">' + items + "</div></section>";
  }

  function renderMenuHeroSliderVC(options) {
    const withAutoSlider = !!(options && options.auto);
    const reduced = prefersReducedMotion();
    const activeCls = reduced ? "menuHeroShot is-active is-reduced" : "menuHeroShot is-active";
    const src = withAutoSlider
      ? HERO_SLIDER_IMAGES[0]
      : (String((options && options.imageUrl) || "").trim() || HERO_DEFAULT_IMAGE);
    const autoAttr = withAutoSlider ? ' data-vc-menu-slider="1"' : "";

    return '<div class="menuHeroSlider" aria-label="Imágenes de comida"' + autoAttr + '><div class="menuHeroSliderStage" aria-hidden="true"><img src="' + escapeHtml(src) + '" alt="" class="' + activeCls + '" loading="eager" decoding="async" /></div></div>';
  }

  function startHeroSliderIfPresent() {
    clearHeroSliderTimers();
    const slider = root.querySelector('[data-vc-menu-slider="1"]');
    if (!slider) return;
    const stage = slider.querySelector(".menuHeroSliderStage");
    if (!stage) return;

    const reduced = prefersReducedMotion();
    const paths = HERO_SLIDER_IMAGES.slice();
    const bad = {};
    let active = 0;
    let prev = null;

    function appendShot(idx, cls) {
      const src = paths[idx];
      if (!src) return;
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.className = cls;
      img.loading = "eager";
      img.decoding = "async";
      img.addEventListener("error", function () {
        onError(idx);
      }, { once: true });
      stage.appendChild(img);
    }

    function findNextIndex(from) {
      if (paths.length <= 1) return from;
      for (let step = 1; step <= paths.length; step += 1) {
        const idx = (from + step) % paths.length;
        if (!bad[idx]) return idx;
      }
      return from;
    }

    function preloadNext() {
      if (paths.length <= 1) return;
      const next = findNextIndex(active);
      if (next === active) return;
      const img = new Image();
      img.decoding = "async";
      img.src = paths[next];
    }

    function draw() {
      stage.innerHTML = "";
      if (prev != null && !bad[prev]) {
        appendShot(prev, "menuHeroShot is-prev");
      }
      if (!bad[active]) {
        appendShot(active, reduced ? "menuHeroShot is-active is-reduced" : "menuHeroShot is-active");
      }
    }

    function dropPrevLater() {
      if (heroSliderPrevTimeout != null) {
        window.clearTimeout(heroSliderPrevTimeout);
      }
      heroSliderPrevTimeout = window.setTimeout(function () {
        prev = null;
        draw();
        heroSliderPrevTimeout = null;
      }, 1100);
    }

    function onError(idx) {
      if (bad[idx]) return;
      bad[idx] = true;
      if (idx !== active) return;
      const next = findNextIndex(active);
      if (next === active) return;
      prev = active;
      active = next;
      draw();
      dropPrevLater();
      preloadNext();
    }

    function advance() {
      const next = findNextIndex(active);
      if (next === active) return;
      prev = active;
      active = next;
      draw();
      dropPrevLater();
      preloadNext();
    }

    draw();
    preloadNext();
    if (!reduced && paths.length > 1) {
      heroSliderInterval = window.setInterval(advance, 3500);
    }
  }

  function mountVillaTemplate(tokens) {
    if (!state.templateHtml) return false;
    root.innerHTML = applyTokens(state.templateHtml, tokens || {});
    return true;
  }

  function renderVillaCarmen(menu) {
    if (!state.templateHtml) return false;

    if (state.menuType === "closed_conventional") {
      const showDishImages = !!menu.show_dish_images;
      const sections = getMenuViewSections(menu);
      const riceNotes = [
        "Arroces mínimo para 2 personas.",
        "Solamente un tipo de arroz en mesa completa para mesas de menos de 9 personas.",
        "En mesas a partir de 9 personas se podrán pedir dos arroces distintos, siendo uno de ellos seco y otro meloso.",
        "Si en mesas inferiores de 9 personas desean pedir dos tipos de arroces distintos, siendo uno seco y otro meloso, tendrían un suplemento de 12€ en la cuenta total, por servicio extra.",
      ];
      let riceLeadShown = false;
      const sectionBlocks = sections
        .map(function (section) {
          const titleLower = String(section.title || "").toLowerCase();
          const kind = String(section.kind || "").toLowerCase();
          const isRice = kind === "arroces" || titleLower.indexOf("arroz") >= 0;
          const isPickable = kind === "entrantes" || kind === "principales" || isRice;
          let html = "";
          if (isRice && !riceLeadShown) {
            riceLeadShown = true;
            html += '<p class="menuSectionLead">O si prefieres, puedes elegir uno de nuestros arroces como principal.</p>';
          }
          html += renderMenuSectionVC(section.title, section.dishes, isRice ? riceNotes : null, {
            pickable: isPickable,
            showImages: showDishImages,
            annotations: section.annotations,
          });
          return html;
        })
        .join("");

      const hasContent = sections.some(function (section) {
        return Array.isArray(section.dishes) && section.dishes.length > 0;
      });
      const emptyState = hasContent ? "" : '<div class="menuState">No hay contenido disponible.</div>';
      const priceCard = renderMenuPriceCardVC(formatMenuPrice(menu.price));
      const initialHeroSrc = HERO_SLIDER_IMAGES[0] || HERO_DEFAULT_IMAGE;
      const initialHeroClass = prefersReducedMotion() ? "menuHeroShot is-active is-reduced" : "menuHeroShot is-active";

      return mountVillaTemplate({
        MENU_TITLE: escapeHtml(menu.menu_title || "Menu sin titulo"),
        MENU_SUBTITLE: escapeHtml(menu.menu_subtitle[0] || "Jueves y viernes (no festivos)"),
        MENU_HERO_SHOTS: '<img src="' + escapeHtml(initialHeroSrc) + '" alt="" class="' + initialHeroClass + '" loading="eager" decoding="async" />',
        MENU_SECTION_STARTERS: sectionBlocks,
        MENU_SECTION_MAINS: "",
        MENU_SECTION_RICE_LEAD: "",
        MENU_SECTION_RICE: "",
        MENU_SECTION_OTHERS: "",
        MENU_EMPTY_STATE: emptyState,
        MENU_PRICE_CARD: priceCard,
        ALLERGENS_LEGEND: renderAllergensLegendVC(),
        CURRENT_YEAR: String(new Date().getFullYear()),
      });
    }

    if (state.menuType === "a_la_carte") {
      const sections = getMenuViewSections(menu);
      const comments = Array.isArray(menu.settings.comments) ? menu.settings.comments.filter(Boolean) : [];
      const showDishImages = !!menu.show_dish_images;
      let body = "";

      if (sections.length === 0) {
        body = '<div class="menuState">No hay contenido disponible.</div>';
      } else {
        const cards = sections
          .map(function (section) {
            if (showDishImages) {
              return '<article class="menuSectionCard"><h2 class="menuSectionTitle">' + escapeHtml(section.title) + "</h2>" + renderDishGrid(section.dishes, {
                showImages: true,
                showPriceLabel: true,
              }) + renderSectionAnnotations(section.annotations) + "</article>";
            }

            const rows = section.dishes.map(function (dish) {
              return renderMenuDishItem(dish, { withAllergens: true, showPriceLabel: true });
            }).join("");
            return '<article class="menuSectionCard"><h2 class="menuSectionTitle">' + escapeHtml(section.title) + '</h2><ul class="menuDishList">' + rows + "</ul>" + renderSectionAnnotations(section.annotations) + "</article>";
          })
          .join("");

        const notesLines = ['<p class="menuDishText menuMuted">' + escapeHtml(beverageLabel(menu.settings)) + "</p>"];
        comments.forEach(function (comment) {
          notesLines.push('<p class="menuDishText menuMuted">' + escapeHtml(comment) + "</p>");
        });
        const notesCard = notesLines.length
          ? '<article class="menuSectionCard"><h2 class="menuSectionTitle">Condiciones</h2>' + notesLines.join("") + "</article>"
          : "";

        body = '<div class="menuGrid">' + cards + notesCard + "</div>";
      }

      return mountVillaTemplate({
        MENU_TITLE: escapeHtml(menu.menu_title || "Menu sin titulo"),
        MENU_SUBTITLE: escapeHtml(menu.menu_subtitle[0] || "Carta convencional"),
        MENU_BODY: body,
        ALLERGENS_LEGEND: renderAllergensLegendVC(),
      });
    }

    if (state.menuType === "a_la_carte_group") {
      const sections = getMenuViewSections(menu);
      const subtitles = Array.isArray(menu.menu_subtitle) ? menu.menu_subtitle.filter(Boolean) : [];
      const comments = Array.isArray(menu.settings.comments) ? menu.settings.comments.filter(Boolean) : [];
      const showDishImages = !!menu.show_dish_images;
      const beverageLines = groupBeverageLines(menu);
      let body = "";

      if (sections.length === 0) {
        body = '<div class="menuState">No hay contenido disponible.</div>';
      } else {
        const sectionsHtml = sections
          .map(function (section) {
            if (showDishImages) {
              return '<section class="menuSubSection"><h3 class="menuSubTitle">' + escapeHtml(section.title) + "</h3>" + renderDishGrid(section.dishes, {
                showImages: true,
                showPriceLabel: true,
              }) + renderSectionAnnotations(section.annotations) + "</section>";
            }
            const rows = section.dishes.map(function (dish) {
              return renderMenuDishItem(dish, { withAllergens: false, showPriceLabel: true });
            }).join("");
            return '<section class="menuSubSection"><h3 class="menuSubTitle">' + escapeHtml(section.title) + '</h3><ul class="menuDishList">' + rows + "</ul>" + renderSectionAnnotations(section.annotations) + "</section>";
          })
          .join("");

        const subtitleBlock = subtitles.length
          ? '<div class="groupSubtitles">' + subtitles.map(function (line) { return '<p class="menuDishText menuMuted">' + escapeHtml(line) + "</p>"; }).join("") + "</div>"
          : '<p class="menuDishText menuMuted">(A partir de ' + escapeHtml(String(menu.settings.min_party_size || 8)) + ' personas)</p>';

        const forecastBlock =
          '<section class="menuSubSection">' +
          '<h3 class="menuSubTitle">Previsión</h3>' +
          '<p class="menuDishText">Cada persona elige platos de esta carta y paga según el precio de cada plato.</p>' +
          '<p class="menuDishText menuMuted">No existe un precio cerrado único para todo el menú.</p>' +
          "</section>";

        const beverageLinesHtml = beverageLines.map(function (line, idx) {
          return '<p class="' + (idx === 0 ? "menuDishText" : "menuDishText menuMuted") + '">' + escapeHtml(line) + "</p>";
        }).join("");

        const commentsSection = comments.length
          ? '<section class="menuSubSection"><h3 class="menuSubTitle">Comentarios</h3>' + comments.map(function (comment) { return '<p class="menuDishText menuMuted">' + escapeHtml(comment) + "</p>"; }).join("") + "</section>"
          : "";

        body =
          '<article class="menuSectionCard groupPanel">' +
          '<div class="menugrupos-decor">' +
          '<img class="menugrupos-flower-top-left" src="/media/menugrupos/pngegg.png" alt="" loading="lazy" />' +
          '<img class="menugrupos-flower-bottom-right" src="/media/menugrupos/pngegg2.png" alt="" loading="lazy" />' +
          '<img class="menugrupos-vine" src="/media/menugrupos/enredadera.png" alt="" loading="lazy" />' +
          "</div>" +
          '<h2 class="menuSectionTitle">' + escapeHtml(menu.menu_title || "Menu sin titulo") + "</h2>" +
          subtitleBlock +
          '<div class="menuGrid menuGrid--single">' +
          sectionsHtml +
          forecastBlock +
          '<section class="menuSubSection"><h3 class="menuSubTitle">Bebidas</h3>' + beverageLinesHtml + "</section>" +
          '<section class="menuSubSection"><h3 class="menuSubTitle">Café</h3><p class="menuDishText menuMuted">' + (menu.settings.included_coffee ? "Café incluido" : "Café no incluido") + "</p></section>" +
          commentsSection +
          "</div>" +
          "</article>";
      }

      return mountVillaTemplate({
        MENU_TITLE: escapeHtml(menu.menu_title || "Menu sin titulo"),
        MENU_SUBTITLE: escapeHtml(menu.menu_subtitle[0] || "Menu de grupos a la carta"),
        MENU_BODY: body,
      });
    }

    if (state.menuType === "closed_group") {
      const sections = getMenuViewSections(menu);
      const subtitles = Array.isArray(menu.menu_subtitle) ? menu.menu_subtitle.filter(Boolean) : [];
      const comments = Array.isArray(menu.settings.comments) ? menu.settings.comments.filter(Boolean) : [];
      const priceValue = Number(menu.price);
      const beverageLines = groupBeverageLines(menu);

      const sectionsHtml = sections
        .map(function (section) {
          const rows = section.dishes.map(function (dish) { return renderMenuDishItem(dish, { withAllergens: false, showPriceLabel: false }); }).join("");
          return '<section class="menuSubSection"><h3 class="menuSubTitle">' + escapeHtml(section.title) + '</h3><ul class="menuDishList">' + rows + "</ul>" + renderSectionAnnotations(section.annotations) + "</section>";
        })
        .join("");

      const subtitleBlock = subtitles.length
        ? '<div class="groupSubtitles">' + subtitles.map(function (s) { return '<p class="menuDishText menuMuted">' + escapeHtml(s) + "</p>"; }).join("") + "</div>"
        : '<p class="menuDishText menuMuted">(A partir de ' + escapeHtml(String(menu.settings.min_party_size || 8)) + ' personas)</p>';

      const beverageLinesHtml = beverageLines.map(function (line, idx) {
        return '<p class="' + (idx === 0 ? "menuDishText" : "menuDishText menuMuted") + '">' + escapeHtml(line) + "</p>";
      }).join("");

      const commentsHtml = comments.length
        ? '<section class="menuSubSection"><h3 class="menuSubTitle">Comentarios</h3>' + comments.map(function (c) { return '<p class="menuDishText menuMuted">' + escapeHtml(c) + "</p>"; }).join("") + "</section>"
        : "";

      return mountVillaTemplate({
        MENU_TITLE: escapeHtml(menu.menu_title || "Menu sin titulo"),
        PAGE_SUBTITLE: "Para mesas de más de 8 personas",
        GROUP_SUBTITLES_BLOCK: subtitleBlock,
        GROUP_SECTIONS: sectionsHtml,
        GROUP_BEVERAGE_LINES: beverageLinesHtml,
        GROUP_PRICE_LINE: Number.isFinite(priceValue) ? escapeHtml(formatEuro(priceValue) + " / pax") : escapeHtml(String(menu.price || "")),
        GROUP_COFFEE_LINE: menu.settings.included_coffee ? "Café incluido" : "Café no incluido",
        GROUP_COMMENTS_SECTION: commentsHtml,
        CURRENT_YEAR: String(new Date().getFullYear()),
      });
    }

    if (state.menuType === "special") {
      const showDishImages = !!menu.show_dish_images;
      const sections = getMenuViewSections(menu);
      const specialImageURL = resolveMediaURL(menu.special_menu_image_url || "");
      const hasImage = Boolean(specialImageURL);
      const body = sections.length
        ? '<div class="menuMain">' + sections.map(function (section) { return renderMenuSectionVC(section.title, section.dishes, null, { showImages: showDishImages, annotations: section.annotations }); }).join("") + "</div>"
        : '<div class="menuState">No hay contenido disponible.</div>';

      const heroMedia = hasImage
        ? '<img class="menuHeroShot is-active is-reduced" src="' + escapeHtml(specialImageURL) + '" alt="' + escapeHtml(menu.menu_title || "") + '" loading="eager" decoding="async" />'
        : renderMenuHeroSliderVC({ auto: true });

      return mountVillaTemplate({
        MENU_TITLE: escapeHtml(menu.menu_title || "Menu sin titulo"),
        MENU_SUBTITLE: escapeHtml(menu.menu_subtitle[0] || "Menu especial"),
        MENU_HERO_MEDIA: heroMedia,
        MENU_BODY: body,
        ALLERGENS_LEGEND: renderAllergensLegendVC(),
      });
    }

    return false;
  }

  function sectionHtmlGeneric(section) {
    const dishes = Array.isArray(section.dishes) ? section.dishes : [];
    const rows = dishes
      .map(function (dish) {
        const title = String((dish && (dish.title || dish.descripcion || dish.description)) || "").trim();
        if (!title) return "";
        const price = dish && dish.price != null ? '<span class="vc-item-price">+' + toMoney(dish.price) + "</span>" : "";
        return '<li class="vc-item"><span>' + escapeHtml(title) + "</span>" + price + "</li>";
      })
      .join("");
    return '<article class="vc-card"><h3>' + escapeHtml(section.title || "Seccion") + '</h3><ul class="vc-list">' + (rows || '<li class="vc-empty">Sin platos</li>') + "</ul>" + renderSectionAnnotations(normalizeSectionAnnotations(section.annotations)) + "</article>";
  }

  function renderGeneric(menu) {
    const subtitle = menu.menu_subtitle[0] || "Preview en tiempo real";
    const content = menu.sections.length ? menu.sections.map(sectionHtmlGeneric).join("") : '<article class="vc-card"><p class="vc-empty">Sin secciones aun</p></article>';
    const comments = Array.isArray(menu.settings.comments)
      ? menu.settings.comments.filter(Boolean).map(function (c) { return "<li>" + escapeHtml(c) + "</li>"; }).join("")
      : "";
    const isPerDishMenu = state.menuType === "a_la_carte" || state.menuType === "a_la_carte_group";

    const specialImageURL = resolveMediaURL(menu.special_menu_image_url || "");
    const imageBlock = state.menuType === "special" && specialImageURL
      ? '<img class="vc-hero-image" src="' + escapeHtml(specialImageURL) + '" alt="Imagen menu" />'
      : "";

    const shell = state.templateHtml || '<section class="vc-shell"><header class="vc-hero"><div class="vc-kicker" data-bind="kicker"></div><h1 class="vc-title" data-bind="title"></h1><p class="vc-subtitle" data-bind="subtitle"></p></header><div class="vc-body"><div class="vc-content" data-bind="content"></div><aside class="vc-meta"><article class="vc-card"><h3>Precio</h3><div class="vc-price" data-bind="price"></div><p class="vc-subtitle" data-bind="beverage"></p><p class="vc-subtitle" data-bind="coffee"></p></article><article class="vc-card"><h3>Comentarios</h3><ul class="vc-comments" data-bind="comments"></ul></article><div data-bind="image"></div></aside></div></section>';

    root.innerHTML = shell;
    bindText("kicker", labelByType(state.menuType));
    bindText("title", menu.menu_title || "Menu sin titulo");
    bindText("subtitle", subtitle);
    bindHtml("content", content);
    bindText("price", isPerDishMenu ? "Precio por plato" : toMoney(menu.price));
    bindText("beverage", beverageLabel(menu.settings));
    bindText("coffee", menu.settings.included_coffee ? "Cafe incluido" : "Cafe no incluido");
    bindHtml("comments", comments || '<li class="vc-empty">Sin comentarios</li>');
    bindHtml("image", imageBlock);
  }

  function labelByType(type) {
    if (type === "closed_group") return "Menu cerrado grupo";
    if (type === "a_la_carte") return "Menu carta convencional";
    if (type === "a_la_carte_group") return "Menu carta grupo";
    if (type === "special") return "Menu especial";
    return "Menu cerrado convencional";
  }

  function render() {
    if (!root) return;
    clearHeroSliderTimers();
    closeDishLightbox();
    const menu = normalizeMenu(state.menu);
    if (state.themeId === "villa-carmen") {
      const rendered = renderVillaCarmen(menu);
      if (rendered) {
        attachDishCardImageFallbackHandlers();
        attachDishCardLightboxHandlers();
        startHeroSliderIfPresent();
        return;
      }
    }
    renderGeneric(menu);
    attachDishCardImageFallbackHandlers();
    attachDishCardLightboxHandlers();
  }

  async function loadTemplate() {
    const url = "/menu-preview/templates/" + encodeURIComponent(state.themeId) + "/menus/" + encodeURIComponent(state.menuType) + ".html";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("template not found");
      state.templateHtml = await res.text();
    } catch (_err) {
      state.templateHtml = "";
    }
  }

  async function applyTheme(themeId, menuType) {
    state.themeId = normalizeThemeId(themeId);
    state.menuType = safeType(menuType);
    if (themeLink) {
      themeLink.setAttribute("href", "/menu-preview/templates/" + encodeURIComponent(state.themeId) + "/theme.css");
    }
    await loadTemplate();
    render();
  }

  window.addEventListener("message", function (event) {
    const msg = event && event.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "vc_preview:init") {
      applyTheme(msg.theme_id || "villa-carmen", msg.menu_type || "closed_conventional");
      if (msg.menu) {
        state.menu = msg.menu;
        render();
      }
      return;
    }

    if (msg.type === "vc_preview:update") {
      if (msg.theme_id && normalizeThemeId(msg.theme_id) !== state.themeId) {
        applyTheme(msg.theme_id, msg.menu_type || state.menuType).then(function () {
          state.menu = msg.menu || state.menu;
          render();
        });
        return;
      }
      if (msg.menu_type && msg.menu_type !== state.menuType) {
        applyTheme(state.themeId, msg.menu_type).then(function () {
          state.menu = msg.menu || state.menu;
          render();
        });
        return;
      }
      state.menu = msg.menu || state.menu;
      render();
    }
  });

  applyTheme("villa-carmen", "closed_conventional");
})();
