import { Hono } from 'hono'
import { users, activityLogs } from '../db/schema'
import { eq } from 'drizzle-orm'

const BONUS_AMOUNT = 5.00

const app = new Hono()

// Check bonus eligibility
app.get('/eligibility', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) return c.json({ error: 'User not found' }, 404)

    const balance = parseFloat(user.portfolioBalance)
    const eligible = !user.signupBonusClaimed && balance === 0

    return c.json({
      eligible,
      amount: BONUS_AMOUNT,
      currency: 'USD',
      alreadyClaimed: user.signupBonusClaimed,
    })
  } catch (error) {
    console.error('Bonus eligibility check failed:', error)
    return c.json({ error: 'Failed to check eligibility' }, 500)
  }
})

// Claim the bonus
app.post('/claim', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) return c.json({ error: 'User not found' }, 404)

    // Check if already claimed
    if (user.signupBonusClaimed) {
      return c.json({ error: 'Bonus already claimed' }, 400)
    }

    // Add bonus to balance
    const currentBalance = parseFloat(user.portfolioBalance)
    const newBalance = currentBalance + BONUS_AMOUNT

    await db
      .update(users)
      .set({
        portfolioBalance: newBalance.toString(),
        previousBalance: user.portfolioBalance,
        signupBonusClaimed: true,
        signupBonusAmount: BONUS_AMOUNT.toString(),
        signupBonusClaimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    // Log activity
    await db.insert(activityLogs).values({
      id: crypto.randomUUID(),
      userId,
      description: `Claimed $${BONUS_AMOUNT} signup bonus`,
    })

    return c.json({
      success: true,
      newBalance,
      bonusAmount: BONUS_AMOUNT,
      message: 'Bonus claimed successfully!',
    })
  } catch (error) {
    console.error('Bonus claim failed:', error)
    return c.json({ error: 'Failed to claim bonus' }, 500)
  }
})

export default app
