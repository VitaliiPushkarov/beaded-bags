import { after } from 'next/server'
import { processOrderEmailQueue } from './order-email-queue'

export function scheduleOrderEmails(orderId?: string): void {
  // after keeps the invocation alive after the response; cron recovers jobs
  // if this process is interrupted.
  after(async () => {
    try {
      await processOrderEmailQueue(orderId)
    } catch {
      console.error(
        'Order email queue unavailable; deferred to scheduled retry',
      )
    }
  })
}
