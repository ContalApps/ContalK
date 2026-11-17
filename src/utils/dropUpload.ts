import type { Attachment } from '../store/useAppStore'

export async function uploadDroppedFile(file: File): Promise<Attachment> {
  const desktop = window.contalkDesktop

  // If running in desktop app, prefer disk registration and streaming upload (up to 2 GB)
  if (desktop) {
    try {
      const filePath = desktop.getPathForFile ? desktop.getPathForFile(file) : ((file as unknown as { path?: string }).path || '')
      if (filePath && desktop.registerDroppedFile && desktop.uploadStorageFile) {
        if (!(await desktop.storageStatus())) {
          throw new Error('Sua conta ainda não está conectada ao servidor de arquivos.')
        }
        const registered = await desktop.registerDroppedFile(filePath)
        const uploaded = await desktop.uploadStorageFile(registered.id)
        return uploaded
      }
    } catch (err) {
      // If disk registration failed with a user-facing error (like >2GB or account changed), rethrow
      if (err instanceof Error && (err.message.includes('2 GB') || err.message.includes('conta'))) {
        throw err
      }
      // Otherwise fall through to inline reader fallback if small enough
    }
  }

  // Fallback for web or memory-only files (up to 1 MB)
  if (file.size > 1048576) {
    throw new Error('O arquivo excede o limite de 1 MB (ou 2 GB no app desktop).')
  }

  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo arrastado.'))
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, 'data:application/octet-stream;base64,'))
    reader.readAsDataURL(file)
  })

  const inlineAttachment: Attachment = {
    name: file.name.slice(0, 200),
    type: file.type.slice(0, 100) || 'application/octet-stream',
    size: file.size,
    data,
  }

  if (desktop?.uploadInlineAttachment && (await desktop.storageStatus().catch(() => false))) {
    return await desktop.uploadInlineAttachment(inlineAttachment)
  }

  return inlineAttachment
}
