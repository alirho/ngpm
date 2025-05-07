
// DOM Elements
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const toolbarButtons = document.querySelectorAll('.toolbar button[data-format]');
const exportMdButton = document.getElementById('export-md');
const exportHtmlButton = document.getElementById('export-html');
const toastElement = document.getElementById('toast');
const toastMessageElement = document.getElementById('toast-message');

// Scrollable Panels
const writePanel = document.querySelector('.write-panel'); // Target the scrollable panel
const previewPanel = document.querySelector('.preview-panel'); // Target the scrollable panel

// Stats Bar Elements
const statCharsElement = document.getElementById('stat-chars');
const statLettersElement = document.getElementById('stat-letters');
const statWordsElement = document.getElementById('stat-words');
const statLinesElement = document.getElementById('stat-lines');
const statSizeElement = document.getElementById('stat-size');

// Scroll Sync Flags
let isSyncingWriteScroll = false;
let isSyncingPreviewScroll = false;

// --- Initialize Lucide Icons ---
lucide.createIcons();

// --- Statistics Calculation ---
function updateStatistics() {
    const text = editor.value;

    // Characters (including whitespace and newlines)
    const charCount = text.length;
    statCharsElement.textContent = charCount;

    // Letters (alphabetic characters in Persian/English, case-insensitive)
    // Using a more inclusive regex for Persian letters and common English letters
    const letters = text.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || [];
    const letterCount = letters.length;
    statLettersElement.textContent = letterCount;


    // Words (sequences of non-whitespace characters)
    // Improved word count regex to handle Persian and English better
    const words = text.match(/[^\s\.,!?;:()[\]{}<>«»]+(?:'[^\s\.,!?;:()[\]{}<>«»]+)?/g) || [];
    const wordCount = words.length;
    statWordsElement.textContent = wordCount;

    // Lines (count newline characters + 1 if text is not empty)
    const lines = text.split('\n');
    // Count non-empty lines for a more meaningful "line" count
    // const nonEmptyLines = lines.filter(line => line.trim() !== '').length;
    // If editor is empty, lines should be 0, otherwise, it's the number of splits (which is lines + 1 for non-empty last line)
    const lineCount = text === '' ? 0 : lines.length;
    statLinesElement.textContent = lineCount;


    // Size (estimate based on UTF-8 encoding)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const fileSize = blob.size;
    statSizeElement.textContent = formatFileSize(fileSize);
}

// Helper to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}


// --- Markdown Rendering ---
function renderMarkdown() {
    const markdownText = editor.value;
    // Configure marked - enable GitHub Flavored Markdown (GFM)
    marked.setOptions({
        gfm: true,
        breaks: true, // Convert single line breaks to <br>
    });
    preview.innerHTML = marked.parse(markdownText);

    // Post-processing for RTL checklists (Marked doesn't handle dir well on list items)
    const listItems = preview.querySelectorAll('li');
    listItems.forEach(item => {
      if (item.querySelector('input[type="checkbox"]')) {
        // Add a class or style to ensure RTL display if needed,
        // though the parent `ul/ol` should handle it if CSS is correct.
        // Example: item.style.direction = 'rtl';
      }
    });

    // Update statistics whenever markdown is rendered
    updateStatistics();
}

// --- Editor Input Handling ---
editor.addEventListener('input', renderMarkdown);

// --- Toolbar Functionality ---

// Helper to insert text at cursor position
const insertText = (textarea, textToInsert, cursorOffset = 0) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    textarea.value = before + textToInsert + after;
    textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length - cursorOffset; // Adjust cursor position based on offset from end
    textarea.focus();
    renderMarkdown(); // Update preview and stats immediately
};

// Helper to wrap selected text
const wrapText = (textarea, beforeText, afterText) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    textarea.value = `${before}${beforeText}${selectedText}${afterText}${after}`;
    textarea.selectionStart = start + beforeText.length;
    textarea.selectionEnd = end + beforeText.length;
    textarea.focus();
    renderMarkdown(); // Update preview and stats immediately
};


