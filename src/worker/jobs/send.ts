/**
 * Queue consumer for outbound messages (§5.4).
 *
 * Works through a campaign's queued rows in pages, re-enqueuing itself rather
 * than looping until the CPU limit. Each recipient is settled individually, so
 * a batch that dies part-way leaves the ones already sent marked sent and the
 * rest still queued — re-driving is safe and nobody is mailed twice.
 *
 * The suppression check is repeated here, immediately before dispatch, even
 * though the rows were filtered at queue time and the trigger enforced it on
 * insert. Between queueing and delivery someone may have unsubscribed, and a
 * message already in flight is exactly the one that makes an unsubscribe feel
 * meaningless. The cost is one indexed lookup per recipient.
 */

import type { Env, SendMessage } from '../env';
import { close, connectAsCron, type Sql } from '../lib/rls';
import { getSender, renderMergeFields, type Sender } from '../lib/sender';
import { mintOneTimeToken } from '../lib/crypto';

/** Recipients settled per invocation before re-enqueuing. */
const PAGE = 100;

export async function handleSend(batch: MessageBatch<SendMessage>, env: Env): Promise<void> {
  const sql = connectAsCron(env);
  const sender = getSender(env);

  try {
    for (const message of batch.messages) {
      try {
        if (message.body.kind === 'campaign') {
          await sendCampaignPage(sql, env, sender, message.body.campaignId);
        } else if (message.body.kind === 'ballot_tokens') {
          // Unreachable today: the route refuses to open a secret ballot while
          // no provider is configured. Explicit rather than a silent fallthrough
          // so it fails loudly if that guard is ever removed.
          console.error(
            'send job: ballot token delivery is not implemented (ballot %s)',
            message.body.ballotId,
          );
          throw new Error('Ballot token delivery is not implemented.');
        }
        message.ack();
      } catch (error) {
        console.error('send job failed', message.body, error);
        message.retry();
      }
    }
  } finally {
    await close(sql);
  }
}

async function sendCampaignPage(
  sql: Sql,
  env: Env,
  sender: Sender,
  campaignId: string,
): Promise<void> {
  const [campaign] = await sql`
    SELECT id, tenant_id, channel, subject, body, status
    FROM public.campaigns WHERE id = ${campaignId}::uuid
  `;
  if (!campaign || campaign.status === 'cancelled') return;

  const recipients = await sql`
    SELECT s.id AS send_id, c.id AS contact_id, c.display_name, c.email, c.phone, c.postal_code
    FROM public.campaign_sends s
    JOIN public.contacts c ON c.id = s.contact_id
    WHERE s.campaign_id = ${campaignId}::uuid AND s.status = 'queued'
    ORDER BY s.id
    LIMIT ${PAGE}
  `;

  if (!recipients.length) {
    await sql`
      UPDATE public.campaigns SET status = 'sent'
      WHERE id = ${campaignId}::uuid AND status = 'sending'
    `;
    return;
  }

  const channel = campaign.channel as 'email' | 'sms';

  for (const recipient of recipients) {
    // Re-checked here, not just at queue time. See the note at the top.
    const [{ suppressed }] = await sql`
      SELECT coram.is_suppressed(${recipient.contact_id}::uuid, ${channel}) AS suppressed
    `;
    if (suppressed) {
      await sql`
        UPDATE public.campaign_sends
        SET status = 'failed', failure_kind = 'opted_out', settled_at = now()
        WHERE id = ${recipient.send_id}::uuid
      `;
      continue;
    }

    const body = renderMergeFields(campaign.body as string, {
      display_name: recipient.display_name as string,
      postal_code: recipient.postal_code as string | null,
    });

    let result;
    if (channel === 'email') {
      // A fresh token per send, so a forwarded email cannot unsubscribe the
      // person who originally received it.
      const { token, hash } = await mintOneTimeToken();
      await sql`
        INSERT INTO public.unsubscribe_tokens (tenant_id, contact_id, token_hash)
        VALUES (${campaign.tenant_id}::uuid, ${recipient.contact_id}::uuid, ${hash})
      `;

      result = await sender.email({
        to: recipient.email as string,
        subject: renderMergeFields(campaign.subject as string, {
          display_name: recipient.display_name as string,
        }),
        body,
        unsubscribeUrl: `https://coram.app/u/${token}`,
      });
    } else {
      result = await sender.sms({
        to: recipient.phone as string,
        body,
        fromSender: 'campaign',
      });
    }

    if (result.ok) {
      await sql`
        UPDATE public.campaign_sends SET status = 'sent', sent_at = now()
        WHERE id = ${recipient.send_id}::uuid
      `;
    } else {
      // An invalid address is a permanent failure and belongs in the ledger as
      // a bounce — continuing to try it damages the sending reputation every
      // other group on this platform shares.
      await sql`
        UPDATE public.campaign_sends
        SET status = ${result.kind === 'invalid_address' ? 'bounced' : 'failed'},
            failure_kind = ${result.kind},
            settled_at = now()
        WHERE id = ${recipient.send_id}::uuid
      `;
    }
  }

  // More to do. Re-enqueue rather than loop, so one campaign cannot hold the
  // consumer past its CPU limit and take the rest of the queue down with it.
  await env.Q_SEND.send({ kind: 'campaign', campaignId });
}
