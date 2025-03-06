  var express = require("express");
  var router = express.Router();
  const AdminHelper = require("../helper/networkCreation");
  const path = require("path");
  const fs = require("fs");
  const db=require('../config/connection')
  const { log } = require("console");
const { Admin } = require("mongodb");
const { route } = require("./superadmin");

  // Ensure express-session is set up in your main file
  // Example: app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: true }));

  /* GET users listing. */
  function checkSession(req, res, next) {
    if (req.session.user) {
      return res.redirect("/admin/home"); // Redirect if session exists
    }
    next(); // Continue if no session
  }
  function isAuthenticated(req, res, next) {
    if (req.session.user) {
      next(); // User is logged in, allow access
    } else {
      res.redirect("/"); // Redirect to login page if not logged in
    }
  }

  router.get("/", checkSession, function (req, res) {
    res.render("admin/network");
  });
  router.get("/home",isAuthenticated,async (req, res) => {
let user2=req.session.user
let vivaDetails = await AdminHelper.getVivaDetailsAndLogs(user2.name);


console.log("recieved details",vivaDetails);
req.session.vivaDetails=vivaDetails


    res.render("admin/home",{viva:vivaDetails}); // Render home page if logged in
  });


  // Super Admin Login
  router.post('/adminLog', async (req, res) => {
    console.log(req.body);
    
    try {
      let response = await AdminHelper.LoginNet(req.body);
  console.log(response);


      if (response.status) {
        req.session.loggedIn = true;
        req.session.user = response.user;

  res.redirect('/admin/home')
      } else {
        res.status(401).send("No network available");
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send("Server error");
    }
  });

  // Create Network Page
  router.get("/create",isAuthenticated, (req, res) => {
   
  
    
    res.render("admin/create",{user:req.session.user.name});
  });

  // Handle File Upload & Signup
  router.post("/posting", async (req, res) => {
    try {
      if (!req.files || !req.files.pdf) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      let response = await AdminHelper.dofile(req.body);
      console.log("upload:", response);

      // Get the uploaded file
      const pdfFile = req.files.pdf;
      const uploadDir = path.join(__dirname, "../public/pdf");
      const filePath = path.join(uploadDir, `${response}.pdf`);

      // Ensure the upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Move the uploaded file
      pdfFile.mv(filePath, (err) => {
        if (err) {
          return res.status(500).json({ error: "Error saving the file" });
        }
        res.send("Network created and file uploaded successfully!");
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Error processing signup" });
    }
  });
  router.get('/viva',isAuthenticated,(req,res)=>{
    console.log(req.session.user);
  
    res.render('admin/vivasumbit',{user:req.session.user.name})
  })
  router.post('/qsumbit', (req, res) => {
    AdminHelper.vivaSubmit(req.body)
      .then(() => {
        res.redirect('/admin/home')

      })
      .catch((error) => {

        console.error("Error submitting viva questions:", error);
        res.status(500).send("An error occurred while submitting.");
      });
  });



  router.post("/result", async (req, res) => {

    console.log(req.body);
    
    
      try {
          const userAnswers = req.body;

          const user = {
            name: userAnswers["user[name]"],
            roll: userAnswers["user[roll]"],
            department: userAnswers["user[department]"],

          vivaname:userAnswers["user[vivaname]"]
          };
  console.log(user);

          // Compare answers (assuming AdminHelper.compare exists)
          const result = await AdminHelper.compare(userAnswers);


          const final={
            name:user.name,
            rollNumb:user.roll,
            department:user.department,
            vivaname:user.vivaname,
            result:result

          }
          AdminHelper.final(final).then((result)=>{
            if(result.result1){

              res.json({ success: true, mesage: "Quiz submitted!",});
            }else{
              res.json({success:false,mesage:"couldnt upload the result to database"})
            }
          })
          
      } catch (error) {
          console.error("Error processing quiz results:", error);
          res.status(500).json({ success: false, message: "Something went wrong" });
      }
  });

  router.get('/results',isAuthenticated,async(req,res)=>{
    try {
      const info = await AdminHelper.returnResult();
      console.log(info);
    res.render('admin/result',{info:info})
  } catch (error) {
      res.json({ success: false, message: "Failed to fetch results", error: error });
  }
  })

  router.post("/toggle-viva/:id", (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        req.session.vivaActive = active; // Store active status in session

        console.log(active ? `Viva ${id} Started` : `Viva ${id} Stopped`);
        res.json({ success: true, active });
    } catch (error) {
        console.error("Error toggling viva:", error);
        res.status(500).json({ message: "Error toggling viva", error });
    }
});
router.get('/assign', (req, res) => {
  const vivaName = req.query.viva; // Get viva name from query parameters

  if (!vivaName) {
    return res.status(400).send("Viva name is missing");
  }

  // Store in session
  req.session.vivaSpecificname = { viva_name: vivaName };

  // Fetch class data
  AdminHelper.getClasses().then((response) => {
    console.log("Class Data:", response);
    res.render('admin/select', { classData: response, vivaName });
  });
});



//ake sure this points to your MongoDB connection

router.post('/logIn', async (req, res) => {
  console.log("Session Viva Details:", req.session.vivaDetails);

  try {
      const { className, rollStart, rollEnd } = req.body;
      const userName = req.session.user?.name;
      const vivaName = req.session.vivaSpecificname?.viva_name; // Retrieve viva name from session

      if (!vivaName) {
          return res.status(400).json({ success: false, message: "Viva name is missing in session" });
      }

      if (!className || !userName || !rollStart || !rollEnd) {
          return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      const minRoll = parseInt(rollStart, 10);
      const maxRoll = parseInt(rollEnd, 10);

      if (isNaN(minRoll) || isNaN(maxRoll) || minRoll > maxRoll || minRoll < 1) {
          return res.status(400).json({ success: false, message: "Invalid roll number range" });
      }

      const studentData = await db.get().collection('students').findOne({ className });

      if (!studentData || !studentData.students) {
          return res.status(404).json({ success: false, message: "Class not found or no students available" });
      }

      const selectedStudents = studentData.students.filter(student => {
          return student.roll >= minRoll && student.roll <= maxRoll;
      });

      if (selectedStudents.length === 0) {
          return res.status(400).json({ success: false, message: "No students found in the selected range" });
      }

      const logEntry = {
          vivaname: vivaName,  // Store viva name from session
          className: studentData.className,
          networkName: userName,
          students: selectedStudents,
          loginTime: new Date(),
      };

      await db.get().collection('logIn').insertOne(logEntry);

      res.redirect('/admin/home');

  } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

 

// Example usage




  module.exports = router;
