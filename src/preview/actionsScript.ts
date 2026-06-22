export const previewActionsScriptPath = "/assets/preview-actions.js";

export const previewActionsScript = `(() => {
  const sourceSelector = "[data-markdown-source]";
  const statusSelector = "[data-copy-status]";

  function setStatus(message) {
    const status = document.querySelector(statusSelector);
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(setStatus.timeoutId);
    setStatus.timeoutId = window.setTimeout(() => {
      status.textContent = "";
    }, 3500);
  }

  async function copyMarkdown(successMessage) {
    const source = document.querySelector(sourceSelector);
    if (!source) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(source.value);
      } else {
        source.focus();
        source.select();
        document.execCommand("copy");
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
      }
      setStatus(successMessage || "Markdownをコピーしました");
      return true;
    } catch (_error) {
      setStatus("コピーできませんでした");
      return false;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const copyButton = target.closest("[data-copy-markdown]");
    if (copyButton) {
      event.preventDefault();
      void copyMarkdown("Markdownをコピーしました");
      return;
    }

    const docsLink = target.closest("[data-open-google-docs]");
    if (docsLink) {
      void copyMarkdown("Markdownをコピーしました。Google Docsに貼り付けられます");
    }
  });
})();`;
