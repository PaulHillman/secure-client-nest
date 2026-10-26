import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const INSTRUCTOR_EMAIL = 'hillmanp@gvsu.edu'

const payloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    email: z.string().email(),
    uri: z.string().max(500).optional(),
    scheduled_event: z.object({
      uri: z.string().max(500),
      start_time: z.string().max(100),
      location: z.object({ join_url: z.string().max(1000).optional() }).passthrough().optional(),
    }).passthrough().optional(),
  }).passthrough(),
})

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const Route = createFileRoute('/api/public/calendly-booking')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signingKey = process.env['CALENDLY_WEBHOOK_SIGNING_KEY']
        if (!signingKey) return new Response('Webhook not configured', { status: 500 })

        const rawBody = await request.text()
        const signatureHeader = request.headers.get('calendly-webhook-signature') ?? ''
        const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')))
        const timestamp = parts['t']
        const signature = parts['v1']
        if (!timestamp || !signature) return new Response('Invalid signature', { status: 401 })
        const expected = await hmacHex(signingKey, `${timestamp}.${rawBody}`)
        if (!timingSafeEqual(signature, expected)) return new Response('Invalid signature', { status: 401 })

        const parsed = payloadSchema.safeParse(JSON.parse(rawBody))
        if (!parsed.success) return new Response('Invalid payload', { status: 400 })
        const event = parsed.data
        if (event.event === 'invitee.canceled') {
          const canceledUri = event.payload.scheduled_event?.uri
          if (canceledUri) {
            const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server')
            await db.from('peer_review_meetings').delete().eq('calendly_event_uri', canceledUri)
          }
          return Response.json({ ignored: true })
        }
        if (event.event !== 'invitee.created') return Response.json({ ignored: true })
        if (!event.payload.scheduled_event) return Response.json({ ignored: true })

        const inviteeEmail = event.payload.email.toLowerCase()
        const eventUri = event.payload.scheduled_event.uri
        const startTime = event.payload.scheduled_event.start_time
        const zoomLink = event.payload.scheduled_event.location?.join_url ?? null

        const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server')
        const { data: student } = await db.from('profiles').select('id, name, email').ilike('email', inviteeEmail).limit(1).maybeSingle()
        if (!student || /parfunkel/i.test(student.name)) return Response.json({ ignored: true })

        // Only students whose latest assessed peer review requires a meeting (attempt 3+, below 8/10).
        const { data: latest } = await db
          .from('peer_review_assessments')
          .select('attempt, score, team_id')
          .eq('user_id', student.id)
          .eq('status', 'assessed')
          .order('attempt', { ascending: false })
          .limit(1)
          .maybeSingle()
        const { peerEmailAction } = await import('@/lib/peer-review-email')
        if (!latest || latest.score == null || !peerEmailAction(latest.score, latest.attempt).meetingRequired) {
          return Response.json({ ignored: true })
        }
        const { data: team } = await db.from('teams').select('is_test').eq('id', latest.team_id).single()
        if (!team || team.is_test) return Response.json({ ignored: true })

        // Keep a record of the booking so the admin Meetings page can list it.
        const { error: saveError } = await db.from('peer_review_meetings').upsert({
          calendly_event_uri: eventUri,
          student_id: student.id,
          team_id: latest.team_id,
          scheduled_at: startTime,
          zoom_url: zoomLink,
          score: latest.score,
          attempt: latest.attempt,
        }, { onConflict: 'calendly_event_uri' })
        if (saveError) console.error('Failed to save peer-review meeting:', saveError)

        const meetingTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        }).format(new Date(startTime))

        const { meetingConfirmedEmailBody } = await import('@/lib/peer-review-email')
        const body = meetingConfirmedEmailBody(student.name, latest.score, meetingTime, zoomLink)
        const subject = `Peer-review meeting confirmed — ${student.name} — ${meetingTime}`

        const { sendTemplateEmail } = await import('@/lib/email-templates/send-email')
        const eventKey = eventUri.split('/').pop() || crypto.randomUUID()
        const send = async (copy: 'student' | 'instructor' | 'pm', to: string | null) => {
          if (!to) return
          await sendTemplateEmail('peer-review-meeting-confirmed', to, {
            templateData: { name: student.name, body, subject: copy === 'student' ? subject : `Copy: ${subject}` },
            replyTo: INSTRUCTOR_EMAIL,
            idempotencyKey: `peer-meeting-${eventKey}-${copy}-${to.toLowerCase()}`,
          })
        }
        await send('student', student.email)
        await send('instructor', INSTRUCTOR_EMAIL)
        const { data: pm } = await db.from('team_members').select('user_id').eq('team_id', latest.team_id).eq('job_title', 'PM').maybeSingle()
        if (pm && pm.user_id !== student.id) {
          const { data: pmProfile } = await db.from('profiles').select('email').eq('id', pm.user_id).single()
          await send('pm', pmProfile?.email ?? null)
        }
        return Response.json({ sent: true })
      },
    },
  },
})
