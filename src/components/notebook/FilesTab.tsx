'use client'

import { useState } from 'react'
import {
  UploadCloud, FileText, Image as ImageIcon, Video, Music, Code,
  Download, Trash2, Eye, X, CheckCircle, Search
} from 'lucide-react'
import { can } from '@/lib/permissions'
import toast from 'react-hot-toast'
import type { NotebookFile, NotebookRole, NotebookSettings } from '@/types'

interface FilesTabProps {
  notebookId: string
  userRole: NotebookRole
  settings: NotebookSettings
}

const INITIAL_FILES: NotebookFile[] = [
  {
    id: 'file-1',
    notebook_id: 'nb-daa',
    uploaded_by: 'user-1',
    original_name: 'algorithms_cheatsheet.pdf',
    storage_key: 'files/algorithms_cheatsheet.pdf',
    mime_declared: 'application/pdf',
    size: 2450000,
    status: 'ready',
    preview_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    uploader: {
      id: 'user-1',
      google_id: null,
      name: 'Vedant',
      email: 'vedant@example.com',
      avatar_url: null,
      created_at: '',
      updated_at: '',
      last_active_at: null,
    },
  },
  {
    id: 'file-2',
    notebook_id: 'nb-daa',
    uploaded_by: 'user-2',
    original_name: 'graph_traversal_diagram.png',
    storage_key: 'files/graph_traversal_diagram.png',
    mime_declared: 'image/png',
    size: 1120000,
    status: 'ready',
    preview_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    uploader: {
      id: 'user-2',
      google_id: null,
      name: 'Alex Chen',
      email: 'alex@example.com',
      avatar_url: null,
      created_at: '',
      updated_at: '',
      last_active_at: null,
    },
  },
  {
    id: 'file-3',
    notebook_id: 'nb-daa',
    uploaded_by: 'user-1',
    original_name: 'quick_sort_benchmark.ts',
    storage_key: 'files/quick_sort_benchmark.ts',
    mime_declared: 'text/typescript',
    size: 4200,
    status: 'ready',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    uploader: {
      id: 'user-1',
      google_id: null,
      name: 'Vedant',
      email: 'vedant@example.com',
      avatar_url: null,
      created_at: '',
      updated_at: '',
      last_active_at: null,
    },
  },
]

