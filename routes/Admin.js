var express = require("express");
var router = express.Router();
const AdminHelper = require("../helper/networkCreation");
const path = require("path");
const fs = require("fs");
const db = require('../config/connection')
const { log } = require("console");
const { Admin } = require("mongodb");
const { route } = require("./superadmin");
const { ObjectId } = require('mongodb');
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
router.get("/home", isAuthenticated, async (req, res) => {
  let user2 = req.session.user
  let vivaDetails = await AdminHelper.getVivaDetailsAndLogs(user2.name);


  console.log("recieved details", JSON.stringify(vivaDetails));
  req.session.vivaDetails = vivaDetails


  res.render("admin/home", { viva: vivaDetails, adminName: req.session.user.name }); // Render home page if logged in
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

// Create Network Page//noyneeded
router.get("/create", isAuthenticated, (req, res) => {



  res.render("admin/create", { user: req.session.user.name });
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
router.get('/viva', isAuthenticated, (req, res) => {
  console.log(req.session.user);

  res.render('admin/button')
})
router.get('/qsumbit', (req, res) => {
  res.render('admin/vivasumbit', { user: req.session.user.name })
})
router.post('/qsumbit', async (req, res) => {
  try {
    console.log("Raw req.body:", req.body);
    console.log("Raw req.files:", req.files);

    const { type, network_name, viva_name, subject_name, viva_uid } = req.body;

    // Initialize arrays to store processed data
    let processedQuestions = [];

    // Find all question keys in the form data
    const questionKeys = Object.keys(req.body).filter(key => key.startsWith('questions['));

    // Process each question
    for (const questionKey of questionKeys) {
      // Extract the question index from the key (e.g., "questions[0]" -> 0)
      const matches = questionKey.match(/questions\[(\d+)\]/);
      if (!matches || !matches[1]) continue;

      const index = matches[1];
      const questionText = req.body[questionKey];

      // Skip if question text is empty
      if (!questionText || !questionText.trim()) continue;

      // Get options for this question
      const optionKeys = Object.keys(req.body).filter(key => key.startsWith(`options[${index}]`));
      const options = [];
      const optionImages = [];

      // Process each option
      for (let i = 0; i < 4; i++) {
        const optionKey = `options[${index}][${i}]`;
        if (req.body[optionKey]) {
          options[i] = req.body[optionKey];
        } else {
          options[i] = ''; // Empty string for missing options
        }

        // Process option image if it exists
        let optionImagePath = null;
        
        if (req.files && req.files[`option_image[${index}][${i}]`]) {
          const file = req.files[`option_image[${index}][${i}]`];

          // Ensure upload folder exists
          const uploadDir = path.join(__dirname, '../public/uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          // Save the file
          const filename = `option-${Date.now()}-${i}-${file.name}`;
          const savePath = path.join(uploadDir, filename);
          await file.mv(savePath);

          // Store the relative path to the image
          optionImagePath = `/uploads/${filename}`;
        }
        
        optionImages[i] = optionImagePath;
      }

      // Get correct answer for this question
      const correctAnswerKey = `correct_answer[${index}]`;
      const correctAnswer = req.body[correctAnswerKey] ? parseInt(req.body[correctAnswerKey]) : 0;

      // Process question image if it exists
      let questionImagePath = null;

      if (req.files && req.files[`question_image[${index}]`]) {
        const file = req.files[`question_image[${index}]`];

        // Ensure upload folder exists
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Save the file
        const filename = `question-${Date.now()}-${file.name}`;
        const savePath = path.join(uploadDir, filename);
        await file.mv(savePath);

        // Store the relative path to the image
        questionImagePath = `/uploads/${filename}`;
      }

      // Add this question to our processed questions array
      processedQuestions.push({
        question: questionText,
        options: options,
        option_images: optionImages,
        correct_answer: correctAnswer,
        image: questionImagePath
      });
    }

    console.log("Processed question data:", processedQuestions);

    // Make sure we have at least one question
    if (processedQuestions.length === 0) {
      return res.status(400).send("No valid questions submitted.");
    }

    // Save in DB
    await AdminHelper.vivaSubmit({
      type,
      network_name,
      subject_name,
      viva_name,
      viva_uid,
      questions: processedQuestions
    });

    res.redirect('/admin/home');
  } catch (error) {
    console.error("Error submitting viva questions:", error);
    res.status(500).send("An error occurred while submitting.");
  }
});
router.get('/discriptive', (req, res) => {
  res.render('admin/disviva', { user: req.session.user.name })
})
router.post('/dqsumbit', async (req, res) => {
  try {
    console.log("Received Data:", req.body); // Debugging step

    // Extract questions from 'questions[]' field
    let questions = req.body['questions[]'];

    // If questions is not an array but exists as a single value, convert it to an array
    if (questions && !Array.isArray(questions)) {
      questions = [questions];
    }

    const { network_name, subject_name, viva_name, viva_uid, type } = req.body;

    // Log the types of received fields


    if (!viva_name || !subject_name || !viva_uid || !questions) {
      console.log("Validation failed - missing fields");
      return res.status(400).send("Invalid data submitted - missing required fields");
    }

    const formattedQuestions = questions.map((q, index) => ({
      questionNumber: index + 1,
      text: q
    }));

    console.log("Formatted Questions:", formattedQuestions);

    await db.get().collection('dqbank').insertOne({
      type,
      network_name,
      subject_name,
      viva_name,
      viva_uid: parseInt(viva_uid),
      questions: formattedQuestions,
      createdAt: new Date()
    });

    res.redirect('/admin/home');
  } catch (error) {
    console.error("Error saving viva:", error);
    res.status(500).send("Internal server error");
  }
});
// Route to get a specific quiz by viva_uid

// Route to handle quiz submissions
router.post('/quiz/submit', async (req, res) => {
  try {
    const { viva_uid, answers } = req.body;
    const userId = req.session.user._id; // Assuming you have user authentication

    // Format the answers
    const formattedAnswers = Object.keys(answers).map(questionNumber => ({
      questionNumber: parseInt(questionNumber),
      answer: answers[questionNumber]
    }));

    // Save the answers to the database
    await db.get().collection('disAnswers').insertOne({
      viva_uid,
      userId,
      answers: formattedAnswers,
      submittedAt: new Date()
    });

    res.redirect('/quiz/thank-you');
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).send("Internal server error");
  }
});
router.post("/result", async (req, res) => {
  console.log(req.body);

  try {
    const userAnswers = req.body;

    const user = {
      viva_uid: userAnswers["user[viva_uid]"],
      name: userAnswers["user[name]"],
      roll: userAnswers["user[roll]"],
      department: userAnswers["user[department]"],
      vivaname: userAnswers["user[vivaname]"],
      networkName: userAnswers["user[networkName]"] // Extracting Teacher Name (NetworkName)
    };

    console.log(user);

    // Compare answers (assuming AdminHelper.compare exists)
    const result = await AdminHelper.compare(userAnswers);

    // Final object to store in database
    const final = {
      viva_uid:parseInt(user.viva_uid),
      name: user.name,
      rollNumb: user.roll,
      department: user.department,
      vivaname: user.vivaname,
      networkName: user.networkName, // Storing Teacher Name
      result: result
    };

    // Store the final result
    AdminHelper.final(final).then((result) => {
      if (result.result1) {
        res.render('admin/vivasuccess')
      } else {
        res.json({ success: false, message: "Couldn't upload the result to database" });
      }
    });

  } catch (error) {
    console.error("Error processing quiz results:", error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

router.get('/result', isAuthenticated, async (req, res) => {
  try {
    const { viva_uid, network_name } = req.query;
   

    // Get results from your helper
    const info = await AdminHelper.returnResult(viva_uid,network_name);

    // Make sure info is an array
    const resultsArray = Array.isArray(info) ? info : [info];

    // Sanitize data to ensure all expected properties exist
    const sanitizedResults = resultsArray.map(item => ({
      _id: item._id || '',
      name: item.name || 'Unknown',
      rollNumb: item.rollNumb || item.roll || '',
      department: item.department || 'Uncategorized',
      vivaname: item.vivaname || 'Unknown Viva',
      networkName: item.networkName || '',
      result: {
        score: item.result && item.result.score !== undefined ? item.result.score : 'N/A',
        results: item.result && item.result.results ? item.result.results : []
      }
    }));
    console.log("sanitise" + sanitizedResults);

    // Render the view with data
    // Server-side: Stringify the data before passing to template
    res.render('admin/result', {
      info: JSON.stringify(sanitizedResults)
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.json({ success: false, message: "Failed to fetch results", error: error.toString() });
  }
});

router.get('/assign', (req, res) => {
  const viva_uid = parseInt(req.query.viva); // Get viva name from query parameters

  if (!viva_uid) {
    return res.status(400).send("Viva name is missing");
  }

  // Fetch lab data
  AdminHelper.getPc().then((pcResponse) => {
    console.log("PC is list:", JSON.stringify(pcResponse));

    // Fetch class data
    AdminHelper.getClasses().then((classResponse) => {
      console.log("Class Data:", classResponse);

      // Assuming pcResponse contains labName
      const labData = pcResponse.map(item => ({ labName: item.labName }));

      // Render the view, passing both viva_uid, classData, and labData
      res.render('admin/select', { 
        classData: classResponse, 
        viva_uid, 
        labData 
      });
    }).catch(error => {
      console.error("Error fetching class data:", error);
      res.status(500).send("Error fetching class data");
    });

  }).catch(error => {
    console.error("Error fetching PC data:", error);
    res.status(500).send("Error fetching PC data");
  });
});




//ake sure this points to your MongoDB connection

// router.post('/logIn', async (req, res) => {
//   console.log("Session Viva Details:", req.session.vivaDetails);

//   try {
//       const { viva_uid,className, rollStart, rollEnd,uniqueId } = req.body;
//       const userName = req.session.user?.name;
//       const vivaName = req.session.vivaSpecificname?.viva_name; // Retrieve viva name from session

//       if (!vivaName) {
//           return res.status(400).json({ success: false, message: "Viva name is missing in session" });
//       }

//       if (!className || !userName || !rollStart || !rollEnd) {
//           return res.status(400).json({ success: false, message: "Missing required fields" });
//       }

//       const minRoll = parseInt(rollStart, 10);
//       const maxRoll = parseInt(rollEnd, 10);

//       if (isNaN(minRoll) || isNaN(maxRoll) || minRoll > maxRoll || minRoll < 1) {
//           return res.status(400).json({ success: false, message: "Invalid roll number range" });
//       }

//       const studentData = await db.get().collection('students').findOne({ className });

//       if (!studentData || !studentData.students) {
//           return res.status(404).json({ success: false, message: "Class not found or no students available" });
//       }

//       const selectedStudents = studentData.students.filter(student => {
//           return student.roll >= minRoll && student.roll <= maxRoll;
//       });

//       if (selectedStudents.length === 0) {
//           return res.status(400).json({ success: false, message: "No students found in the selected range" });
//       }

//       const logEntry = {
//         uniqueId:Number(uniqueId),
//           vivaname: vivaName,  // Store viva name from session
//           className: studentData.className,
//           networkName: userName,
//           students: selectedStudents,
//           loginTime: new Date(),
//       };

//       await db.get().collection('logIn').insertOne(logEntry);

//       res.redirect('/admin/home');

//   } catch (error) {
//       console.error("Error during login:", error);
//       res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// });

router.post('/logIn', async (req, res) => {
  try {
    const { viva_uid, className, rollStart, rollEnd, uniqueId, duration, labName } = req.body;
    const userName = req.session.user?.name;
    
    // Validate basic inputs
    if (!className || !userName || !rollStart || !rollEnd || !viva_uid || !labName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    // Check if the lab is already assigned in the logIn collection
    const existingLabAssignment = await db.get().collection('logIn').findOne({ labName });
    
    if (existingLabAssignment) {
      return res.status(400).json({ 
        success: false, 
        message: `This lab (${labName}) is already assigned. Please remove the previous assignment first check with superadmin  :)` 
      });
    }
    
    // Parse and validate roll number range
    const minRoll = parseInt(rollStart, 10);
    const maxRoll = parseInt(rollEnd, 10);
    
    if (isNaN(minRoll) || isNaN(maxRoll) || minRoll > maxRoll || minRoll < 1) {
      return res.status(400).json({ success: false, message: "Invalid roll number range" });
    }
    
    // Get viva details from qbank or dqbank based on viva_uid
    let vivaDetails = null;
    
    // Check qbank collection first
    vivaDetails = await db.get().collection('qbank').findOne({ viva_uid: Number(viva_uid) });
    
    // If not found in qbank, check dqbank
    if (!vivaDetails) {
      vivaDetails = await db.get().collection('dqbank').findOne({ viva_uid: Number(viva_uid) });
    }
    
    // If viva details not found in either collection
    if (!vivaDetails) {
      return res.status(404).json({ success: false, message: "Viva not found with the provided ID" });
    }
    
    const vivaName = vivaDetails.viva_name;
    const vivaType = vivaDetails.type;
    
    // Get student data
    const studentData = await db.get().collection('students').findOne({ className });
    
    if (!studentData || !studentData.students) {
      return res.status(404).json({ success: false, message: "Class not found or no students available" });
    }
    
    // Filter students by roll number range
    const selectedStudents = studentData.students.filter(student => {
      return student.roll >= minRoll && student.roll <= maxRoll;
    });
    
    if (selectedStudents.length === 0) {
      return res.status(400).json({ success: false, message: "No students found in the selected range" });
    }
    
    // Get PC data for the selected lab
    const labData = await db.get().collection('pc').findOne({ labName });
    const pcList = labData?.pcs || [];
    
    // Assign PCs to students
    const studentsWithPCs = selectedStudents.map((student, index) => {
      // If there are enough PCs in the lab
      if (index < pcList.length) {
        return {
          ...student,
          pcNumber: pcList[index].pcNumber,
          pcIP: pcList[index].ip
        };
      } else {
        // If there are not enough PCs, assign "No PC assigned"
        return {
          ...student,
          pcNumber: "No PC assigned",
          pcIP: "No PC assigned"
        };
      }
    });
    
    // Create log entry
    const logEntry = {
      uniqueId: Number(uniqueId),
      vivaname: vivaName,
      viva_uid: Number(viva_uid),
      type: vivaType,
      duration: parseInt(duration),
      className: studentData.className,
      labName: labName, // Add lab name to the log
      networkName: userName,
      students: studentsWithPCs, // Use students with PC assignments
      loginTime: new Date(),
    };
    
    // Insert log entry into the database
    await db.get().collection('logIn').insertOne(logEntry);
    
    res.redirect('/admin/home');
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
// Example usage
router.get('/remove-class', async (req, res) => {
  const { admin, class: className, range, uniqueId } = req.query;
  console.log(`Removing: ${admin}, ${className}, ${range},${uniqueId}`);

  let something = await AdminHelper.RemoveFromLogin({ className, range, uniqueId: uniqueId, networkName: admin });
  console.log("failed to remove " + JSON.stringify(something));

  res.redirect('/Admin/home'); // Redirect back to the dashboard
});
// //{
//   "vivaname": "viva 2",
//   "viva_uid": 8568,
//   "className": "computer che",
//   "networkName": "kabeer",
//   "students": [
//     { 
//       "name": "hellodsd", 
//       "roll": 1, 
//       "register": 1,
//       "pcNumber": 1,
//       "pcIp": "12"
//     },
//     { 
//       "name": "sadhilj", 
//       "roll": 2, 
//       "register": 2,
//       "pcNumber": 1,
//       "pcIp": "2"
//     },
//     // ... and so on
//   ],
//   "assignedAt": ISODate("2024-03-25T...")
// }
// Add this route to your 

// Add this route to your admin router file
router.get('/studentpc', async (req, res) => {
  try {
    const { uniqueId,logId } = req.query;
    const numericUniqueId = Number(uniqueId); // Convert to number
    const  loguid=Number(logId)
    console.log(numericUniqueId+loguid);
    const loginDetails = await db.get().collection('logIn').findOne({
      viva_uid: numericUniqueId,
      uniqueId:loguid
    });
    
    if (!loginDetails) {
      return res.status(404).render('error', { 
        message: "Assignment data not found" 
      });
    }
    
    // Process student data to add isAssigned flag
    const processedStudents = loginDetails.students.map(student => {
      // Check if PC is assigned (not "No PC assigned" and not null/undefined)
      const isAssigned = student.pcNumber && 
                         student.pcNumber !== "No PC assigned" && 
                         student.pcIP && 
                         student.pcIP !== "No PC assigned";
      
      return {
        ...student,
        isAssigned: isAssigned
      };
    });
    
    // Update the students in loginDetails
    loginDetails.students = processedStudents;
    
    // Calculate assigned and waiting counts
    const assignedCount = processedStudents.filter(student => student.isAssigned).length;
    const waitingCount = processedStudents.length - assignedCount;
    
    // Format date for display
    const formattedDate = new Date(loginDetails.loginTime).toLocaleString();
    
    // Render the template with data
    res.render('admin/infopc', {
      title: "Student PC Assignments",
      loginDetails: loginDetails,
      assignedCount: assignedCount,
      waitingCount: waitingCount,
      formattedDate: formattedDate
    });
    
  } catch (error) {
    console.error("Error fetching PC assignment info:", error);
    res.status(500).render('error', { 
      message: "Server error while fetching PC assignment information" 
    });
  }
});
router.get('/editViva', async (req, res) => {
  try {
    const { viva, admin } = req.query;
    console.log("Editing Viva:", viva, admin);

    // Validate input parameters
    if (!viva || !admin) {
      return res.status(400).send("Missing viva name or admin name");
    }

    const dbInstance = db.get();

    // Search for viva in both collections
    const qbankMatch = await dbInstance.collection('qbank').findOne({
      viva_uid: parseInt(viva),
      network_name: admin
    });

    const dqbankMatch = await dbInstance.collection('dqbank').findOne({
      viva_uid: parseInt(viva),
      network_name: admin
    });

    let existingViva, template;

    if (qbankMatch) {
      existingViva = qbankMatch;
      template = 'admin/editViva'; // Render editViva.hbs if from qbank
    } else if (dqbankMatch) {
      existingViva = dqbankMatch;
      template = 'admin/DeditViva'; // Render DeditViva.hbs if from dqbank
    } else {
      return res.status(404).send("Viva not found!");
    }

    // Normalize image paths for display
    if (existingViva.questions && Array.isArray(existingViva.questions)) {
      existingViva.questions.forEach(question => {
        if (question.image && !question.image.startsWith('/uploads') && !question.image.startsWith('http')) {
          question.image = `/uploads/${question.image}`;
        }
      });
    } else {
      existingViva.questions = []; // Ensure questions is an array
    }

    // Pass the data to the selected template
    res.render(template, {
      viva: existingViva,
      vivaDataJSON: JSON.stringify(existingViva), // For safe JavaScript access
      user: admin
    });

  } catch (error) {
    console.error("Error fetching viva for edit:", error);
    res.status(500).send("Error retrieving viva: " + error.message);
  }
});

router.post('/dupdateViva', async (req, res) => {
  try {
    const { viva_uid, network_name, questions } = req.body; // Extract form data
    console.log("Updating Viva:", viva_uid, network_name);

    if (!viva_uid || !network_name) {
      return res.status(400).send("Missing viva ID or network name.");
    }

    const dbInstance = db.get(); // Get DB instance

    // Find the existing viva
    let existingViva = await dbInstance.collection('dqbank').findOne({
      viva_uid: parseInt(viva_uid),
      network_name: network_name
    });

    if (!existingViva) {
      return res.status(404).send("Viva not found.");
    }

    // Convert questions to proper format
    const updatedQuestions = JSON.parse(questions).map((q, index) => ({
      questionNumber: index + 1,
      text: q.text
    }));

    // Update the viva in the database
    await dbInstance.collection('dqbank').updateOne(
      { viva_uid: parseInt(viva_uid), network_name: network_name },
      { $set: { questions: updatedQuestions, updatedAt: new Date() } }
    );

    console.log("Viva updated successfully:", viva_uid);
    res.redirect('/Admin/Home')
  } catch (error) {
    console.error("Error updating viva:", error);
    res.status(500).send("Error updating viva.");
  }
});




  router.post('/updateViva', async (req, res) => {
    try {
      console.log("==== FORM DATA DEBUG ====");
      console.log("Request body:", req.body);
      console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

      const { viva_id, network_name, viva_name,  } = req.body;

      console.log("Updating viva with ID:", viva_id);

      if (!viva_id || !network_name || !viva_name ) {
        return res.status(400).send("Missing required fields");
      }

      // Fetch existing viva data
      const existingViva = await db.get().collection('qbank').findOne({ _id: new ObjectId(viva_id) });

      if (!existingViva) {
        return res.status(404).send("Viva not found");
      }

      // Create a map of existing questions for easy lookup
      const existingQuestionsMap = {};
      if (existingViva.questions && Array.isArray(existingViva.questions)) {
        existingViva.questions.forEach((question, idx) => {
          existingQuestionsMap[idx] = question;
        });
      }

      // Extract question data from form fields
      const questionsData = {};
      const optionsData = {};
      const correctAnswerData = {};
      const existingImageData = {};

      // Process existing_image fields first
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('existing_image[')) {
          const matches = key.match(/existing_image\[(\d+)\]/);
          if (matches && matches[1]) {
            const index = matches[1];
            existingImageData[index] = req.body[key];
          }
        }
      });

      console.log("Existing image data:", existingImageData);

      // Process other fields
      Object.keys(req.body).forEach(key => {
        // Extract question data
        if (key.startsWith('questions[')) {
          const indexMatch = key.match(/questions\[(\d+)\]/);
          if (indexMatch && indexMatch[1]) {
            const index = indexMatch[1];
            questionsData[index] = req.body[key];
          }
        }

        // Extract options data
        if (key.startsWith('options[')) {
          const matches = key.match(/options\[(\d+)\]\[(\d+)\]/);
          if (matches && matches[1] && matches[2]) {
            const qIndex = matches[1];
            const optIndex = matches[2];

            if (!optionsData[qIndex]) {
              optionsData[qIndex] = [];
            }

            optionsData[qIndex][optIndex] = req.body[key];
          }
        }

        // Extract correct answer data
        if (key.startsWith('correct_answer[')) {
          const indexMatch = key.match(/correct_answer\[(\d+)\]/);
          if (indexMatch && indexMatch[1]) {
            const index = indexMatch[1];
            correctAnswerData[index] = parseInt(req.body[key]);
          }
        }
      });

      console.log("Parsed questions data:", questionsData);
      console.log("Parsed options data:", optionsData);
      console.log("Parsed correct answers:", correctAnswerData);

      // Prepare updated questions array
      const updatedQuestions = [];
      // Track old images that should be deleted
      const imagesToDelete = [];

      // Process all question indices
      const questionIndices = Object.keys(questionsData);

      for (const index of questionIndices) {
        // Skip empty questions
        if (!questionsData[index] || questionsData[index].trim() === '') {
          continue;
        }

        // Prepare question object
        const questionObj = {
          question: questionsData[index],
          options: optionsData[index] || ['', '', '', ''],
          correct_answer: correctAnswerData[index] || 0
        };

        // Get the original image path if it exists
        const originalImagePath = existingQuestionsMap[index]?.image;

        // Process image:
        // 1. First check if there's a new image upload
        if (req.files && req.files[`question_image[${index}]`]) {
          const file = req.files[`question_image[${index}]`];
          const timestamp = Date.now();
          const filename = `${timestamp}-${file.name}`;
          const uploadPath = path.join(__dirname, '../public/uploads/', filename);

          await file.mv(uploadPath);
          questionObj.image = `/uploads/${filename}`;
          console.log(`New image uploaded for question ${index}: ${questionObj.image}`);

          // If there was an original image, mark it for deletion
          if (originalImagePath) {
            imagesToDelete.push(originalImagePath);
            console.log(`Marking old image for deletion: ${originalImagePath}`);
          }
        }
        // 2. Then check if there's an existing image from the form
        else if (existingImageData[index]) {
          questionObj.image = existingImageData[index];
          console.log(`Using existing image from form for question ${index}: ${questionObj.image}`);
        }
        // 3. Finally check if there was an image in the original data
        else if (originalImagePath) {
          questionObj.image = originalImagePath;
          console.log(`Preserving original image for question ${index}: ${questionObj.image}`);
        }

        updatedQuestions.push(questionObj);
      }

      console.log("Final Questions Count:", updatedQuestions.length);
      console.log("First question sample:", updatedQuestions.length > 0 ? JSON.stringify(updatedQuestions[0]) : "No questions");
      console.log("Images to delete:", imagesToDelete);

      // Delete old images that were replaced
      for (const imagePath of imagesToDelete) {
        try {
          // Remove the leading slash to get the correct path relative to public folder
          const relativePath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
          const fullPath = path.join(__dirname, '../public/', relativePath);

          // Check if file exists before attempting to delete
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`Successfully deleted old image: ${fullPath}`);
          } else {
            console.log(`File not found, couldn't delete: ${fullPath}`);
          }
        } catch (deleteError) {
          console.error(`Error deleting image ${imagePath}:`, deleteError);
          // Continue execution even if image deletion fails
        }
      }

      // Update the database
      const updateData = {
        network_name,
        viva_name,   
        questions: updatedQuestions,
      };

      const result = await db.get().collection('qbank').updateOne(
        { _id: new ObjectId(viva_id) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).send("Viva not found");
      }

      console.log(`Successfully updated viva: ${viva_name}`);
      res.redirect('/Admin/home');
    } catch (error) {
      console.error("Error updating viva:", error);
      res.status(500).send("Error updating viva: " + error.message);
    }
  });
// In your router.js file
// First, add this debugging code at the beginning of your updateViva route
// to see exactly what's coming in the request:
router.get('/delete-viva', (req, res) => {
  const networkName = req.query.admin;
  const vivaName = req.query.viva;
  console.log(`Deleting viva: ${vivaName} from network: ${networkName}`);

  AdminHelper.DeletViva(networkName, parseInt(vivaName))
    .then(() => res.redirect('/Admin/home'))
    .catch(err => {
      console.error("Error deleting viva:", err);
      res.status(500).send("Failed to delete viva");
    });
});



// Assuming db is your MongoDB connection object
// Example MongoDB setup (uncomment and adjust if needed):
/*
const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/yourDatabase';
let db;

MongoClient.connect(uri, { useUnifiedTopology: true })
    .then(client => {
        db = client.db('yourDatabase');
        console.log('Connected to MongoDB');
    })
    .catch(err => console.error('Failed to connect to MongoDB:', err));
*/

// POST endpoint for /Admin/disubmit
router.post('/disubmit', async (req, res) => {
  try {
      console.log('Received data:', req.body); // Debugging

      const {
          network_name,
          subject_name,
          viva_name,
          student_name,
          student_roll,
          student_register,
          class_name,
          teacher_name,
          viva_uid,
          duration
      } = req.body;

      // Validate required fields
      if (!viva_uid || !student_name) {
          return res.status(400).json({
              success: false,
              message: 'Missing required fields: viva_uid or student_name'
          });
      }

      // Extract and structure answers
      const answers = Object.keys(req.body)
          .filter(key => key.startsWith('answers['))
          .map(key => {
              const index = key.match(/\d+/)[0]; // Extract index number
              return {
                  questionId: req.body[`questionIds[${index}]`] || index, // Use questionId if available, else fallback
                  text: req.body[key] || ''
              };
          });

      console.log('Parsed Answers:', answers);

      // Prepare the document to save (flattened structure)
      const resultDocument = {
          networkName: network_name || '',
          subjectName: subject_name || '',
          vivaName: viva_name || '',
          studentName: student_name, 
          studentRoll: student_roll || '',
          studentRegister: student_register || '',
          className: class_name || '',
          teacherName: teacher_name || '',
          vivaUid: viva_uid,
          duration: parseInt(duration) || 0,
          answers,  // Directly store the array of answers
          submittedAt: new Date(),
          status: 'submitted'
      };

      // Insert into MongoDB
      const collection = db.get().collection('dresult');
      const insertResult = await collection.insertOne(resultDocument);

      // Render success page or return JSON
      if (insertResult.insertedId) {
        req.session.studentDetails=null;

          res.render('admin/vivasuccess');
      } else {
          throw new Error('Failed to insert document');
      }

  } catch (error) {
      console.error('Error in /Admin/disubmit:', error);
      return res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: error.message
      });
  }
});



// Assuming db is your MongoDB connection object

// GET endpoint to retrieve results grouped by className and student


// Assuming db is your MongoDB connection object

// GET endpoint to retrieve results and render disresult.hbs
router.get('/dresult', async (req, res) => {
  try {
      const { vivaUid, networkName } = req.query;

      if (!vivaUid || !networkName) {
          return res.status(400).render('error', { 
              message: 'Both vivaUid and networkName are required' 
          });
      }

      const collection = db.get().collection('dresult');

      const results = await collection.aggregate([
        // Match specific vivaUid and networkName
        { 
            $match: { 
                vivaUid: vivaUid, 
                networkName: networkName 
            } 
        },
        // Group by className to organize data properly
        {
            $group: {
                _id: "$className",
                students: {
                    $push: {
                        name: "$studentName",
                        roll: "$studentRoll",
                        register: "$studentRegister",
                        answers: "$answers",
                        submittedAt: "$submittedAt",
                        subjectName: "$subjectName",
                        vivaName: "$vivaName",
                        duration: "$duration"
                    }
                }
            }
        },
        // Project the final output
        { 
            $project: { 
                className: "$_id", 
                students: 1, 
                _id: 0 
            } 
        }
    ]).toArray();
    

      console.log('Aggregation Results:', JSON.stringify(results, null, 2));

      if (results.length === 0) {
          return res.render('admin/disresult', {
              vivaUid,
              networkName,
              classes: [],
              message: 'No results found for the specified vivaUid and networkName'
          });
      }

      // Render the template with the processed results
      res.render('admin/disresult', {
          vivaUid,
          networkName,
          classes: results
      });

  } catch (error) {
      console.error('Error in /Admin/dresult/by-class:', error);
      res.status(500).render('error', { message: 'Internal server error' });
  }
});

// Route to display the scoring page
router.get('/score-viva', async (req, res) => {
  try {
      const { vivaUid, networkName } = req.query;
      
      if (!vivaUid || !networkName) {
          return res.status(400).render('error', {
              message: 'Both vivaUid and networkName are required'
          });
      }
      
      const collection = db.get().collection('dresult');
      
      const results = await collection.aggregate([
          // Match specific vivaUid and networkName
          {
              $match: {
                  vivaUid: vivaUid,
                  networkName: networkName
              }
          },
          // Group by className to organize data properly
          {
              $group: {
                  _id: "$className",
                  students: {
                      $push: {
                          name: "$studentName",
                          roll: "$studentRoll",
                          register: "$studentRegister",
                          answers: "$answers",
                          submittedAt: "$submittedAt",
                          subjectName: "$subjectName",
                          vivaName: "$vivaName",
                          duration: "$duration"
                      }
                  }
              }
          },
          // Project the final output
          {
              $project: {
                  className: "$_id",
                  students: 1,
                  _id: 0
              }
          }
      ]).toArray();
      
      console.log('Aggregation Results:', JSON.stringify(results, null, 2));
      
      if (results.length === 0) {
          return res.render('admin/score-viva', {
              vivaUid,
              networkName,
              classes: [],
              message: 'No results found for the specified vivaUid and networkName'
          });
      }
      
      // Check if students already have scores in validatedResults collection
      const validatedCollection = db.get().collection('validatedResults');
      
      // Get all student rolls from the results
      const allStudentRolls = results.flatMap(cls => 
          cls.students.map(student => student.roll)
      );
      
      // Find existing validated scores
      const existingScores = await validatedCollection.find({
          vivaUid: vivaUid,
          networkName: networkName,
          studentRoll: { $in: allStudentRolls }
      }).toArray();
      
      // Create a map of existing scores by student roll
      const scoresByRoll = {};
      existingScores.forEach(item => {
          scoresByRoll[item.studentRoll] = item.scores;
      });
      
      // Merge existing scores into the results data
      results.forEach(cls => {
          cls.students.forEach(student => {
              if (scoresByRoll[student.roll]) {
                  // Add existing scores to each answer
                  student.answers.forEach((answer, index) => {
                      const existingScore = scoresByRoll[student.roll].find(
                          s => s.questionId === answer.questionId
                      );
                      
                      if (existingScore) {
                          answer.score = existingScore.score;
                          answer.comment = existingScore.comment;
                      }
                  });
              }
          });
      });
      
      // Render the template with the processed results
      res.render('admin/score-viva', {
          vivaUid,
          networkName,
          classes: results
      });
      
  } catch (error) {
      console.error('Error in /score-viva:', error);
      res.status(500).render('error', { message: 'Internal server error' });
  }
});

// Route to handle score submission
router.post('/submit-scores', async (req, res) => {
  try {
      console.log('Received request body:', req.body);
      
      // Extract URL parameters from the referrer if available
      const referrer = req.headers.referer || '';
      const urlParams = new URL(referrer).searchParams;
      
      // Extract values with fallbacks (form data, then URL params, then default)
      const vivaUid = req.body.vivaUid || urlParams.get('vivaUid') || '';
      const networkName = req.body.networkName || urlParams.get('networkName') || '';
      const className = req.body.className ||  urlParams.get('className') || '';
      const studentName = req.body.studentName || '';
      const studentRoll = req.body.studentRoll || '';
      const studentRegister = req.body.studentRegister || '';
      const subjectName = req.body.subjectName || '';
      const vivaName = req.body.vivaName || '';
      
      // Check if we have the minimum required field
      if (!studentRoll) {
          return res.status(400).json({ 
              success: false, 
              message: 'Student roll number is required' 
          });
      }
      
      // Process scores
      let scores = [];
      let index = 0;
      
      // Keep looking for scores as long as we find score fields
      while (req.body[`scores[${index}][score]`] !== undefined) {
          scores.push({
              questionId: req.body[`scores[${index}][questionId]`] || `question${index+1}`,
              score: req.body[`scores[${index}][score]`] || "0",
              comment: req.body[`scores[${index}][comment]`] || ""
          });
          index++;
      }
      
      console.log('Processed scores:', scores);
      
      // Validate that we have scores
      if (!scores || scores.length === 0) {
          return res.status(400).json({ 
              success: false, 
              message: 'No score data found in request' 
          });
      }
      
      // Calculate total score
      let totalScore = 0;
      scores.forEach(score => {
          totalScore += parseInt(score.score) || 0;
      });
      
      // Prepare document for insertion/update
      const scoreDocument = {
          vivaUid,
          networkName,
          className,
          studentName,
          studentRoll,
          studentRegister,
          subjectName,
          vivaName,
          scores,
          totalScore,
          validatedAt: new Date(),
          validatedBy: req.session.user ? req.session.user.name : 'Unknown'
      };
      
      console.log('Score document to be saved:', scoreDocument);
      
      // Create a query that uses available fields for identifying the document
      const query = { studentRoll };
      if (vivaUid) query.vivaUid = vivaUid;
      if (networkName) query.networkName = networkName;
      
      // Insert or update in validatedResults collection
      const collection = db.get().collection('validatedResults');
      
      await collection.updateOne(
          query,
          { $set: scoreDocument },
          { upsert: true }
      );
      
      res.json({ success: true, message: 'Scores submitted successfully' });
      
  } catch (error) {
      console.error('Error in /submit-scores:', error);
      res.status(500).json({ 
          success: false, 
          message: 'Error submitting scores', 
          error: error.message 
      });
  }
});
// routes/validatedResults.js


// Route to fetch all validated results and render filterable page
router.get('/ddresult', async (req, res) => {
  try {
    const { vivaUid, networkName } = req.query; // Changed from req.body to req.query

    // Fetch all validated results
    const validatedResults = await db.get().collection('validatedResults')
      .find({ vivaUid: String(vivaUid), networkName })
      .toArray();

    if (!validatedResults || validatedResults.length === 0) {
      console.log("No validated results found.");
      return res.render('Admin/dfinalscore', {
        results: [],
        classNames: [],
        hasResults: false
      });
    }

    // ✅ Fix: This line was inside the if block and unreachable
    const classNames = [...new Set(validatedResults.map(result => result.className))];

    res.render('Admin/dfinalscore', { 
      results: validatedResults,
      classNames,
      hasResults: true
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).render('error', { 
      message: 'Failed to fetch results',
      error
    });
  }
});

module.exports = router;
