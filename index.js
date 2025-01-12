const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const path = require("path");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const port = process.env.PORT || 5000;

// Middleware setup
app.use(express.json({ limit: "25mb" }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

// رفع الصور
const uploadImage = require("./src/utils/uploadImage");

// جميع الروابط
const authRoutes = require("./src/users/user.route");
const productRoutes = require("./src/products/products.route");
const reviewRoutes = require("./src/reviews/reviews.router");
const orderRoutes = require("./src/orders/orders.route");
const statsRoutes = require("./src/stats/stats.rout");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/stats", statsRoutes);

// خدمة الملفات الثابتة (مثل ملفات React)
app.use(express.static(path.join(__dirname, "build")));

// إعادة توجيه جميع الطلبات إلى index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

// الاتصال بقاعدة البيانات
main()
    .then(() => console.log("MongoDB is successfully connected."))
    .catch((err) => console.log(err));

async function main() {
    await mongoose.connect(process.env.DB_URL);

    app.get("/", (req, res) => {
        res.send("Lebaba E-commerce Server is running....!");
    });
}

// رفع صورة واحدة
app.post("/uploadImage", (req, res) => {
    uploadImage(req.body.image)
        .then((url) => res.send(url))
        .catch((err) => res.status(500).send(err));
});

// رفع عدة صور
app.post("/uploadImages", async (req, res) => {
    try {
        const { images } = req.body;
        if (!images || !Array.isArray(images)) {
            return res.status(400).send("Invalid request: images array is required.");
        }

        const uploadPromises = images.map((image) => uploadImage(image));
        const urls = await Promise.all(uploadPromises);

        res.send(urls);
    } catch (error) {
        console.error("Error uploading images:", error);
        res.status(500).send("Internal Server Error");
    }
});

// تشغيل الخادم
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});