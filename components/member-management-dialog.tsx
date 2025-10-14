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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserPlus, MoreVertical, Crown, Shield, User, Trash2, Copy, Share2, RefreshCw, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { inviteMember, updateMemberRole, removeMember, regenerateInviteCode } from '@/app/actions/leagues'

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
  leagueName: string
  inviteCode: string | null
  members: Member[]
  currentUserRole: 'owner' | 'admin' | 'member' | null
}

export function MemberManagementDialog({
  leagueId,
  leagueName,
  inviteCode: initialInviteCode,
  members,
  currentUserRole,
}: MemberManagementDialogProps) {
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canManageRoles = currentUserRole === 'owner'

  const leagueInviteUrl = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`
    : null

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInviteUrl(null)
    setInviting(true)

    const result = await inviteMember(leagueId, inviteEmail)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(result.message || 'Member added successfully!')
      if (result.inviteUrl) {
        setInviteUrl(result.inviteUrl)
      }
      setInviteEmail('')
    }

    setInviting(false)
  }

  const copyInviteLink = async () => {
    if (inviteUrl) {
      await navigator.clipboard.writeText(inviteUrl)
      setSuccess('Invite link copied to clipboard!')
    }
  }

  const copyLeagueInviteLink = async () => {
    if (leagueInviteUrl) {
      await navigator.clipboard.writeText(leagueInviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRegenerateCode = async () => {
    if (!confirm('Are you sure? This will invalidate the current invite link.')) return

    setRegenerating(true)
    setError(null)

    const result = await regenerateInviteCode(leagueId)

    if (result.error) {
      setError(result.error)
    } else if (result.inviteCode) {
      setInviteCode(result.inviteCode)
      setSuccess('New invite link generated!')
    }

    setRegenerating(false)
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
          Manage Users
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Users</DialogTitle>
          <DialogDescription>
            Invite members, share league link, and manage your crew
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

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2 glass">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invite">Share Link</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4 mt-4">
            {inviteUrl && (
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1">Invitation Link</Label>
                    <div className="glass border-primary/30 p-2 rounded-lg text-sm break-all">
                      {inviteUrl}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={copyInviteLink}
                  variant="outline"
                  size="sm"
                  className="w-full glass border-primary/30"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Share this link with the invitee. They can sign up and join the league.
                </p>
              </div>
            )}

            {/* Invite Section */}
            {canInvite && (
              <div className="space-y-4">
                <div className="glass-card p-4">
                  <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-primary" />
                    Invite by Email
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
                        <AvatarImage src={member.avatar_url || undefined} alt={member.full_name || member.email} />
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
          </TabsContent>

          <TabsContent value="invite" className="space-y-4 mt-4">
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Share2 className="h-5 w-5 text-neon-blue mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1">Share League Link</h3>
                  <p className="text-sm text-muted-foreground">
                    Share this link with anyone you want to invite to {leagueName}. They can sign up and join instantly.
                  </p>
                </div>
              </div>

              {leagueInviteUrl ? (
                <div className="space-y-3">
                  <div className="glass border-primary/30 p-4 rounded-lg break-all text-sm font-mono">
                    {leagueInviteUrl}
                  </div>

                  <Button
                    onClick={copyLeagueInviteLink}
                    className="w-full neon-glow-blue"
                    size="lg"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>

                  {canInvite && (
                    <>
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-3">
                          <strong>Invite Code:</strong> {inviteCode}
                        </p>
                        <Button
                          onClick={handleRegenerateCode}
                          disabled={regenerating}
                          variant="outline"
                          size="sm"
                          className="w-full glass border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                          {regenerating ? 'Regenerating...' : 'Regenerate Link'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Warning: This will invalidate the current link
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No invite link available for this league.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
