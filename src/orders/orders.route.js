const express = require("express");
const Order = require("./orders.model");
const router = express.Router();
const axios = require("axios");

const session = require("express-session");

// إعداد بيانات ثابتة خاصة بـ Thawani
const THAWANI_API_URL = 'https://uatcheckout.thawani.om/api/v1';
const THAWANI_API_KEY = 'rRQ26GcsZzoEhbrP2HZvLYDbn9C9et'; // ضع المفتاح الخاص بك هنا
const PUBLIC_KEY = "HGvTMLDssJghr9tlN9gr4DVYt0qyBy";

// إعداد الجلسة
router.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Route 1: بدء عملية الدفع
router.post('/create-thawani-session', async (req, res) => {
  try {
    // التحقق من وجود بيانات products في الطلب
    if (!req.body.products || req.body.products.length === 0) {
      return res.status(400).json({ error: "Products are required" });
    }

    // تحضير البيانات لإرسالها إلى Thawani
    const data = {
      client_reference_id: Date.now().toString(), // معرف فريد للجلسة
      mode: 'payment',
      products: req.body.products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        unit_amount: Math.round(product.price * 1000), // تحويل السعر إلى البيسة (1000 بيسة = 1 ريال عماني)
      })),
      success_url: `${req.protocol}://${req.get('host')}/success`, // رابط النجاح
      cancel_url: `${req.protocol}://${req.get('host')}/fail`, // رابط الإلغاء
    };

    // إرسال الطلب إلى Thawani لإنشاء جلسة دفع
    const response = await axios.post(`${THAWANI_API_URL}/checkout/session`, data, {
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': THAWANI_API_KEY,
      },
    });

    // حفظ معرف الجلسة في session
    req.session.pay_session_id = response.data.data.session_id;

    // إرجاع رابط الدفع كاستجابة JSON
    const paymentLink = `https://uatcheckout.thawani.om/pay/${response.data.data.session_id}?key=${PUBLIC_KEY}`;
    res.json({ payment_url: paymentLink });
  } catch (error) {
    console.error('Error creating payment session:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error creating payment session.' });
  }
});

// Route 2: نجاح الدفع
router.get('/success', async (req, res) => {
  try {
      const sessionId = req.session.pay_session_id;

      const response = await axios.get(`${THAWANI_API_URL}/checkout/session/${sessionId}`, {
          headers: {
              'Content-Type': 'application/json',
              'thawani-api-key': THAWANI_API_KEY
          }
      });

      res.json(response.data);
  } catch (error) {
      console.error('Error fetching payment success data:', error.response.data || error.message);
      res.status(500).send('Error fetching payment success data.');
  }
});

// Route 3: فشل الدفع
router.get('/fail', async (req, res) => {
  try {
      const sessionId = req.session.pay_session_id;

      const response = await axios.get(`${THAWANI_API_URL}/checkout/session/${sessionId}`, {
          headers: {
              'Content-Type': 'application/json',
              'thawani-api-key': THAWANI_API_KEY
          }
      });

      res.json(response.data);
  } catch (error) {
      console.error('Error fetching payment failure data:', error.response.data || error.message);
      res.status(500).send('Error fetching payment failure data.');
  }
});

// Route 4: استرداد المبلغ
router.get('/refund', async (req, res) => {
  try {
      const sessionId = req.session.pay_session_id;

      const sessionData = await axios.get(`${THAWANI_API_URL}/checkout/session/${sessionId}`, {
          headers: {
              'Content-Type': 'application/json',
              'thawani-api-key': THAWANI_API_KEY
          }
      });

      const paymentObject = await axios.get(`${THAWANI_API_URL}/payments?checkout_invoice=${sessionData.data.data.invoice}`, {
          headers: {
              'Content-Type': 'application/json',
              'thawani-api-key': THAWANI_API_KEY
          }
      });

      const payment = paymentObject.data.data[0];

      const refundResponse = await axios.post(`${THAWANI_API_URL}/refunds`, {
          payment_id: payment.payment_id,
          reason: 'Refund Requested'
      }, {
          headers: {
              'Content-Type': 'application/json',
              'thawani-api-key': THAWANI_API_KEY
          }
      });

      const refundStatus = await axios.get(`${THAWANI_API_URL}/refunds/${refundResponse.data.data.refund_id}`, {
          headers: {
              'Content-Type': 'application/json',
              'thawani-api-key': THAWANI_API_KEY
          }
      });

      res.json(refundStatus.data);
  } catch (error) {
      console.error('Error processing refund:', error.response.data || error.message);
      res.status(500).send('Error processing refund.');
  }
});



