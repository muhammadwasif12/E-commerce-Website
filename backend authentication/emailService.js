const nodemailer = require('nodemailer');
const { emailTemplates } = require('./emailTemplates');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send verification email
exports.sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates.verification(otp);

    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Verify Your Email',
      html: template
    });

    return { success: true };
  } catch (error) {
    console.error('Send verification email error:', error);
    throw error;
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    const template = emailTemplates.passwordReset(resetUrl);

    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request',
      html: template
    });

    return { success: true };
  } catch (error) {
    console.error('Send password reset email error:', error);
    throw error;
  }
};

// Send welcome email
exports.sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates.welcome(name);

    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Welcome to ShopHub!',
      html: template
    });

    return { success: true };
  } catch (error) {
    console.error('Send welcome email error:', error);
    throw error;
  }
};

// Send order confirmation email
exports.sendOrderConfirmation = async (email, orderData) => {
  try {
    const transporter = createTransporter();
    const template = emailTemplates.orderConfirmation(orderData);

    await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: `Order Confirmation #${orderData.orderNumber}`,
      html: template
    });

    return { success: true };
  } catch (error) {
    console.error('Send order confirmation email error:', error);
    throw error;
  }
};
