// server.js
// where your node app starts

// init project
const express = require('express');
const app = express();

var bodyParser  = require('body-parser');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const cors = require('cors');
app.use(cors());

const dotenv = require('dotenv');
dotenv.config();

const helmet = require('helmet');
app.use(helmet());

const mongoose = require('mongoose');
mongoose.connect(process.env.DATABASE, {useUnifiedTopology: true, useNewUrlParser: true});

const schedule = require('node-schedule');

var Schema = mongoose.Schema;
var reimSchema = new Schema({
   name: String,
   status: String,
   amount: Number,
   receipt: String
 });

var Reim = mongoose.model("Reim", reimSchema);

var rule2 = new schedule.RecurrenceRule();
rule2.dayOfWeek = [1,3,5];
rule2.hour = 6;
rule2.minute = 0;
schedule.scheduleJob(rule2, function(){
    sendEmail();
});

var rule3 = new schedule.RecurrenceRule();
rule3.dayOfWeek = [2,4,6];
rule3.hour = 6;
rule3.minute = 0;
schedule.scheduleJob(rule3, function() {
    sendReminderEmail();
});

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/index.html');
});

app.get('/auth', function(request, response) {
  response.sendFile(__dirname + '/protectpage.html');
});

app.post('/api/new_reimbursement', function(req, res) {
  if(req.body.name == null || req.body.amount == null || req.body.receipt == null) {
    console.log(req.body);
    res.status(418);
    res.send(req.body);
  }
  else {
    var amount = req.body.amount;
    if(amount.indexOf("$") != -1) {
      amount = amount.substring(1, amount.length);
    }
    var rei = new Reim({ name: req.body.name, status: "uploaded", amount: amount, receipt: req.body.receipt });
    console.log(rei);
    rei.save(function(err, done) {
      if(err) console.error(err);
      console.log(done);
      res.redirect("/auth");
    });
  }
});

app.post('/api/close_reimbursement', function(req, res) {
  if(req.body.name == null || req.body.amount == null) {
    console.log(req.body);
    res.status(418);
    res.send(req.body);
  }
  else {
    var amount = req.body.amount;
    if(amount.indexOf("$") != -1) {
      amount = amount.substring(1, amount.length);
    }
    Reim.update({name: req.body.name, amount: req.body.amount, status: ["uploaded", "submitted"]}, {status: "closed"}, function(err, data) {
      if(err) console.log(err);
      console.log(data);
      res.redirect('/auth');
    });
  }
});

app.get('/api/open_reimbursements', function(req, res) {
    var open = Reim.find({status: ["uploaded", "submitted"]}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

app.get('/api/submitted_reimbursements', function(req, res) {
    var submitted = Reim.find({status: "submitted"}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

app.get('/api/uploaded_reimbursements', function(req, res) {
    var uploaded = Reim.find({status: "uploaded"}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

app.get('/api/closed_reimbursements', function(req, res) {
    var closed = Reim.find({status: "closed"}, function(err, done) {
      if(err) console.log(err);
      res.send(done);
    })
});

function closeReim(name, amount) {
    Reim.update({name: name, amount: amount, status: ["uploaded", "submitted"]}, {status: "closed"}, function(err, data) {
      if(err) console.log(err);

    });
}

function sendEmail() {
    var date = new Date();
    var text = "Hello! Here are the reimbursements that I've requested. This email will be sent automatically until the outstanding balance is zero. \n";
    var promise = Reim.find({status: ["submitted", "uploaded"]});
    promise.then(function(submitted) {
        if(submitted.length == 0) {
          return;
        }
        var count = 0;
        var total = 0;
        text += "\n New: \n";
        for(var i = 0; i < submitted.length; i++) {
            if(submitted[i].status == "uploaded") {
            count++
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
        if(count == 0) {
          text += "None \n";
        }
        count = 0;
        text += "\n Previously Submitted: \n"
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
      text += "\n Total Outstanding: $" + total;
      console.log(text);
      var html = text.replace(/\n/g, "<br>");
      const sgMail = require('@sendgrid/mail');
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
    })

}

function sendReminderEmail() {
  var date = new Date();
  var promise = Reim.find({status: ["submitted", "uploaded"]});
  promise.then(function(submitted) {
      if(submitted.length == 0) {
        return;
      }

  text = "This is a friendly reminder to check USAA to see if outstanding reimbursements have been paid before the next request is sent tomorrow."
  html = "<p>Hi Spencer,</p><p><br>This is a friendly reminder to check USAA to see if outstanding reimbursements have been paid before the next request is sent tomorrow.</p>"
  const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID);
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


app.post("/api/email", function(req, res) {
    sendEmail();
    res.send("sent");
})

app.post("/api/email/reminder", function(req, res) {
    sendReminderEmail();
    res.send("sent");
})

// listen for requests :)
const listener = app.listen(process.env.PORT || 8071, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

module.exports = listener;
