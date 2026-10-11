/* Shows a PDF on the page (used on the Openings page).
   Any element with data-pdf="path/to/file.pdf" gets the PDF's pages drawn inside its .pdf-pages box.
   Uses PDF.js (Apache 2.0), bundled in assets/vendor/pdfjs. */
import * as pdfjsLib from '../vendor/pdfjs/pdf.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;

const MAX_PAGES = 6;

for (const el of document.querySelectorAll('[data-pdf]')) {
  showPdf(el);
}

async function showPdf(el) {
  const url = el.getAttribute('data-pdf');
  const box = el.querySelector('.pdf-pages');
  const status = el.querySelector('.pdf-status');

  let response;
  try {
    response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
  } catch (err) {
    response = null;
  }
  if (response && response.status === 404) {
    el.classList.add('is-missing');
    status.textContent = el.getAttribute('data-missing-text') || 'The full position description will be posted here soon.';
    return;
  }

  try {
    const pdf = await pdfjsLib.getDocument({ url, isEvalSupported: false, useWasm: false }).promise;
    const count = Math.min(pdf.numPages, MAX_PAGES);
    const pages = [];
    for (let n = 1; n <= count; n += 1) pages.push(await pdf.getPage(n));

    const canvases = pages.map((page, i) => {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Page ${i + 1} of ${pdf.numPages} of the PDF`);
      box.appendChild(canvas);
      return canvas;
    });

    let tasks = [];
    const draw = async () => {
      tasks.forEach((t) => t.cancel());
      tasks = [];
      const cssWidth = Math.min(box.clientWidth, 850);
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
      await Promise.all(pages.map((page, i) => {
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (cssWidth * ratio) / base.width });
        const canvas = canvases[i];
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const task = page.render({ canvas, viewport });
        tasks.push(task);
        return task.promise.catch((err) => {
          if (!err || err.name !== 'RenderingCancelledException') throw err;
        });
      }));
    };

    await draw();
    status.hidden = true;
    el.classList.add('is-ready');

    let lastWidth = box.clientWidth;
    let timer;
    new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - lastWidth) < 4) return;
      lastWidth = box.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(draw, 200);
    }).observe(box);
  } catch (err) {
    // If the PDF can't be drawn here, fall back to the browser's own PDF viewer.
    console.warn('PDF preview failed, using the browser viewer instead.', err);
    status.hidden = true;
    box.textContent = '';
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.title = 'PDF document';
    box.appendChild(frame);
  }
}
