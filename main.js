const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));

const domain = "";
const apikey = "";
const egg = "15";
const location = "1";
const codeqr = "00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214355408219697190303UMI51440014ID.CO.QRIS.WWW0215ID20232679713720303UMI5204481253033605802ID5915ALMER OK11936836006KEDIRI61056411162070703A01630476E3"
const merchant = "OK1193683"
const keyorkut = "951096517289910871193683OKCT435AAED33CE20F14403F6059A4FD4168"
const elxyz = "KC-018ba8b52541c9a0"

function getProducts() {
    const data = fs.readFileSync('produce.json');
    return JSON.parse(data);
}

function generateRandomPassword() {
    return Math.random().toString(36).substr(2, 5);
}

function getTransactions() {
    if (!fs.existsSync('transactions.json')) {
        fs.writeFileSync('transactions.json', '[]');
    }
    const data = fs.readFileSync('transactions.json');
    return JSON.parse(data);
}

function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formatted = date.toLocaleDateString('id-ID', options);
    const withoutComma = formatted.replace(',', '');
    const capitalized = withoutComma.split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
    return capitalized;
}

function getTransactions() {
    if (!fs.existsSync('transactions.json')) {
        fs.writeFileSync('transactions.json', '[]');
    }
    const data = fs.readFileSync('transactions.json');
    return JSON.parse(data);
}

function saveTransactions(transactions) {
    fs.writeFileSync('transactions.json', JSON.stringify(transactions, null, 2));
}

async function checkQRISStatus(transactionId, amount) {
    try {
        const apiUrl = `https://gateway.okeconnect.com/api/mutasi/qris/${merchant}/${keyorkut}`;
        const response = await axios.get(apiUrl);
        const result = response.data;
        const latestTransaction = result.data && result.data.length > 0 ? result.data[0] : null;

        if (!latestTransaction) {
            throw new Error('Data mutasi tidak tersedia.');
        }

        if (parseInt(latestTransaction.amount) === parseInt(amount)) {
            return 'succeeded';
        } else {
            return 'pending';
        }
    } catch (error) {
        console.error('Error in checkQRISStatus:', error);
        throw error;
    }
}

app.get('/invoice/:id', (req, res) => {
    const transactionId = req.params.id;
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
        return res.status(404).send('Transaksi tidak ditemukan.');
    }
    res.render('invoice', { transaction });
});

app.post('/api/checkout', async (req, res) => {
    const { username, email, price } = req.body;

    if (!username || !email || !price) {
        console.error('Field tidak lengkap:', req.body);
        return res.status(400).json({ error: 'Semua field harus diisi.' });
    }

    const products = getProducts();
    const product = products.find(p => Number(p.price) === Number(price));

    if (!product) {
        console.error('Produk tidak ditemukan dengan harga:', price);
        return res.status(404).json({ error: 'Produk tidak ditemukan.' });
    }

    const adminFee = Math.floor(Math.random() * (10 - 1 + 1)) + 1;
    const amountWithFee = product.price + adminFee;

    try {
        const qrResponse = await axios.get(`http://api.elxyzgpt.xyz/orkut/createpayment?apikey=${elxyz}&amount=${amountWithFee}&codeqr=${codeqr}`);
        const qrData = qrResponse.data.data;

        const transactions = getTransactions();
        const transactionId = uuidv4();
        const newTransaction = {
            id: transactionId,
            username,
            email,
            memory: product.memory,
            disk: product.disk,
            cpu: product.cpu,
            originalAmount: product.price,
            adminFee,
            amount: amountWithFee,
            qrImageUrl: qrData.qrImageUrl,
            qrisData: qrData.qrisData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expirationTime: qrData.expirationTime,
            status: 'pending'
        };

        transactions.push(newTransaction);
        saveTransactions(transactions);

        res.json({ transactionId });
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat melakukan checkout.' });
    }
});

app.get('/api/check-status/:id', async (req, res) => {
    const transactionId = req.params.id;
    const transactions = getTransactions();
    const transactionIndex = transactions.findIndex(t => t.id === transactionId);
    if (transactionIndex === -1) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }
    const transaction = transactions[transactionIndex];
    if (transaction.status === 'succeeded') {
        return res.json({ status: 'succeeded' });
    }
    try {
        const status = await checkQRISStatus(transactionId, transaction.amount);
        if (status === 'succeeded' && transaction.status !== 'succeeded') {
            transactions[transactionIndex].status = 'succeeded';
            transactions[transactionIndex].updatedAt = formatDate(new Date());
            saveTransactions(transactions);
            notifyTelegramAdmin(transactions[transactionIndex]);
        }
        res.json({ status: transactions[transactionIndex].status });
    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa status pembayaran.' });
    }
});

async function createAccountAndServer(email, username, memory, disk, cpu) {
    try {
        let password = generateRandomPassword();
        let response = await fetch(`${domain}/api/application/users`, {
            method: 'POST',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apikey}`
            },
            body: JSON.stringify({
                email: email,
                username: username,
                first_name: username,
                last_name: username,
                language: "en",
                password: password
            })
        });

        let data = await response.json();
        if (data.errors) return;
        let user = data.attributes;

        let eggResponse = await fetch(`${domain}/api/application/nests/5/eggs/${egg}`, {
            method: 'GET',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apikey}`
            }
        });

        let eggData = await eggResponse.json();
        let startup_cmd = eggData.attributes.startup;

        let serverResponse = await fetch(`${domain}/api/application/servers`, {
            method: 'POST',
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apikey}`
            },
            body: JSON.stringify({
                name: username,
                description: " ",
                user: user.id,
                egg: parseInt(egg),
                docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
                startup: startup_cmd,
                environment: {
                    INST: "npm",
                    USER_UPLOAD: "0",
                    AUTO_UPDATE: "0",
                    CMD_RUN: "npm start"
                },
                limits: {
                    memory: memory,
                    swap: 0,
                    disk: disk,
                    io: 500,
                    cpu: cpu
                },
                feature_limits: {
                    databases: 5,
                    backups: 5,
                    allocations: 1
                },
                deploy: {
                    locations: [parseInt(location)],
                    dedicated_ip: false,
                    port_range: []
                }
            })
        });

        let serverData = await serverResponse.json();
        if (serverData.errors) return;
        let server = serverData.attributes;

        sendEmail(email, user, password, server);

    } catch (error) {
        console.error("Error:", error);
    }
}

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

app.get('/', (req, res) => {
    const products = getProducts();
    res.render('cpanel', { products });
});

app.post('/api/create-panel', async (req, res) => {
    const { email, username, memory, disk, cpu } = req.body;

    if (!email || !username || !memory || !disk || !cpu) {
        return res.status(400).json({ error: 'Semua parameter (email, username, memory, disk, cpu) harus diisi.' });
    }

    try {
        await createAccountAndServer(email, username, memory, disk, cpu);
        res.status(200).json({ message: 'Akun dan server berhasil dibuat.' });
    } catch (error) {
        res.status(500).json({ error: 'Terjadi kesalahan saat membuat panel.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


