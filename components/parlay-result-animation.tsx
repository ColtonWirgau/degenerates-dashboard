'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface ParlayResultAnimationProps {
  result: 'win' | 'loss' | 'push' | null
  userParlay?: {
    legs: Array<{ result: string | null }>
  }
}

const winMessages = [
  "JACKPOT! You're on fire!",
  "CASHING OUT! What a legend!",
  "ABSOLUTE HEATER! Keep it going!",
  "MONEY PRINTER GO BRRR!",
  "TO THE MOON! Unstoppable!",
  "DIAMOND HANDS! You called it!",
  "KING OF THE PARLAY!",
  "STRAIGHT CASH HOMIE!",
]

const lossMessages = [
  "You're really not good at this...",
  "Maybe stick to your day job?",
  "Ouch... that one hurt",
  "Into the trash it goes!",
  "There goes the rent money",
  "What a circus performance",
  "Stonks only go down for you",
  "Better luck next week, champ",
  "Vegas thanks you for your service",
  "That pick was absolutely terrible",
]

const pushMessages = [
  "Meh... not great, not terrible",
  "Push city! Money back time",
  "Perfectly balanced, as all things should be",
  "That was boring",
]

export function ParlayResultAnimation({ result, userParlay }: ParlayResultAnimationProps) {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!result || !userParlay) return

    // Calculate if user's parlay won, lost, or pushed
    const legs = userParlay.legs
    if (legs.length === 0) return

    const hasLoss = legs.some(leg => leg.result === 'loss')
    const allWins = legs.every(leg => leg.result === 'win')
    const hasPush = legs.some(leg => leg.result === 'push')

    let finalResult: 'win' | 'loss' | 'push' | null = null

    if (hasLoss) {
      finalResult = 'loss'
    } else if (allWins) {
      finalResult = 'win'
    } else if (hasPush && !hasLoss) {
      finalResult = 'push'
    }

    if (!finalResult) return

    // Set random message
    let messages: string[] = []
    if (finalResult === 'win') {
      messages = winMessages
      // Trigger confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        })
      }, 250)
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        })
      }, 400)
    } else if (finalResult === 'loss') {
      messages = lossMessages
    } else {
      messages = pushMessages
    }

    setMessage(messages[Math.floor(Math.random() * messages.length)])
    setShow(true)

    // Hide after 4 seconds
    const timer = setTimeout(() => {
      setShow(false)
    }, 4000)

    return () => clearTimeout(timer)
  }, [result, userParlay])

  const getColors = () => {
    const legs = userParlay?.legs || []
    const hasLoss = legs.some(leg => leg.result === 'loss')
    const allWins = legs.every(leg => leg.result === 'win')

    if (hasLoss) {
      return {
        bg: 'from-neon-pink/20 to-destructive/20',
        text: 'text-destructive',
        border: 'border-destructive/50',
        glow: 'shadow-[0_0_30px_rgba(239,68,68,0.5)]'
      }
    } else if (allWins) {
      return {
        bg: 'from-cyan-500/20 to-neon-blue/20',
        text: 'text-neon-blue',
        border: 'border-neon-blue/50',
        glow: 'shadow-[0_0_30px_rgba(0,217,255,0.5)]'
      }
    } else {
      return {
        bg: 'from-neon-blue/20 to-neon-blue/5',
        text: 'text-neon-blue',
        border: 'border-neon-blue/50',
        glow: 'shadow-[0_0_30px_rgba(255,215,0,0.5)]'
      }
    }
  }

  const colors = getColors()

  // Portaled to <body>: `position: fixed` inside the shell's transformed
  // .page-sheet would be captured by the transform's containing block and
  // scale with the card.
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{
            scale: 1,
            rotate: 0,
            opacity: 1,
            transition: {
              type: 'spring',
              stiffness: 260,
              damping: 20
            }
          }}
          exit={{
            scale: 0,
            rotate: 180,
            opacity: 0,
            transition: { duration: 0.3 }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              rotate: [0, 2, -2, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              repeatDelay: 0.5
            }}
            className={`
              glass-intense border-2 ${colors.border} ${colors.glow}
              bg-gradient-to-br ${colors.bg}
              rounded-3xl p-12 max-w-2xl mx-4
              backdrop-blur-xl
            `}
          >
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`text-4xl md:text-6xl font-bold text-center ${colors.text}`}
            >
              {message}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