toolbarButtons.forEach(button => {
    button.addEventListener('click', () => {
        const format = button.getAttribute('data-format');
        if (!editor) return;

        switch (format) {
            case 'bold':
                wrapText(editor, '**', '**');
                break;
            case 'italic':
                wrapText(editor, '*', '*');
                break;
            case 'heading':
                 // Insert heading prefix at the beginning of the current line or selected lines
                const startPos = editor.selectionStart;
                const endPos = editor.selectionEnd;
                const text = editor.value;
                // Find the start of the line(s)
                let lineStart = startPos;
                while (lineStart > 0 && text[lineStart - 1] !== '\n') {
                    lineStart--;
                }
                 // Find the end of the line(s) - important if multiline selection
                let lineEnd = endPos;
                 while (lineEnd < text.length && text[lineEnd] !== '\n') {
                    lineEnd++;
                }

                const prefix = '## ';
                const before = text.substring(0, lineStart);
                const selectedLines = text.substring(lineStart, lineEnd);
                const after = text.substring(lineEnd);

                // Add prefix, handling potential existing prefixes (cycle H1-H6?) - simple ## for now
                // Basic implementation: just add ##
                editor.value = before + prefix + selectedLines + after;
                editor.selectionStart = startPos + prefix.length;
                editor.selectionEnd = endPos + prefix.length;
                editor.focus();
                renderMarkdown();
                break;
            case 'strike':
                wrapText(editor, '~~', '~~');
                break;
            case 'ul':
                 // Add '- ' to the beginning of the current or selected lines
                 {
                    const selStart = editor.selectionStart;
                    const selEnd = editor.selectionEnd;
                    const textVal = editor.value;
                    let lineStartIdx = textVal.lastIndexOf('\n', selStart - 1) + 1; // Find start of the first selected line
                    const beforeLines = textVal.substring(0, lineStartIdx);
                    const selectedText = textVal.substring(lineStartIdx, selEnd);
                    const afterLines = textVal.substring(selEnd);

                    const lines = selectedText.split('\n');
                    let processedLines = '';
                    let addedChars = 0;
                    lines.forEach((line, index) => {
                        processedLines += '- ' + line;
                        addedChars += 2;
                        if (index < lines.length - 1) {
                            processedLines += '\n';
                        }
                    });

                    editor.value = beforeLines + processedLines + afterLines;
                    editor.selectionStart = selStart + 2; // Adjust start selection
                    editor.selectionEnd = selEnd + addedChars; // Adjust end selection
                    editor.focus();
                    renderMarkdown();
                 }
                break;
            case 'ol':
                // Add '1. ' to the beginning of the current or selected lines (needs smart numbering later)
                {
                     const selStart = editor.selectionStart;
                    const selEnd = editor.selectionEnd;
                    const textVal = editor.value;
                    let lineStartIdx = textVal.lastIndexOf('\n', selStart - 1) + 1; // Find start of the first selected line
                    const beforeLines = textVal.substring(0, lineStartIdx);
                    const selectedText = textVal.substring(lineStartIdx, selEnd);
                    const afterLines = textVal.substring(selEnd);

                    const lines = selectedText.split('\n');
                    let processedLines = '';
                    let addedChars = 0;
                    // Basic: start each line with 1. Improvement: number sequentially
                    lines.forEach((line, index) => {
                        processedLines += '1. ' + line;
                        addedChars += 3;
                        if (index < lines.length - 1) {
                            processedLines += '\n';
                        }
                    });

                    editor.value = beforeLines + processedLines + afterLines;
                     editor.selectionStart = selStart + 3; // Adjust start selection
                    editor.selectionEnd = selEnd + addedChars; // Adjust end selection
                    editor.focus();
                    renderMarkdown();
                }
                break;
            case 'checklist':
                 // Add '- [ ] ' to the beginning of the current or selected lines
                 {
                    const selStart = editor.selectionStart;
                    const selEnd = editor.selectionEnd;
                    const textVal = editor.value;
                    let lineStartIdx = textVal.lastIndexOf('\n', selStart - 1) + 1; // Find start of the first selected line
                    const beforeLines = textVal.substring(0, lineStartIdx);
                    const selectedText = textVal.substring(lineStartIdx, selEnd);
                    const afterLines = textVal.substring(selEnd);

                    const lines = selectedText.split('\n');
                    let processedLines = '';
                    let addedChars = 0;
                    lines.forEach((line, index) => {
                        processedLines += '- [ ] ' + line;
                        addedChars += 6;
                        if (index < lines.length - 1) {
                            processedLines += '\n';
                        }
                    });

                    editor.value = beforeLines + processedLines + afterLines;
                     editor.selectionStart = selStart + 6; // Adjust start selection
                    editor.selectionEnd = selEnd + addedChars; // Adjust end selection
                    editor.focus();
                    renderMarkdown();
                 }
                break;
            case 'blockquote':
                 // Add '> ' to the beginning of the current or selected lines
                {
                     const selStart = editor.selectionStart;
                    const selEnd = editor.selectionEnd;
                    const textVal = editor.value;
                    let lineStartIdx = textVal.lastIndexOf('\n', selStart - 1) + 1; // Find start of the first selected line
                    const beforeLines = textVal.substring(0, lineStartIdx);
                    const selectedText = textVal.substring(lineStartIdx, selEnd);
                    const afterLines = textVal.substring(selEnd);

                    const lines = selectedText.split('\n');
                    let processedLines = '';
                    let addedChars = 0;
                    lines.forEach((line, index) => {
                        processedLines += '> ' + line;
                        addedChars += 2;
                        if (index < lines.length - 1) {
                            processedLines += '\n';
                        }
                    });

                    editor.value = beforeLines + processedLines + afterLines;
                    editor.selectionStart = selStart + 2; // Adjust start selection
                    editor.selectionEnd = selEnd + addedChars; // Adjust end selection
                    editor.focus();
                    renderMarkdown();
                }
                break;
            case 'code':
                if (editor.selectionStart !== editor.selectionEnd) {
                    // If multiline selection, wrap with ```, otherwise use ` for inline
                     const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
                     if (selectedText.includes('\n')) {
                        wrapText(editor, '```\n', '\n```');
                     } else {
                         wrapText(editor, '`', '`'); // Inline code
                     }
                } else {
                    // Insert code block template
                    insertText(editor, '\n```\n\n```\n', 4); // Place cursor inside the block
                }
                break;
            case 'table':
                insertText(editor, '\n| عنوان ۱ | عنوان ۲ |\n|---|---|\n| متن ۱ | متن ۲ |\n', 0); // Cursor at end
                break;
            case 'image':
                 // Wrap selection as alt text if exists
                if (editor.selectionStart !== editor.selectionEnd) {
                     wrapText(editor, '![', '](آدرس-عکس)');
                } else {
                    insertText(editor, '\n![توضیح عکس](آدرس-عکس)', 13); // Place cursor at the beginning of URL part
                }
                break;
            case 'link':
                 // Wrap selection as link text if exists
                if (editor.selectionStart !== editor.selectionEnd) {
                     wrapText(editor, '[', '](آدرس-لینک)');
                } else {
                    insertText(editor, '[متن لینک](آدرس-لینک)', 11); // Place cursor at the beginning of URL part
                }
                break;
            default:
                break;
        }
    });
});

