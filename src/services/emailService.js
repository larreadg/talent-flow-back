import nodemailer from 'nodemailer';
import { appName } from '../utils/utils.js';

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',       // servidor SMTP de Gmail
  port: 465,                    // SSL
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function enviarCorreo({ to, subject, text, html }) {
  return transporter.sendMail({
    from: `"${appName}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
