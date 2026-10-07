'use client'

import React from 'react'
import {
  Bold, Italic, Underline, Strikethrough, Code, Link2,
  List, ListOrdered, CheckSquare, Quote, Minus, AlignLeft,
  AlignCenter, AlignRight, ImageIcon, RotateCcw, RotateCw,
  Highlighter, Table, Heading1, Heading2, Heading3,
  CheckCircle, Loader2, WifiOff, AlertCircle
} from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  editor: Editor | null
  canEdit: boolean
  onImageUpload: () => void
  syncStatus: 'synced' | 'saving' | 'offline' | 'error'
  activeUsers: { name: string; color: string }[]
}

export function EditorToolbar({ editor, canEdit, onImageUpload, syncStatus }: EditorToolbarProps) {
  if (!editor) return null

  const SyncIndicator = () => {
    const icons = {
      synced: <CheckCircle size={12} style={{ color: '#10b981' }} />,
      saving: <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />,
      offline: <WifiOff size={12} style={{ color: '#f59e0b' }} />,
      error: <AlertCircle size={12} style={{ color: '#ef4444' }} />,
    }
    const labels = { synced: 'Saved', saving: 'Saving…', offline: 'Offline', error: 'Error' }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'hsl(var(--muted))' }}>
        {icons[syncStatus]}
        {labels[syncStatus]}
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', height: 38, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'hsl(var(--muted))' }}>👁 View only</span>
      </div>
    )
  }

  function toolbarBtn(
    label: string,
    icon: React.ReactNode,
    action: () => void,
    active?: boolean,
    title?: string
  ) {
    return (
      <button
        key={label}
        onClick={action}
        title={title || label}
        style={{
          padding: '5px 7px',
          borderRadius: 6,
          border: 'none',
          background: active ? 'hsl(var(--brand) / 0.15)' : 'transparent',
          color: active ? 'hsl(var(--brand))' : 'hsl(var(--muted))',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.1s ease',
        }}
        onMouseEnter={e => {
          if (!active) e.currentTarget.style.background = 'hsl(var(--surface-2))'
          e.currentTarget.style.color = 'hsl(var(--foreground))'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = active ? 'hsl(var(--brand) / 0.15)' : 'transparent'
          e.currentTarget.style.color = active ? 'hsl(var(--brand))' : 'hsl(var(--muted))'
        }}
      >
        {icon}
      </button>
    )
  }

  function separator() {
    return <div style={{ width: 1, height: 20, background: 'hsl(var(--border))', margin: '0 4px' }} />
  }

  function addLink() {
    if (!editor) return
    const url = window.prompt('Enter URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  function insertTable() {
    if (!editor) return
    (editor.chain().focus() as any).insertTable?.({ rows: 3, cols: 3, withHeaderRow: true })?.run?.()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      height: 38, overflowX: 'auto',
    }}>
      {/* Headings */}
      {toolbarBtn('h1', <Heading1 size={15} />, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), 'Heading 1')}
      {toolbarBtn('h2', <Heading2 size={15} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), 'Heading 2')}
      {toolbarBtn('h3', <Heading3 size={15} />, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), 'Heading 3')}

      {separator()}

      {/* Text formatting */}
      {toolbarBtn('Bold', <Bold size={14} />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold (⌘B)')}
      {toolbarBtn('Italic', <Italic size={14} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic (⌘I)')}
      {toolbarBtn('Underline', <Underline size={14} />, () => (editor.chain().focus() as any).toggleUnderline?.().run?.(), editor.isActive('underline'), 'Underline (⌘U)')}
      {toolbarBtn('Strike', <Strikethrough size={14} />, () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'))}
      {toolbarBtn('Highlight', <Highlighter size={14} />, () => (editor.chain().focus() as any).toggleHighlight?.().run?.(), editor.isActive('highlight'))}
      {toolbarBtn('Code', <Code size={14} />, () => editor.chain().focus().toggleCode().run(), editor.isActive('code'), 'Inline code')}

      {separator()}

      {/* Alignment */}
      {toolbarBtn('Left', <AlignLeft size={14} />, () => (editor.chain().focus() as any).setTextAlign?.('left').run?.(), editor.isActive({ textAlign: 'left' }))}
      {toolbarBtn('Center', <AlignCenter size={14} />, () => (editor.chain().focus() as any).setTextAlign?.('center').run?.(), editor.isActive({ textAlign: 'center' }))}
      {toolbarBtn('Right', <AlignRight size={14} />, () => (editor.chain().focus() as any).setTextAlign?.('right').run?.(), editor.isActive({ textAlign: 'right' }))}

      {separator()}

      {/* Lists */}
      {toolbarBtn('Bullet', <List size={14} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet list')}
      {toolbarBtn('Ordered', <ListOrdered size={14} />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Numbered list')}
      {toolbarBtn('Task', <CheckSquare size={14} />, () => (editor.chain().focus() as any).toggleTaskList?.().run?.(), editor.isActive('taskList'), 'Task list')}

      {separator()}

      {/* Blocks */}
      {toolbarBtn('Quote', <Quote size={14} />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {toolbarBtn('Code block', <Code size={14} />, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'), 'Code block')}
      {toolbarBtn('Divider', <Minus size={14} />, () => editor.chain().focus().setHorizontalRule().run(), false, 'Divider')}
      {toolbarBtn('Table', <Table size={14} />, insertTable, false, 'Insert table')}
      {toolbarBtn('Image', <ImageIcon size={14} />, onImageUpload, false, 'Insert image')}
      {toolbarBtn('Link', <Link2 size={14} />, addLink, editor.isActive('link'), 'Insert link')}

      {separator()}

      {/* History */}
      {toolbarBtn('Undo', <RotateCcw size={14} />, () => editor.chain().focus().undo().run(), false, 'Undo (⌘Z)')}
      {toolbarBtn('Redo', <RotateCw size={14} />, () => editor.chain().focus().redo().run(), false, 'Redo (⌘⇧Z)')}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sync status */}
      <SyncIndicator />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
