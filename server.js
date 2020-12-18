
//Set up a webserver using express
const express = require('express');
const app = express();

//Sets up bodyParser, used to parse request bodies
var bodyParser  = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Sets up cors to allow for cross origin requests
const cors = require('cors');
app.use(cors());

//Sets up dotenv, used to read .env variables
const dotenv = require('dotenv');
dotenv.config();

//Sets up helmet which does some simple security work
const helmet = require('helmet');
app.use(helmet());

//Connects to mongodb which stores reimbursement information
const mongoose = require('mongoose');
mongoose.connect(process.env.DATABASE, {useUnifiedTopology: true, useNewUrlParser: true});

//Creates the schema for a reimbursement stored in mongo
const schedule = require('node-schedule');

var Schema = mongoose.Schema;
var reimSchema = new Schema({
   name: String, //Title of the reimbursement
   status: String, //Either uploaded, submitted or closed, used to determine whether a reimbursement was previously submitted
   amount: Number, //Amount owed, stored as a simple number
   receipt: String //Link to receipt for transaction
 });

var Reim = mongoose.model("Reim", reimSchema);

//Creates and sets recurrce rule for sending request emails
var rule2 = new schedule.RecurrenceRule();
rule2.dayOfWeek = [1,3,5]; //Mon, Wen, Fri
rule2.hour = 6;
rule2.minute = 0;
schedule.scheduleJob(rule2, function(){
    sendEmail();
});

//Creates and sets recurrence rule for sending reminder emails
var rule3 = new schedule.RecurrenceRule();
rule3.dayOfWeek = [2,4,6]; //Tues, Thur, Sat
rule3.hour = 6;
rule3.minute = 0;
schedule.scheduleJob(rule3, function() {
    sendReminderEmail();
});

//Loads static files (css) from public folder
app.use(express.static('public'));

//Serves home page
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/index.html');
});

//Serves protected main page
app.get('/auth', function(request, response) {
  response.sendFile(__dirname + '/protectpage.html');
});

//Endpoint for submitting a new reimbursement
app.post('/api/new_reimbursement', function(req, res) {
    //Refuse to brew tea (send anything) for requests where any info is null
    if(req.body.name == null || req.body.amount == null || req.body.receipt == null) {
    console.log(req.body);
    res.status(418);
    res.send(req.body);
  }
  else {
    var amount = req.body.amount;
    if(amount.indexOf("$") != -1) {
      amount = amount.substring(1, amount.length); //Remove the $ sign if it was entered in the form
    }
    //Create and save a reimbursement with the given info and an "uploaded" status
    var rei = new Reim({ name: req.body.name, status: "uploaded", amount: amount, receipt: req.body.receipt });
    rei.save(function(err, done) {
      if(err) console.error(err);
      console.log(done);
      res.redirect("/auth"); //Redirect back ot main page once saved
    });
  }
});

app.post('/api/close_reimbursement', function(req, res) {
    //Refuse to close requests without sufficient information
    if(req.body.name == null || req.body.amount == null) {
    console.log(req.body);
    res.status(418);
    res.send(req.body);
  }
  else {
    let amount = req.body.amount;
    if(amount.indexOf("$") != -1) {
      amount = amount.substring(1, amount.length); //Remove $ sign if it was included in the form
    }
    //Use mongoose's update method to change the item with given info to a status of closed
    Reim.update({name: req.body.name, amount: amount, status: ["uploaded", "submitted"]}, {status: "closed"}, function(err, data) {
      if(err) console.log(err);
      console.log(data);
      res.redirect('/auth'); //Redirect to main page when done
    });
  }
});

