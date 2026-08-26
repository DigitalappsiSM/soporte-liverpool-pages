(() => {
  const API = "https://portal-soporte-liverpool.escanor-enrique.chatgpt.site/api/tickets";
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
  const storeOptions = q("#store-options");
  const modelsSlot = q("#models-slot");
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
  const commentCount = q("#comment-count");

  const MIN_COMMENT = 12;

  // Populate store datalist
  for (const store of stores) {
    const option = document.createElement("option");
    option.value = store.label;
    option.label = store.determinant;
    storeOptions.append(option);
  }

  const currentStore = () =>
    stores.find((item) => item.label === storeInput.value || item.determinant === storeInput.value);

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
  const isTicketTypeValid = () => ticketType === "soporte" || ticketType === "contenido";
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
    sType.textContent = ticketType ? (ticketType === "soporte" ? "Soporte" : "Contenido") : "Sin tipo de ticket";
    sStore.textContent = store ? store.label : "Sin tienda";
    sModels.textContent = selected.size ? [...selected].join(" · ") : "Sin soporte";
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

    // Progress bar
    const done = [isNameValid(), isTicketTypeValid(), isStoreValid(), areModelsValid(), isCommentValid()].filter(Boolean).length;
    progressFill.style.width = (done / 5) * 100 + "%";
    progressBar.setAttribute("aria-valuenow", String(done));
    stepsDone.textContent = String(done);

    submit.disabled = !(done === 5 && isStoreEmailValid());
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

  storeInput.oninput = () => {
    clearError(storeInput, "store-error");
    renderModels();
  };
  storeInput.onblur = () => {
    if (storeInput.value.trim() === "") { setWrap(storeInput, "neutral"); clearError(storeInput, "store-error"); }
    else if (!isStoreValid()) showError(storeInput, "store-error", "Selecciona una tienda de la lista.");
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

    const file = attachment.files && attachment.files[0];
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
    body.set("models", JSON.stringify([...selected]));
    body.set("comments", comments.value.trim());
    body.set("openedAt", String(openedAt));
    body.set("website", q("#website").value);
    if (file) body.set("attachment", file);

    try {
      const response = await fetch(API, { method: "POST", body });
      const result = await response.json();
      if (!response.ok || !result.folio) throw new Error(result.error || "No fue posible crear el ticket.");
      q("#form-content").hidden = true;
      q("#ticket-folio").textContent = result.folio;
      q("#success-message").textContent = normalizedStoreEmail()
        ? "La incidencia quedó registrada. Las actualizaciones se enviarán a Jaqueline Juárez y a " + normalizedStoreEmail() + "."
        : "La incidencia quedó registrada y las actualizaciones se enviarán a Jaqueline Juárez.";
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
    renderModels();
  };

  update();
})();
