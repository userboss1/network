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

// Using Express Router


// Route to display the edit PC page
router.get('/editpc', async (req, res) => {
    try {
      // Fetch labs with their PCs from the database
      const labs = await db.get().collection('pc').find({}).toArray();
      
      // Render the edit PC page with the data
      res.render('superadmin/infoeditpc', { 
        labs: labs,
        title: 'Edit PC Information'
      });
    } catch (error) {
      console.error('Error fetching PC data:', error);
      res.status(500).send('Error fetching PC data');
    }
  });

// Route to handle the PC update
// 1. Make sure route matches the form action
router.post('/editpc', async (req, res) => {
    try {
      console.log('Form data received:', req.body);
      
      const { labName } = req.body;
      
      if (!labName) {
        return res.status(400).send('Lab name is required');
      }
  
      // Extract PC updates from form data
      const updateOperations = {};
      
      // Process fields with names like "ip_0", "ip_1", etc.
      for (const key in req.body) {
        if (key.startsWith('ip_')) {
          const index = parseInt(key.substring(3)); // Extract the index number after "ip_"
          const ip = req.body[key];
          
          if (!isNaN(index) && ip) {
            updateOperations[`pcs.${index}.ip`] = ip;
          }
        }
      }
      
      console.log('Update operations:', updateOperations);
      
      if (Object.keys(updateOperations).length === 0) {
        return res.status(400).send('No valid PC updates found in the request');
      }
      
      // Apply all updates in a single operation
      const result = await db.get().collection('pc').updateOne(
        { labName },
        { $set: updateOperations }
      );
      
      console.log('Update result:', result);
      
      if (result.modifiedCount === 0) {
        console.log('No changes made to the database');
      } else {
        console.log('Updates completed successfully');
      }
      
      res.redirect('/superadmin');
    } catch (error) {
      console.error('Error updating PC data:', error);
      res.status(500).send(`Error updating PC data: ${error.message}`);
    }
  });
// Don't forget to export the router



module.exports=router