//Endpoint for getting all open (uploaded or submitted) reimbursements
app.get('/api/open_reimbursements', function(req, res) {
    Reim.find({status: ["uploaded", "submitted"]}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});


//Endpoint for getting all submitted reimbursements
app.get('/api/submitted_reimbursements', function(req, res) {
    Reim.find({status: "submitted"}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

//Endpoint for getting all uploaded reimbursements (not yet sent for reimbursement)
app.get('/api/uploaded_reimbursements', function(req, res) {
    Reim.find({status: "uploaded"}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

//Endpoint for getting all reimbursements that have been closed
app.get('/api/closed_reimbursements', function(req, res) {
    Reim.find({status: "closed"}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

//Function that sends emails, generating simply text and
function sendEmail() {
    const date = new Date();
    let text = "Hello! Here are the reimbursements that I've requested. This email will be sent automatically until the outstanding balance is zero. \n";
    const promise = Reim.find({status: ["submitted", "uploaded"]});
    promise.then(function(submitted) {
        if(submitted.length == 0) {
          return;
        }
        let count = 0;
        let total = 0;
        text += "\n New: \n";
        //Increment through not previously submitted adding their info to text
        //and addding their amount to our running total/count
        for(let i = 0; i < submitted.length; i++) {
            if(submitted[i].status == "uploaded") {
            count++;
            text += submitted[i].name;
            text += " (";
            text += submitted[i].receipt;
            text += "): $";
            text += submitted[i].amount;
            total += submitted[i].amount;
            text += "\n";
            Reim.update({name: submitted[i].name, amount: submitted[i].amount, status: ["uploaded"]}, {status: "submitted"}, function(err, data) {
              if(err) console.log(err);
            });
          }
        }
        //If there were no uploaded items, add text saying so
        if(count == 0) {
          text += "None \n";
        }
        count = 0; //Reset count so we can know if there were any previously submitted items
        text += "\n Previously Submitted: \n"
        //Now loop throguh submitted doing the same
        for(var i = 0; i < submitted.length; i++) {
            if(submitted[i].status == "submitted") {
            count++;
            text += submitted[i].name;
            text += " (";
            text += submitted[i].receipt;
            text += "): $";
            text += submitted[i].amount;
            total += submitted[i].amount;
            text += "\n";
          }
        }
        if(count == 0) {
          text += "None \n";
        }
        if(total >= 0) {
            text += "\n Total Outstanding: $" + total.toFixed(2);
        }
        else {
            text += "\n Total Outstanding: -$" + Math.abs(total).toFixed(2);
        }

      let html = text.replace(/\n/g, "<br>"); //Create our email HTML by simply replacing new line characters with HTML breaks
      const sgMail = require('@sendgrid/mail');
      //Set our api key and create a sendgrid message with the info we've created
        sgMail.setApiKey(process.env.SENDGRID);
        const msg = {
          to: process.env.PAYER_EMAIL,
          cc: process.env.PAID_EMAIL,
          from: 'racket@spencerbartlett.com',
          subject: 'Reimbursement Request for ' + (date.getMonth() + 1) + '/' + date.getDate(),
          text: text,
          html: html,
        };
        sgMail.send(msg);
        return "Sent";
    });
}

function sendReminderEmail() {
  const date = new Date();
  const promise = Reim.find({status: ["submitted", "uploaded"]});
  promise.then(function(submitted) {
      if(submitted.length == 0) {
        return;
      }

  text = "This is a friendly reminder to check USAA to see if outstanding reimbursements have been paid before the next request is sent tomorrow."
  //Simple HTML written statically for reminder
  html = "<p>Hi Spencer,</p><p><br>This is a friendly reminder to check USAA to see if outstanding reimbursements have been paid before the next request is sent tomorrow.</p>"
  const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID);
    //Sets msg including to and from address as well as text of the email
    const msg = {
      to: process.env.PAID_EMAIL,
      from: 'racket@spencerbartlett.com',
      subject: 'Reimbursement Close-Check Reminder ' + (date.getMonth() + 1) + '/' + date.getDate(),
      text: text,
      html: html,
    };
    sgMail.send(msg);
    return "Sent";
    });
}


// listen for requests :)
const listener = app.listen(process.env.PORT || 8071, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

module.exports = listener;
