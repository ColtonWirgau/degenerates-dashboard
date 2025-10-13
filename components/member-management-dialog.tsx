'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, MoreVertical, Crown, Shield, User, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { inviteMember, updateMemberRole, removeMember } from '@/app/actions/leagues'

interface Member {
  id: string
  user_id: string
  full_name: string | null
  email: string
  avatar_url?: string | null
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

interface MemberManagementDialogProps {
  leagueId: string
  members: Member[]
  currentUserRole: 'owner' | 'admin' | 'member' | null
}

export function MemberManagementDialog({
  leagueId,
  members,
  currentUserRole,
}: MemberManagementDialogProps) {
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canManageRoles = currentUserRole === 'owner'

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInviting(true)

    const result = await inviteMember(leagueId, inviteEmail)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('Member invited successfully!')
      setInviteEmail('')
      setTimeout(() => setSuccess(null), 3000)
    }

    setInviting(false)
  }

  const handleRoleChange = async (memberId: string, newRole: 'owner' | 'admin' | 'member') => {
    setError(null)
    const result = await updateMemberRole(leagueId, memberId, newRole)

    if (result.error) {
      setError(result.error)
    }
  }

  const handleRemove = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    setError(null)
    const result = await removeMember(leagueId, memberId)

    if (result.error) {
      setError(result.error)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-gold" />
      case 'admin':
        return <Shield className="h-4 w-4 text-neon-purple" />
      default:
        return <User className="h-4 w-4 text-primary" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'text-gold bg-[#FFD700]/10 border-[#FFD700]/30'
      case 'admin':
        return 'text-neon-purple bg-[#A855F7]/10 border-[#A855F7]/30'
      default:
        return 'text-neon-blue bg-primary/10 border-primary/30'
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="neon-glow-purple" size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Manage Members
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage League Members</DialogTitle>
          <DialogDescription>
            Invite new members, change roles, and manage your crew
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {success && (
          <div className="glass border-neon-green/50 p-3 rounded-xl text-sm text-neon-green animate-in fade-in slide-in-from-top-2">
            {success}
          </div>
        )}

        {/* Invite Section */}
        {canInvite && (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Invite New Member
              </h3>
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <Label htmlFor="email" className="text-xs text-muted-foreground">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="degen@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="glass border-primary/30"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={inviting}
                  className="w-full neon-glow-blue"
                >
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Current Members ({members.length})</h3>
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="glass-card hover:glass-intense transition-all flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url} alt={member.full_name || member.email} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                      {getInitials(member.full_name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {member.full_name || member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase ${getRoleColor(
                      member.role
                    )}`}
                  >
                    {getRoleIcon(member.role)}
                    {member.role}
                  </div>

                  {canManageRoles && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-white/10"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-intense border-primary/30">
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(member.id, 'owner')}
                          disabled={member.role === 'owner'}
                        >
                          <Crown className="h-4 w-4 mr-2 text-gold" />
                          Make Owner
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(member.id, 'admin')}
                          disabled={member.role === 'admin'}
                        >
                          <Shield className="h-4 w-4 mr-2 text-neon-purple" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleChange(member.id, 'member')}
                          disabled={member.role === 'member'}
                        >
                          <User className="h-4 w-4 mr-2 text-primary" />
                          Make Member
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRemove(member.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
