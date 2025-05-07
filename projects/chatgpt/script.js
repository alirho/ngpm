const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettings = document.getElementById("close-settings");
const fontSelect = document.getElementById("font-select");
const themeSelect = document.getElementById("theme-select");
const downloadHTML = document.getElementById("download-html");
const downloadMD = document.getElementById("download-md");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");

function updatePreview() {
  preview.innerHTML = marked.parse(editor.value);
}

function insertMarkdown(action) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.substring(start, end);
  let inserted = '';

  switch (action) {
    case 'bold':
      inserted = `**${selected}**`; break;
    case 'italic':
      inserted = `*${selected}*`; break;
    case 'heading':
      inserted = `# ${selected}`; break;
    case 'strike':
      inserted = `~~${selected}~~`; break;
    case 'ul':
      inserted = `- ${selected}`; break;
    case 'ol':
      inserted = `1. ${selected}`; break;
    case 'checklist':
      inserted = `- [ ] ${selected}`; break;
    case 'quote':
      inserted = `> ${selected}`; break;
    case 'code':
      inserted = `\`\`\`\n${selected}\n\`\`\``; break;
    case 'table':
      inserted = `| عنوان | عنوان |\n|-------|-------|\n| داده | داده |`; break;
    case 'image':
      inserted = `![توضیح تصویر](آدرس)`; break;
    case 'link':
      inserted = `[عنوان](آدرس)`; break;
  }

  editor.setRangeText(inserted, start, end, 'end');
  updatePreview();
}

document.querySelectorAll('.buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    insertMarkdown(btn.dataset.action);
  });
});

editor.addEventListener('input', updatePreview);
window.addEventListener('load', updatePreview);

settingsBtn.onclick = () => settingsModal.style.display = "block";
closeSettings.onclick = () => settingsModal.style.display = "none";

fontSelect.onchange = () => {
  document.body.style.fontFamily = fontSelect.value;
};

themeSelect.onchange = () => {
  document.body.className = themeSelect.value === 'dark' ? 'dark' : '';
};

downloadHTML.onclick = () => {
  const blob = new Blob([preview.innerHTML], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "file.html";
  a.click();
};

downloadMD.onclick = () => {
  const blob = new Blob([editor.value], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "file.md";
  a.click();
};

uploadBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    editor.value = reader.result;
    updatePreview();
  };
  reader.readAsText(file);
};

function syncScroll(source, target) {
  source.addEventListener('scroll', () => {
    const percent = source.scrollTop / (source.scrollHeight - source.clientHeight);
    target.scrollTop = percent * (target.scrollHeight - target.clientHeight);
  });
}

syncScroll(editor, preview);
syncScroll(preview, editor);

