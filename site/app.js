(() => {
  const API = "https://portal-soporte-liverpool.chelito-esteban91.workers.dev/api/tickets";
  const stores = window.LIVERPOOL_STORES || [];
  const selected = new Set();
  let ticketType = "";
  let openedAt = Date.now();

  const q = (s) => document.querySelector(s);
  const form = q("#support-form");
  const requester = q("#requesterName");
  const storeEmail = q("#storeEmail");
  const ticketTypeButtons = [...document.querySelectorAll(".ticket-type-card")];
  const storeInput = q("#store");
  const storeList = q("#store-options");
  const modelsSlot = q("#models-slot");
  const commentsSlot = q("#comments-slot");
  const modelGrid = q("#model-grid");
  const modelsEmpty = q("#models-empty");
  const comments = q("#comments");
  const attachment = q("#attachment");
  const attachmentName = q("#attachment-name");
  const submit = q("#submit-button");
  const error = q("#form-error");
  const progressFill = q("#progress-fill");
  const progressBar = q("#progress-bar");
  const stepsDone = q("#steps-done");
  const stepsTotal = q("#steps-total");
  const commentCount = q("#comment-count");

  const MIN_COMMENT = 12;
  const TYPE_LABELS = { soporte: "Soporte", contenido: "Contenido", testigos: "Testigos" };
  const isTestigos = () => ticketType === "testigos";

  // Accent- and case-insensitive text used to match stores.
  const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const currentStore = () => {
    const value = normalize(storeInput.value);
    if (!value) return undefined;
    return stores.find((item) => normalize(item.label) === value || item.determinant === value);
  };

  function chipClass(model) {
    const key = model.toLowerCase().replaceAll(" ", "-").replace("°", "");
    return key.startsWith("vwpl") ? "chip-vwpl" : "chip-" + key;
  }

  // ---- Field-level validation helpers ----
  function setWrap(input, state) {
    const wrap = input.closest(".field-wrap");
    if (!wrap) return;
    wrap.classList.toggle("is-valid", state === "valid");
    wrap.classList.toggle("is-invalid", state === "invalid");
  }

  function showError(input, id, message) {
    const el = q("#" + id);
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
    if (input.tagName === "TEXTAREA") input.classList.add("is-invalid");
    else setWrap(input, "invalid");
  }

  function clearError(input, id) {
    const el = q("#" + id);
    if (el) el.hidden = true;
    if (input.tagName === "TEXTAREA") input.classList.remove("is-invalid");
  }

  const isNameValid = () => requester.value.trim().length >= 3;
  const normalizedStoreEmail = () => storeEmail.value.trim().toLowerCase();
  const isStoreEmailValid = () => {
    const value = normalizedStoreEmail();
    return value === "" || /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@liverpool\.com\.mx$/.test(value);
  };
  const isTicketTypeValid = () => Object.hasOwn(TYPE_LABELS, ticketType);
  const isStoreValid = () => Boolean(currentStore());
  const areModelsValid = () => selected.size > 0;
  const isCommentValid = () => comments.value.trim().length >= MIN_COMMENT;

  function markStep(step, complete) {
    const slot = document.querySelector('.slot[data-step="' + step + '"]');
    if (slot) slot.classList.toggle("is-complete", complete);
  }

  // ---- Models rendering ----
  function renderModels() {
    const store = currentStore();
    selected.clear();
    modelGrid.replaceChildren();
    if (!store) {
      modelsSlot.disabled = true;
      modelsSlot.classList.add("slot-disabled");
      modelsEmpty.hidden = false;
      modelGrid.hidden = true;
      return update();
    }
    modelsSlot.disabled = false;
    modelsSlot.classList.remove("slot-disabled");
    modelsEmpty.hidden = true;
    modelGrid.hidden = false;
    for (const model of [...store.models, "Otro"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "model-chip " + chipClass(model);
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = '<span class="chip-dot"></span>' + model + '<span class="chip-check">✓</span>';
      button.onclick = () => {
        selected.has(model) ? selected.delete(model) : selected.add(model);
        button.classList.toggle("selected", selected.has(model));
        button.setAttribute("aria-pressed", String(selected.has(model)));
        comments.placeholder = selected.has("Otro")
          ? "Describe el soporte no catalogado y la incidencia…"
          : "¿Qué está ocurriendo? Incluye desde cuándo y qué se ha intentado…";
        update();
      };
      modelGrid.append(button);
    }
    update();
  }

  // ---- Global state sync ----
  function update() {
    const store = currentStore();
    const length = comments.value.trim().length;

    // Live comment counter
    commentCount.textContent = length >= MIN_COMMENT ? "Mínimo alcanzado ✓" : length + "/" + MIN_COMMENT + " mínimo";
    commentCount.classList.toggle("warning", length > 0 && length < MIN_COMMENT);
    commentCount.classList.toggle("ready", length >= MIN_COMMENT);

    // Summary line
    const sReq = q("#summary-requester");
    const sType = q("#summary-type");
    const sStore = q("#summary-store");
    const sModels = q("#summary-models");
    sReq.textContent = requester.value.trim() || "Sin solicitante";
    sType.textContent = TYPE_LABELS[ticketType] || "Sin tipo de ticket";
    sStore.textContent = store ? store.label : "Sin tienda";
    sModels.textContent = selected.size ? [...selected].join(" · ") : "Sin soporte";
    sModels.hidden = isTestigos();
    sReq.classList.toggle("filled", isNameValid());
    sType.classList.toggle("filled", isTicketTypeValid());
    sStore.classList.toggle("filled", isStoreValid());
    sModels.classList.toggle("filled", areModelsValid());

    // Step completion badges
    markStep(1, isNameValid());
    markStep(2, isTicketTypeValid());
    markStep(3, isStoreValid());
    markStep(4, areModelsValid());
    markStep(5, isCommentValid());

    // Live valid marker on store input once it matches
    if (isStoreValid()) setWrap(storeInput, "valid");
    else if (!storeInput.value) setWrap(storeInput, "neutral");

    // Testigos only needs requester, type and store.
    modelsSlot.hidden = isTestigos();
    commentsSlot.hidden = isTestigos();

    // Progress bar
    const steps = [isNameValid(), isTicketTypeValid(), isStoreValid()];
    if (!isTestigos()) steps.push(areModelsValid(), isCommentValid());
    const done = steps.filter(Boolean).length;
    progressFill.style.width = (done / steps.length) * 100 + "%";
    progressBar.setAttribute("aria-valuemax", String(steps.length));
    progressBar.setAttribute("aria-valuenow", String(done));
    stepsDone.textContent = String(done);
    stepsTotal.textContent = String(steps.length);

    submit.disabled = !(done === steps.length && isStoreEmailValid());
  }

  // ---- Field events (validate on blur, recover on input) ----
  requester.oninput = () => {
    if (isNameValid()) {
      clearError(requester, "requesterName-error");
      setWrap(requester, "valid");
    } else if (requester.closest(".field-wrap").classList.contains("is-invalid") && requester.value === "") {
      setWrap(requester, "neutral");
    }
    update();
  };
  requester.onblur = () => {
    if (requester.value.trim() === "") { setWrap(requester, "neutral"); clearError(requester, "requesterName-error"); }
    else if (!isNameValid()) showError(requester, "requesterName-error", "Ingresa al menos 3 caracteres.");
    else { clearError(requester, "requesterName-error"); setWrap(requester, "valid"); }
  };

  storeEmail.oninput = () => {
    if (!storeEmail.value.trim()) {
      clearError(storeEmail, "storeEmail-error");
      setWrap(storeEmail, "neutral");
    } else if (isStoreEmailValid()) {
      clearError(storeEmail, "storeEmail-error");
      setWrap(storeEmail, "valid");
    }
    update();
  };
  storeEmail.onblur = () => {
    if (!storeEmail.value.trim()) {
      clearError(storeEmail, "storeEmail-error");
      setWrap(storeEmail, "neutral");
    } else if (!isStoreEmailValid()) {
      showError(storeEmail, "storeEmail-error", "Usa un correo válido que termine en @liverpool.com.mx.");
    } else {
      storeEmail.value = normalizedStoreEmail();
      clearError(storeEmail, "storeEmail-error");
      setWrap(storeEmail, "valid");
    }
    update();
  };

  for (const button of ticketTypeButtons) {
    button.onclick = () => {
      ticketType = button.dataset.ticketType || "";
      for (const option of ticketTypeButtons) {
        const selectedType = option === button;
        option.classList.toggle("selected", selectedType);
        option.setAttribute("aria-checked", String(selectedType));
      }
      update();
    };
  }

  // ---- Store combobox (replaces <datalist>, which renders inconsistently across browsers) ----
  let matches = [];
  let activeIndex = -1;
  let lastStore;

  function filterStores() {
    const query = normalize(storeInput.value);
    if (!query) return stores;
    return stores.filter((item) => item.determinant.startsWith(query) || normalize(item.label).includes(query));
  }

  function setActive(index) {
    const options = storeList.querySelectorAll(".combobox-option");
    options.forEach((option, i) => option.classList.toggle("is-active", i === index));
    activeIndex = index;
    if (index >= 0 && options[index]) {
      storeInput.setAttribute("aria-activedescendant", options[index].id);
      options[index].scrollIntoView({ block: "nearest" });
    } else {
      storeInput.removeAttribute("aria-activedescendant");
    }
  }

  function openList() {
    matches = filterStores();
    const chosen = currentStore();
    storeList.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("li");
      empty.className = "combobox-empty";
      empty.textContent = "No encontramos tiendas con ese determinante o nombre.";
      storeList.append(empty);
    }
    matches.forEach((item, i) => {
      const option = document.createElement("li");
      option.id = "store-option-" + item.determinant;
      option.className = "combobox-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(item === chosen));
      const code = document.createElement("b");
      code.textContent = item.determinant;
      const name = document.createElement("span");
      name.textContent = item.name;
      option.append(code, name);
      option.onclick = () => chooseStore(item);
      option.onmousemove = () => { if (activeIndex !== i) setActive(i); };
      storeList.append(option);
    });
    storeList.hidden = false;
    storeInput.setAttribute("aria-expanded", "true");
    setActive(-1);
  }

  function closeList() {
    storeList.hidden = true;
    storeInput.setAttribute("aria-expanded", "false");
    setActive(-1);
  }

  function storeChanged() {
    const store = currentStore();
    if (store === lastStore) return update();
    lastStore = store;
    renderModels();
  }

  function chooseStore(item) {
    storeInput.value = item.label;
    clearError(storeInput, "store-error");
    setWrap(storeInput, "valid");
    closeList();
    storeChanged();
  }

  // Keep focus in the input while tapping or clicking an option.
  storeList.onmousedown = (event) => event.preventDefault();

  const narrowScreen = window.matchMedia("(max-width: 620px)");
  storeInput.onfocus = () => {
    openList();
    // On phones, lift the field so the on-screen keyboard does not cover the list.
    if (narrowScreen.matches) setTimeout(() => storeInput.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
  };
  storeInput.onclick = () => { if (storeList.hidden) openList(); };
  storeInput.oninput = () => {
    clearError(storeInput, "store-error");
    openList();
    storeChanged();
  };
  storeInput.onkeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (storeList.hidden) openList();
      if (!matches.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      if (storeList.hidden) return;
      event.preventDefault();
      if (activeIndex >= 0) chooseStore(matches[activeIndex]);
      else if (matches.length === 1) chooseStore(matches[0]);
    } else if (event.key === "Escape" && !storeList.hidden) {
      event.preventDefault();
      closeList();
    }
  };
  storeInput.onblur = () => {
    closeList();
    const store = currentStore();
    if (store) storeInput.value = store.label;
    if (storeInput.value.trim() === "") { setWrap(storeInput, "neutral"); clearError(storeInput, "store-error"); }
    else if (!store) showError(storeInput, "store-error", "Selecciona una tienda de la lista.");
    else { clearError(storeInput, "store-error"); setWrap(storeInput, "valid"); }
  };

  comments.oninput = () => {
    if (isCommentValid()) clearError(comments, "comments-error");
    update();
  };
  comments.onblur = () => {
    const len = comments.value.trim().length;
    if (len > 0 && len < MIN_COMMENT) showError(comments, "comments-error", "Describe el problema con al menos " + MIN_COMMENT + " caracteres.");
    else clearError(comments, "comments-error");
  };

  attachment.onchange = () => {
    const file = attachment.files && attachment.files[0];
    attachmentName.textContent = file ? file.name : "Adjuntar evidencia";
  };

  // ---- Submit ----
  form.onsubmit = async (event) => {
    event.preventDefault();
    const store = currentStore();
    if (submit.disabled || !store) return;

    const file = !isTestigos() && attachment.files && attachment.files[0];
    if (file && file.size > 10485760) {
      error.textContent = "El archivo no puede superar 10 MB.";
      error.hidden = false;
      return;
    }
    error.hidden = true;
    submit.disabled = true;
    submit.classList.add("is-loading");
    submit.innerHTML = "Enviando a Odoo… <span>→</span>";

    const body = new FormData();
    body.set("requesterName", requester.value.trim());
    if (normalizedStoreEmail()) body.set("storeEmail", normalizedStoreEmail());
    body.set("ticketType", ticketType);
    body.set("determinant", store.determinant);
    body.set("storeName", store.name);
    body.set("models", JSON.stringify(isTestigos() ? [] : [...selected]));
    body.set("comments", isTestigos() ? "" : comments.value.trim());
    body.set("openedAt", String(openedAt));
    body.set("website", q("#website").value);
    if (file) body.set("attachment", file);

    try {
      const response = await fetch(API, { method: "POST", body });
      const result = await response.json();
      if (!response.ok || !result.folio) throw new Error(result.error || "No fue posible crear el ticket.");
      q("#form-content").hidden = true;
      q("#ticket-folio").textContent = result.folio;
      const warnings = Array.isArray(result.warnings) ? result.warnings.filter((message) => typeof message === "string") : [];
      q("#success-message").textContent = warnings.length
        ? "La incidencia quedó registrada. " + warnings.join(" ")
        : normalizedStoreEmail()
          ? "La incidencia quedó registrada. Jaqueline Juárez y el correo de la tienda quedaron incluidos como seguidores del ticket."
          : "La incidencia quedó registrada. Jaqueline Juárez está incluida en el seguimiento.";
      q("#success-state").hidden = false;
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : "No fue posible crear el ticket.";
      error.hidden = false;
      submit.classList.remove("is-loading");
      submit.innerHTML = "Enviar ticket <span>→</span>";
      update();
    }
  };

  // ---- Reset ----
  q("#reset-button").onclick = () => {
    form.reset();
    selected.clear();
    ticketType = "";
    for (const button of ticketTypeButtons) {
      button.classList.remove("selected");
      button.setAttribute("aria-checked", "false");
    }
    openedAt = Date.now();
    q("#success-state").hidden = true;
    q("#form-content").hidden = false;
    attachmentName.textContent = "Adjuntar evidencia";
    submit.classList.remove("is-loading");
    submit.innerHTML = "Enviar ticket <span>→</span>";
    setWrap(requester, "neutral");
    setWrap(storeEmail, "neutral");
    setWrap(storeInput, "neutral");
    clearError(requester, "requesterName-error");
    clearError(storeEmail, "storeEmail-error");
    clearError(storeInput, "store-error");
    clearError(comments, "comments-error");
    closeList();
    lastStore = undefined;
    renderModels();
  };

  update();
})();
