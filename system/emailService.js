const nodemailer = require('nodemailer');

function sendEmail(email, user, password, server) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'wawe99634@gmail.com',
            pass: 'qqfahqrzrvitrmoy'
        }
    });

    let mailOptions = {
        from: 'wawe99634@gmail.com',
        to: email,
        subject: 'DATA PANEL ANDA',
        html: `
            <h3>Hi ${user.username},</h3>
            <p>Your account and server have been successfully created. Here are the details:</p>
            <ul>
                <li><strong>Username:</strong> ${user.username}</li>
                <li><strong>Password:</strong> ${password}</li>
                <li><strong>Server Memory:</strong> ${server.limits.memory} MB</li>
                <li><strong>Server Disk:</strong> ${server.limits.disk} MB</li>
                <li><strong>Server CPU:</strong> ${server.limits.cpu}%</li>
            </ul>
            <p>Please login to your server using the following URL: ${domain}</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
        } else {
            console.log("Email sent:", info.response);
        }
    });
}

module.exports = {
    sendEmail
};
