// Descarga el contenido completo de un gráfico como PNG. Los gráficos de
// Recharts viven dentro de SVG, pero algunos detalles del dashboard (centro de
// donas, leyendas propias) son HTML; por eso se captura el contenedor entero.

function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source)
  const style = Array.from(computed)
    .map((name) => `${name}:${computed.getPropertyValue(name)};`)
    .join('')

  target.setAttribute('style', style)

  const sourceChildren = Array.from(source.children)
  const targetChildren = Array.from(target.children)

  sourceChildren.forEach((child, index) => {
    const targetChild = targetChildren[index]
    if (targetChild) inlineComputedStyles(child, targetChild)
  })
}

function ensureSvgAttributes(root: Element) {
  root.querySelectorAll('svg').forEach((svg) => {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const rect = svg.getBoundingClientRect()
    if (!svg.getAttribute('width')) svg.setAttribute('width', String(Math.max(1, rect.width)))
    if (!svg.getAttribute('height')) svg.setAttribute('height', String(Math.max(1, rect.height)))
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadChartPng(
  container: HTMLElement | null,
  filename: string,
  background: string,
): Promise<void> {
  if (!container) throw new Error('No se encontró el gráfico para exportar.')

  const rect = container.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(rect.width))
  const height = Math.max(1, Math.ceil(rect.height))
  const scale = 2

  const clone = container.cloneNode(true) as HTMLElement
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.background = background

  inlineComputedStyles(container, clone)
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.background = background
  ensureSvgAttributes(clone)

  const html = new XMLSerializer().serializeToString(clone)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        ${html}
      </foreignObject>
    </svg>
  `

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo rasterizar el gráfico.'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible.')

  ctx.scale(scale, scale)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('No se pudo crear el PNG.'))
        return
      }

      downloadBlob(blob, filename)
      resolve()
    }, 'image/png')
  })
}
