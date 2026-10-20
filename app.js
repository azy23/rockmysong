
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
const OUTPUT_SAMPLE_RATE = 44100;
const MP3_BITRATE = 192;

const styles = {
  classic: "Classic Rock",
  hard: "Hard Rock",
  pop: "Pop Rock",
  punk: "Punk Rock",
  metal: "Heavy Metal",
  acoustic: "Acoustic Rock"
};

const styleSettings = {
  classic: { bass: 1.15, mid: 1.1, treble: 1.12, drive: 1.8, wet: 0.16 },
  hard:    { bass: 1.3,  mid: 1.2, treble: 1.25, drive: 3.5, wet: 0.28 },
  pop:     { bass: 1.08, mid: 1.12, treble: 1.18, drive: 1.3, wet: 0.10 },
  punk:    { bass: 1.2,  mid: 1.3, treble: 1.2,  drive: 3.0, wet: 0.24 },
  metal:   { bass: 1.35, mid: 0.92, treble: 1.35, drive: 5.0, wet: 0.32 },
  acoustic:{ bass: 1.05, mid: 1.08, treble: 1.18, drive: 1.05, wet: 0.04 }
};

let currentFile = null;
let currentObjectUrl = null;
let selectedStyle = "classic";
let isProcessing = false;
let downloadUrl = null;
let downloadLink = null;

function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) statusMessage.classList.add(type);
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
    ["audio/mpeg", "audio/wav", "audio/x-wav"].includes(file.type)
  );
}

function clearDownload() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }

  if (downloadLink) {
    downloadLink.remove();
    downloadLink = null;
  }
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

  clearDownload();

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

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  clearDownload();

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

function loadMp3Encoder() {
  if (window.lamejs) return Promise.resolve(window.lamejs);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-rockmysong-encoder]');

    if (existing) {
      existing.addEventListener("load", () => {
        window.lamejs ? resolve(window.lamejs) : reject(new Error("MP3 encoder မရရှိပါ။"));
      }, { once: true });

      existing.addEventListener("error", () => reject(new Error("MP3 encoder ကို ဖွင့်မရပါ။")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
    script.async = true;
    script.dataset.rockmysongEncoder = "true";

    script.onload = () => {
      if (window.lamejs) resolve(window.lamejs);
      else reject(new Error("MP3 encoder ကို စတင်အသုံးပြုမရပါ။"));
    };

    script.onerror = () => reject(
      new Error("MP3 encoder ကို အင်တာနက်မှ ရယူမရပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပါ။")
    );

    document.head.appendChild(script);
  });
}

function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = amount;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) /
      (Math.PI + k * Math.abs(x));
  }

  return curve;
}