// مسار لإنشاء جلسة دفع مع Thawani
// router.post("/create-thawani-session", async (req, res) => {
//   const { products } = req.body;

//   if (!products || products.length === 0) {
//     return res.status(400).json({ error: "Products are required" });
//   }

//   try {
//     const lineItems = products.map((product) => ({
//       name: product.name,
//       quantity: product.quantity,
//       unit_amount: Math.round(product.price * 100), // تحويل السعر إلى البيسة
//     }));

//     const data = {
//       client_reference_id: Date.now(), // معرف مرجعي للجلسة
//       mode: "payment",
//       products: lineItems,
//       success_url: "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}", // سيتم استبدال {CHECKOUT_SESSION_ID} من قبل Thawani
//       cancel_url: "http://localhost:5173/cancel",
//     };

//     const response = await axios.post(`${API_URL}/checkout/session`, data, {
//       headers: {
//         "Content-Type": "application/json",
//         "thawani-api-key": API_KEY,
//       },
//     });

//     const redirectUrl = `https://uatcheckout.thawani.om/pay/${response.data.data.session_id}?key=${PUBLIC_KEY}`;
//     res.json({ payment_url: redirectUrl });
//   } catch (error) {
//     console.error("Error creating checkout session:", error.response?.data || error.message);
//     res.status(500).json({ error: "Failed to create checkout session" });
//   }
// });
// // مسار للتحقق من حالة الدفع
// router.post("/confirm-payment", async (req, res) => {
//   const { session_id } = req.body;

//   if (!session_id) {
//     return res.status(400).json({ error: "Session ID is required" });
//   }

//   try {
//     const response = await axios.get(`${API_URL}/checkout/session/${session_id}`, {
//       headers: {
//         "Content-Type": "application/json",
//         "thawani-api-key": API_KEY,
//       },
//     });

//     const paymentData = response.data;

//     if (paymentData.data.payment_status === "paid") {
//       // حفظ الطلب في قاعدة البيانات
//       const order = new Order({
//         orderId: paymentData.data.client_reference_id,
//         products: paymentData.data.products,
//         amount: paymentData.data.total_amount / 100, // تحويل البيسة إلى الريال العماني
//         status: "completed",
//       });

//       await order.save();

//       res.json({
//         success: true,
//         order: order,
//       });
//     } else {
//       res.json({
//         success: false,
//         message: "Payment not successful",
//       });
//     }
//   } catch (error) {
//     console.error("Error confirming payment:", error.response?.data || error.message);
//     res.status(500).json({ error: "Failed to confirm payment" });
//   }
// });

// مسارات أخرى (يمكن إضافتها حسب الحاجة)
// ...


// تقديم صفحة React عند المسارات غير المعروفة

router.get("/:email", async (req, res) => {
  const email = req.params.email;
  if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }

  try {
    const orders = await Order.find({ email: email });

    if (orders.length === 0 || !orders) {
      return res
        .status(400)
        .send({ orders: 0, message: "No orders found for this email" });
    }
    res.status(200).send({ orders });
  } catch (error) {
    console.error("Error fetching orders by email", error);
    res.status(500).send({ message: "Failed to fetch orders by email" });
  }
});

// get order by id
router.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }
    res.status(200).send(order);
  } catch (error) {
    console.error("Error fetching orders by user id", error);
    res.status(500).send({ message: "Failed to fetch orders by user id" });
  }
});

// get all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    if (orders.length === 0) {
      return res.status(404).send({ message: "No orders found", orders: [] });
    }

    res.status(200).send(orders);
  } catch (error) {
    console.error("Error fetching all orders", error);
    res.status(500).send({ message: "Failed to fetch all orders" });
  }
});

// update order status
router.patch("/update-order-status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).send({ message: "Status is required" });
  }

  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        status,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if(!updatedOrder) {
      return res.status(404).send({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder
    })

  } catch (error) {
    console.error("Error updating order status", error);
    res.status(500).send({ message: "Failed to update order status" });
  }
});

// delete order
router.delete('/delete-order/:id', async( req, res) => {
  const { id } = req.params;

  try {
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) {
      return res.status(404).send({ message: "Order not found" });
    }
    res.status(200).json({
      message: "Order deleted successfully",
      order: deletedOrder
    })
    
  } catch (error) {
    console.error("Error deleting order", error);
    res.status(500).send({ message: "Failed to delete order" });
  }
} )

module.exports = router;