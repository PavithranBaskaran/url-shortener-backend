const express = require("express");
const app = express();
const cors = require("cors");
const mongodb = require("mongodb");
const mongoClient = mongodb.MongoClient;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const randomstring = require("randomstring");
const url = require("./config");

const URL =
  process.env.DB

let authenticate = function (request, response, next) {
  // console.log(request.headers);
  if (request.headers.authorization) {
    let verify = jwt.verify(
      request.headers.authorization,
      process.env.SECRET 
    );
    console.log(verify);
    if (verify) {
      request.userid = verify.id;

      next();
    } else {
      response.status(401).json({
        message: "Unauthorized",
      });
    }
  } else {
    response.status(401).json({
      message: "Unauthorized",
    });
  }
};
//MiddleWare
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

app.get("/", function (request, response) {
  response.send("Server RUnning");
});

//Login User
app.post("/", async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    const user = await db
      .collection("users")
      .findOne({ username: request.body.username });

    if (user) {
      const match = await bcrypt.compare(request.body.password, user.password);
      if (match) {
        //Token
        const token = jwt.sign(
          { id: user._id, username: user.username, active: user.active },
          process.env.SECRET
        );
        // console.log(token);
        response.json({
          message: "Successfully Logged In!!",
          active: user.active,
          token,
        });
      } else {
        response.json({
          message: "Password is incorrect!!",
        });
      }
    } else {
      response.json({
        message: "User not found",
      });
    }
    await connection.close();
  } catch (error) {
    console.log(error);
  }
});

//Register
app.post("/register", async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(request.body.password, salt);
    request.body.password = hash;
    let userIDCheck = await db
      .collection("users")
      .findOne({ username: request.body.username });
    if (userIDCheck) {
      response.json({
        message: "Username already exists. Please choose other username",
      });
    } else {
      let emailIDCheck = await db
        .collection("users")
        .findOne({ email: request.body.email });
      if (!emailIDCheck) {
        await db.collection("users").insertOne(request.body);
        await connection.close();
        let mailid = request.body.email;

        var transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "testnodemail04@gmail.com",
            pass:  process.env.pass,
          },
        });

        var mailOptions = {
          from: "testnodemail04@gmail.com",
          to: mailid,
          subject: "URL Shortener",
          text: `Please activate the account by clicking this link`,
          html: `<div><h3><a href="#"> http://localhost:3000/activate-account/ </a></h3></div>`,
        };

        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            console.log(error);
            response.json({
              message: "Email not send",
            });
          } else {
            console.log("Email sent: " + info.response);
            response.json({
              message: "Email Send",
            });
          }
        });
        response.json({
          message:
            "User Registered! Please check the mail and activate the account",
        });
      } else {
        response.json({
          message:
            "Already a registered User.Please use different mailID or Use Forgot password to reset password",
        });
      }
    }
  } catch (error) {
    console.log(error);
  }
});

//Activate Account
app.post("/activate-account", async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    const userActiveStatus = await db
      .collection("users")
      .findOne({ email: request.body.email });
    if (userActiveStatus) {
      if (userActiveStatus.active === false) {
        await db
          .collection("users")
          .updateOne({ email: request.body.email }, { $set: { active: true } });
        response.json({
          message: `${userActiveStatus.username} Your account is activated!`,
        });
      } else {
        response.json({
          message: `${userActiveStatus.username} Your account is already activated`,
        });
      }
    } else {
      response.json({
        message: `Your email ID is not found`,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

//Reset Password
app.post("/resetpassword", async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    const user = await db
      .collection("users")
      .findOne({ email: request.body.email });
    if (user) {
      let mailid = request.body.email;
      let rString = randomstring.generate(7);
      let link = "http://localhost:3000/reset-password-page";
      await db
        .collection("users")
        .updateOne({ email: mailid }, { $set: { rString: rString } });
      await connection.close();

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "testnodemail04@gmail.com",
          pass: process.env.pass,
        },
      });

      var mailOptions = {
        from: "testnodemail04@gmail.com",
        to: mailid,
        subject: "Password Reset",
        text: `Your Random text is ${rString}. Click the link to reset password ${link}`,
        html: `<h2> Your Random text is ${rString}. Click the link to reset password ${link}</h2>`,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
          response.json({
            message: "Email not send",
          });
        } else {
          console.log("Email sent: " + info.response);
          response.json({
            message: "Email Send",
          });
        }
      });
      response.json({
        message: "Email Send",
      });
    } else {
      response.json({
        message: "Email Id not match / User not found",
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/reset-password-page", async function (request, response) {
  let mailid = request.body.email;
  let String = request.body.rString;
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(request.body.password, salt);
    request.body.password = hash;
    const user = await db
      .collection("users")
      .findOne({ email: request.body.email });
    if (user) {
      if (user.rString === request.body.rString) {
        await db
          .collection("users")
          .updateOne(
            { rString: String },
            { $set: { password: request.body.password } }
          );
        response.json({
          message: "Password reset done",
        });
      } else {
        response.json({
          message: "Random String is incorrect",
        });
      }
    } else {
      response.json({
        message: "Email Id not match / User not found",
      });
    }
    await db
      .collection("users")
      .updateOne({ rString: String }, { $unset: { rString: "" } });
  } catch (error) {
    console.log(error);
  }
});

//Enter Short URL
app.post("/enterurl", authenticate, async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    if (request.body.longURL == "") {
      response.json({
        message: "Please enter URL",
      });
    } else {
      request.body.userid = mongodb.ObjectId(request.userid);
      let random = randomstring.generate(5);
      request.body.shortURL = `${url}/${random}`;
      const user = await db.collection("urls").insertOne(request.body);
      await connection.close();
      response.json({
        message: "URL added",
      });
    }
  } catch (error) {
    console.log(error);
  }
});

//Get URL's

app.get("/enterurl", authenticate, async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    const data = await db
      .collection("urls")
      .find({ userid: mongodb.ObjectId(request.userid) })
      .toArray();
    if (data) {
      response.json(data);
    } else {
      console.log("User not found");
      response.json({
        message: "User not found",
      });
    }
    await connection.close();
  } catch (error) {
    console.log(error);
  }
});

app.get('/dashboard',authenticate, async function(request,response)
{
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
   let data =  db.collection('urls').find({userid: mongodb.ObjectId(request.userid) }).toArray()
   if(data)
   {
    response.json(data)
   }
   else{
    response.json('error')
   }
  } catch (error) {
    console.log(error)
  }
})


//View Website
app.get("/:shortURL", async function (request, response) {
  try {
    const connection = await mongoClient.connect(URL);
    const db = connection.db("URLshortener");
    db.collection("urls").findOne(
      { shortURL: `${url}/${request.params.shortURL}` },
      function (error, data) {
        if (error) throw error;
        db.collection("urls").updateOne(
          { shortURL: `${url}/${request.params.shortURL}` },
          { $inc: { count: 1 } },
          function (error, updatedData) {
            if (error) throw error;
            response.redirect(data.longURL);
          }
        );
      }
    );
    await connection.close()
  } catch (error) {
    console.log(error);
  }
});



app.listen(process.env.PORT );
