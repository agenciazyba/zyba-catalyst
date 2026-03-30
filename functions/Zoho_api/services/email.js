async function sendOtpEmail(app, toEmail, otp) {
  await app.email().sendMail({
    from_email: process.env.OTP_FROM_EMAIL,
    to_email: [toEmail],
    subject: "Seu código de acesso",
    html_mode: true,
    content: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Seu código de acesso</h2>
        <p>Use o código abaixo para entrar:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      </div>
    `
  });
}

module.exports = {
  sendOtpEmail
};