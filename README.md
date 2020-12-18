# Racket

Racket is a simple reimbursement tracking system, originally designed to help me keep track
of things that my parents owed me money for.

![Demo Screen showing Racket](https://i.imgur.com/8AaqoRP.png)

## Features

- Upload reimbursements with names, amounts and links to a receipt


- Automatically send emails (default 3 times a week) to the person
paying with info on what's new and what's been previously requested
  

- Automatically sends person being paid reminder emails to check if they've
been paid and very easy closing if they have been


## Installation

#### Linux

- Install packages

`npm install`

- Set environment variables

`process.env.PORT: sets what port the app will run on (default 8073)`  
`process.env.PAID_EMAIL: email address for the person getting paid (requesting reimbursements)`  
`process.env.PAID_EMAIL: email address to the person paying`  
`process.env.SENDGRID: sendgrid API key (used to send emails)`  
`process.env.DATABASE: a mongoDB connection URL, used to store reimbursement info`


- Start the app

`node app.js`


