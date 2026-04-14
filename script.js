

const STORAGE_KEY = "notes_app_v2_notes";


let notes = [];
let activeNoteId = null;
let saveTimeout = null;
let viewingTrash = false;

const elements = {
  newNoteBtn: document.getElementById("new-note-btn"),
  deleteNoteBtn: document.getElementById("delete-note-btn"),
  pinNoteBtn: document.getElementById("pin-note-btn"),
  notesList: document.getElementById("notes-list"),
  noteTitle: document.getElementById("note-title"),
  noteContent: document.getElementById("note-content"),
  noteTagsInput: document.getElementById("note-tags-input"),
  searchInput: document.getElementById("search-input"),
  saveStatus: document.getElementById("save-status"),
  wordCount: document.getElementById("word-count"),
  sortSelect: document.getElementById("sort-select"),
  filterPinnedBtn: document.getElementById("filter-pinned-btn"),
  filterTrashBtn: document.getElementById("filter-trash-btn"),
  exportNotesBtn: document.getElementById("export-notes-btn"),
  importNotesInput: document.getElementById("import-notes-input"),
colorDots: document.querySelectorAll(".color-dot"),
};

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      notes = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      notes = parsed;
    } else {
      notes = [];
    }
  } catch {
    notes = [];
  }
}

function persistNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function createNote() {
  const now = new Date().toISOString();
  const note = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    title: "",
    content: "",
    tags: [],
    pinned: false,
    color: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  notes.unshift(note);
  activeNoteId = note.id;
  renderNotesList();
  selectNote(activeNoteId);
}

function deleteActiveNote() {
  if (!activeNoteId) return;
  const index = notes.findIndex((n) => n.id === activeNoteId);
  if (index === -1) return;

  const note = notes[index];
  if (note.deletedAt) {
    // Permanently delete if already in trash
    notes.splice(index, 1);
  } else {
    // Move to trash
    note.deletedAt = new Date().toISOString();
  }
  if (notes.length) {
    const newIndex = Math.min(index, notes.length - 1);
    activeNoteId = notes[newIndex].id;
  } else {
    activeNoteId = null;
  }

  persistNotes();
  renderNotesList();
  if (activeNoteId) {
    selectNote(activeNoteId);
  } else {
    clearEditor();
  }
}

function clearEditor() {
  elements.noteTitle.value = "";
  elements.noteContent.value = "";
  elements.noteTagsInput.value = "";
  elements.deleteNoteBtn.disabled = true;
  elements.pinNoteBtn.classList.remove("active");
  elements.wordCount.textContent = "0 words";
}

function selectNote(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  activeNoteId = id;
  elements.noteTitle.value = note.title;
  elements.noteContent.value = note.content;
  elements.noteTagsInput.value = note.tags?.join(", ") || "";
  elements.deleteNoteBtn.disabled = false;
  elements.pinNoteBtn.classList.toggle("active", !!note.pinned);
  updateWordCount();
  renderNotesList();
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderNotesList() {
  const query = elements.searchInput.value.trim().toLowerCase();

  elements.notesList.innerHTML = "";

  let filtered = notes.filter((n) =>
    viewingTrash ? n.deletedAt : !n.deletedAt
  );

  if (elements.filterPinnedBtn.classList.contains("active") && !viewingTrash) {
    filtered = filtered.filter((n) => n.pinned);
  }

  if (query) {
    filtered = filtered.filter((n) => {
      const haystack = (n.title + " " + n.content + " " + (n.tags || []).join(" ")).toLowerCase();
      return haystack.includes(query);
    });
  }

  const sortValue = elements.sortSelect.value;
  filtered.sort((a, b) => {
    if (sortValue === "created_asc") {
      return new Date(a.createdAt) - new Date(b.createdAt);
    }
    if (sortValue === "title_asc") {
      return a.title.localeCompare(b.title);
    }
    // default: updated_desc
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  // pinned always at top within current filter (when not viewing trash)
  if (!viewingTrash) {
    filtered.sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1));
  }

  if (!filtered.length) {
    const empty = document.createElement("li");
    if (viewingTrash) {
      empty.textContent = "Trash is empty.";
    } else {
      empty.textContent = query ? "No notes match your search." : "No notes yet. Create one!";
    }
    empty.className = "notes-list-empty";
    elements.notesList.appendChild(empty);
    return;
  }

  filtered.forEach((note) => {
    const li = document.createElement("li");
    li.className = "notes-list-item";
    if (note.color) {
      li.dataset.color = note.color;
    }
    if (note.id === activeNoteId) {
      li.classList.add("active");
    }
    li.dataset.id = note.id;

    const title = document.createElement("div");
    title.className = "notes-list-title";
    title.textContent = note.title || "Untitled note";

    const preview = document.createElement("div");
    preview.className = "notes-list-preview";
    preview.textContent = note.content || "Write something...";

    const meta = document.createElement("div");
    meta.className = "notes-list-meta";

    const timeSpan = document.createElement("span");
    timeSpan.textContent = viewingTrash
      ? `Deleted ${formatDate(note.deletedAt)}`
      : formatDate(note.updatedAt);

    const tag = document.createElement("span");
    tag.className = "tag-pill";
    if (viewingTrash) {
      tag.textContent = "Trash";
    } else if (note.pinned) {
      tag.textContent = "Pinned";
    } else if (note.tags && note.tags.length) {
      tag.textContent = note.tags[0];
    } else if (note.title) {
      tag.textContent = "Note";
    } else {
      tag.textContent = "Draft";
    }

    meta.appendChild(timeSpan);
    meta.appendChild(tag);

    li.appendChild(title);
    li.appendChild(preview);
    li.appendChild(meta);

    li.addEventListener("click", () => selectNote(note.id));

    elements.notesList.appendChild(li);
  });
}

function scheduleSaveStatus(message) {
  elements.saveStatus.textContent = message;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    elements.saveStatus.textContent = "All changes saved";
  }, 900);
}

