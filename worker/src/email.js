import { EmailMessage } from 'cloudflare:email';

function createMimeMessage({ from, to, replyTo, subject, text, files }) {
  const messageId = `<${Date.now()}.${crypto.randomUUID()}@${from.split('@')[1]}>`;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n');

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    text,
  ].join('\r\n');

  const attachmentParts = files.map((file) => [
    `--${boundary}`,
    `Content-Type: ${file.type || 'application/octet-stream'}; name="${file.name}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${file.name}"`,
    '',
    file.data,
  ].join('\r\n')).join('\r\n');

  const message = [
    headers,
    '',
    textPart,
    attachmentParts,
    `--${boundary}--`,
  ].join('\r\n');

  return new EmailMessage(from, to, message);
}

export async function sendEmail(env, { subject, message, replyTo, files }) {
  if (!env.SENDER_EMAIL || !env.DESTINATION_EMAIL) {
    throw new Error('Email configuration missing: SENDER_EMAIL or DESTINATION_EMAIL not set');
  }

  if (!env.EMAIL) {
    throw new Error('Email binding not configured');
  }

  try {
    const emailMessage = createMimeMessage({
      from: env.SENDER_EMAIL,
      to: env.DESTINATION_EMAIL,
      replyTo: replyTo || env.SENDER_EMAIL,
      subject: subject || 'New Submission',
      text: `Submission:\n\n${message}`,
      files,
    });

    await env.EMAIL.send(emailMessage);
  } catch (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