// --- Export Functionality ---
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`فایل ${filename} با موفقیت صادر شد.`);
}

exportMdButton.addEventListener('click', () => {
    const markdownContent = editor.value;
    downloadFile(markdownContent, 'document.md', 'text/markdown;charset=utf-8');
});

exportHtmlButton.addEventListener('click', () => {
    // const previewElement = document.getElementById('preview');
    const renderedHtml = marked.parse(editor.value); // Ensure latest rendering
    // Include basic HTML structure and styles for better standalone viewing
    const htmlContent = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Document</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">
<style>
    body { font-family: 'Vazirmatn', sans-serif; direction: rtl; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
    blockquote { border-right: 4px solid #dfe2e5; padding-right: 1em; margin-right: 1em; color: #6a737d; }
    code { font-family: monospace; background-color: #f1f1f1; padding: 0.2em 0.4em; border-radius: 3px; direction: ltr; text-align: left; display: inline-block;}
    pre { background-color: #f6f8fa; border: 1px solid #dfe2e5; border-radius: 3px; padding: 1em; overflow-x: auto; direction: ltr; text-align: left;}
    pre code { background-color: transparent; padding: 0; border: none; display: block; } /* Ensure block display for code in pre */
    table { border-collapse: collapse; margin-bottom: 1em; direction: rtl;}
    th, td { border: 1px solid #dfe2e5; padding: 0.6em 1em; text-align: right; }
    th { background-color: #f6f8fa; font-weight: bold; }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-right: 2em; }
    /* Basic checklist alignment */
    li input[type="checkbox"] { margin-left: 0.5em; vertical-align: middle; }
</style>
</head>
<body>
${renderedHtml}
</body>
</html>`;
    downloadFile(htmlContent, 'document.html', 'text/html;charset=utf-8');
});


// --- Toast Notification ---
let toastTimeout;

function showToast(message) {
    if (!toastElement || !toastMessageElement) return;

    toastMessageElement.textContent = message;
    toastElement.classList.add('show');

    // Clear previous timeout if exists
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Set new timeout to hide the toast
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove('show');
        toastTimeout = null; // Reset timeout variable
    }, 3000); // Hide after 3 seconds
}

// --- Synchronized Scrolling ---

// Helper function to calculate scroll ratio
function getScrollRatio(element) {
    // Handle division by zero if scrollHeight equals clientHeight
    const scrollableHeight = element.scrollHeight - element.clientHeight;
    return scrollableHeight > 0 ? element.scrollTop / scrollableHeight : 0;
}

// Helper function to set scroll position based on ratio
function setScrollPosition(element, ratio) {
    const scrollableHeight = element.scrollHeight - element.clientHeight;
    element.scrollTop = ratio * scrollableHeight;
}

// Use the panel elements for scroll events
writePanel.addEventListener('scroll', () => {
    if (isSyncingWriteScroll) {
        isSyncingWriteScroll = false; // Reset flag
        return; // Ignore programmatic scroll
    }
    // User scrolled the write panel, sync the preview panel
    isSyncingPreviewScroll = true; // Set flag to prevent preview's listener from looping back
    const ratio = getScrollRatio(writePanel);
    setScrollPosition(previewPanel, ratio);
    // Optional: Add a small timeout to reset the flag if needed, sometimes helps with racing conditions
     // setTimeout(() => { isSyncingPreviewScroll = false; }, 50);
});

previewPanel.addEventListener('scroll', () => {
    if (isSyncingPreviewScroll) {
        isSyncingPreviewScroll = false; // Reset flag
        return; // Ignore programmatic scroll
    }
    // User scrolled the preview panel, sync the write panel
    isSyncingWriteScroll = true; // Set flag to prevent write's listener from looping back
    const ratio = getScrollRatio(previewPanel);
    setScrollPosition(writePanel, ratio);
    // Optional: Add a small timeout to reset the flag if needed
     // setTimeout(() => { isSyncingWriteScroll = false; }, 50);
});


// --- Initial Render & Stats Calculation ---
renderMarkdown(); // Render initial content (if any) and calculate initial stats

