var express = require('express');
var router = express.Router();
const usersHelpers=require('../helper/guestHelper')
const superhelper=require('../helper/superadmin')
const db = require('../config/connection')
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
router.get('/addStudent',(req,res)=>{
   res.render('superadmin/addStudent')
})
router.post("/addstudent", async (req, res) => {
   console.log(req.body);
   try {
       const insertedId = await superhelper.addStudents(req.body);
       res.json({ success: true, message: "Students added successfully!", insertedId });
     
   } catch (error) {
       console.error("Error adding students:", error);
       res.status(500).json({ success: false, message: "Internal Server Error" });
   }
});

router.delete('/delete/:id', verifyLogin, async (req, res) => {
   try {
       const userId = req.params.id;
       await superhelper.deleteUser(userId);
       res.json({ success: true, message: "User deleted successfully" });
   } catch (error) {
       console.error("Error deleting user:", error);
       res.status(500).json({ success: false, message: "Internal Server Error" });
   }
});
router.get('/pc',(req,res)=>{
   res.render('superadmin/pc')
})

router.post('/add', async (req, res) => {
   try {
       console.log('Received body:', req.body);

       const { labName, pcNumber, ip } = req.body;

       // Detailed logging
       console.log('Lab Name:', labName);
       console.log('PC Numbers:', pcNumber);
       console.log('IPs:', ip);

       // Ensure pcNumber and ip are arrays
       const pcNumbers = Array.isArray(pcNumber) 
           ? pcNumber.map(num => num.trim()).filter(num => num !== '')
           : [pcNumber].filter(num => num && num.trim() !== '');

       const ips = Array.isArray(ip)
           ? ip.map(ipAddr => ipAddr.trim()).filter(ipAddr => ipAddr !== '')
           : [ip].filter(ipAddr => ipAddr && ipAddr.trim() !== '');

       console.log('Processed PC Numbers:', pcNumbers);
       console.log('Processed IPs:', ips);

       // Create PC entries with robust validation
       const pcs = pcNumbers.map((pc, index) => ({
           pcNumber: parseInt(pc),
           ip: ips[index] || null
       })).filter(pc => pc.pcNumber && pc.ip);

       console.log('Final PC Entries:', pcs);

       if (pcs.length === 0) {
           return res.status(400).json({ 
               error: "No valid PC entries provided",
               details: {
                   originalPcNumbers: parseInt(pcNumber),
             
                   processedPcNumbers: pcNumbers,
                   processedIPs: parsips
               }
           });
       }

       const collection = db.get().collection('pc');

       // Upsert operation
       const result = await collection.updateOne(
           { labName },
           { 
               $set: { labName },
               $push: { pcs: { $each: pcs } }
           },
           { upsert: true }
       );

       console.log('Database update result:', result);

       res.status(200).json({ 
           message: "Lab updated successfully",
           pcs: pcs
       });

   } catch (error) {
       console.error('Full error in lab addition:', error);
       res.status(500).json({ 
           error: "Error updating lab",
           details: error.toString() 
       });
   }
});


router.get('/editpc', async (req, res) => {
   try {// Fetch all labs
       const labs = await db.get().collection('pc').find().toArray();

       res.render('superadmin/editpc', { labs });
   } catch (error) {
       console.error(error);
       res.status(500).send("Error fetching labs.");
   } finally {
      
   }
});
router.get('/edit/:labName', async (req, res) => {
   const labName = req.params.labName;

   try {
       await client.connect();
       const db = client.db(dbName);
       const collection = db.collection('pc');

       const lab = await collection.findOne({ labName });

       if (!lab) {
           return res.send("<p>Lab not found.</p>");
       }

       res.render('superadmin/editPcForm', { lab });
   } catch (error) {
       console.error(error);
       res.send("<p>Error fetching lab details.</p>");
   } finally {
       await client.close();
   }
});
router.post('/update/:labName', async (req, res) => {
   const labName = req.params.labName;
   const { pcNumber, ip } = req.body;

   const updatedPcs = pcNumber.map((pc, index) => ({
       pcNumber: pc,  // Keep PC number same
       ip: ip[index]   // Update only IP
   }));

   try {
       await client.connect();
       const db = client.db(dbName);
       const collection = db.collection('pc');

       await collection.updateOne(
           { labName },
           { $set: { pcs: updatedPcs } }
       );

       res.send("Lab updated successfully! <a href='/pc/edit'>Go Back</a>");
   } catch (error) {
       console.error(error);
       res.status(500).send("Error updating lab.");
   } finally {
       await client.close();
   }
});

module.exports=router