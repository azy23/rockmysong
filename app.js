
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
const GRADIO_URL = "https://cb9ad34f9d64e0f886.gradio.live";
const GRADIO_ENDPOINT = "/generate_with_download";

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
let isProcessing = false;
let resultAudio = null;
let resultDownload = null;
let resultObjectUrl = null;
let gradioClientPromise = null;

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
  return (
    /\.(mp3|wav)$/i.test(file.name) ||
    ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave"].includes(file.type)
  );
}

function removeAIResult() {
  if (resultAudio) {
    resultAudio.pause();
    resultAudio.removeAttribute("src");
    resultAudio.load();
    resultAudio.remove();
    resultAudio = null;
  }

  if (resultDownload) {
    resultDownload.remove();
    resultDownload = null;
  }

  if (resultObjectUrl) {
    URL.revokeObjectURL(resultObjectUrl);
    resultObjectUrl = null;
  }

  const oldResultHeading = document.getElementById("aiResultHeading");
  if (oldResultHeading) oldResultHeading.remove();
}

function clearAudio() {
  if (isProcessing) return;

  originalAudio.pause();
  originalAudio.removeAttribute("src");
  originalAudio.load();

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  removeAIResult();

  currentFile = null;
  audioFile.value = "";

  fileInfo.classList.add("hidden");
  audioPreview.classList.add("hidden");

  fileName.textContent = "";
  fileSize.textContent = "";

  showStatus("သီချင်းဖိုင်တစ်ခုကို ရွေးချယ်ပြီး စတင်လိုက်ပါ။");
}

function loadAudio(file) {
  if (!file || isProcessing) return;

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

  removeAIResult();

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

async function getGradioClient() {
  if (!gradioClientPromise) {
    gradioClientPromise = import(
      "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js"
    ).then(async module => {
      if (!module.Client || !module.handle_file) {
        throw new Error("Gradio JavaScript client ကို ဖွင့်မရပါ။");
      }

      showStatus("AI Server ကို ချိတ်ဆက်နေပါတယ်။ ခဏစောင့်ပါ…");

      const client = await module.Client.connect(GRADIO_URL);

      return {
        client,
        handle_file: module.handle_file
      };
    }).catch(error => {
      gradioClientPromise = null;
      throw error;
    });
  }

  return gradioClientPromise;
}

function getRemoteFileUrl(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    return null;
  }

  if (typeof value === "object") {
    if (typeof value.url === "string") {
      if (/^https?:\/\//i.test(value.url)) {
        return value.url;
      }

      if (value.url.startsWith("/")) {
        return new URL(value.url, GRADIO_URL).href;
      }
    }

    if (typeof value.path === "string") {
      if (/^https?:\/\//i.test(value.path)) {
        return value.path;
      }

      // A server-local path is not necessarily a public browser URL.
      // Do not treat paths such as /tmp/audio.wav as downloadable URLs.
    }
  }

  return null;
}

function createResultHeading() {
  const heading = document.createElement("h3");
  heading.id = "aiResultHeading";
  heading.textContent = "🎸 AI Rock Version";

  Object.assign(heading.style, {
    marginTop: "24px",
    marginBottom: "12px",
    color: "inherit"
  });

  statusMessage.insertAdjacentElement("afterend", heading);

  return heading;
}

function displayAIResult(audioUrl, downloadUrl, originalName, styleKey) {
  removeAIResult();

  if (!audioUrl && !downloadUrl) {
    throw new Error(
      "AI က အဖြေပြန်ပေးခဲ့ပေမယ့် အသံဖိုင် URL ကို မဖတ်နိုင်ပါ။ API output ကို စစ်ဆေးဖို့လိုပါတယ်။"
    );
  }

  const heading = createResultHeading();

  if (audioUrl) {
    resultAudio = document.createElement("audio");
    resultAudio.controls = true;
    resultAudio.preload = "metadata";
    resultAudio.src = audioUrl;
    resultAudio.setAttribute("aria-label", "AI Rock Version audio");

    Object.assign(resultAudio.style, {
      display: "block",
      width: "100%",
      maxWidth: "640px",
      marginTop: "10px",
      marginBottom: "12px"
    });

    heading.insertAdjacentElement("afterend", resultAudio);
  }

  const linkUrl = downloadUrl || audioUrl;

  if (linkUrl) {
    resultDownload = document.createElement("a");
    resultDownload.href = linkUrl;
    resultDownload.target = "_blank";
    resultDownload.rel = "noopener noreferrer";
    resultDownload.textContent = "⬇ AI Rock Version ကို ဒေါင်းလုဒ်လုပ်ရန်";
    resultDownload.className = "download-result";

    const safeBaseName = originalName
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 80) || "rock_song";

    resultDownload.download = `${safeBaseName}_${styleKey}_AI_Rock.mp3`;

    Object.assign(resultDownload.style, {
      display: "inline-block",
      marginTop: "12px",
      marginBottom: "16px",
      padding: "12px 18px",
      borderRadius: "10px",
      fontWeight: "700",
      textDecoration: "none",
      background: "#ff6b1a",
      color: "#ffffff"
    });

    const audioElement = resultAudio || heading;
    audioElement.insertAdjacentElement("afterend", resultDownload);
  }
}

