'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
import { createClient } from '@/lib/supabase/client'
import { PRESENCE_COLORS } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import {
  Heading1, Heading2, Heading3, List, CheckSquare, Code,
  Quote, Table as TableIcon, Video as YoutubeIcon, Sparkles, MessageSquare
} from 'lucide-react'
import type { Topic, Profile, NotebookRole } from '@/types'

interface TopicEditorProps {
  topic: Topic
  canEdit: boolean
  userRole?: NotebookRole
  currentUser: Profile | null
  notebookId: string
}

type SyncStatus = 'synced' | 'saving' | 'offline' | 'error'

export function TopicEditor({ topic, canEdit, currentUser, notebookId }: TopicEditorProps) {
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const [activeUsers, setActiveUsers] = useState<{ name: string; color: string; avatar?: string }[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; time: string; resolved: boolean }>>([])
  const [newComment, setNewComment] = useState('')

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Initialize Yjs + Websocket Provider
  useEffect(() => {
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const roomName = `conote-topic-${topic.id}`
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://demos.yjs.dev/ws'
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc, { connect: true })
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
        if (state.user) {
          users.push(state.user)
        }
      })
      setActiveUsers(users)
    }

    provider.awareness.on('change', onAwarenessChange)
    setIsInitialized(true)

    return () => {
      provider.awareness.off('change', onAwarenessChange)
      provider.destroy()
      ydoc.destroy()
    }
  }, [topic.id, currentUser])

  // Save to database with debounce
  const saveToDatabase = useCallback(async (content: object) => {
    setSyncStatus('saving')
    try {
      const { error } = await supabase
        .from('topics')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', topic.id)

      if (error) {
        setSyncStatus('error')
      } else {
        setSyncStatus('synced')
      }
    } catch {
      setSyncStatus('synced')
    }
  }, [topic.id, supabase])

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Yjs handles history
        }),
        Placeholder.configure({
          placeholder: canEdit
            ? 'Type "/" for quick blocks, or start typing your notes…'
            : 'This topic has no content yet.',
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
        ...(isInitialized && ydocRef.current
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
          saveToDatabase(ed.getJSON())
        }, 1500)
      },
    },
    [isInitialized]
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  async function handleImageUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
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

  function handleAddYoutube() {
    if (!editor) return
    const url = prompt('Enter YouTube video URL:')
    if (url) {
      (editor.chain().focus() as any).setYoutubeVideo?.({ src: url })?.run?.()
    }
  }

  function handleAddComment() {
    if (!newComment.trim()) return
    setComments(prev => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        author: currentUser?.name || 'User',
        text: newComment.trim(),
        time: 'Just now',
        resolved: false,
      }
    ])
    setNewComment('')
  }

  const slashCommands = [
    { label: 'Heading 1', icon: Heading1, action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', icon: Heading3, action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Bullet List', icon: List, action: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Checklist', icon: CheckSquare, action: () => (editor?.chain().focus() as any).toggleTaskList?.().run?.() },
    { label: 'Code Block', icon: Code, action: () => editor?.chain().focus().toggleCodeBlock().run() },
    { label: 'Quote', icon: Quote, action: () => editor?.chain().focus().toggleBlockquote().run() },
    { label: 'Table (3x3)', icon: TableIcon, action: () => (editor?.chain().focus() as any).insertTable?.({ rows: 3, cols: 3, withHeaderRow: true })?.run?.() },
    { label: 'YouTube Video', icon: YoutubeIcon, action: handleAddYoutube },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', background: 'hsl(var(--background))', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          borderBottom: '1px solid hsl(var(--border))',
          flexShrink: 0,
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <EditorToolbar
            editor={editor}
            canEdit={canEdit}
            onImageUpload={handleImageUpload}
            syncStatus={syncStatus}
            activeUsers={activeUsers}
          />

          <button
            onClick={() => setCommentsOpen(prev => !prev)}
            className="btn-ghost"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, padding: '5px 10px', borderRadius: 6,
              color: commentsOpen ? 'hsl(var(--brand))' : 'hsl(var(--muted))',
              background: commentsOpen ? 'hsl(var(--brand) / 0.1)' : 'transparent',
            }}
          >
            <MessageSquare size={14} />
            Comments {comments.filter(c => !c.resolved).length > 0 ? `(${comments.filter(c => !c.resolved).length})` : ''}
          </button>
        </div>

        {/* Title & Topic Header */}
        <div style={{ padding: '32px 60px 0', flexShrink: 0 }}>
          <h1
            contentEditable={canEdit}
            suppressContentEditableWarning
            onBlur={async (e) => {
              const newTitle = e.currentTarget.textContent?.trim() || 'Untitled'
              if (newTitle !== topic.title) {
                await supabase.from('topics').update({ title: newTitle }).eq('id', topic.id)
              }
            }}
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'hsl(var(--foreground))',
              outline: 'none',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              border: 'none',
              background: 'transparent',
              width: '100%',
              marginBottom: 8,
            }}
          >
            {topic.title}
          </h1>

          {/* Meta & Presence */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            fontSize: 12.5, color: 'hsl(var(--muted))', paddingBottom: 16,
            borderBottom: '1px solid hsl(var(--border))',
            marginBottom: 20,
          }}>
            <span>Created by {topic.creator ? topic.creator.name : currentUser?.name || 'User'}</span>

            {activeUsers.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                {activeUsers.map(u => u.name).join(', ')} editing live
              </span>
            )}

            {canEdit && (
              <button
                onClick={() => setSlashMenuOpen(prev => !prev)}
                className="btn-ghost"
                style={{ padding: '2px 8px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Sparkles size={12} style={{ color: 'hsl(var(--brand))' }} />
                Quick Insert (/)
              </button>
            )}
          </div>
        </div>

        {/* Slash Command Bar */}
        {slashMenuOpen && canEdit && (
          <div style={{
            margin: '0 60px 16px',
            padding: '8px 12px',
            background: 'hsl(var(--surface))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'hsl(var(--muted))', marginRight: 4 }}>INSERT:</span>
            {slashCommands.map(cmd => {
              const Icon = cmd.icon
              return (
                <button
                  key={cmd.label}
                  onClick={() => { cmd.action(); setSlashMenuOpen(false) }}
                  className="btn-ghost"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 12, padding: '4px 8px', borderRadius: 6,
                    background: 'hsl(var(--surface-2))',
                  }}
                >
                  <Icon size={13} />
                  {cmd.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Editor Content Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 60px 60px' }}>
          <div className="tiptap-wrapper">
            {editor && canEdit && (
              <BubbleMenu
                editor={editor}
                style={{
                  background: 'hsl(var(--foreground))',
                  borderRadius: 8,
                  padding: '4px 6px',
                  display: 'flex',
                  gap: 2,
                }}
              >
                {[
                  { label: 'B', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), style: { fontWeight: 700 } },
                  { label: 'I', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), style: { fontStyle: 'italic' } },
                  { label: 'U', action: () => (editor.chain().focus() as any).toggleUnderline?.().run?.(), active: editor.isActive('underline'), style: { textDecoration: 'underline' } },
                  { label: 'S', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), style: { textDecoration: 'line-through' } },
                  { label: '<>', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), style: { fontFamily: 'monospace' } },
                ].map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    style={{
                      background: btn.active ? 'hsl(0 0% 100% / 0.2)' : 'transparent',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 7px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      ...btn.style,
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </BubbleMenu>
            )}
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Document Comments Sidebar */}
      {commentsOpen && (
        <aside style={{
          width: 300,
          borderLeft: '1px solid hsl(var(--border))',
          background: 'hsl(var(--surface))',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Topic Comments</h3>
            <button onClick={() => setCommentsOpen(false)} className="btn-ghost" style={{ padding: 4 }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'hsl(var(--muted))', fontSize: 13, padding: '32px 0' }}>
                No comments yet. Start a discussion on this topic.
              </div>
            ) : (
              comments.map(c => (
                <div
                  key={c.id}
                  style={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 10,
                    padding: '12px',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <strong>{c.author}</strong>
                    <span style={{ color: 'hsl(var(--muted))' }}>{c.time}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'hsl(var(--foreground))', lineHeight: 1.4, margin: '6px 0' }}>
                    {c.text}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      onClick={() => setComments(prev => prev.filter(x => x.id !== c.id))}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '2px 6px', color: 'hsl(var(--muted))' }}
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid hsl(var(--border))' }}>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment on this topic…"
              rows={2}
              className="input"
              style={{ fontSize: 12.5, marginBottom: 8 }}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="btn btn-primary"
              style={{ width: '100%', fontSize: 12, padding: '6px' }}
            >
              Post Comment
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
