document.addEventListener("DOMContentLoaded", () => {
  // Declare marked variable
  const marked = window.marked

  // عناصر DOM
  const editor = document.getElementById("editor")
  const preview = document.getElementById("preview")
  const lineNumbers = document.getElementById("line-numbers")
  const settingsButton = document.getElementById("settings-button")
  const settingsModal = document.getElementById("settings-modal")
  const closeSettings = document.getElementById("close-settings")
  const parserSelect = document.getElementById("parser-select")
  const fontSelect = document.getElementById("font-select")
  const themeSelect = document.getElementById("theme-select")
  const lineNumbersToggle = document.getElementById("line-numbers-toggle")
  const exportMdButton = document.getElementById("export-md")
  const exportHtmlButton = document.getElementById("export-html")
  const toolbarButtons = document.querySelectorAll(".toolbar button[data-action]")
  const undoButton = document.getElementById("undo-button")
  const redoButton = document.getElementById("redo-button")
  const fullscreenButton = document.getElementById("fullscreen-button")
  const loadFileButton = document.getElementById("load-file-button")
  const fileInput = document.getElementById("file-input")
  const editorContainer = document.querySelector(".editor-container")

  // عناصر آمار
  const charCount = document.getElementById("char-count")
  const letterCount = document.getElementById("letter-count")
  const wordCount = document.getElementById("word-count")
  const lineCount = document.getElementById("line-count")
  const fileSize = document.getElementById("file-size")

  // تنظیم marked برای پشتیبانی از RTL
  marked.setOptions({
    breaks: true,
    gfm: true,
  })

  // متغیرهای تاریخچه تغییرات
  let history = []
  let historyIndex = -1
  let isUndoRedo = false

  // تابع بارگذاری تنظیمات از localStorage
  function loadSettings() {
    const parser = localStorage.getItem("parser") || "marked"
    const font = localStorage.getItem("font") || "Vazirmatn"
    const theme = localStorage.getItem("theme") || "light"
    const showLineNumbers = localStorage.getItem("showLineNumbers") === "true"

    parserSelect.value = parser
    fontSelect.value = font
    themeSelect.value = theme
    lineNumbersToggle.checked = showLineNumbers

    applyFont(font)
    applyTheme(theme)

    document.body.classList.toggle("show-line-numbers", showLineNumbers)
  }

  // بارگذاری تنظیمات از localStorage
  loadSettings()

  // بارگذاری محتوای ذخیره شده از localStorage
  const savedContent = localStorage.getItem("markdown-content") || ""

  // برگشت به استفاده از textarea برای ویرایشگر
  editor.value = savedContent
  renderMarkdown()
  updateStats()
  updateLineNumbers()
  highlightCurrentLine()

  // اضافه کردن محتوای اولیه به تاریخچه
  history.push(savedContent)
  historyIndex = 0

  // متغیرهای کنترل اسکرول
  let isManualScrolling = false
  let editorScrolling = false
  let previewScrolling = false

  // تابع تشخیص جهت متن برای هر خط
  function detectLineDirection() {
    const text = editor.value
    const lines = text.split("\n")
    const cursorPosition = editor.selectionStart

    // پیدا کردن خط فعلی و موقعیت آن
    let currentLineStart = 0
    let currentLineIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length
      const lineEnd = currentLineStart + lineLength

      if (cursorPosition >= currentLineStart && cursorPosition <= lineEnd + 1) {
        currentLineIndex = i
        break
      }

      currentLineStart = lineEnd + 1 // +1 برای نویسه خط جدید
    }

    // ایجاد یک المان موقت برای تست جهت هر خط
    const tempDiv = document.createElement("div")
    tempDiv.style.position = "absolute"
    tempDiv.style.visibility = "hidden"
    document.body.appendChild(tempDiv)

    // بررسی هر خط و تنظیم کلاس مناسب
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // اگر خط خالی است، پیش‌فرض RTL
      if (!line) continue

      // بررسی اگر خط با حروف انگلیسی شروع می‌شود یا بیشتر حروف انگلیسی دارد
      const englishChars = line.match(/[a-zA-Z]/g) || []
      const nonEnglishChars = line.match(/[^\x00-\x7F]/g) || []

      // اگر اولین کاراکتر انگلیسی است یا تعداد کاراکترهای انگلیسی بیشتر است
      if (/^[a-zA-Z]/.test(line) || (englishChars.length > nonEnglishChars.length && englishChars.length > 0)) {
        // این خط باید LTR باشد
        tempDiv.setAttribute("data-line-" + i, "ltr")
      } else {
        // این خط باید RTL باشد
        tempDiv.setAttribute("data-line-" + i, "rtl")
      }
    }

    // حذف المان موقت
    document.body.removeChild(tempDiv)

    return {
      lines,
      currentLineIndex,
      directions: Array.from({ length: lines.length }, (_, i) => {
        const attr = tempDiv.getAttribute("data-line-" + i)
        return attr || "rtl" // پیش‌فرض RTL
      }),
    }
  }

  // تابع اعمال جهت به خط فعلی
  function applyDirectionToCurrentLine() {
    const { currentLineIndex, directions } = detectLineDirection()

    // اعمال جهت به خط فعلی
    if (directions[currentLineIndex] === "ltr") {
      editor.style.direction = "ltr"
      editor.style.textAlign = "left"
    } else {
      editor.style.direction = "rtl"
      editor.style.textAlign = "right"
    }
  }

  // اضافه کردن رویداد input برای تشخیص و اعمال جهت
  editor.addEventListener("input", () => {
    applyDirectionToCurrentLine()

    // ذخیره محتوا و به‌روزرسانی
    const content = editor.value
    localStorage.setItem("markdown-content", content)
    saveToHistory(content)
    renderMarkdown()
    updateStats()
    updateLineNumbers()
    highlightCurrentLine()
  })

  // اضافه کردن رویداد keydown برای تشخیص جهت قبل از ورود نویسه
  editor.addEventListener("keydown", (e) => {
    // Ctrl+Z برای undo
    if (e.ctrlKey && e.key === "z") {
      e.preventDefault()
      undo()
      return
    }

    // Ctrl+Y برای redo
    if (e.ctrlKey && e.key === "y") {
      e.preventDefault()
      redo()
      return
    }

    // اگر کلید Enter فشرده شد، جهت خط جدید را تنظیم کنیم
    if (e.key === "Enter") {
      const cursorPosition = editor.selectionStart
      const text = editor.value
      const lines = text.split("\n")

      // پیدا کردن خط فعلی
      let currentLineStart = 0
      let currentLineEnd = 0
      let currentLine = ""

      for (let i = 0; i < lines.length; i++) {
        currentLineEnd = currentLineStart + lines[i].length

        if (cursorPosition >= currentLineStart && cursorPosition <= currentLineEnd + 1) {
          currentLine = lines[i]
          break
        }

        currentLineStart = currentLineEnd + 1 // +1 برای نویسه خط جدید
      }

      // بررسی الگوهای لیست
      const unorderedListMatch = currentLine.match(/^(\s*)-\s(.*)$/)
      const orderedListMatch = currentLine.match(/^(\s*)\d+\.\s(.*)$/)
      const checklistMatch = currentLine.match(/^(\s*)-\s\[([ x])\]\s(.*)$/)

      if (unorderedListMatch || orderedListMatch || checklistMatch) {
        // اگر خط فعلی با الگوی لیست شروع شده
        let prefix = ""
        let isEmpty = false

        if (unorderedListMatch) {
          const [, spaces, content] = unorderedListMatch
          isEmpty = content.trim() === ""
          prefix = isEmpty ? "" : `${spaces}- `
        } else if (orderedListMatch) {
          const [, spaces, content] = orderedListMatch
          isEmpty = content.trim() === ""

          // اگر خط خالی نیست، شماره بعدی را محاسبه می‌کنیم
          if (!isEmpty) {
            const currentNumber = Number.parseInt(currentLine.match(/^(\s*)(\d+)/)[2])
            prefix = `${spaces}${currentNumber + 1}. `
          }
        } else if (checklistMatch) {
          const [, spaces, , content] = checklistMatch
          isEmpty = content.trim() === ""
          prefix = isEmpty ? "" : `${spaces}- [ ] `
        }

        if (isEmpty) {
          // اگر خط خالی است، الگوی لیست را حذف می‌کنیم و در همان خط باقی می‌مانیم
          e.preventDefault()
          const beforeCursor = text.substring(0, currentLineStart)
          const afterCursor = text.substring(currentLineEnd + 1)
          editor.value = beforeCursor + "\n" + afterCursor
          editor.selectionStart = editor.selectionEnd = currentLineStart + 1

          // به‌روزرسانی محتوا
          const content = editor.value
          localStorage.setItem("markdown-content", content)
          saveToHistory(content)
          renderMarkdown()
          updateStats()
          updateLineNumbers()
          highlightCurrentLine()
        } else if (prefix) {
          // اگر خط خالی نیست، الگوی لیست را در خط جدید اضافه می‌کنیم
          e.preventDefault()
          const beforeCursor = text.substring(0, cursorPosition)
          const afterCursor = text.substring(cursorPosition)
          editor.value = beforeCursor + "\n" + prefix + afterCursor
          editor.selectionStart = editor.selectionEnd = cursorPosition + 1 + prefix.length

          // به‌روزرسانی محتوا
          const content = editor.value
          localStorage.setItem("markdown-content", content)
          saveToHistory(content)
          renderMarkdown()
          updateStats()
          updateLineNumbers()
          highlightCurrentLine()
        }
      }

      setTimeout(() => {
        applyDirectionToCurrentLine()
      }, 0)
    }

    // اگر کلید فاصله یا Tab فشرده شد، جهت را بررسی کنیم
    if (e.key === " " || e.key === "Tab") {
      setTimeout(() => {
        applyDirectionToCurrentLine()
      }, 0)
    }

    // بستن خودکار نویسه‌های جفت
    const pairChars = {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "'": "'",
      "`": "`",
      "<": ">",
    }

    if (pairChars[e.key]) {
      e.preventDefault()

      const start = editor.selectionStart
      const end = editor.selectionEnd
      const selectedText = editor.value.substring(start, end)

      // اگر متنی انتخاب شده باشد، آن را بین نویسه‌های جفت قرار می‌دهیم
      if (start !== end) {
        const newText = e.key + selectedText + pairChars[e.key]
        editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end)
        editor.selectionStart = start + 1
        editor.selectionEnd = end + 1
      } else {
        // اگر متنی انتخاب نشده باشد، نویسه‌های جفت را اضافه می‌کنیم و مکان‌نما را بین آنها قرار می‌دهیم
        const newText = e.key + pairChars[e.key]
        editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end)
        editor.selectionStart = start + 1
        editor.selectionEnd = start + 1
      }

      // به‌روزرسانی محتوا
      const content = editor.value
      localStorage.setItem("markdown-content", content)
      saveToHistory(content)
      renderMarkdown()
      updateStats()
      updateLineNumbers()
      highlightCurrentLine()
    }
  })

  // اضافه کردن رویداد click برای تنظیم جهت هنگام کلیک
  editor.addEventListener("click", () => {
    applyDirectionToCurrentLine()
  })

  // اضافه کردن رویداد keypress برای تشخیص نوع نویسه
  editor.addEventListener("keypress", (e) => {
    if (e.key.length === 1) {
      const cursorPosition = editor.selectionStart
      const text = editor.value
      const textBeforeCursor = text.substring(0, cursorPosition)
      const currentLine = textBeforeCursor.split("\n").pop() || ""

      // اگر خط خالی است یا فقط فاصله دارد
      if (!currentLine.trim()) {
        // اگر کاراکتر انگلیسی است
        if (/[a-zA-Z]/.test(e.key)) {
          editor.style.direction = "ltr"
          editor.style.textAlign = "left"
        } else if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(e.key)) {
          // اگر کاراکتر فارسی/عربی است
          editor.style.direction = "rtl"
          editor.style.textAlign = "right"
        } else {
          // برای سایر کاراکترها، پیش‌فرض RTL
          editor.style.direction = "rtl"
          editor.style.textAlign = "right"
        }
      }
    }
  })

  // به‌روزرسانی هایلایت با کلیک یا حرکت مکان‌نما
  editor.addEventListener("click", highlightCurrentLine)
  editor.addEventListener("keyup", (e) => {
    highlightCurrentLine()
  })
  editor.addEventListener("mouseup", highlightCurrentLine)

  // رویداد اسکرول ویرایشگر - اصلاح شده
  editor.addEventListener("scroll", () => {
    if (editorScrolling) return

    // همگام‌سازی شماره خطوط
    if (lineNumbers.style.display !== "none") {
      lineNumbers.scrollTop = editor.scrollTop
    }

    // همگام‌سازی پیش‌نمایش فقط اگر کاربر اسکرول کرده باشد
    if (!isManualScrolling) return

    previewScrolling = true
    const percentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight)
    preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight)

    setTimeout(() => {
      previewScrolling = false
    }, 50)

    // به‌روزرسانی هایلایت خط فعلی هنگام اسکرول
    highlightCurrentLine()
  })

  // رویداد اسکرول پیش‌نمایش - اصلاح شده
  preview.addEventListener("scroll", () => {
    if (previewScrolling) return

    // همگام‌سازی ویرایشگر فقط اگر کاربر اسکرول کرده باشد
    if (!isManualScrolling) return

    editorScrolling = true
    const percentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight)
    editor.scrollTop = percentage * (editor.scrollHeight - editor.clientHeight)

    setTimeout(() => {
      editorScrolling = false
    }, 50)
  })

  // تشخیص اسکرول دستی
  editor.addEventListener("mousedown", () => (isManualScrolling = true))
  preview.addEventListener("mousedown", () => (isManualScrolling = true))

  editor.addEventListener("wheel", () => (isManualScrolling = true))
  preview.addEventListener("wheel", () => (isManualScrolling = true))

  // غیرفعال کردن اسکرول دستی بعد از مدتی عدم فعالیت
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      isManualScrolling = false
    }, 1000)
  })

  // رویداد باز کردن مدال تنظیمات
  settingsButton.addEventListener("click", () => {
    settingsModal.style.display = "flex"
  })

  // رویداد بستن مدال تنظیمات
  closeSettings.addEventListener("click", () => {
    settingsModal.style.display = "none"
  })

  // بستن مدال با کلیک خارج از آن
  window.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      settingsModal.style.display = "none"
    }
  })

  // رویداد تغییر مفسر
  parserSelect.addEventListener("change", function () {
    localStorage.setItem("parser", this.value)
    renderMarkdown()
  })

  // رویداد تغییر فونت
  fontSelect.addEventListener("change", function () {
    localStorage.setItem("font", this.value)
    applyFont(this.value)
  })

  // رویداد تغییر تم
  themeSelect.addEventListener("change", function () {
    localStorage.setItem("theme", this.value)
    applyTheme(this.value)
  })

  // رویداد تغییر نمایش شماره خطوط
  lineNumbersToggle.addEventListener("change", function () {
    const isChecked = this.checked
    localStorage.setItem("showLineNumbers", isChecked)
    document.body.classList.toggle("show-line-numbers", isChecked)
    updateLineNumbers()
  })

  // رویداد دکمه‌های خروجی
  exportMdButton.addEventListener("click", exportMarkdown)
  exportHtmlButton.addEventListener("click", exportHtml)

  // رویداد دکمه‌های نوار ابزار
  toolbarButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const action = this.getAttribute("data-action")
      applyFormatting(action)
    })
  })

  // رویداد دکمه‌های undo و redo
  if (undoButton) {
    undoButton.addEventListener("click", () => {
      undo()
    })
  }

  if (redoButton) {
    redoButton.addEventListener("click", () => {
      redo()
    })
  }

  // رویداد دکمه حالت نمایش تمام صفحه
  fullscreenButton.addEventListener("click", toggleFullscreenPreview)

  // رویداد دکمه بارگذاری فایل
  loadFileButton.addEventListener("click", () => {
    fileInput.click()
  })

  // رویداد انتخاب فایل
  fileInput.addEventListener("change", loadMarkdownFile)

  // تابع ذخیره وضعیت در تاریخچه
  function saveToHistory(content) {
    if (isUndoRedo) {
      isUndoRedo = false
      return
    }

    // حذف تاریخچه‌های بعد از موقعیت فعلی
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }

    // اضافه کردن وضعیت جدید به تاریخچه
    history.push(content)
    historyIndex = history.length - 1

    // محدود کردن تعداد تاریخچه‌ها
    if (history.length > 100) {
      history.shift()
      historyIndex--
    }
  }

  // تابع undo
  function undo() {
    if (historyIndex > 0) {
      historyIndex--
      isUndoRedo = true
      editor.value = history[historyIndex]
      renderMarkdown()
      updateStats()
      updateLineNumbers()
      highlightCurrentLine()
    }
  }

  // تابع redo
  function redo() {
    if (historyIndex < history.length - 1) {
      historyIndex++
      isUndoRedo = true
      editor.value = history[historyIndex]
      renderMarkdown()
      updateStats()
      updateLineNumbers()
      highlightCurrentLine()
    }
  }

  // تابع هایلایت کردن خط فعلی - روش جدید با استفاده از یک textarea موقت
  function highlightCurrentLine() {
    // حذف هایلایت قبلی
    const oldHighlight = document.querySelector(".line-highlight")
    if (oldHighlight) {
      oldHighlight.remove()
    }

    // ایجاد یک textarea موقت برای محاسبه دقیق موقعیت خط
    const tempTextarea = document.createElement("textarea")
    tempTextarea.style.position = "absolute"
    tempTextarea.style.visibility = "hidden"
    tempTextarea.style.height = "auto"
    tempTextarea.style.width = editor.clientWidth + "px"
    tempTextarea.style.font = window.getComputedStyle(editor).font
    tempTextarea.style.lineHeight = window.getComputedStyle(editor).lineHeight
    tempTextarea.style.padding = window.getComputedStyle(editor).padding
    document.body.appendChild(tempTextarea)

    // کپی متن تا موقعیت مکان‌نما به textarea موقت
    const cursorPosition = editor.selectionStart
    const textBeforeCursor = editor.value.substring(0, cursorPosition)
    tempTextarea.value = textBeforeCursor

    // محاسبه ارتفاع متن تا موقعیت مکان‌نما
    const textHeight = tempTextarea.scrollHeight

    // حذف textarea موقت
    document.body.removeChild(tempTextarea)

    // محاسبه ارتفاع خط
    const lineHeight = Number.parseFloat(window.getComputedStyle(editor).lineHeight)

    // محاسبه شماره خط فعلی (با شروع از 0) - اصلاح شده
    const currentLine = Math.floor(textHeight / lineHeight) - 3 // تغییر از -1 به -3 برای اصلاح مشکل

    // محاسبه موقعیت عمودی خط فعلی با در نظر گرفتن اسکرول
    const editorPadding = 16 // پدینگ بالای ویرایشگر
    const topPosition = (currentLine + 1) * lineHeight - editor.scrollTop + editorPadding

    // ایجاد المان هایلایت
    const highlight = document.createElement("div")
    highlight.className = "line-highlight"
    highlight.style.top = `${topPosition}px`
    highlight.style.height = `${lineHeight}px`

    // اضافه کردن به DOM
    document.querySelector(".editor-wrapper").appendChild(highlight)
  }

  // اصلاح تابع به‌روزرسانی شماره خطوط برای هم‌راستا شدن با متن
  function updateLineNumbers() {
    if (!lineNumbersToggle.checked) {
      return
    }

    const lines = editor.value.split("\n")
    let lineNumbersHTML = ""

    for (let i = 0; i < lines.length; i++) {
      lineNumbersHTML += `<div class="line-number">${i + 1}</div>`
    }

    lineNumbers.innerHTML = lineNumbersHTML

    // تنظیم ارتفاع خط برای هم‌راستا شدن با متن
    const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight)
    const lineNumberElements = lineNumbers.querySelectorAll(".line-number")

    lineNumberElements.forEach((element) => {
      element.style.height = `${lineHeight}px`
    })
  }

  // تابع به‌روزرسانی آمار
  function updateStats() {
    const text = editor.value

    // تعداد نویسه (کاراکتر)
    const chars = text.length
    charCount.textContent = `نویسه: ${chars}`

    // تعداد حروف (بدون فاصله و علائم)
    const letters = text.replace(/[^a-zA-Zا-یآ-ی]/g, "").length
    letterCount.textContent = `حروف: ${letters}`

    // تعداد واژه‌ها
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    wordCount.textContent = `واژه‌ها: ${words}`

    // تعداد خط‌ها
    const lines = text.split("\n").length
    lineCount.textContent = `خط: ${lines}`

    // حجم فایل
    const size = new Blob([text]).size
    const formattedSize = formatFileSize(size)
    fileSize.textContent = `حجم: ${formattedSize}`
  }

  // تابع فرمت‌بندی حجم فایل
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + " بایت"
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " کیلوبایت"
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + " مگابایت"
    }
  }

  // تابع رندر مارک‌داون
  function renderMarkdown() {
    const markdownText = editor.value
    const parser = parserSelect.value

    try {
      if (parser === "marked") {
        preview.innerHTML = marked.parse(markdownText)
      } else {
        // در اینجا می‌توانید مفسرهای دیگر را اضافه کنید
        preview.innerHTML = marked.parse(markdownText)
      }

      // اعمال جهت متن به پاراگراف‌های پیش‌نمایش
      applyDirectionToPreview()
    } catch (error) {
      console.error("Error rendering markdown:", error)
      preview.innerHTML = "<p>خطا در رندر مارک‌داون</p>"
    }
  }

  // تابع تشخیص نویسه فارسی
  function isFirstCharPersian(text) {
    if (!text) return true // پیش‌فرض RTL

    // حذف نویسه‌های خاص مارک‌داون از ابتدای متن
    const cleanText = text.replace(/^[#>*\-+\s\d.[\]()]+/, "").trim()

    if (!cleanText) return true // اگر متن خالی شد، پیش‌فرض RTL

    // بررسی اولین نویسه
    const firstChar = cleanText.charAt(0)

    // اگر با حروف انگلیسی شروع شود، false برمی‌گرداند
    return !/[a-zA-Z]/.test(firstChar)
  }

  // تابع اعمال جهت متن به پیش‌نمایش
  function applyDirectionToPreview() {
    const paragraphs = preview.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote")

    paragraphs.forEach((paragraph) => {
      const text = paragraph.textContent.trim()
      if (text) {
        // حذف کلاس‌های قبلی
        paragraph.classList.remove("ltr")

        // بررسی اگر خط با حروف انگلیسی شروع می‌شود
        if (!isFirstCharPersian(text)) {
          paragraph.style.direction = "ltr"
          paragraph.style.textAlign = "left"
          paragraph.classList.add("ltr")
        } else {
          paragraph.style.direction = "rtl"
          paragraph.style.textAlign = "right"
        }
      }
    })
  }

  // تابع اعمال فرمت‌بندی - اصلاح شده برای حذف متن پیش‌فرض
  function applyFormatting(action) {
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const selectedText = editor.value.substring(start, end)
    let replacement = ""

    switch (action) {
      case "bold":
        replacement = selectedText ? `**${selectedText}**` : "**"
        break
      case "italic":
        replacement = selectedText ? `*${selectedText}*` : "*"
        break
      case "heading":
        replacement = selectedText ? `# ${selectedText}` : "# "
        break
      case "strikethrough":
        replacement = selectedText ? `~~${selectedText}~~` : "~~"
        break
      case "unordered-list":
        if (selectedText) {
          replacement = selectedText
            .split("\n")
            .map((line) => `- ${line}`)
            .join("\n")
        } else {
          replacement = "- "
        }
        break
      case "ordered-list":
        if (selectedText) {
          replacement = selectedText
            .split("\n")
            .map((line, i) => `${i + 1}. ${line}`)
            .join("\n")
        } else {
          replacement = "1. "
        }
        break
      case "checklist":
        if (selectedText) {
          replacement = selectedText
            .split("\n")
            .map((line) => `- [ ] ${line}`)
            .join("\n")
        } else {
          replacement = "- [ ] "
        }
        break
      case "blockquote":
        if (selectedText) {
          replacement = selectedText
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
        } else {
          replacement = "> "
        }
        break
      case "code":
        replacement = selectedText ? "```\n" + selectedText + "\n```" : "```\n\n```"
        break
      case "table":
        replacement = `| عنوان ۱ | عنوان ۲ |
| --- | --- |
| محتوا | محتوا |`
        break
      case "image":
        replacement = selectedText ? `![${selectedText}](آدرس تصویر)` : "![](آدرس تصویر)"
        break
      case "link":
        replacement = selectedText ? `[${selectedText}](آدرس پیوند)` : "[](آدرس پیوند)"
        break
    }

    // جایگزینی متن انتخاب شده با متن فرمت‌بندی شده
    editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end)

    // تنظیم موقعیت مکان‌نما بعد از فرمت‌بندی
    let newCursorPos

    if (action === "code" && !selectedText) {
      // برای کد، مکان‌نما را در خط وسط قرار می‌دهیم
      newCursorPos = start + 4
    } else if (!selectedText) {
      // اگر متنی انتخاب نشده باشد، مکان‌نما را در وسط قرار می‌دهیم
      if (["bold", "italic", "strikethrough"].includes(action)) {
        newCursorPos = start + Math.floor(replacement.length / 2)
      } else {
        newCursorPos = start + replacement.length
      }
    } else {
      // اگر متنی انتخاب شده باشد، مکان‌نما را در انتها قرار می‌دهیمهیم
      newCursorPos = start + replacement.length
    }

    editor.focus()
    editor.setSelectionRange(newCursorPos, newCursorPos)

    // به‌روزرسانی پیش‌نمایش و آمار
    localStorage.setItem("markdown-content", editor.value)
    saveToHistory(editor.value)
    renderMarkdown()
    updateStats()
    updateLineNumbers()
    highlightCurrentLine()
  }

  // تابع خروجی مارک‌داون
  function exportMarkdown() {
    downloadFile(editor.value, "document.md", "text/markdown")
  }

  // تابع خروجی HTML
  function exportHtml() {
    const currentFont = fontSelect.value
    // اصلاح نام فونت Iranian-Sans در خروجی HTML
    const fontFamily = currentFont === "Iranian-Sans" ? "IranianSans" : currentFont

    const htmlContent = `<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>سند مارک‌داون</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
<link href="https://cdn.jsdelivr.net/gh/font-store/font-iranian-sans@master/WebFonts/css/style.css" rel="stylesheet" type="text/css" />
<style>
  body { 
    font-family: '${fontFamily}', system-ui, sans-serif; 
    line-height: 1.6; 
    max-width: 800px; 
    margin: 0 auto; 
    padding: 20px; 
  }
  img { max-width: 100%; }
  pre { background: #f5f5f5; padding: 1rem; overflow: auto; border-radius: 4px; }
  blockquote { border-right: 4px solid #ddd; margin-right: 0; padding-right: 1rem; color: #666; }
  code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
  table { border-collapse: collapse; width: 100%; }
  table th, table td { border: 1px solid #ddd; padding: 8px; }
  table tr:nth-child(even) { background-color: #f2f2f2; }
  .ltr { direction: ltr; text-align: left; }
</style>
</head>
<body>
${preview.innerHTML}
</body>
</html>`

    downloadFile(htmlContent, "document.html", "text/html")
  }

  // تابع دانلود فایل
  function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()

    URL.revokeObjectURL(url)
  }

  // تابع تغییر حالت نمایش تمام صفحه
  function toggleFullscreenPreview() {
    editorContainer.classList.toggle("fullscreen-preview")

    // تغییر آیکون دکمه
    if (editorContainer.classList.contains("fullscreen-preview")) {
      fullscreenButton.innerHTML = '<i class="fa-solid fa-compress"></i>'
      fullscreenButton.title = "بازگشت به حالت عادی"
    } else {
      fullscreenButton.innerHTML = '<i class="fa-solid fa-expand"></i>'
      fullscreenButton.title = "حالت نمایش"
    }
  }

  // تابع بارگذاری فایل مارک‌داون
  function loadMarkdownFile(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (e) => {
      const content = e.target.result
      editor.value = content
      localStorage.setItem("markdown-content", content)
      saveToHistory(content)
      renderMarkdown()
      updateStats()
      updateLineNumbers()
      highlightCurrentLine()
    }

    reader.readAsText(file)

    // پاک کردن مقدار input برای امکان انتخاب مجدد همان فایل
    fileInput.value = ""
  }

  // اضافه کردن تابع برای تنظیم مکان‌نما در سمت راست به صورت پیش‌فرض
  function setDefaultCursorPosition() {
    if (editor.value.length === 0) {
      // اگر ویرایشگر خالی است، مکان‌نما را در سمت راست قرار می‌دهیم
      editor.style.textAlign = "right"
    }
  }

  // اضافه کردن رویداد focus برای تنظیم مکان‌نما
  editor.addEventListener("focus", setDefaultCursorPosition)

  // اضافه کردن رویداد click برای تنظیم مکان‌نما
  editor.addEventListener("click", () => {
    if (editor.selectionStart === 0 && editor.selectionEnd === 0) {
      setDefaultCursorPosition()
    }
  })

  // تابع اعمال فونت
  function applyFont(fontName) {
    // اصلاح نام فونت Iranian-Sans
    if (fontName === "Iranian-Sans") {
      // اعمال مستقیم فونت به جای استفاده از متغیر CSS
      document.documentElement.style.fontFamily = "IranianSans, system-ui, sans-serif"
      editor.style.fontFamily = "IranianSans, monospace"
      document.querySelector(".preview-content").style.fontFamily = "IranianSans, sans-serif"
    } else {
      // برای وزیرمتن از متغیر CSS استفاده می‌کنیم
      document.documentElement.style.setProperty("--font-family", fontName)
      document.documentElement.style.fontFamily = ""
      editor.style.fontFamily = ""
      document.querySelector(".preview-content").style.fontFamily = ""
    }
  }

  // تابع اعمال تم
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme)
  }

  // فراخوانی تابع setDefaultCursorPosition در زمان بارگذاری اولیه
  setDefaultCursorPosition()

  // رندر اولیه
  renderMarkdown()
  updateStats()
  updateLineNumbers()
  highlightCurrentLine()
})

