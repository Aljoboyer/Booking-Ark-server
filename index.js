const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const app = express();
const ObjectId = require('mongodb').ObjectId;
require('dotenv').config();
const admin = require("firebase-admin");
const fileUpload = require('express-fileupload');
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const port = process.env.PORT || 5000;

//middleware 
app.use(cors());
app.use(express.json());
app.use(fileUpload());

//firebase admin
const serviceAccount = require('./booking-ark--firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.obwta.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

//verifying email by id token
async function VerfyToken(req, res, next){
    if(req.headers.authorization.startsWith('Bearer '))
    {
        const idtoken = req.headers.authorization.split('Bearer ')[1];
        try{
            const decodedUser = await admin.auth().verifyIdToken(idtoken);
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }
    }
    next()
}

async function run() {
    try{
        await client.connect();

        const database = client.db('AircncDB');
        const HotelCollection = database.collection('HotelCollection');
        const BookingCollection = database.collection('BookingCollection');
        const UserCollection = database.collection('UserCollection')

        //adming adding  new hotel
        app.post('/addinghotel', async (req, res) => {
            const data = req.body;
            const front = req.files.img.data;
            const back = req.files.img2.data;
            
            const encodedpic1 = front.toString('base64');
            const img = Buffer.from(encodedpic1, 'base64');

            const encodedpic2 = back.toString('base64');
            const img2 = Buffer.from(encodedpic2, 'base64');

            const hotel = {...data, img, img2};
            const result = await HotelCollection.insertOne(hotel)
            res.json(result) 
        })
        
        //geting all hotel
        app.get('/hotels', async(req, res) => {
            const cursor = HotelCollection.find({});
            const result = await cursor.toArray();
            res.send(result)
        })
        //hotel geting by searching 
        app.get('/searchhotels', async (req, res) => {
            const data = JSON.stringify(req.query.search)
            const space = parseInt(req.query.space);
            HotelCollection.createIndex({hotellocation:"text"})
            const result = await HotelCollection.find({ $and : [{$text: {$search: data}},{space: {$gte: space} }] }).toArray();
            res.send(result)
        })
        //finding hotels by space and location
        app.get('/findhotels', async (req, res) => {
            const data = JSON.stringify(req.query.destination);
            const space = parseInt(req.query.space);
            HotelCollection.createIndex({hotellocation:"text"})
              const  result = await HotelCollection.find({ $and : [{$text: {$search: data}},
                    {space: {$gte: space} }] }).toArray();
            res.send(result)
        })

        //getings hotel by id
        app.get('/getahotel/:id', async (req , res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await HotelCollection.findOne(query);
            res.send(result) 
        })

        //payment system

          //payment intent
      app.post('/create-payment-intent', async (req, res) => {
        const paymentinfo = req.body
        const payment = parseInt(paymentinfo.price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
            currency: 'usd',
            amount: payment,
            payment_method_types: ['card']
          });
        res.send({
        clientSecret: paymentIntent.client_secret
        });
    })
    app.post('/paymentdetailspost', async (req , res) => {
        const hotel = req.body;
        const result = await BookingCollection.insertOne(hotel);
        res.json(result)
    })

    app.get('/bookings',VerfyToken, async (req, res) => {
        const email = req.query.email;
        if(req.decodedEmail === email)
        {
            const query = {email: email}
            const result = await BookingCollection.find(query).toArray();
            res.send(result)
        }
        else{
            res.status(401).send({message: 'UnAuthorised'})
        }

    })

    //saving user to database
    app.post('/saveuser', async (req, res) => {
        const user = req.body
        const result = await UserCollection.insertOne(user)
        res.json(result)
    })

    app.put('/addmin', async (req, res) => {
        const email = req.query.email;
        console.log(email)
        const filter = {email: email}
        const option = {upsert: true};
        const updatedoc = {
            $set:{
                role: 'Admin'
            }
        }
        const result = await UserCollection.updateOne(filter, updatedoc, option);
        res.json(result)
    })

        app.get('/managehotel', async (req, res) => {
            const cursor = HotelCollection.find({});
            const result = await cursor.toArray();
            res.send(result)
        })
        app.delete('/deletehotel', async (req, res) => {
            const id = req.query.id;
            const query = {_id: ObjectId(id)};
            const result = await HotelCollection.deleteOne(query);
            res.send(result)
        })
        app.get('/managebookings', async (req, res) => {
            const cursor = BookingCollection.find({});
            const result = await cursor.toArray();
            res.send(result)
        })

        //geting admin
        app.get('/findadmin', async (req, res) => {
            const email = req.query.email;
            const query = {email: email};
            const user = await UserCollection.findOne(query);
            let isadmin;
            if(user)
            {
                if(user.role === 'Admin')
                    {
                        isadmin = true
                    }
            }
            res.send({isadmin: isadmin})
        })
    }
    finally{

    }
}
run().catch(console.dir)

//////
app.get('/', (req, res) => {
    res.send('Air Cnc Server is connected');
})

app.listen(port, (req, res) => {
    console.log('Air Cnc Port is', port)
})