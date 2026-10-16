'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UploadCloud, FileText, Image as ImageIcon, Video, Music, Code,
  Download, Trash2, Eye, X, CheckCircle, Search, Loader2
} from 'lucide-react'
import { can } from '@/lib/permissions'
import toast from 'react-hot-toast'
import type { NotebookFile, NotebookRole, NotebookSettings } from '@/types'

interface FilesTabProps {
  notebookId: string
  userRole: NotebookRole
  settings: NotebookSettings
}

export function FilesTab({ notebookId, userRole, settings }: FilesTabProps) {
  const [files, setFiles] = useState<NotebookFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [previewFile, setPreviewFile] = useState<NotebookFile | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const canUpload = can(userRole, 'file:upload', settings)
  const canDownload = can(userRole, 'file:download', settings)
  const canDelete = can(userRole, 'file:delete', settings)

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/notebooks/${notebookId}/files`)
      const data = await res.json()
      if (res.ok && data.files) {
        setFiles(data.files)
      }
    } catch (err) {
      console.error('[FilesTab load error]', err)
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  function getFileIcon(mime: string) {
    if (mime.startsWith('image/')) return <ImageIcon size={18} style={{ color: 'var(--accent)' }} />
    if (mime.startsWith('video/')) return <Video size={18} style={{ color: '#8b5cf6' }} />
    if (mime.startsWith('audio/')) return <Music size={18} style={{ color: '#f59e0b' }} />
    if (mime.includes('typescript') || mime.includes('javascript') || mime.includes('json'))
      return <Code size={18} style={{ color: 'var(--success)' }} />
    return <FileText size={18} style={{ color: 'var(--accent)' }} />
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) return

    const file = uploadedFiles[0]
    setUploadProgress(20)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setUploadProgress(50)
      const res = await fetch(`/api/notebooks/${notebookId}/files`, {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(90)
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      setUploadProgress(100)
      setTimeout(() => setUploadProgress(null), 500)

      setFiles(prev => [data.file, ...prev])
      toast.success(`${file.name} uploaded`)
    } catch (err: any) {
      setUploadProgress(null)
      toast.error(err.message || 'Failed to upload file')
    } finally {
      e.target.value = ''
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!canDelete) {
      toast.error('You do not have permission to delete files.')
      return
    }

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/files/${fileId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete file')
      }

      setFiles(prev => prev.filter(f => f.id !== fileId))
      if (previewFile?.id === fileId) {
        setPreviewFile(null)
      }
      toast.success('File deleted')
    } catch (err: any) {
      toast.error(err.message || 'Could not delete file')
    }
  }

  const filteredFiles = files.filter(f =>
    f.original_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 650, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            Files & Attachments
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {files.length} {files.length === 1 ? 'file' : 'files'} securely stored in cloud
          </p>
        </div>

        {canUpload && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 550,
              cursor: 'pointer',
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <UploadCloud size={14} />
            <span>Upload file</span>
            <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Progress Indicator */}
      {uploadProgress !== null && (
        <div style={{ marginBottom: 20, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span>Uploading to Supabase Storage…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent)', transition: 'width 0.2s ease' }} />
          </div>
        </div>
      )}

      {/* Search Bar */}
      {files.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search attachments…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: 34,
              padding: '0 12px 0 32px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 8, color: 'var(--text-muted)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Loading files…</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        /* Empty State */
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            No attachments yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Upload PDFs, documents, or images to share with notebook collaborators.
          </p>
          {canUpload && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <UploadCloud size={14} />
              <span>Choose a file</span>
              <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        /* File List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredFiles.map(file => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                transition: 'background var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {getFileIcon(file.mime_declared)}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.original_name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {formatBytes(file.size)} • Uploaded {new Date(file.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {file.preview_url && canDownload && (
                  <a
                    href={file.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={file.original_name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      textDecoration: 'none',
                    }}
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </a>
                )}

                {canDelete && (
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="Delete file"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