function updateWordCount() {
  const content = elements.noteContent.value || "";
  const words = content.trim()
    ? content.trim().split(/\s+/).length
    : 0;
  elements.wordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function handleEditorChange() {
  if (!activeNoteId) {
    // If no active note but user starts typing it makes 1 
    createNote();
  }
  const note = notes.find((n) => n.id === activeNoteId);
  if (!note) return;

  note.title = elements.noteTitle.value;
  note.content = elements.noteContent.value;
  const tagsRaw = elements.noteTagsInput.value || "";
  note.tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  note.updatedAt = new Date().toISOString();

  persistNotes();
  renderNotesList();
  scheduleSaveStatus("Saving…");
  updateWordCount();
}

function togglePinActiveNote() {
  if (!activeNoteId) return;
  const note = notes.find((n) => n.id === activeNoteId);
  if (!note) return;
  note.pinned = !note.pinned;
  note.updatedAt = new Date().toISOString();
  elements.pinNoteBtn.classList.toggle("active", note.pinned);
  persistNotes();
  renderNotesList();
}

function setColorForActiveNote(color) {
  if (!activeNoteId) return;
  const note = notes.find((n) => n.id === activeNoteId);
  if (!note) return;
  note.color = color;
  note.updatedAt = new Date().toISOString();
  persistNotes();
  renderNotesList();
}



function exportNotes() {
  const blob = new Blob([JSON.stringify(notes, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "notes-export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importNotesFromFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!Array.isArray(parsed)) return;
      // basic normalize
      notes = parsed.map((n) => ({
        id: n.id || String(Date.now() + Math.random()),
        title: n.title || "",
        content: n.content || "",
        tags: Array.isArray(n.tags) ? n.tags : [],
        pinned: !!n.pinned,
        color: n.color || null,
        deletedAt: n.deletedAt || null,
        createdAt: n.createdAt || new Date().toISOString(),
        updatedAt: n.updatedAt || new Date().toISOString(),
      }));
      if (notes.length) {
        activeNoteId = notes[0].id;
      } else {
        activeNoteId = null;
      }
      persistNotes();
      renderNotesList();
      if (activeNoteId) {
        selectNote(activeNoteId);
      } else {
        clearEditor();
      }
      scheduleSaveStatus("Imported");
    } catch {
      // ignore malformed
    }
  };
  reader.readAsText(file);
}

function init() {
  loadNotes();

  if (!notes.length) {
    createNote();
  } else {
    activeNoteId = notes[0].id;
    selectNote(activeNoteId);
  }

  renderNotesList();

  elements.newNoteBtn.addEventListener("click", () => {
    createNote();
    elements.noteTitle.focus();
  });

  elements.deleteNoteBtn.addEventListener("click", () => {
    if (!activeNoteId) return;
    const confirmed = confirm("Delete this note? This cannot be undone.");
    if (confirmed) {
      deleteActiveNote();
      scheduleSaveStatus("Deleted");
    }
  });

  elements.noteTitle.addEventListener("input", handleEditorChange);
  elements.noteContent.addEventListener("input", handleEditorChange);
  elements.noteTagsInput.addEventListener("input", handleEditorChange);
  elements.noteContent.addEventListener("input", updateWordCount);

  elements.searchInput.addEventListener("input", () => {
    renderNotesList();
  });

  elements.sortSelect.addEventListener("change", () => {
    renderNotesList();
  });

  elements.filterPinnedBtn.addEventListener("click", () => {
    if (viewingTrash) return;
    elements.filterPinnedBtn.classList.toggle("active");
    renderNotesList();
  });

  elements.filterTrashBtn.addEventListener("click", () => {
    viewingTrash = !viewingTrash;
    elements.filterTrashBtn.classList.toggle("active", viewingTrash);
    elements.filterPinnedBtn.classList.toggle("active", false);
    renderNotesList();
  });

  elements.pinNoteBtn.addEventListener("click", togglePinActiveNote);

  elements.colorDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const color = dot.getAttribute("data-color");
      setColorForActiveNote(color);
    });
  });

elements.exportNotesBtn.addEventListener("click", exportNotes);

  elements.importNotesInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) {
      importNotesFromFile(file);
      // reset input so the same file can be chosen again if needed
      event.target.value = "";
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      elements.noteContent.focus();
      scheduleSaveStatus("Saved");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);


