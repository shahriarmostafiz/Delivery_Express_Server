const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000;

// mongoose code
// mongoose.connect()
mongoose
  .connect(process.env.URI, {
    dbName: process.env.DB_NAME,
  })
  .then(() => {
    console.log("connected using mongoose");
  })
  .catch(() => {
    console.log("error connecting with mongoose");
  });

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "deliveryman"],
    default: "user",
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
});
const user = new mongoose.model("User", userSchema);

app.post("/users", async (req, res) => {
  console.log(req.body);

  try {
    const createdUser = await user.create(req.body);
    console.log("user created");
    res.status(200).json({
      message: "success",
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({
      message: "failed",
    });
  }
});
// mongo db code
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collections
    const usersCollection = client.db("dex").collection("users");
    const bookingCollection = client.db("dex").collection("bookings");

    // middlewares
    const verifyToken = (req, res, next) => {
      const authCode = req.headers.authorization;
      // console.log("header", req.headers.authorization);

      if (!authCode) {
        return res.status(401).send({ message: "Access Forbidden" });
      }
      const token = authCode.split(" ")[1];
      jwt.verify(token, process.env.TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Access Forbidden" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      // if(user.role)
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({
          message: "Un authorized",
        });
      }
      next();
    };
    const verifyDeliveryMan = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isDeliveryMan = user?.role == "deliveryman";
      if (!isDeliveryMan) {
        return res.status(403).send({ message: "Unauthorized" });
      }
      next();
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.TOKEN, { expiresIn: "10h" });
      res.send({ token });
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // get all  users
    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // update user info

    app.put("/users/updatePhoto/:id", async (req, res) => {
      const id = req.params.id;
      const info = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updatedDoc = {
        $set: {
          image: req.body.image,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    app.post("/socialLoginUsers", async (req, res) => {
      const user = req.body;
      const email = user.email;
      const query = { email: email };
      const isExisting = await usersCollection.findOne(query);
      if (isExisting) {
        return res.send({ message: "user exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // user role routes
    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/roles/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.decoded.email;
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const admin = user?.role === "admin";
      const deliveryman = user?.role === "deliveryman";
      // if(!isAdmin)
      res.send({ admin, deliveryman });
      // return {  };
    });

    // booking apis
    // post a booking
    app.post("/addBooking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne(bookingData);
      res.send(result);
    });
    // get booking
    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.decoded.email;
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const role = user?.role;
      if (role === "admin") {
        const result = await bookingCollection.find().toArray();
        return res.send(result);
      }
      if (role === "deliveryman") {
        const filter = { deliverymanId: new ObjectId(user._id) };
        const result = await bookingCollection.find(filter).toArray();
        return res.send(result);
      }
      const result = await bookingCollection.find({ email: email }).toArray();

      res.send(result);
    });

    // get the stats
    app.get("/stats", async (req, res) => {
      const userTotal = await usersCollection.estimatedDocumentCount({
        role: "user",
      });
      res.send({ userTotal });
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello user");
});
app.listen(port, () => {
  console.log("listening on port", port);
});