async function generateAIRockSong(file, styleKey) {
  const styleName = styles[styleKey];

  if (!styleName) {
    throw new Error("Rock Style ကို မှန်ကန်စွာ ရွေးချယ်ထားခြင်းမရှိပါ။");
  }

  showStatus("အဆင့် ၁/၃ — AI Server ကို ချိတ်ဆက်နေပါတယ်။");

  const { client, handle_file } = await getGradioClient();

  showStatus(
    "အဆင့် ၂/၃ — သီချင်းဖိုင်ကို AI Server သို့ ပို့နေပါတယ်။"
  );

  const result = await client.predict(GRADIO_ENDPOINT, {
    audio_file: handle_file(file),
    style: styleName
  });

  if (!result || !Array.isArray(result.data)) {
    throw new Error("AI Server က မျှော်လင့်ထားတဲ့ output ပုံစံကို မပြန်ပေးပါ။");
  }

  console.log("RockMySong AI response:", result.data);

  showStatus("အဆင့် ၃/၃ — AI ထုတ်ပေးတဲ့ သီချင်းဖိုင်ကို ပြင်ဆင်နေပါတယ်။");

  const audioOutput = result.data[0];
  const downloadOutput = result.data[1];

  const audioUrl = getRemoteFileUrl(audioOutput);
  const downloadUrl = getRemoteFileUrl(downloadOutput) || audioUrl;

  if (!audioUrl && !downloadUrl) {
    throw new Error(
      "AI ရလဒ်ကို ရရှိခဲ့ပေမယ့် ဖိုင် URL မပါဝင်ပါ။ Browser Console မှာ RockMySong AI response ကို စစ်ဆေးပါ။"
    );
  }

  displayAIResult(audioUrl, downloadUrl, file.name, styleKey);

  showStatus(
    `${styleName} AI Version ထုတ်လုပ်ပြီးပါပြီ။ အောက်က player မှာ နားထောင်ပြီး ဒေါင်းလုဒ်လုပ်နိုင်ပါတယ်။`,
    "success"
  );
}

audioFile.addEventListener("change", event => {
  loadAudio(event.target.files?.[0]);
});

removeFileButton.addEventListener("click", clearAudio);

styleGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-style]");
  if (!button || isProcessing) return;

  const styleKey = button.dataset.style;

  if (!styles[styleKey]) return;

  selectedStyle = styleKey;

  styleGrid.querySelectorAll("[data-style]").forEach(card => {
    const selected = card.dataset.style === selectedStyle;
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });

  selectedStyleLabel.textContent = styles[selectedStyle];

  showStatus(`${styles[selectedStyle]} ကို ရွေးချယ်ထားပါတယ်။`);
});

transformButton.addEventListener("click", async () => {
  if (isProcessing) return;

  if (!currentFile) {
    showStatus("အရင်ဆုံး သီချင်းဖိုင်ကို ရွေးချယ်ပါ။", "error");
    audioFile.click();
    return;
  }

  isProcessing = true;
  transformButton.disabled = true;

  const originalButtonText = transformButton.textContent;
  transformButton.textContent = "AI လုပ်ဆောင်နေပါတယ်…";

  removeAIResult();

  try {
    await generateAIRockSong(currentFile, selectedStyle);
  } catch (error) {
    console.error("RockMySong AI error:", error);

    let message = error instanceof Error
      ? error.message
      : "မသိရှိသော အမှားတစ်ခု ဖြစ်ပွားခဲ့ပါတယ်။";

    if (
      /fetch|network|failed to connect|timeout|load failed/i.test(message)
    ) {
      message +=
        " Colab runtime အလုပ်လုပ်နေသလား၊ Gradio URL သက်တမ်းရှိသေးသလား စစ်ဆေးပါ။";
    }

    showStatus(`AI လုပ်ဆောင်မှု မအောင်မြင်ပါ — ${message}`, "error");
  } finally {
    isProcessing = false;
    transformButton.disabled = false;
    transformButton.textContent = originalButtonText;
  }
});

uploadZone.addEventListener("dragover", event => {
  event.preventDefault();
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", event => {
  event.preventDefault();
  uploadZone.classList.remove("drag-over");

  loadAudio(event.dataTransfer.files?.[0]);
});

window.addEventListener("beforeunload", () => {
  originalAudio.pause();

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  if (resultObjectUrl) {
    URL.revokeObjectURL(resultObjectUrl);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error => {
        console.error("Service worker registration failed:", error);
      });
  });
}
