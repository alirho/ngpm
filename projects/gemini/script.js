// --- Dynamic Import Placeholder & Setup ---
// We use dynamic import later in initializeApp to ensure DOM is ready
// and handle potential loading errors more gracefully.
let configureShahneshan = () => { console.warn("ShahNeshan configure function not available."); };
let shahneshanToOutput = (text) => {
    console.warn("ShahNeshan markdownToOutput function not available.");
    return `<p style="color:red;">مفسر ShahNeshan بارگذاری نشده است.</p><pre>${text}</pre>`;
};

// --- Wait for the DOM to be ready ---
document.addEventListener('DOMContentLoaded', async () => { // Make listener async for dynamic import

    // --- Get HTML Elements ---
    const markdownInput = document.getElementById('markdown-input');
    const htmlOutput = document.getElementById('html-output');
    const toolbar = document.getElementById('toolbar');
    const exportMdButton = document.getElementById('export-md');
    const exportHtmlButton = document.getElementById('export-html');
    const container = document.querySelector('.container');
    const toggleFullscreenButton = document.getElementById('toggle-fullscreen-preview');
    // Status Bar Elements
    const lineCountSpan = document.getElementById('line-count');
    const wordCountSpan = document.getElementById('word-count');
    const charCountSpan = document.getElementById('char-count');
    const letterCountSpan = document.getElementById('letter-count');
    const sizeCountSpan = document.getElementById('size-count');
    // File Upload Elements
    const uploadButton = document.getElementById('btn-upload');
    const fileInput = document.getElementById('file-input');
    // Settings Modal Elements
    const settingsButton = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalButton = document.getElementById('modal-close');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const parserRadioButtons = document.querySelectorAll('input[name="parser"]');
    // Undo/Redo buttons
    const undoButton = document.getElementById('btn-undo');
    const redoButton = document.getElementById('btn-redo');

    // Check essential elements
    if (!markdownInput || !htmlOutput || !toolbar || !container) {
        console.error("Critical layout elements not found! Aborting script initialization.");
        return;
    }
    console.log('Base elements found.');

    // --- Global State ---
    let currentParser = 'marked'; // Default parser
    let history = [];
    let historyIndex = -1;
    const MAX_HISTORY = 50;
    let isApplyingState = false; // Flag for Undo/Redo

    // --- Debounce Function ---
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // --- History Management ---
    function saveState() {
        if (isApplyingState || !markdownInput) return;

        const currentState = {
            value: markdownInput.value,
            selectionStart: markdownInput.selectionStart,
            selectionEnd: markdownInput.selectionEnd,
        };

        // Avoid saving identical states, but update cursor if needed
        if (historyIndex >= 0 && history[historyIndex].value === currentState.value) {
            if (history[historyIndex].selectionStart !== currentState.selectionStart ||
                history[historyIndex].selectionEnd !== currentState.selectionEnd) {
                history[historyIndex].selectionStart = currentState.selectionStart;
                history[historyIndex].selectionEnd = currentState.selectionEnd;
                // console.log("History: Updated cursor in last state");
            }
            return; // Don't save identical value state
        }

        // Clear future states if we are undoing and then typing
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }

        // Add new state
        history.push(currentState);
        historyIndex++;

        // Limit history size
        if (history.length > MAX_HISTORY) {
            history.shift();
            historyIndex--;
        }
        // console.log("History: State saved, index:", historyIndex, "size:", history.length);
        updateUndoRedoButtons();
    }

    function applyState(state) {
        if (!state || !markdownInput) return;
        isApplyingState = true; // Set flag
        console.log("Applying history state");

        // Store selection before changing value (might lose focus)
        const ss = state.selectionStart;
        const se = state.selectionEnd;

        markdownInput.value = state.value; // Apply text change

        // Update UI immediately after value change
        updatePreview();
        updateStatusBar();
        setTextDirection();

        // Restore focus and selection range
        try {
            markdownInput.focus();
            markdownInput.setSelectionRange(ss, se);
        } catch (e) { console.error("Error setting selection range:", e); }

        // Sync scroll (might need slight delay)
        setTimeout(() => syncScroll(markdownInput, htmlOutput), 0);

        updateUndoRedoButtons(); // Update buttons status

        // Unset flag slightly later to avoid race conditions with input event
        setTimeout(() => { isApplyingState = false; }, 10);
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            applyState(history[historyIndex]);
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            applyState(history[historyIndex]);
        }
    }

    function updateUndoRedoButtons() {
        if(undoButton) undoButton.disabled = (historyIndex <= 0);
        if(redoButton) redoButton.disabled = (historyIndex >= history.length - 1);
    }

    // Debounced version of saveState
    const debouncedSaveState = debounce(saveState, 400);

    // --- Initial Marked.js Options ---
    // Ensure marked is loaded (global from CDN)
    if (typeof marked === 'undefined') {
         console.error("Marked.js library not loaded!");
         // Display error to user?
    } else {
        try {
            marked.setOptions({ gfm: true, breaks: true });
        } catch (e) {
             console.error("Error setting Marked options:", e);
        }
    }


    // --- ShahNeshan Configuration (Loaded dynamically later) ---
    async function loadAndConfigureShahneshan() {
        try {
            console.log("Attempting to dynamically import ShahNeshan from './shahneshan.js'...");
            // [!] Adjust path if needed
            const shahneshanModule = await import('./shahneshan.js');
            // Assign to globally scoped (within DOMContentLoaded) variables
            configureShahneshan = shahneshanModule.configure;
            shahneshanToOutput = shahneshanModule.markdownToOutput;

            // Apply configuration (using default/example for now)
            if (typeof configureShahneshan === 'function') {
                 configureShahneshan({
                     customStyles: ``, // Add styles if needed
                     plugins: []
                 });
                 console.log("ShahNeshan dynamically imported and configured.");
                 return true; // Indicate success
            } else {
                 console.error("ShahNeshan module loaded, but configure function not found.");
                 return false;
            }
        } catch (e) {
            console.error("Failed to load or configure ShahNeshan dynamically:", e);
            // Disable ShahNeshan option in UI
             const shahneshanRadio = document.querySelector('input[name="parser"][value="shahneshan"]');
             if (shahneshanRadio) {
                shahneshanRadio.disabled = true;
                const shahneshanLabel = shahneshanRadio.closest('label');
                if(shahneshanLabel) {
                    shahneshanLabel.style.color = '#999';
                    shahneshanLabel.title = 'کتابخانه ShahNeshan بارگذاری نشد.';
                }
             }
            return false; // Indicate failure
        }
    }

    // --- Function to Update Preview Pane ---
    function updatePreview() {
        if (!markdownInput || !htmlOutput) return;
        const markdownText = markdownInput.value;
        let htmlText = '';

        // console.log(`Updating preview using parser: ${currentParser}`);

        try {
            if (currentParser === 'marked') {
                 if (typeof marked !== 'undefined') { // Check if marked exists
                     htmlText = marked.parse(markdownText);
                 } else {
                      htmlText = '<p style="color: red;">خطا: کتابخانه Marked بارگذاری نشده است.</p>';
                 }
            } else if (currentParser === 'shahneshan') {
                 // Check if the function was successfully loaded
                 if (typeof shahneshanToOutput === 'function' && !shahneshanToOutput.toString().includes("not loaded")) {
                     htmlText = shahneshanToOutput(markdownText);
                 } else {
                      htmlText = '<p style="color: red;">خطا: مفسر ShahNeshan بارگذاری نشده یا تابع آن یافت نشد.</p>';
                 }
            } else {
                htmlText = '<p style="color: red;">خطا: مفسر ناشناخته انتخاب شده است.</p>';
            }
        } catch (error) {
             console.error(`Error parsing Markdown with ${currentParser}:`, error);
             htmlText = `<p style="color: red;">خطا در پردازش مارک‌داون با ${currentParser}.</p>`;
        }

        // Apply the generated HTML
        htmlOutput.innerHTML = htmlText;
        // Note: dir="auto" is removed. Direction relies on global setTextDirection.
    }

    // --- Function to Update Status Bar ---
    function updateStatusBar() {
        if (!markdownInput) return;
        const text = markdownInput.value;
        const lines = text.split('\n').length;
        const words = text.split(/\s+/).filter(Boolean).length;
        const chars = text.length;
        const letters = (text.match(/[a-zA-Z\u0600-\u06FF]/g) || []).length;
        const size = new Blob([text]).size;
        // Add null checks for spans
        if(lineCountSpan) lineCountSpan.textContent = lines;
        if(wordCountSpan) wordCountSpan.textContent = words;
        if(charCountSpan) charCountSpan.textContent = chars;
        if(letterCountSpan) letterCountSpan.textContent = letters;
        if(sizeCountSpan) sizeCountSpan.textContent = size;
    }

    // --- Function to Detect and Set GLOBAL Text Direction ---
    function setTextDirection() {
        if (!markdownInput || !htmlOutput) return;
        try {
            const text = markdownInput.value;
            const firstStrongMatch = text.match(/[\u0600-\u06FFa-zA-Z]/); // Find first LTR or RTL letter
            const firstStrongChar = firstStrongMatch ? firstStrongMatch[0] : text.trim().charAt(0); // Fallback to first char

            let detectedDir = 'rtl'; // Default to RTL
            if ((firstStrongChar >= 'a' && firstStrongChar <= 'z') || (firstStrongChar >= 'A' && firstStrongChar <= 'Z')) {
                detectedDir = 'ltr';
            }

            // Apply direction if changed
            if (markdownInput.dir !== detectedDir) {
                console.log(`Changing editor direction to: ${detectedDir}`); // DEBUG LOG
                markdownInput.dir = detectedDir;
                markdownInput.style.textAlign = (detectedDir === 'rtl') ? 'right' : 'left';

                // [!] Attempt to move cursor to the correct edge *if editor is focused*
                if (document.activeElement === markdownInput) {
                    // Use timeout to ensure it happens after potential browser adjustments
                    setTimeout(() => {
                        try {
                            if (detectedDir === 'rtl') {
                                const len = markdownInput.value.length;
                                markdownInput.setSelectionRange(len, len); // Move to end
                                // console.log("Moved cursor to end for RTL");
                            } else {
                                markdownInput.setSelectionRange(0, 0); // Move to start
                                // console.log("Moved cursor to start for LTR");
                            }
                        } catch (e) { console.error("Error setting selection range on direction change:", e); }
                    }, 0);
                }
            }

            // Apply to preview container as well
            if (htmlOutput.dir !== detectedDir) {
                htmlOutput.dir = detectedDir;
                htmlOutput.style.textAlign = (detectedDir === 'rtl') ? 'right' : 'left'; // Set alignment too
            }
        } catch (error) { console.error("Error in setTextDirection:", error); }
    } // --- End of setTextDirection ---
    
    // --- Helper Function to Insert Markdown Syntax ---
    // Function definition starts here, continues in next part
    function insertMarkdownSyntax(prefix, suffix = '', specialCase = null) {
        if (!markdownInput) return;
        // console.log(`Inserting syntax: prefix='${prefix}', suffix='${suffix}', specialCase='${specialCase}'`);
        try {
            const start = markdownInput.selectionStart;
            const end = markdownInput.selectionEnd;
            const selectedText = markdownInput.value.substring(start, end);
            const currentText = markdownInput.value;
            let newText = '';
            let cursorPos = start + prefix.length;
            const needsNewlinePrefix = (specialCase === 'list' || specialCase === 'quote') && start > 0 && currentText[start - 1] !== '\n';
            const actualPrefix = needsNewlinePrefix ? '\n' + prefix : prefix;
            cursorPos = start + actualPrefix.length;

            // --- End of Part 1 (approx line 300) ---
            // --- Continuation of insertMarkdownSyntax function from Part 1 ---
            if (selectedText) {
                // --- Case 1: Text is selected ---
                if ((specialCase === 'list' || specialCase === 'quote') && selectedText.includes('\n')) {
                    const lines = selectedText.split('\n'); const processedLines = lines.map(line => actualPrefix + line).join('\n');
                    newText = currentText.substring(0, start) + processedLines + currentText.substring(end); cursorPos = start + processedLines.length;
                } else {
                    // Standard wrapping
                    newText = currentText.substring(0, start) + actualPrefix + selectedText + suffix + currentText.substring(end); cursorPos = start + actualPrefix.length + selectedText.length + suffix.length;
                }
            } else {
                // --- Case 2: No text is selected ---
                let textToInsert = actualPrefix + suffix; cursorPos = start + actualPrefix.length;
                if (specialCase === 'link') { textToInsert = actualPrefix + '[]()' + suffix; cursorPos = start + actualPrefix.length + 1; }
                else if (specialCase === 'image') { textToInsert = actualPrefix + '![]()' + suffix; cursorPos = start + actualPrefix.length + 2; }
                else if (specialCase === 'table') { textToInsert = actualPrefix + '| سرستون ۱ | سرستون ۲ |\n|---|---|\n| ردیف ۱، سلول ۱ | ردیف ۱، سلول ۲ |\n| ردیف ۲، سلول ۱ | ردیف ۲، سلول ۲ |' + suffix; cursorPos = start + actualPrefix.length + 2; if (start > 0 && currentText[start-1] !== '\n') { textToInsert = '\n' + textToInsert; cursorPos++; } if (end === currentText.length) { textToInsert = textToInsert + '\n'; } }
                else if (specialCase === 'code_block') { textToInsert = '```\n' + '\n```'; cursorPos = start + 4; if (start > 0 && currentText[start-1] !== '\n') { textToInsert = '\n' + textToInsert; cursorPos++; } if (end < currentText.length && currentText[end] !== '\n') { textToInsert = textToInsert + '\n'; } else if (end === currentText.length) { textToInsert = textToInsert + '\n'; } }
                newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);
            }
            markdownInput.value = newText;
            markdownInput.focus();
            markdownInput.setSelectionRange(cursorPos, cursorPos);
            // Manually trigger updates and save state AFTER programmatic change
            updatePreview();
            updateStatusBar();
            setTextDirection(); // Re-check editor direction
            saveState(); // Save state after button action
            updateUndoRedoButtons(); // Update buttons after save

        } catch (error) { console.error("Error in insertMarkdownSyntax:", error); }
    } // --- End of insertMarkdownSyntax function ---


    // --- Toolbar Button Event Listener ---
    if (toolbar) {
        toolbar.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button || !button.id) return;

            // Handle non-formatting buttons first
            if (button.id === 'btn-upload') return; // Handled by separate listener
            if (button.id === 'btn-settings') return; // Handled by separate listener
            if (button.id === 'btn-undo') { undo(); return; }
            if (button.id === 'btn-redo') { redo(); return; }

            // Handle formatting buttons by calling insertMarkdownSyntax
            // console.log(`Toolbar formatting button clicked: ID=${button.id}`);
            switch (button.id) {
                case 'btn-bold': insertMarkdownSyntax('**', '**'); break;
                case 'btn-italic': insertMarkdownSyntax('*', '*'); break;
                case 'btn-heading':
                    const startH = markdownInput.selectionStart; const currentTextH = markdownInput.value;
                    const prefixH = (startH === 0 || currentTextH[startH - 1] === '\n') ? '# ' : '\n# ';
                    insertMarkdownSyntax(prefixH, '', null); break;
                case 'btn-strike': insertMarkdownSyntax('~~', '~~'); break;
                case 'btn-ul': insertMarkdownSyntax('- ', '', 'list'); break;
                case 'btn-ol': insertMarkdownSyntax('1. ', '', 'list'); break;
                case 'btn-checklist': insertMarkdownSyntax('- [ ] ', '', 'list'); break;
                case 'btn-quote': insertMarkdownSyntax('> ', '', 'quote'); break;
                case 'btn-code':
                    if (markdownInput.selectionStart !== markdownInput.selectionEnd) { insertMarkdownSyntax('`', '`'); }
                    else { insertMarkdownSyntax('', '', 'code_block'); } break;
                case 'btn-table': insertMarkdownSyntax('', '', 'table'); break;
                case 'btn-image': insertMarkdownSyntax('', '', 'image'); break;
                case 'btn-link': insertMarkdownSyntax('', '', 'link'); break;
                 // default: console.log(`Unknown formatting button ID: ${button.id}`);
            }
        });
    } else { console.error("Toolbar not found!"); }

    // --- File Upload Logic ---
    if (uploadButton && fileInput && markdownInput) {
        uploadButton.addEventListener('click', () => { fileInput.click(); });
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                markdownInput.value = e.target.result;
                // Reset history and save initial state
                console.log("Resetting history after file load.");
                history = []; historyIndex = -1; saveState(); updateUndoRedoButtons();
                // Update UI
                updatePreview(); updateStatusBar(); setTextDirection();
                // Scroll and focus
                setTimeout(() => {
                     if(markdownInput.focus) markdownInput.focus(); markdownInput.scrollTop = 0;
                     syncScroll(markdownInput, htmlOutput);
                 }, 50);
                event.target.value = null;
            };
            reader.onerror = (e) => { console.error("Error reading file:", e); alert('Error reading file.'); event.target.value = null; };
            reader.readAsText(file);
        });
    } else { console.error("Upload button or file input or markdown input not found!"); }


    // --- Helper Function to Download Files ---
    function downloadFile(filename, content, mimeType) {
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) { console.error("Error in downloadFile:", error); alert("خطا در ایجاد فایل دانلود."); }
    }

    // --- Export Button Event Listeners ---
    if (exportMdButton && markdownInput) {
         exportMdButton.addEventListener('click', () => {
              try { const markdownContent = markdownInput.value; downloadFile('parsi-negar.md', markdownContent, 'text/markdown;charset=utf-8'); }
              catch(error) { console.error("Error during MD export click:", error); }
         });
    } else { console.error("Export MD button or markdown input not found!"); }

    if (exportHtmlButton && htmlOutput) {
         exportHtmlButton.addEventListener('click', () => {
            try {
                 const currentDir = htmlOutput.dir || 'rtl';
                 const htmlContent = `<!DOCTYPE html><html lang="fa" dir="${currentDir}"><head><meta charset="UTF-8"><title>Exported Document</title><style>body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 900px; margin: 0 auto; text-align: start;} p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, table { text-align: start; } code { background-color: #eee; padding: 2px 4px; border-radius: 3px; font-family: monospace; direction: ltr; display: inline-block; } pre { background-color: #eee; padding: 10px; border-radius: 3px; overflow-x: auto; direction: ltr; text-align: left; margin: 1em 0;} blockquote { border-inline-start: 4px solid #ccc; padding-inline-start: 10px; margin: 1em 0; color: #666; } table { border-collapse: collapse; margin: 1em 0; border: 1px solid #ccc;} th, td { border: 1px solid #ccc; padding: 8px; text-align: inherit;} th { background-color: #f4f4f4; font-weight: bold;} img { max-width: 100%; height: auto; display: block; margin: 10px auto;} ul, ol { padding-inline-start: 30px; margin: 1em 0;} li { margin-bottom: 0.3em; text-align: start; } a { color: #007bff; text-decoration: none; } a:hover { text-decoration: underline; }</style></head><body>${htmlOutput.innerHTML}</body></html>`;
                 downloadFile('parsi-negar.html', htmlContent, 'text/html;charset=utf-8');
            } catch(error) { console.error("Error during HTML export click:", error); }
         });
    } else { console.error("Export HTML button or HTML output not found!"); }

    // --- Scroll Syncing Logic ---
    let isSyncing = false;
    function syncScroll(sourceElement, targetElement) {
        if (isSyncing || !sourceElement || !targetElement || sourceElement.clientHeight === 0 || targetElement.clientHeight === 0) return;
        isSyncing = true;
        const sourceScrollHeight = sourceElement.scrollHeight; const sourceClientHeight = sourceElement.clientHeight;
        const targetScrollHeight = targetElement.scrollHeight; const targetClientHeight = targetElement.clientHeight;
        if (sourceScrollHeight <= sourceClientHeight) { isSyncing = false; return; }
        const scrollableDistSource = sourceScrollHeight - sourceClientHeight;
        const scrollPercent = scrollableDistSource > 0 ? sourceElement.scrollTop / scrollableDistSource : 0;
        const scrollableDistTarget = targetScrollHeight - targetClientHeight;
        if (scrollableDistTarget > 0) { targetElement.scrollTop = scrollPercent * scrollableDistTarget; }
        setTimeout(() => { isSyncing = false; }, 50);
    }
    if(markdownInput && htmlOutput) {
        markdownInput.addEventListener('scroll', () => syncScroll(markdownInput, htmlOutput));
        htmlOutput.addEventListener('scroll', () => syncScroll(htmlOutput, markdownInput));
    } else { console.error("Cannot attach scroll listeners - editor or preview element not found."); }

    // --- Preview Fullscreen Toggle Logic ---
    if (toggleFullscreenButton && container) {
        toggleFullscreenButton.addEventListener('click', () => {
            try {
                const icon = toggleFullscreenButton.querySelector('i');
                container.classList.toggle('fullscreen-preview-active');
                if (container.classList.contains('fullscreen-preview-active')) {
                    icon.classList.remove('fa-expand'); icon.classList.add('fa-compress');
                    toggleFullscreenButton.title = "خروج از تمام صفحه";
                } else {
                    icon.classList.remove('fa-compress'); icon.classList.add('fa-expand');
                    toggleFullscreenButton.title = "نمایش تمام صفحه پیش‌نمایش";
                }
                setTimeout(() => {
                    if (!container.classList.contains('fullscreen-preview-active')) {
                         syncScroll(markdownInput, htmlOutput); syncScroll(htmlOutput, markdownInput);
                    }
                }, 350);
            } catch(error) { console.error("Error during Fullscreen toggle click:", error); }
        });
    } else { console.error("Toggle Fullscreen button or container not found!"); }


    // --- Settings Modal Logic ---
    function openModal() { if (settingsModal) settingsModal.classList.remove('hidden'); }
    function closeModal() { if (settingsModal) settingsModal.classList.add('hidden'); }
    if (settingsButton) { settingsButton.addEventListener('click', openModal); } else { console.error("Settings button not found!"); }
    if (closeModalButton) { closeModalButton.addEventListener('click', closeModal); } else { console.error("Modal close button not found!"); }
    if (settingsModal) { settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) closeModal(); }); } else { console.error("Settings modal not found!"); }

    // --- Theme Switching Logic ---
    function applyTheme(themeName) {
        if (!document.body) return;
        // console.log("Applying theme:", themeName);
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${themeName}`);
        themeButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.theme === themeName); });
        try { localStorage.setItem('theme', themeName); }
        catch (e) { console.error("Could not save theme to localStorage:", e); }
    }
    themeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const selectedTheme = event.target.dataset.theme; if (selectedTheme) applyTheme(selectedTheme);
        });
    });

    // --- Parser Switching Logic ---
    parserRadioButtons.forEach(radio => {
        radio.addEventListener('change', (event) => {
            if (event.target.checked) {
                currentParser = event.target.value;
                console.log(`Parser changed to: ${currentParser}`);
                try { localStorage.setItem('parser', currentParser); }
                catch (e) { console.error("Could not save parser preference:", e); }
                updatePreview(); // Re-render preview
            }
        });
    });


    // --- Keyboard Shortcuts for Undo/Redo ---
     if (markdownInput) {
        markdownInput.addEventListener('keydown', (event) => {
            let handled = false;
            // Ctrl+Z or Cmd+Z for Undo
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
                handled = true; undo();
            }
            // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z for Redo
            else if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') ||
                     ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z')) {
                handled = true; redo();
            }
            // --- Potential future: Add Ctrl+B, Ctrl+I etc. ---
            // else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
            //      handled = true; insertMarkdownSyntax('**', '**');
            // }
            // else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'i') {
            //      handled = true; insertMarkdownSyntax('*', '*');
            // }

            if (handled) { event.preventDefault(); } // Prevent default only if we handled it
        });
     }

    // --- Initial Setup ---
    async function initializeApp() { // Make async for dynamic import
        console.log("Initializing App...");
        try {
            // Load theme first
            const savedTheme = localStorage.getItem('theme') || 'light';
            applyTheme(savedTheme);

            // Attempt to load ShahNeshan dynamically
            await loadAndConfigureShahneshan();

            // Load parser preference AFTER attempting library load
            const savedParser = localStorage.getItem('parser') || 'marked';
            currentParser = savedParser;
            // Disable radio if ShahNeshan failed to load
            const shahneshanRadioInit = document.querySelector('input[name="parser"][value="shahneshan"]');
            if (currentParser === 'shahneshan' && shahneshanRadioInit && shahneshanRadioInit.disabled) {
                 console.warn("ShahNeshan selected but failed to load, falling back to marked.");
                 currentParser = 'marked';
                 try { localStorage.setItem('parser', currentParser); } catch(e){}
            }
            // Update radio button selection
            const currentParserRadio = document.querySelector(`input[name="parser"][value="${currentParser}"]`);
            if (currentParserRadio) { currentParserRadio.checked = true; }
            else { const markedRadio = document.querySelector('input[name="parser"][value="marked"]'); if(markedRadio) markedRadio.checked = true; currentParser = 'marked'; }
            console.log(`Initial parser set to: ${currentParser}`);

            // Initial UI updates
            setTextDirection();
            updatePreview();
            updateStatusBar();

            // Initialize History
            history = []; historyIndex = -1; saveState(); updateUndoRedoButtons();

            console.log("Initial setup complete.");
        } catch (error) { console.error("Error during initial setup:", error); }
    }

    // Run initialization
    initializeApp();

    // --- Main Input Listener ---
    if(markdownInput) {
        markdownInput.addEventListener('input', () => {
            // Don't run updates if state is being applied by undo/redo
            if (!isApplyingState) {
                 updatePreview();
                 updateStatusBar();
                 setTextDirection();
                 debouncedSaveState(); // Save state after user pauses
                 // Sync scroll can remain immediate or be debounced
                 setTimeout(() => syncScroll(markdownInput, htmlOutput), 50);
            }
        });
    } else { console.error("Markdown input element not found, cannot attach listener."); }


}); // End DOMContentLoaded listener