async function processRockAudio(file, styleKey) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass || !window.OfflineAudioContext && !window.webkitOfflineAudioContext) {
    throw new Error("ဒီ browser မှာ လိုအပ်တဲ့ audio processing ကို မထောက်ပံ့ပါ။ Chrome သို့မဟုတ် Edge ကို စမ်းသုံးပါ။");
  }

  showStatus("အဆင့် ၁/၃ — သီချင်းအသံကို ဖတ်နေပါတယ်။ ခဏစောင့်ပါ…");

  const inputContext = new AudioContextClass();

  let decoded;

  try {
    const arrayBuffer = await file.arrayBuffer();
    decoded = await inputContext.decodeAudioData(arrayBuffer);
  } finally {
    await inputContext.close();
  }

  const OfflineClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const frameCount = Math.ceil(decoded.duration * OUTPUT_SAMPLE_RATE);

  if (!frameCount || !Number.isFinite(frameCount)) {
    throw new Error("သီချင်းအသံကြာချိန်ကို ဖတ်မရပါ။");
  }

  // Guard against excessive memory use for very long tracks.
  if (frameCount > OUTPUT_SAMPLE_RATE * 60 * 12) {
    throw new Error("သီချင်းကြာချိန် ၁၂ မိနစ်ထက် ကျော်နေပါတယ်။ ပိုတိုတဲ့ဖိုင်ကို စမ်းပါ။");
  }

  showStatus("အဆင့် ၂/၃ — ရွေးချယ်ထားတဲ့ Rock အသံ effect တွေ ထည့်နေပါတယ်။");

  const offline = new OfflineClass(
    Math.min(decoded.numberOfChannels, 2),
    frameCount,
    OUTPUT_SAMPLE_RATE
  );

  const source = offline.createBufferSource();
  source.buffer = decoded;

  const bass = offline.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 140;
  bass.gain.value = 3.0;

  const mid = offline.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1200;
  mid.Q.value = 0.8;
  mid.gain.value = 1.5;

  const treble = offline.createBiquadFilter();
  treble.type = "highshelf";
  treble.frequency.value = 4200;
  treble.gain.value = 2.0;

  const settings = styleSettings[styleKey] || styleSettings.classic;

  bass.gain.value = 3 * settings.bass;
  mid.gain.value = 1.5 * settings.mid;
  treble.gain.value = 2 * settings.treble;

  const dry = offline.createGain();
  dry.gain.value = 1 - settings.wet;

  const wet = offline.createGain();
  wet.gain.value = settings.wet;

  const distortion = offline.createWaveShaper();
  distortion.curve = makeDistortionCurve(settings.drive);
  distortion.oversample = "4x";

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.22;

  source.connect(bass);
  bass.connect(mid);
  mid.connect(treble);

  treble.connect(dry);
  dry.connect(compressor);

  treble.connect(distortion);
  distortion.connect(wet);
  wet.connect(compressor);

  compressor.connect(offline.destination);

  source.start(0);

  const rendered = await offline.startRendering();

  showStatus("အဆင့် ၃/၃ — MP3 ဖိုင်အဖြစ် ပြောင်းနေပါတယ်။");

  const lamejs = await loadMp3Encoder();
  const channels = Math.min(rendered.numberOfChannels, 2);
  const encoder = new lamejs.Mp3Encoder(channels, OUTPUT_SAMPLE_RATE, MP3_BITRATE);
  const left = rendered.getChannelData(0);
  const right = channels > 1 ? rendered.getChannelData(1) : left;
  const chunks = [];
  const blockSize = 1152;

  function toInt16(floatData, start, end) {
    const output = new Int16Array(end - start);

    for (let i = start, j = 0; i < end; i++, j++) {
      const sample = Math.max(-1, Math.min(1, floatData[i]));
      output[j] = sample < 0 ? sample * 32768 : sample * 32767;
    }

    return output;
  }

  for (let i = 0; i < left.length; i += blockSize) {
    const end = Math.min(i + blockSize, left.length);
    const leftBlock = toInt16(left, i, end);
    const mp3buf = channels > 1
      ? encoder.encodeBuffer(leftBlock, toInt16(right, i, end))
      : encoder.encodeBuffer(leftBlock);

    if (mp3buf.length) chunks.push(new Uint8Array(mp3buf));

    if (i % (blockSize * 200) === 0) {
      const percent = Math.min(100, Math.round((i / left.length) * 100));
      showStatus(`MP3 ဖိုင်ထုတ်နေပါတယ် — ${percent}%`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length) chunks.push(new Uint8Array(finalChunk));

  return new Blob(chunks, { type: "audio/mpeg" });
}

function offerDownload(blob, originalName, styleKey) {
  clearDownload();

  downloadUrl = URL.createObjectURL(blob);
  downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;

  const safeBaseName = originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80) || "rock_song";

  downloadLink.download = `${safeBaseName}_${styleKey}_rock.mp3`;
  downloadLink.textContent = "⬇ MP3 ဖိုင်ကို ဒေါင်းလုဒ်လုပ်ရန်";
  downloadLink.className = "download-result";
  downloadLink.style.display = "inline-block";
  downloadLink.style.marginTop = "12px";
  downloadLink.style.padding = "12px 18px";
  downloadLink.style.borderRadius = "10px";
  downloadLink.style.fontWeight = "700";
  downloadLink.style.textDecoration = "none";
  downloadLink.style.background = "#ff6b1a";
  downloadLink.style.color = "#ffffff";

  statusMessage.insertAdjacentElement("afterend", downloadLink);
}

audioFile.addEventListener("change", event => {
  loadAudio(event.target.files?.[0]);
});

removeFileButton.addEventListener("click", clearAudio);

styleGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-style]");
  if (!button || isProcessing) return;

  selectedStyle = button.dataset.style;

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
  clearDownload();

  try {
    const outputBlob = await processRockAudio(currentFile, selectedStyle);
    offerDownload(outputBlob, currentFile.name, selectedStyle);

    showStatus(
      `${styles[selectedStyle]} effect ထည့်ပြီး MP3 ထုတ်ပြီးပါပြီ။ အောက်ကခလုတ်ကို နှိပ်ပြီး ဒေါင်းလုဒ်လုပ်ပါ။ သတိပြုရန် — ဒါဟာ audio effect processing ဖြစ်ပြီး AI arrangement အသစ် မဟုတ်သေးပါ။`,
      "success"
    );
  } catch (error) {
    console.error("RockMySong processing error:", error);
    showStatus(
      error instanceof Error
        ? `လုပ်ဆောင်မှု မအောင်မြင်ပါ — ${error.message}`
        : "လုပ်ဆောင်မှု မအောင်မြင်ပါ။ အခြားဖိုင်တစ်ခုနဲ့ ထပ်စမ်းပါ။",
      "error"
    );
  } finally {
    isProcessing = false;
    transformButton.disabled = false;
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

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error => console.error("Service worker registration failed:", error));
  });
}
