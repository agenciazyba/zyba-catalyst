async function sendOtpEmail(app, toEmail, otp) {
  await app.email().sendMail({
    from_email: process.env.OTP_FROM_EMAIL,
    to_email: [toEmail],
    subject: "Your Zyba Outdoors access code",
    html_mode: true,
    content: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; text-align: center; color: #15231f; padding: 24px 16px;">
        <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 700;">Your Zyba Outdoors access code</h2>
        <p style="margin: 0 0 20px; font-size: 15px;">Use this code to sign in to your Zyba Outdoors trip.</p>
        <p style="display: inline-block; margin: 0 0 20px; padding: 14px 20px; border-radius: 8px; background: #f3f6f1; color: #0f1f1a; font-size: 30px; font-weight: 700; letter-spacing: 6px;">${otp}</p>
        <p style="margin: 0 0 8px; font-size: 14px;">This code expires in 10 minutes.</p>
        <p style="margin: 0; font-size: 13px; color: #5d6a66;">If you did not request this code, you can safely ignore this email.</p>
      </div>
    `
  });
}

module.exports = {
  sendOtpEmail
};
