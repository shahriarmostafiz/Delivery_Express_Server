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
const { MongoClient, ServerApiVersion } = require("mongodb");

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

    // middlewares
    const verifyToken = (req, res, next) => {
      const authCode = req.headers.authorization;
      // console.log("header", req.headers.authorization);

      if (!authCode) {
        return res.status(401).send({ message: "Access Forbidden" });
      }
      const token = authCode.split(" ")[1];
      jwt.verify(token, SECRET, (err, decoded) => {
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
      //   const email = req.decoded.email;
      //   const query = { email: email };
      //   const user = await usersCollection.findOne(query);
      //   const isAdmin = user?.role === "admin";
      //   if (!isAdmin) {
      //     return res.status(403).send({ message: "Forbidden" });
      //   }
      //   next();
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

    // admin routes

    app.get("/users/isadmin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const tokenEmail = req.decoded.email;
      if (email !== tokenEmail) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const admin = user.role === "admin";
      // if(!isAdmin)
      return { admin };
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
