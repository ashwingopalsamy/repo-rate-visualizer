const INTERACTION_SELECTORS = [
  '.crosshair-line',
  '.chart-tooltip',
  '.chart-readout',
  '.chart-interaction-overlay',
  '.chart-hover-halo',
  '.chart-hover-dot',
  '.decision-marker__hit',
];

const STYLE_PROPERTIES = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor',
  'letter-spacing', 'text-transform', 'display', 'visibility', 'color',
];

function svgSize(svgEl) {
  const rect = svgEl.getBoundingClientRect();
  const width = Number.parseFloat(svgEl.getAttribute('width')) || rect.width;
  const height = Number.parseFloat(svgEl.getAttribute('height')) || rect.height;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

export function cloneSvgForExport(svgEl, { backgroundColor, provenance } = {}) {
  if (!svgEl) throw new Error('Chart SVG is not available.');
  const clone = svgEl.cloneNode(true);
  const { width, height: chartHeight } = svgSize(svgEl);
  const footerHeight = provenance ? 34 : 0;
  const height = chartHeight + footerHeight;

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  clone.querySelectorAll(INTERACTION_SELECTORS.join(',')).forEach(element => element.remove());
  clone.querySelectorAll('rect[fill="transparent"]').forEach(element => element.remove());

  const originalElements = svgEl.querySelectorAll('*');
  const cloneElements = clone.querySelectorAll('*');
  originalElements.forEach((original, index) => {
    const copied = cloneElements[index];
    if (!copied) return;
    const computed = window.getComputedStyle(original);
    STYLE_PROPERTIES.forEach(property => {
      const value = computed.getPropertyValue(property);
      if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
        copied.style.setProperty(property, value);
      }
    });
  });

  if (backgroundColor) {
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('width', String(width));
    background.setAttribute('height', String(height));
    background.setAttribute('fill', backgroundColor);
    clone.insertBefore(background, clone.firstChild);
  }

  if (provenance) {
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = provenance.title || 'RBI repo rate chart';
    clone.insertBefore(title, clone.firstChild);

    const description = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    description.textContent = provenance.description || '';
    clone.insertBefore(description, title.nextSibling);

    const footer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    footer.setAttribute('aria-label', 'Chart provenance');
    const footerBackground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    footerBackground.setAttribute('x', '0');
    footerBackground.setAttribute('y', String(chartHeight));
    footerBackground.setAttribute('width', String(width));
    footerBackground.setAttribute('height', String(footerHeight));
    footerBackground.setAttribute('fill', backgroundColor || '#ffffff');
    footerBackground.setAttribute('opacity', '0.96');
    footer.appendChild(footerBackground);

    const footerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    footerText.setAttribute('x', '12');
    footerText.setAttribute('y', String(chartHeight + 21));
    footerText.setAttribute('fill', '#5f6368');
    footerText.setAttribute('font-family', 'Inter, Arial, sans-serif');
    footerText.setAttribute('font-size', '10');
    footerText.textContent = provenance.footer || '';
    footer.appendChild(footerText);
    clone.appendChild(footer);
  }

  return { clone, width, height };
}

function blobFromClone(clone) {
  const source = new XMLSerializer().serializeToString(clone);
  if (!source.includes('<svg')) throw new Error('The chart SVG could not be serialized.');
  return new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadSvg(svgEl, filename, options) {
  const { clone } = cloneSvgForExport(svgEl, options);
  downloadBlob(blobFromClone(clone), filename);
}

export async function renderPngBlob(svgEl, { backgroundColor, scale = 2, provenance } = {}) {
  await document.fonts?.ready;
  const { clone, width, height } = cloneSvgForExport(svgEl, { backgroundColor, provenance });
  const blob = blobFromClone(clone);
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('The chart could not be rendered as PNG.'));
      nextImage.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable.');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);

    const png = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG encoding failed.')), 'image/png');
    });
    if (!png || png.type !== 'image/png' || png.size < 100) throw new Error('The generated PNG is empty.');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(svgEl, filename, options) {
  downloadBlob(await renderPngBlob(svgEl, options), filename);
}
