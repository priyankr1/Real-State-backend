import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './.env.local' });
}
dotenv.config();

const getSmtpConfig = () => {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;

  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user,
      pass: process.env.SMTP_PASS,
    },
  };
};

const createTransporter = () => {
  if (!getSmtpConfig().auth.user || !process.env.SMTP_PASS) {
    console.warn('Email SMTP configuration incomplete. Set SMTP_USER (or EMAIL_USER) and SMTP_PASS.');
  }

  return nodemailer.createTransport(getSmtpConfig());
};

const transporter = createTransporter();

// Helper function to send emails with error handling
export const sendEmail = async (mailOptions) => {
  return await transporter.sendMail(mailOptions);
};

// Health check function
export const checkEmailHealth = async () => {
  const smtpConfig = getSmtpConfig();
  const missing = [
    !smtpConfig.auth.user ? 'SMTP_USER or EMAIL_USER' : null,
    !smtpConfig.auth.pass ? 'SMTP_PASS' : null,
  ].filter(Boolean);

  if (missing.length) {
    return {
      status: 'error',
      message: `SMTP credentials not configured: missing ${missing.join(', ')}`,
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user || null,
    };
  }
  try {
    await transporter.verify();
    return {
      status: 'healthy',
      message: 'Email SMTP service is operational',
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.auth.user,
    };
  }
};

export default transporter;
