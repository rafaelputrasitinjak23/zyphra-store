const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');
const { env } = require('../config/env');
const templates = require('../emails/templates');

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass || !env.smtp.fromEmail) return null;
  transporter = nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure, auth: { user: env.smtp.user, pass: env.smtp.pass }, pool: true, maxConnections: 3 });
  return transporter;
}
async function sendMail({ to, subject, html, template, metadata = {}, retryType, retryPayload }) {
  const transport = getTransporter();
  if (!transport) {
    await EmailLog.create({ to, subject, template, status: 'failed', error: 'SMTP belum dikonfigurasi.', metadata, retryType, retryPayload }).catch(() => {});
    return { sent: false, error: 'SMTP belum dikonfigurasi.' };
  }
  try {
    const info = await transport.sendMail({ from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`, to, subject, html });
    await EmailLog.create({ to, subject, template, status: 'sent', metadata: { ...metadata, messageId: info.messageId }, retryType, retryPayload, sentAt: new Date() }).catch(() => {});
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    await EmailLog.create({ to, subject, template, status: 'failed', error: error.message, metadata, retryType, retryPayload }).catch(() => {});
    return { sent: false, error: error.message };
  }
}
const sendOtp = (to, data) => sendMail({ to, subject: `Kode OTP ${env.smtp.fromName}`, html: templates.otpTemplate(data), template: `otp_${data.purpose}` });
const sendLoginNotice = (to, data) => sendMail({ to, subject: `Login baru di ${env.smtp.fromName}`, html: templates.loginTemplate(data), template: 'login_notice' });
const sendSimple = (to, subject, data, template) => sendMail({ to, subject, html: templates.simpleTemplate(subject, data.name, data.message, data.action), template, retryType: 'simple', retryPayload: { data, template } });
const sendInvoice = (to, order) => sendMail({ to, subject: `Invoice ${order.invoiceNumber}`, html: templates.invoiceTemplate({ order, actionUrl: `${env.appUrl}/orders/${order.orderNumber}` }), template: 'invoice', metadata: { orderNumber: order.orderNumber }, retryType: 'invoice', retryPayload: { orderNumber: order.orderNumber } });
module.exports = { sendMail, sendOtp, sendLoginNotice, sendSimple, sendInvoice };
