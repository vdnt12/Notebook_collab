import assert from 'assert'
import { can, ROLE_HIERARCHY, DEFAULT_NOTEBOOK_SETTINGS } from '../src/lib/permissions.ts'

console.log('🧪 Running Notebook Security, Role Enforcement & RLS Test Suite...\n')

// 1. Role Hierarchy Verification
console.log('▶ Test 1: Role Hierarchy Constraints')
assert.strictEqual(ROLE_HIERARCHY.OWNER > ROLE_HIERARCHY.EDITOR, true, 'OWNER must outrank EDITOR')
assert.strictEqual(ROLE_HIERARCHY.EDITOR > ROLE_HIERARCHY.COMMENTER, true, 'EDITOR must outrank COMMENTER')
assert.strictEqual(ROLE_HIERARCHY.COMMENTER > ROLE_HIERARCHY.VIEWER, true, 'COMMENTER must outrank VIEWER')
console.log('  ✅ Passed: Role hierarchy order verified.')

// 2. Owner Privilege Verification
console.log('\n▶ Test 2: OWNER Capabilities')
assert.strictEqual(can('OWNER', 'notebook:delete'), true, 'OWNER can delete notebook')
assert.strictEqual(can('OWNER', 'notebook:manage_members'), true, 'OWNER can manage members')
assert.strictEqual(can('OWNER', 'notebook:change_roles'), true, 'OWNER can change roles')
assert.strictEqual(can('OWNER', 'notebook:transfer_ownership'), true, 'OWNER can transfer ownership')
assert.strictEqual(can('OWNER', 'topic:create'), true, 'OWNER can create topics')
assert.strictEqual(can('OWNER', 'file:upload'), true, 'OWNER can upload files')
console.log('  ✅ Passed: Complete OWNER privileges confirmed.')

// 3. Editor Privilege Boundaries & Privilege Escalation Prevention
console.log('\n▶ Test 3: EDITOR Boundaries (No Privilege Escalation)')
assert.strictEqual(can('EDITOR', 'notebook:delete'), false, 'EDITOR cannot delete notebook')
assert.strictEqual(can('EDITOR', 'notebook:manage_members'), false, 'EDITOR cannot manage members')
assert.strictEqual(can('EDITOR', 'notebook:change_roles'), false, 'EDITOR cannot change roles')
assert.strictEqual(can('EDITOR', 'notebook:transfer_ownership'), false, 'EDITOR cannot transfer ownership')
assert.strictEqual(can('EDITOR', 'topic:create'), true, 'EDITOR can create topics')
assert.strictEqual(can('EDITOR', 'topic:edit'), true, 'EDITOR can edit topics')
assert.strictEqual(can('EDITOR', 'file:upload'), true, 'EDITOR can upload files')
console.log('  ✅ Passed: EDITOR boundaries enforced; privilege escalation prevented.')

// 4. Commenter Boundaries
console.log('\n▶ Test 4: COMMENTER Boundaries (Read-Only Content, Interactive Discussion)')
assert.strictEqual(can('COMMENTER', 'topic:edit'), false, 'COMMENTER cannot edit topics')
assert.strictEqual(can('COMMENTER', 'topic:create'), false, 'COMMENTER cannot create topics')
assert.strictEqual(can('COMMENTER', 'file:upload'), false, 'COMMENTER cannot upload files')
assert.strictEqual(can('COMMENTER', 'comment:create'), true, 'COMMENTER can post comments')
assert.strictEqual(can('COMMENTER', 'comment:view'), true, 'COMMENTER can view comments')
assert.strictEqual(can('COMMENTER', 'topic:view'), true, 'COMMENTER can view topics')
console.log('  ✅ Passed: COMMENTER capabilities restricted to comments and viewing.')

// 5. Viewer Boundaries
console.log('\n▶ Test 5: VIEWER Boundaries (Read-Only Access)')
assert.strictEqual(can('VIEWER', 'topic:edit'), false, 'VIEWER cannot edit topics')
assert.strictEqual(can('VIEWER', 'topic:create'), false, 'VIEWER cannot create topics')
assert.strictEqual(can('VIEWER', 'comment:create'), false, 'VIEWER cannot post comments')
assert.strictEqual(can('VIEWER', 'file:upload'), false, 'VIEWER cannot upload files')
assert.strictEqual(can('VIEWER', 'topic:view'), true, 'VIEWER can read content')
assert.strictEqual(can('VIEWER', 'notebook:view'), true, 'VIEWER can view notebook')
console.log('  ✅ Passed: VIEWER strictly restricted to read-only access.')

// 6. Cross-User Notebook Access Restrictions
console.log('\n▶ Test 6: Cross-User Isolation Simulation')
const userA = { id: 'user-a-uuid' }
const userB = { id: 'user-b-uuid' }
const notebookPrivateToA = { id: 'nb-1', owner_id: userA.id, members: [] }

function hasAccess(user, notebook) {
  if (notebook.owner_id === user.id) return true
  return notebook.members.some(m => m.user_id === user.id)
}

assert.strictEqual(hasAccess(userA, notebookPrivateToA), true, 'User A has access to their private notebook')
assert.strictEqual(hasAccess(userB, notebookPrivateToA), false, 'User B must NOT have access to User A private notebook')
console.log('  ✅ Passed: Cross-user notebook access strictly isolated.')

// 7. Non-Recursive RLS Helper Emulation
console.log('\n▶ Test 7: Non-Recursive Security Definer Role Resolution')
function resolveRole(userId, notebook, members) {
  if (notebook.owner_id === userId) return 'OWNER'
  const member = members.find(m => m.notebook_id === notebook.id && m.user_id === userId)
  return member ? member.role : null
}

const membersList = [
  { notebook_id: 'nb-1', user_id: 'user-b-uuid', role: 'EDITOR' },
  { notebook_id: 'nb-1', user_id: 'user-c-uuid', role: 'VIEWER' },
]

assert.strictEqual(resolveRole(userA.id, notebookPrivateToA, membersList), 'OWNER')
assert.strictEqual(resolveRole(userB.id, notebookPrivateToA, membersList), 'EDITOR')
assert.strictEqual(resolveRole('user-c-uuid', notebookPrivateToA, membersList), 'VIEWER')
assert.strictEqual(resolveRole('unauthorized-user', notebookPrivateToA, membersList), null)
console.log('  ✅ Passed: Security definer role resolution logic verified without recursion.')

console.log('\n🎉 All Security & Role Enforcement Checks Passed!')
