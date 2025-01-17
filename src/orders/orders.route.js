const express = require("express");
const Order = require("./orders.model");
const verifyToken = require("../middleware/verifyToken");
const verifyAdmin = require("../middleware/verifyAdmin");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const nodemailer = require("nodemailer");

// // إعداد nodemailer
// const transporter = nodemailer.createTransport({
//     service: 'gmail', // يمكنك استخدام أي خدمة أخرى مثل Outlook أو Yahoo
//     auth: {
//         user: process.env.EMAIL_USER, // البريد الإلكتروني الخاص بك
//         pass: process.env.EMAIL_PASS, // كلمة المرور الخاصة بالبريد الإلكتروني
//     },
// });


// create checkout session
router.post("/create-checkout-session", async (req, res) => {
    const { products, province, wilayat, streetAddress, phone, email, orderNotes, firstName, lastName } = req.body;

    console.log("Products received in server:", JSON.stringify(products, null, 2));

    if (!products || products.length === 0) {
        return res.status(400).json({ error: "No products found in the request" });
    }

    try {
        const lineItems = products.map((product) => {
            const imageUrl = Array.isArray(product.image) ? product.image[0] : product.image;

            if (!imageUrl || typeof imageUrl !== 'string') {
                throw new Error(`Invalid image URL for product: ${product.name}`);
            }

            return {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: product.name,
                        images: [imageUrl],
                    },
                    unit_amount: Math.round(product.price * 100), // السعر يجب أن يكون بالسنتات
                },
                quantity: product.quantity,
            };
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: lineItems,
            mode: "payment",
            success_url: "https://www.royasow.store/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: "https://www.royasow.store/cancel",
            metadata: {
                province,
                wilayat,
                streetAddress,
                phone,
                email,
                orderNotes,
                firstName,
                lastName,
            },
        });

        console.log("Stripe session created:", session.id);

        // إنشاء الطلب وحفظه في قاعدة البيانات
        const order = new Order({
            orderId: session.id, // استخدام معرف الجلسة كمعرف للطلب
            firstName,
            lastName,
            products: products.map((product) => ({
                productId: product._id, // استخدام _id بدلاً من id
                quantity: product.quantity,
            })),
            amount: products.reduce((total, product) => total + product.price * product.quantity, 0), // حساب المبلغ الإجمالي
            email,
            phoneNumber: phone,
            shippingAddress: {
                country: "Oman",
                province,
                wilayat,
                streetAddress,
            },
            orderNotes,
            status: "pending", // الحالة الافتراضية
        });

        await order.save(); // حفظ الطلب في قاعدة البيانات
        console.log("Order saved to database:", order);

        res.json({ id: session.id });
    } catch (error) {
        console.error("Error creating checkout session or saving order:", error);
        res.status(500).json({ error: "Failed to create checkout session or save order", details: error.message });
    }
});

// تأكيد الدفع
router.post("/confirm-payment", async (req, res) => {
    const { session_id } = req.body;

    if (!session_id) {
        console.error("Session ID is required");
        return res.status(400).json({ error: "Session ID is required" });
    }

    try {
        // استرجاع بيانات الجلسة من Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ["line_items", "payment_intent"],
        });

        if (!session.payment_intent) {
            console.error("Payment intent not found in session");
            return res.status(400).json({ error: "Payment intent not found in session" });
        }

        const paymentIntentId = session.payment_intent.id;

        // البحث عن الطلب في قاعدة البيانات
        let order = await Order.findOne({ orderId: paymentIntentId });

        if (!order) {
            // إنشاء طلب جديد إذا لم يتم العثور عليه
            const lineItems = session.line_items.data.map((item) => ({
                productId: item.price.product,
                quantity: item.quantity,
            }));

            const amount = session.amount_total / 100;

            order = new Order({
                orderId: paymentIntentId,
                products: lineItems,
                amount: amount,
                email: session.customer_details.email || session.metadata.email,
                phoneNumber: session.metadata.phone || "N/A",
                shippingAddress: {
                    country: session.metadata.country || "Oman",
                    province: session.metadata.province || "N/A",
                    wilayat: session.metadata.wilayat || "N/A",
                    streetAddress: session.metadata.streetAddress || "N/A",
                },
                orderNotes: session.metadata.orderNotes || "No notes provided",
                firstName: session.metadata.firstName || "N/A", // إضافة firstName
                lastName: session.metadata.lastName || "N/A", // إضافة lastName
                status: session.payment_intent.status === "succeeded" ? "pending" : "failed",
            });
        } else {
            // تحديث حالة الطلب إذا تم العثور عليه
            order.status = session.payment_intent.status === "succeeded" ? "pending" : "failed";
        }

        await order.save(); // حفظ الطلب في قاعدة البيانات
        console.log("Order saved to database:", order);

        res.json({ order });
    } catch (error) {
        console.error("Error confirming payment:", error);
        res.status(500).json({ error: "Failed to confirm payment", details: error.message });
    }
});


// get order by email address
router.get("/:email", async (req, res) => {
    const email = req.params.email;
    if (!email) {
        return res.status(400).send({ message: "Email is required" });
    }

    try {
        const orders = await Order.find({ email: email });

        if (orders.length === 0 || !orders) {
            return res.status(400).send({ orders: 0, message: "No orders found for this email" });
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

        if (!updatedOrder) {
            return res.status(404).send({ message: "Order not found" });
        }

        res.status(200).json({
            message: "Order status updated successfully",
            order: updatedOrder
        });

    } catch (error) {
        console.error("Error updating order status", error);
        res.status(500).send({ message: "Failed to update order status" });
    }
});

// delete order
router.delete('/delete-order/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const deletedOrder = await Order.findByIdAndDelete(id);
        if (!deletedOrder) {
            return res.status(404).send({ message: "Order not found" });
        }
        res.status(200).json({
            message: "Order deleted successfully",
            order: deletedOrder
        });

    } catch (error) {
        console.error("Error deleting order", error);
        res.status(500).send({ message: "Failed to delete order" });
    }
});

module.exports = router;