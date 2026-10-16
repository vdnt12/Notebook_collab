'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Youtube } from '@tiptap/extension-youtube'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { PRESENCE_COLORS, formatRelativeTime } from '@/lib/utils'
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Code,
  Quote, Table as TableIcon, Image as ImageIcon, Minus, MessageSquare,
  Check, CheckCircle2, Loader2, Sparkles, X, Send, Paperclip, Type,
  Smile, CornerDownRight, Search
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Topic, Profile, NotebookRole } from '@/types'

interface TopicEditorProps {
  topic: Topic
  canEdit: boolean
  userRole?: NotebookRole
  currentUser: Profile | null
  notebookId: string
  onTitleChange?: (newTitle: string) => void
  onIconChange?: (newIcon: string) => void
}

type SyncStatus = 'synced' | 'saving' | 'offline' | 'error'

const PAGE_ICONS = ['📚', '💻', '📝', '🚀', '🧠', '📊', '🎯', '📁', '💡', '🔬', '🎨', '⚡']

export function TopicEditor({
  topic,
  canEdit,
  userRole = 'OWNER',
  currentUser,
  notebookId,
  onTitleChange,
  onIconChange,
}: TopicEditorProps) {
  const [title, setTitle] = useState(topic.title || 'Untitled')
  const [icon, setIcon] = useState(topic.icon || '📄')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [activeUsers, setActiveUsers] = useState<{ name: string; color: string; avatar?: string }[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<Array<{ id: string; author: string; avatar_url?: string; text: string; time: string; resolved: boolean }>>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [serifMode, setSerifMode] = useState(false)

  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)

  const collabWsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim() || ''
  const useCollab = Boolean(collabWsUrl && !collabWsUrl.includes('demos.yjs.dev'))

  // Update local state when topic prop changes
  useEffect(() => {
    setTitle(topic.title || 'Untitled')
    setIcon(topic.icon || '📄')
  }, [topic.id, topic.title, topic.icon])

  // Fetch comments for topic
  const loadComments = useCallback(async () => {
    try {
      setLoadingComments(true)
      const res = await fetch(`/api/topics/${topic.id}/comments`)
      const data = await res.json()
      if (res.ok && data.comments) {
        setComments(data.comments)
      }
    } catch {
      // Fallback
    } finally {
      setLoadingComments(false)
    }
  }, [topic.id])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Yjs real-time presence setup (Section 21)
  useEffect(() => {
    if (!useCollab) {
      setIsInitialized(true)
      setSyncStatus('synced')
      return
    }

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc
    const roomName = `notebook-topic-${topic.id}`
    const provider = new WebsocketProvider(collabWsUrl, roomName, ydoc, { connect: true })
    providerRef.current = provider

    provider.on('status', (event: { status: string }) => {
      if (event.status === 'connected') setSyncStatus('synced')
      else if (event.status === 'disconnected') setSyncStatus('offline')
    })

    if (currentUser) {
      const colorIndex = Math.abs(
        currentUser.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      ) % PRESENCE_COLORS.length

      provider.awareness.setLocalStateField('user', {
        name: currentUser.name,
        color: PRESENCE_COLORS[colorIndex],
        avatar: currentUser.avatar_url,
      })
    }

    function onAwarenessChange() {
      const users: { name: string; color: string; avatar?: string }[] = []
      provider.awareness.getStates().forEach((state) => {
        if (state.user) users.push(state.user)
      })
      setActiveUsers(users)
    }

    provider.awareness.on('change', onAwarenessChange)
    setIsInitialized(true)

    return () => {
      provider.awareness.off('change', onAwarenessChange)
      provider.destroy()
      ydoc.destroy()
      ydocRef.current = null
      providerRef.current = null
    }
  }, [topic.id, currentUser, collabWsUrl, useCollab])

  // Save content to database with subtle status transition (Section 22)
  const saveToDatabase = useCallback(async (content: object, textSummary: string) => {
    setSyncStatus('saving')
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          content_text: textSummary.slice(0, 300),
        }),
      })
      if (res.ok) {
        setSyncStatus('synced')
      } else {
        setSyncStatus('error')
      }
    } catch {
      setSyncStatus('error')
    }
  }, [topic.id])

  // Initialize Tiptap editor
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          undoRedo: useCollab ? false : undefined,
        }),
        Placeholder.configure({
          placeholder: canEdit
            ? 'Type "/" for commands, or write thoughts…'
            : 'Empty note.',
        }),
        Image.configure({ allowBase64: true }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Highlight.configure({ multicolor: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Youtube.configure({ width: 640, height: 360 }),
        ...(useCollab && isInitialized && ydocRef.current
          ? [
              Collaboration.configure({ document: ydocRef.current }),
              ...(providerRef.current && currentUser
                ? [
                    CollaborationCursor.configure({
                      provider: providerRef.current,
                      user: {
                        name: currentUser.name,
                        color: PRESENCE_COLORS[0],
                      },
                    }),
                  ]
                : []),
            ]
          : []),
      ],
      editable: canEdit,
      content: topic.content && typeof topic.content === 'object'
        ? (topic.content as Record<string, unknown>)
        : undefined,
      onUpdate: ({ editor: ed }) => {
        if (!canEdit) return
        setSyncStatus('saving')
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => {
          saveToDatabase(ed.getJSON(), ed.getText())
        }, 1200)
      },
    },
    [isInitialized, topic.id]
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  // Title save
  const handleTitleBlur = async () => {
    const trimmed = title.trim() || 'Untitled'
    if (trimmed !== topic.title) {
      try {
        setSyncStatus('saving')
        await fetch(`/api/topics/${topic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmed }),
        })
        if (onTitleChange) onTitleChange(trimmed)
        window.dispatchEvent(new CustomEvent('notebooks-updated'))
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }
  }

  // Icon save
  const handleIconSelect = async (selectedEmoji: string) => {
    setIcon(selectedEmoji)
    setShowIconPicker(false)
    try {
      await fetch(`/api/topics/${topic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon: selectedEmoji }),
      })
      if (onIconChange) onIconChange(selectedEmoji)
      window.dispatchEvent(new CustomEvent('notebooks-updated'))
    } catch {
      // Fallback
    }
  }

  // Handle image upload
  const handleImageUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file || !editor) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const url = e.target?.result as string
        editor.chain().focus().setImage({ src: url }).run()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Handle file card insertion
  const handleFileAttach = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file || !editor) return
      const name = file.name
      const sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      editor.chain().focus().insertContent(
        `<p><strong>📎 ${name}</strong> (${sizeStr}) — <em>Uploaded</em></p>`
      ).run()
      toast.success(`Attached ${name}`)
    }
    input.click()
  }

  // Handle post comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return
    const text = newComment.trim()
    setNewComment('')

    try {
      const res = await fetch(`/api/topics/${topic.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, notebookId }),
      })
      const data = await res.json()
      if (res.ok && data.comment) {
        setComments(prev => [...prev, data.comment])
        toast.success('Comment posted')
      }
    } catch {
      toast.error('Failed to post comment')
    }
  }

  // Resolve comment
  const handleResolveComment = async (commentId: string) => {
    try {
      await fetch(`/api/topics/${topic.id}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, resolved: true }),
      })
      setComments(prev => prev.filter(c => c.id !== commentId))
      toast.success('Comment resolved')
    } catch {
      toast.error('Failed to resolve comment')
    }
  }

  // Slash commands list (Section 17)
  const slashCommands = [
    { label: 'Text', desc: 'Plain writing block', icon: 'T', action: () => editor?.chain().focus().setParagraph().run() },
    { label: 'Heading 1', desc: 'Large section heading', icon: 'H1', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', desc: 'Medium section heading', icon: 'H2', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', desc: 'Subheading', icon: 'H3', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Checklist', desc: 'Track tasks and action items', icon: '☑', action: () => (editor?.chain().focus() as any).toggleTaskList?.().run?.() },
    { label: 'Bullet list', desc: 'Simple bulleted list', icon: '•', action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', desc: 'Sequential list', icon: '1.', action: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: 'Quote', desc: 'Capture inspiration or citations', icon: '“', action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: 'Code block', desc: 'Code snippet with syntax highlighting', icon: '</>', action: () => editor?.chain().focus().toggleCodeBlock().run() },
    { label: 'Divider', desc: 'Subtle visual separator', icon: '—', action: () => editor?.chain().focus().setHorizontalRule().run() },
    { label: 'Table', desc: 'Simple 3x3 data grid', icon: '▦', action: () => (editor?.chain().focus() as any).insertTable?.({ rows: 3, cols: 3, withHeaderRow: true })?.run?.() },
    { label: 'Image', desc: 'Upload or embed image', icon: '🖼', action: handleImageUpload },
    { label: 'File', desc: 'Attach a file or PDF', icon: '📎', action: handleFileAttach },
  ]

  const filteredCommands = slashQuery.trim()
    ? slashCommands.filter(c =>
        c.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
        c.desc.toLowerCase().includes(slashQuery.toLowerCase())
      )
    : slashCommands

  const executeSlashCommand = (cmd: typeof slashCommands[0]) => {
    cmd.action()
    setSlashMenuOpen(false)
    setSlashQuery('')
  }

  // Keyboard listener for "/" slash command menu
  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '/' && !slashMenuOpen) {
      setSlashMenuOpen(true)
      setSlashQuery('')
      setSlashSelectedIndex(0)
    } else if (slashMenuOpen) {
      if (e.key === 'Escape') {
        setSlashMenuOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[slashSelectedIndex]) {
          executeSlashCommand(filteredCommands[slashSelectedIndex])
        }
      }
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--background)', position: 'relative', overflow: 'hidden' }}>
      {/* Main Reading / Writing Canvas */}
      <div
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onKeyDown={handleEditorKeyDown}
      >
        {/* Subtle Top Control Strip (Section 7, 22) */}
        <div style={{
          height: 44,
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {/* Live Save Indicator (Section 22) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`live-save-tag ${syncStatus === 'synced' ? 'synced' : ''}`}>
              {syncStatus === 'saving' && <Loader2 size={12} className="animate-spin" />}
              {syncStatus === 'synced' && <Check size={12} />}
              <span>{syncStatus === 'saving' ? 'Saving…' : 'Saved'}</span>
            </div>

            {/* Serif / Sans toggle (Section 6) */}
            <button
              onClick={() => setSerifMode(!serifMode)}
              className="btn-ghost"
              style={{
                fontSize: 11.5,
                padding: '2px 6px',
                borderRadius: 4,
                color: serifMode ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
              title="Toggle editorial serif typography"
            >
              {serifMode ? 'Serif font' : 'Sans font'}
            </button>
          </div>

          {/* Right: Presence & Comments Drawer Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Active remote users */}
            {activeUsers.length > 0 && (
              <div className="avatar-stack">
                {activeUsers.slice(0, 3).map((u, i) => (
                  <div
                    key={i}
                    className="avatar-stack-item"
                    title={u.name}
                    style={{ background: u.color }}
                  >
                    {u.name.slice(0, 1)}
                  </div>
                ))}
              </div>
            )}

            {/* Comments button */}
            <button
              onClick={() => setCommentsOpen(!commentsOpen)}
              className="btn-ghost btn-sm"
              style={{
                gap: 5,
                color: commentsOpen ? 'var(--accent)' : 'var(--text-secondary)',
                background: commentsOpen ? 'var(--accent-subtle)' : 'transparent',
              }}
            >
              <MessageSquare size={13} />
              <span>Comments</span>
              {comments.length > 0 && (
                <span style={{
                  fontSize: 10.5,
                  padding: '1px 5px',
                  borderRadius: 10,
                  background: 'var(--surface-hover)',
                  fontWeight: 600,
                }}>
                  {comments.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Ideal Centered Reading Column: 680-760px (Section 13) */}
        <div className="editor-reading-column">
          {/* 1. Page Icon (Section 15) */}
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="page-icon-button"
              title="Change page icon"
            >
              {icon}
            </button>

            {/* Emoji Picker Popup */}
            {showIconPicker && (
              <>
                <div
                  onClick={() => setShowIconPicker(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 70 }}
                />
                <div
                  className="menu-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 4,
                    padding: 8,
                    width: 160,
                  }}
                >
                  {PAGE_ICONS.map(em => (
                    <button
                      key={em}
                      onClick={() => handleIconSelect(em)}
                      style={{
                        fontSize: 20,
                        padding: 6,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderRadius: 6,
                        textAlign: 'center',
                      }}
                      className="hover:bg-[var(--surface-hover)]"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 2. Directly Editable Title (Section 14) */}
          <textarea
            ref={titleInputRef}
            rows={1}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editor?.commands.focus()
              }
            }}
            placeholder="Untitled"
            className="note-editable-title"
          />

          {/* 3. Subtitle / Metadata (Section 14) */}
          <div style={{
            fontSize: 12.5,
            color: 'var(--text-muted)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>Last edited {formatRelativeTime(topic.updated_at)}</span>
            <span>•</span>
            <span>Created by {topic.creator?.name || currentUser?.name || 'Vedant'}</span>

            {canEdit && (
              <button
                onClick={() => setSlashMenuOpen(true)}
                className="btn-ghost"
                style={{
                  fontSize: 11.5,
                  padding: '1px 6px',
                  borderRadius: 4,
                  gap: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Sparkles size={11} style={{ color: 'var(--accent)' }} />
                <span>Commands (/)</span>
              </button>
            )}
          </div>

          {/* Subtle separator (Section 2) */}
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 24, opacity: 0.6 }} />

          {/* 4. Floating Selection Bubble Menu (Section 19) */}
          {editor && canEdit && (
            <BubbleMenu editor={editor} className="floating-bubble-toolbar">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
                style={{ fontWeight: 700 }}
                title="Bold (⌘B)"
              >
                B
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`bubble-btn ${editor.isActive('italic') ? 'active' : ''}`}
                style={{ fontStyle: 'italic' }}
                title="Italic (⌘I)"
              >
                I
              </button>
              <button
                onClick={() => (editor.chain().focus() as any).toggleUnderline?.().run?.()}
                className={`bubble-btn ${editor.isActive('underline') ? 'active' : ''}`}
                style={{ textDecoration: 'underline' }}
                title="Underline (⌘U)"
              >
                U
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
                style={{ textDecoration: 'line-through' }}
                title="Strikethrough"
              >
                S
              </button>
              <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={`bubble-btn ${editor.isActive('code') ? 'active' : ''}`}
                style={{ fontFamily: 'monospace' }}
                title="Code"
              >
                &lt;/&gt;
              </button>
              <button
                onClick={() => setCommentsOpen(true)}
                className="bubble-btn"
                title="Add comment"
              >
                💬
              </button>
            </BubbleMenu>
          )}

          {/* 5. Floating Slash Command Menu (Section 17, 18) */}
          {slashMenuOpen && canEdit && (
            <div
              className="slash-command-popup"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: 8,
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px 8px',
                borderBottom: '1px solid var(--border)',
                marginBottom: 4,
              }}>
                <Search size={13} style={{ color: 'var(--text-muted)' }} />
                <input
                  value={slashQuery}
                  onChange={e => {
                    setSlashQuery(e.target.value)
                    setSlashSelectedIndex(0)
                  }}
                  placeholder="Filter blocks…"
                  autoFocus
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 12.5,
                    width: '100%',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {filteredCommands.length === 0 ? (
                <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  No matching blocks
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <div
                    key={cmd.label}
                    onClick={() => executeSlashCommand(cmd)}
                    onMouseEnter={() => setSlashSelectedIndex(idx)}
                    className={`slash-command-item ${idx === slashSelectedIndex ? 'selected' : ''}`}
                  >
                    <div className="slash-command-icon">
                      {cmd.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 550, fontSize: 13 }}>{cmd.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cmd.desc}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 6. Block Editor Content (Section 12, 16) */}
          <div className={`ProseMirror ${serifMode ? 'serif-mode' : ''}`}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* 7. Right Sliding Comments Drawer (Section 31) */}
      {commentsOpen && (
        <aside
          style={{
            width: 320,
            borderLeft: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            animation: 'slideRight 180ms var(--ease-spring)',
            zIndex: 40,
          }}
        >
          {/* Drawer Header */}
          <div style={{
            height: 48,
            padding: '0 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text-primary)' }}>
              Comments
            </div>
            <button
              onClick={() => setCommentsOpen(false)}
              className="btn-ghost btn-icon"
              style={{ width: 26, height: 26 }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Comments List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '40px 16px' }}>
                <MessageSquare size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>No comments on this page yet.</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Highlight text or write below to start a discussion.</p>
              </div>
            ) : (
              comments.map(c => (
                <div
                  key={c.id}
                  style={{
                    background: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.author}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatRelativeTime(c.time)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45, margin: '4px 0 8px' }}>
                    {c.text}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleResolveComment(c.id)}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '2px 6px', gap: 4 }}
                    >
                      <Check size={11} /> Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* New Comment Input */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--background)',
          }}>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              className="input"
              style={{
                fontSize: 13,
                resize: 'none',
                marginBottom: 8,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleAddComment()
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⌘↵ to post</span>
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="btn btn-primary btn-sm"
                style={{ height: 28, fontSize: 12 }}
              >
                Post
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
