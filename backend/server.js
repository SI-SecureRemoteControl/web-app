const express = require('express');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt')

dotenv.config(); 

const app = express();
const port = process.env.PORT || 5000;
const cors=require("cors");
const corsOptions ={
   origin:'*', 
   credentials:true,            
   optionSuccessStatus:200,
}

app.use(cors(corsOptions))
app.use(express.json())

app.post('/login', (req, res) => {
  //THIS IS TEMPORARY, PROPER AUTHENTICATION WILL BE ADDED LATER
  const loginRequest = req.body;
  
  bcrypt.compare(loginRequest.password, '$2a$12$syTr35twcAPPFPr8E1q8RuqzNHd8Bb53w4ZA7D9TNubbVdHS/fxIm', (err, result) => {
    if(err) {
      console.error(err);
      return;
    }

    if(result) {
      if(loginRequest.username == 'admin') {
        res.sendStatus(200);
      } else {
        res.sendStatus(400);
      }
    } else {
      res.sendStatus(400);
    }
  });
})

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
