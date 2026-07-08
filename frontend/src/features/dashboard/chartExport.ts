// Descarga un gráfico (SVG de Recharts) como imagen PNG. El SVG es autónomo
// (sin imágenes externas), así que se puede rasterizar en un <canvas> sin
// problemas de "tainted canvas".

export async function downloadChartPng(
  container: HTMLElement | null,
  filename: string,
  background: string,
): Promise<void> {
  const svg = container?.querySelector('svg')
  if (!svg) throw new Error('No se encontró el gráfico para exportar.')

  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const scale = 2 // export nítido (retina)

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const xml = new XMLSerializer().serializeToString(clone)
  const svgUrl =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo rasterizar el gráfico.'))
    img.src = svgUrl
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

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
