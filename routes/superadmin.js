var express = require('express');
var router = express.Router();
const usersHelpers=require('../helper/guestHelper')
const superhelper=require('../helper/superadmin')
/* GET home page. */
const verifyLogin=(req,res,next)=>{
   if(req.session.adminLog){
     next()
   }
   else{
     res.render('superadmin/security')
   }
 }
router.get('/',verifyLogin, function(req, res, next) {
   superhelper.getAll().then((products)=>{
      console.log(products);
      
      res.render('superadmin/home',{products})
   })
});
router.post('/superlogin',(req,res)=>{
 

  superhelper.check(req.body).then((response)=>{
 if(response){
   req.session.adminLog=true
    res.redirect('/superadmin')
 }
 else{
    res.redirect('/superadmin')
 }
    
  })  
})
router.get('/addnewadmin',(req,res)=>{
   res.render('superadmin/addadmin')
})
router.post('/addAdmin',(req,res)=>{
   superhelper.newAdmin(req.body).then((resp)=>{
      res.redirect('/superadmin')
   })
})

module.exports=router