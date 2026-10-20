
"use strict";

const audioFile = document.getElementById("audioFile");
const uploadZone = document.getElementById("uploadZone");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const audioPreview = document.getElementById("audioPreview");
const originalAudio = document.getElementById("originalAudio");
const removeFileButton = document.getElementById("removeFile");
const styleGrid = document.getElementById("styleGrid");
const selectedStyleLabel = document.getElementById("selectedStyle");
const transformButton = document.getElementById("transformButton");
const statusMessage = document.getElementById("statusMessage");

const MAX_FILE_SIZE = 30 * 1024 * 1024;

const styles = {
  classic: "Classic Rock",
  hard: "Hard Rock",
  pop: "Pop Rock",
  punk: "Punk Rock",
  metal: "Heavy Metal",
  acoustic: "Acoustic Rock"
};

let currentFile = null;
let currentObjectUrl = null;
let selectedStyle = "classic";

function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSupportedAudio(file) {
  const name = file.name.toLowerCase();

  return (
    /\.(mp3|wav)$/.test(name) ||
    ["audio/mpeg", "audio/wav", "audio/x-wav"].includes(file.type)
  );
}

function clearAudio() {
  originalAudio.pause();
  originalAudio.removeAttribute("src");
  originalAudio.load();

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  currentFile = null;
  audioFile.value = "";

  fileInfo.classList.add("hidden");
  audioPreview.classList.add("hidden");

  fileName.textContent = "";
  fileSize.textContent = "";

  showStatus("သီချင်းဖိုင်တစ်ခုကို ရွေးချယ်ပြီး စတင်လိုက်ပါ။");
}

function loadAudio(file) {
  if (!file) return;

  if (!isSupportedAudio(file)) {
    showStatus("MP3 သို့မဟုတ် WAV ဖိုင်ကိုသာ ရွေးချယ်ပေးပါ။", "error");
    return;
  }

  if (file.size === 0) {
    showStatus("ဖိုင်ထဲမှာ အသံဒေတာမရှိပါ။ အခြားဖိုင်ရွေးပါ။", "error");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showStatus("ဖိုင်အရွယ်အစား 30 MB ထက် မကျော်ရပါ။", "error");
    return;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentFile = file;
  currentObjectUrl = URL.createObjectURL(file);

  originalAudio.src = currentObjectUrl;
  originalAudio.load();

  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);

  fileInfo.classList.remove("hidden");
  audioPreview.classList.remove("hidden");

  showStatus(
    "သီချင်းဖိုင် အဆင်သင့်ဖြစ်ပါပြီ။ မူရင်းသီချင်းကို နားထောင်ကြည့်နိုင်ပါတယ်။",
    "success"
  );
}

audioFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  loadAudio(file);
});

removeFileButton.addEventListener("click", clearAudio);

styleGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-style]");

  if (!button) return;

  selectedStyle = button.dataset.style;

  styleGrid.querySelectorAll("[data-style]").forEach((card) => {
    const isSelected = card.dataset.style === selectedStyle;

    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });

  selectedStyleLabel.textContent = styles[selectedStyle];

  showStatus(
    `${styles[selectedStyle]} ကို ရွေးချယ်ထားပါတယ်။`
  );
});

transformButton.addEventListener("click", () => {
  if (!currentFile) {
    showStatus(
      "အရင်ဆုံး သင်ပြောင်းလဲလိုတဲ့ သီချင်းဖိုင်ကို ရွေးချယ်ပါ။",
      "error"
    );

    audioFile.click();
    return;
  }

  showStatus(
    `${styles[selectedStyle]} ကို ရွေးချယ်ထားပါတယ်။ AI သီချင်းဖန်တီးမှု Backend ကို မချိတ်ဆက်ရသေးတဲ့အတွက် ရလဒ်အသစ်ကို မထုတ်ပေးနိုင်သေးပါ။`,
    "error"
  );
});

uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("drag-over");

  const file = event.dataTransfer.files?.[0];

  if (file) {
    loadAudio(file);
  }
});

window.addEventListener("beforeunload", () => {
  originalAudio.pause();

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
