var express = require("express");
var router = express.Router();
const AdminHelper = require("../helper/networkCreation");
const path = require("path");
const fs = require("fs");
const { log } = require("console");

// Ensure express-session is set up in your main file
// Example: app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: true }));

/* GET users listing. */
router.get("/", function (req, res) {
  res.render("admin/network");
});

// Super Admin Login
router.post('/adminLog', async (req, res) => {
  console.log(req.body);
  
  try {
    let response = await AdminHelper.LoginNet(req.body);

    if (response.status) {
      req.session.loggedIn = true;
      req.session.user = response.user;

      res.render('admin/home', { user: req.session.user });
    } else {
      res.status(401).send("No network available");
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Server error");
  }
});

// Create Network Page
router.get("/create", (req, res) => {
  res.render("admin/create");
});

// Handle File Upload & Signup
router.post("/posting", async (req, res) => {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    let response = await AdminHelper.doSignup(req.body);
    console.log("Signup response:", response);

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
router.get('/viva',(req,res)=>{
  res.render('admin/vivasumbit')
})
router.post('/qsumbit', (req, res) => {
  AdminHelper.vivaSumbit(req.body)
    .then(() => {
      res.send("Form submitted, viva questions added.");
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
          department: userAnswers["user[department]"]
        };
console.log(user);

        // Compare answers (assuming AdminHelper.compare exists)
        const result = await AdminHelper.compare(userAnswers);


        const final={
          name:user.name,
          rollNumb:user.roll,
          department:user.department,
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

router.get('/results',async(req,res)=>{
  try {
    const info = await AdminHelper.returnResult();
    console.log(info);
   res.render('admin/result',{info:info})
} catch (error) {
    res.json({ success: false, message: "Failed to fetch results", error: error });
}
})
module.exports = router;
