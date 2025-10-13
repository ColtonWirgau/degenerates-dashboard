import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function validateParlayLegs(legs: Array<{ description: string; odds: string }>) {
  try {
    const legDescriptions = legs.map((leg, idx) => `${idx + 1}. ${leg.description} (${leg.odds})`).join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a sports betting expert validator for NFL parlays. Analyze the provided betting legs and check if they violate standard parlay rules.

PARLAY RULES TO ENFORCE:
1. Cannot bet over AND under on the same total/line (e.g., can't have "Over 45.5" and "Under 45.5" for same game)
2. Cannot bet both sides of the same prop (e.g., can't have "Player X over 100 yards" and "Player X under 100 yards")
3. Cannot have contradictory outcomes in the same game (e.g., can't have "Team A -7" and "Team B +3" in same game)
4. CAN bet multiple legs from the same game as long as they don't contradict (e.g., can have "Team A ML" and "Over 45.5" in same game)
5. CAN bet same team in different games
6. CAN bet player props and game outcomes from same game if they don't contradict

For each leg, respond with:
- "status": "valid" or "conflicting"
- "conflicts_with": array of leg numbers it conflicts with (e.g., [2, 3])
- "reason": brief explanation if conflicting

Return JSON array matching the order of legs provided.`,
        },
        {
          role: 'user',
          content: `Validate these parlay legs:\n\n${legDescriptions}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return result
  } catch (error) {
    console.error('OpenAI validation error:', error)
    return null
  }
}
