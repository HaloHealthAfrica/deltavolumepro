import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { userService } from '@/lib/services/user-service'

export async function POST(req: Request) {
  // Get the webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET environment variable')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  // Handle the webhook event
  const eventType = evt.type

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data
        const primaryEmail = email_addresses?.[0]?.email_address

        if (!primaryEmail) {
          console.error('User created without email:', id)
          return new Response('User has no email', { status: 400 })
        }

        await userService.createUser({
          clerkId: id,
          email: primaryEmail,
          name: [first_name, last_name].filter(Boolean).join(' ') || undefined,
          imageUrl: image_url || undefined,
        })

        console.log('User created in local DB:', id)
        break
      }

      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url } = evt.data
        const primaryEmail = email_addresses?.[0]?.email_address

        if (!primaryEmail) {
          console.error('User updated without email:', id)
          return new Response('User has no email', { status: 400 })
        }

        // Sync user data from Clerk
        await userService.syncFromClerk({
          id,
          emailAddresses: email_addresses.map(e => ({ emailAddress: e.email_address })),
          firstName: first_name,
          lastName: last_name,
          imageUrl: image_url,
        })

        console.log('User updated in local DB:', id)
        break
      }

      case 'user.deleted': {
        const { id } = evt.data

        if (!id) {
          console.error('User deleted event without ID')
          return new Response('Missing user ID', { status: 400 })
        }

        // Mark user as inactive (don't delete to preserve trade history)
        await userService.handleClerkUserDeleted(id)

        console.log('User marked inactive in local DB:', id)
        break
      }

      case 'session.created': {
        // Update last sign-in timestamp
        const { user_id } = evt.data

        if (user_id) {
          try {
            await userService.updateLastSignIn(user_id)
            console.log('Updated last sign-in for user:', user_id)
          } catch {
            // User might not exist in local DB yet
            console.log('Could not update last sign-in, user may not exist:', user_id)
          }
        }
        break
      }

      default:
        console.log('Unhandled webhook event type:', eventType)
    }

    return new Response('Webhook processed', { status: 200 })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response('Error processing webhook', { status: 500 })
  }
}
