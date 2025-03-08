import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs'

dotenv.config();
const app = express();
app.use(cors());
app.use(express.static('public')); 

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const callbackUrl = process.env.SUCCESS_PAGE;

app.get('/pay', async (req, res) => {
    try {
        let { amount, name, email, contact, tickets, event } = req.query;

        if (!amount || isNaN(amount) || amount < 1) {
            return res.status(400).send('Invalid amount');
        }

        amount = parseInt(amount) * 100; 

        name = name || 'Anonymous Donor';
        email = email || 'donor@example.com';
        contact = contact || '9999999999'; 

        const response = await axios.post(
            'https://api.razorpay.com/v1/payment_links',
            {
                amount: amount,
                currency: 'INR',
                description: 'Book you tickets',
                customer: { name, email, contact },
                callback_url: callbackUrl,
                callback_method: 'get',
                notes: {
                    donated_amount: amount / 100,
                    donor_name: name,
                    email: email,
                    tickets: tickets,
                    eventName: event
                }
            },
            {
                auth: {
                    username: RAZORPAY_KEY_ID,
                    password: RAZORPAY_KEY_SECRET
                }
            }
        );

        res.redirect(response.data.short_url);
    } catch (error) {
        console.error('Razorpay API Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Error generating payment link');
    }
});

app.get('/success', async (req, res) => {
    try {
        const { razorpay_payment_id } = req.query;

        if (!razorpay_payment_id) {
            return res.status(400).send('Payment ID missing');
        }

        // Fetch payment details from Razorpay
        const paymentResponse = await axios.get(
            `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
            {
                auth: {
                    username: RAZORPAY_KEY_ID,
                    password: RAZORPAY_KEY_SECRET
                }
            }
        );

        const payment = paymentResponse.data;

        const amount = payment.notes.donated_amount || (payment.amount / 100);
        const name = payment.notes.donor_name || 'Anonymous Donor';
        const receiptNumber = razorpay_payment_id; 
        const eventName = payment.notes.eventName;
        const tickets = payment.notes.tickets;

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const successFilePath = path.join(__dirname, 'public', 'success.html');

        // Read the HTML file and inject dynamic data
        let successPage = await fs.promises.readFile(successFilePath, 'utf8');

        successPage = successPage
            .replace('{{name}}', name)
            .replace('{{amount}}', `₹${amount}`)
            .replace('{{receiptNumber}}', receiptNumber)
            .replace('{{eventName}}', eventName)
            .replace('{{tickets}}', tickets);

        res.send(successPage);
    } catch (error) {
        console.error('Error fetching payment details:', error.response ? error.response.data : error.message);
        res.status(500).send('Error displaying donation confirmation');
    }
});


app.get('/home', (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(process.env.PORT, () => console.log('Server running on port 3000'));
