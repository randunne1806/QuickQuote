const express = require('express');
const stripe = require('stripe')('your_secret_key');

const app = express();
app.use(express.json());

app.post('/api/payment', async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      payment_method: paymentMethodId,
      amount: 1000, // amount in cents
      currency: 'usd',
      confirmation_method: 'manual',
      confirm: true,
    });

    // Handle successful payment
    res.json({ success: true });
  } catch (error) {
    // Handle payment failure
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Server is running on port 3001');
});