export function FilesTab({ notebookId, userRole, settings }: FilesTabProps) {
  const [files, setFiles] = useState<NotebookFile[]>(INITIAL_FILES)
  const [search, setSearch] = useState('')
  const [previewFile, setPreviewFile] = useState<NotebookFile | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const canUpload = can(userRole, 'file:upload', settings)
  const canDownload = can(userRole, 'file:download', settings)
  const canDelete = can(userRole, 'file:delete', settings)

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  function getFileIcon(mime: string) {
    if (mime.startsWith('image/')) return <ImageIcon size={20} style={{ color: '#ec4899' }} />
    if (mime.startsWith('video/')) return <Video size={20} style={{ color: '#8b5cf6' }} />
    if (mime.startsWith('audio/')) return <Music size={20} style={{ color: '#f59e0b' }} />
    if (mime.includes('typescript') || mime.includes('javascript') || mime.includes('json')) return <Code size={20} style={{ color: '#10b981' }} />
    return <FileText size={20} style={{ color: '#6366f1' }} />
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files
    if (!uploadedFiles || uploadedFiles.length === 0) return

    setUploadProgress(10)
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev === null || prev >= 100) {
          clearInterval(interval)
          setTimeout(() => setUploadProgress(null), 800)
          return 100
        }
        return prev + 25
      })
    }, 200)

    const fileList = Array.from(uploadedFiles)
    fileList.forEach(f => {
      const newFile: NotebookFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        notebook_id: notebookId,
        uploaded_by: 'current-user',
        original_name: f.name,
        storage_key: `files/${f.name}`,
        mime_declared: f.type || 'application/octet-stream',
        size: f.size,
        status: 'ready',
        preview_url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        created_at: new Date().toISOString(),
      }
      setFiles(prev => [newFile, ...prev])
    })

    toast.success(`Uploaded ${fileList.length} file(s)`)
  }

  function handleDeleteFile(fileId: string) {
    if (!canDelete) {
      toast.error('Permission denied to delete files')
      return
    }
    setFiles(prev => prev.filter(f => f.id !== fileId))
    toast.success('File deleted')
  }

  function handleDownload(file: NotebookFile) {
    if (!canDownload) {
      toast.error('Viewer downloads are disabled by the notebook owner.')
      return
    }
    toast.success(`Downloading ${file.original_name}…`)
  }

  const filtered = files.filter(f =>
    f.original_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1080, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Notebook Files & Media</h2>
          <p style={{ fontSize: 13.5, color: 'hsl(var(--muted))' }}>
            Store and preview reference documents, diagrams, PDFs, and assets attached to this notebook.
          </p>
        </div>

        {canUpload && (
          <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <UploadCloud size={16} />
            Upload File
            <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Upload progress banner */}
      {uploadProgress !== null && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', borderRadius: 10,
          background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>Uploading…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'hsl(var(--surface-2))', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'hsl(var(--brand))', transition: 'width 0.2s ease' }} />
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files in this notebook…"
          className="input"
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Files Grid */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 20px',
          border: '2px dashed hsl(var(--border))', borderRadius: 16,
          background: 'hsl(var(--surface) / 0.5)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No files uploaded yet</h3>
          <p style={{ fontSize: 13, color: 'hsl(var(--muted))', maxWidth: 360, margin: '0 auto 16px' }}>
            Upload research papers, source code, lecture slides, or diagrams to attach them to this notebook.
          </p>
          {canUpload && (
            <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <UploadCloud size={15} />
              Choose files
              <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(file => (
            <div
              key={file.id}
              style={{
                background: 'hsl(var(--surface))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: 'hsl(var(--surface-2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {getFileIcon(file.mime_declared)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13.5,
                      color: 'hsl(var(--foreground))',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={file.original_name}>
                      {file.original_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--muted))', marginTop: 2 }}>
                      {formatBytes(file.size)} • {file.uploader?.name || 'Vedant'}
                    </div>
                  </div>
                </div>

                {file.preview_url && file.mime_declared.startsWith('image/') && (
                  <div
                    onClick={() => setPreviewFile(file)}
                    style={{
                      height: 120, borderRadius: 8, overflow: 'hidden',
                      marginBottom: 12, cursor: 'pointer', background: 'hsl(var(--surface-2))',
                    }}
                  >
                    <img src={file.preview_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: 10, borderTop: '1px solid hsl(var(--border))',
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {file.preview_url && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Eye size={13} /> Preview
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(file)}
                    className="btn-ghost"
                    style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Download size={13} /> Download
                  </button>
                </div>

                {canDelete && (
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="btn-ghost"
                    style={{ padding: 4, color: 'hsl(0 84% 60%)' }}
                    title="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="modal-overlay animate-fade-in" onClick={() => setPreviewFile(null)}>
          <div
            className="modal animate-scale-in"
            style={{ maxWidth: 700, padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {getFileIcon(previewFile.mime_declared)}
                <span style={{ fontWeight: 700, fontSize: 15 }}>{previewFile.original_name}</span>
              </div>
              <button onClick={() => setPreviewFile(null)} className="btn-ghost" style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ textAlign: 'center', maxHeight: 440, overflow: 'auto', borderRadius: 8, background: 'hsl(var(--surface-2))', padding: 12 }}>
              {previewFile.mime_declared.startsWith('image/') ? (
                <img src={previewFile.preview_url} alt="" style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 6 }} />
              ) : (
                <div style={{ padding: '40px 20px', color: 'hsl(var(--muted))' }}>
                  <p style={{ fontSize: 14 }}>Preview not supported for this format.</p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => handleDownload(previewFile)} className="btn btn-primary" style={{ fontSize: 13 }}>
                <Download size={14} /> Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
