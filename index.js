const express = require('express')
const mongoose  = require('mongoose')
const cors = require('cors')
const app = express()
require('dotenv').config();
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const port = process.env.PORT || 5000

//Midelwier
app.use(express.json({limit: "25mb"}));
app.use((express.urlencoded({limit: "25mb"})));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors({
  origin:'https://lebab-frontend-final.vercel.app',
  credentials:true
}))

// image upload
const uploadImage= require("./src/utils/uploadImage")

const authRoutes = require ('./src/users/user.route')
const Products = require('./src/products/products.route')
const reviewRoutes = require('./src/reviews/reviews.router')
const statsRoutes = require('./src/stats/stats.rout')
const orderRoutes =require("./src/orders/orders.route")
app.use('/api/auth',authRoutes)
app.use('/api/products',Products)
app.use('/api/reviews',reviewRoutes)
app.use('/api/stats',statsRoutes)
app.use('/api/orders',orderRoutes);


main().
  then(()=>console.log("mongodb is successfully connected")).
  catch(err => console.log(err))
async function main() {
    await mongoose.connect(process.env.DB_URL)
    app.get('/', (req, res) => {
      res.send('lebaba ')
    })
}

app.post("/uploadImage", (req, res) => {
  uploadImage(req.body.image)
    .then((url) => res.send(url))
    .catch((err) => res.status(500).send(err));
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})