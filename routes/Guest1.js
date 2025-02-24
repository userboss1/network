var express = require('express');
var router = express.Router();
const usersHelpers=require('../helper/guestHelper');
const guestHelper = require('../helper/guestHelper');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('guest/index');
});
router.post('/login',(req,res)=>{
  usersHelpers.doLogin(req.body).then((response)=>{
    
    
    if(response.status){
      req.session.loggedIn=true
      req.session.user=response.user
  
      
res.render('guest/resource',{user:req.session.user})
      
    }
    else{
      res.send("No netwokr available")
      
    }
  })
  
})
router.get('/viva',(req,res)=>{
  guestHelper.getQ().then((response)=>{
    console.log(response);
    res.render('guest/viva',{response})
    
  })
})
module.exports = router;
