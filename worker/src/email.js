import { EmailMessage } from 'cloudflare:email';

function createMimeMessage({ from, to, replyTo, subject, text }) {
  const messageId = `<${Date.now()}.${crypto.randomUUID()}@${from.split('@')[1]}>`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
  ].join('\r\n');

  const message = [headers, '', text].join('\r\n');

  return new EmailMessage(from, to, message);
}

export async function sendEmail(env, { subject, message, replyTo, imageUrls }) {
  if (!env.SENDER_EMAIL || !env.DESTINATION_EMAIL) {
    throw new Error('Email configuration missing: SENDER_EMAIL or DESTINATION_EMAIL not set');
  }

  if (!env.EMAIL) {
    throw new Error('Email binding not configured');
  }

  try {
    let text = `Submission:\n\n${message}`;
    if (imageUrls && imageUrls.length > 0) {
      text += '\n\nImages:\n' + imageUrls.join('\n');
    }

    const emailMessage = createMimeMessage({
      from: env.SENDER_EMAIL,
      to: env.DESTINATION_EMAIL,
      replyTo: replyTo || env.SENDER_EMAIL,
      subject: subject || 'New Submission',
      text,
    });

    await env.EMAIL.send(emailMessage);
  } catch (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
