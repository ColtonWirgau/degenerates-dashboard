'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check, Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface LeagueInviteLinkProps {
  inviteCode: string
  leagueName: string
}

export function LeagueInviteLink({ inviteCode, leagueName }: LeagueInviteLinkProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="glass border-primary/30">
          <Link2 className="h-4 w-4 mr-2" />
          Share Link
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-intense border-primary/30 max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to {leagueName}</DialogTitle>
          <DialogDescription>
            Share this link with anyone you want to join the league
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-link" className="text-xs text-muted-foreground">
              Invite Link
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-link"
                value={inviteUrl}
                readOnly
                className="glass border-primary/30 font-mono text-sm"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                onClick={copyLink}
                size="sm"
                className="neon-glow-blue"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="glass-card p-4 space-y-2">
            <div className="flex items-start gap-2">
              <div className="text-2xl">🔗</div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Anyone with this link can join</p>
                <p className="text-xs text-muted-foreground">
                  Share it with your friends, post it in your group chat, or send it however you want
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-3 border-primary/20">
            <p className="text-xs text-muted-foreground text-center">
              Invite Code: <span className="font-mono font-bold text-foreground">{inviteCode}</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
