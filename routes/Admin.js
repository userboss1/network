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

      // Process each option
      for (let i = 0; i < 4; i++) {
        const optionKey = `options[${index}][${i}]`;
        if (req.body[optionKey]) {
          options[i] = req.body[optionKey];
        } else {
          options[i] = ''; // Empty string for missing options
        }
      }

      // Get correct answer for this question
      const correctAnswerKey = `correct_answer[${index}]`;
      const correctAnswer = req.body[correctAnswerKey] ? parseInt(req.body[correctAnswerKey]) : 0;

      // Process image if it exists
      let imagePath = null;

      if (req.files && req.files[`question_image[${index}]`]) {
        const file = req.files[`question_image[${index}]`];

        // Ensure upload folder exists
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Save the file
        const filename = `${Date.now()}-${file.name}`;
        const savePath = path.join(uploadDir, filename);
        await file.mv(savePath);

        // Store the relative path to the image
        imagePath = `/uploads/${filename}`;
      }

      // Add this question to our processed questions array
      processedQuestions.push({
        question: questionText,
        options: options,
        correct_answer: correctAnswer,
        image: imagePath
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

router.get('/results', isAuthenticated, async (req, res) => {
  try {
    const { viva, admin } = req.query;
    console.log(viva, admin);

    // Get results from your helper
    const info = await AdminHelper.returnResult(viva, admin);

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

  // Store in session
  // req.session.vivaSpecificname = { viva_uid: vivaName };

  // Fetch class data
  AdminHelper.getClasses().then((response) => {
    console.log("Class Data:", response);
    res.render('admin/select', { classData: response, viva_uid });
  });
});
router.post('/dsubmit', async (req, res) => {
  try {
      const { viva_uid, answers } = req.body;
      const userId = req.session.user._id; // Assuming you have user authentication
      
      // Format the answers
      const formattedAnswers = Object.keys(answers).map(questionNumber => ({
          questionNumber: parseInt(questionNumber),
          answer: answers[questionNumber]
      }));
      
      // Save the answers to the database
      await db.get().quizAnswers.insertOne({
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
    const { viva_uid, className, rollStart, rollEnd, uniqueId, duration } = req.body;
    const userName = req.session.user?.name;

    // Validate basic inputs
    if (!className || !userName || !rollStart || !rollEnd || !viva_uid) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
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

    // Create log entry
    const logEntry = {
      uniqueId: Number(uniqueId),
      vivaname: vivaName,
      viva_uid: Number(viva_uid),
      type: vivaType,
      duration: parseInt(duration), // Add the duration field from req.body
      className: studentData.className,
      networkName: userName,
      students: selectedStudents,
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

    // Use the first match found
    const existingViva = qbankMatch || dqbankMatch;

    if (!existingViva) {
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

    // Pass the data to the template
    res.render('admin/editViva', {
      viva: existingViva,
      vivaDataJSON: JSON.stringify(existingViva), // For safe JavaScript access
      user: admin
    });

  } catch (error) {
    console.error("Error fetching viva for edit:", error);
    res.status(500).send("Error retrieving viva: " + error.message);
  }
});



  router.post('/updateViva', async (req, res) => {
    try {
      console.log("==== FORM DATA DEBUG ====");
      console.log("Request body:", req.body);
      console.log("Request files:", req.files ? Object.keys(req.files) : "No files");

      const { viva_id, network_name, viva_name, viva_password } = req.body;

      console.log("Updating viva with ID:", viva_id);

      if (!viva_id || !network_name || !viva_name || !viva_password) {
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
        viva_password,
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

  AdminHelper.DeletViva(networkName, vivaName)
    .then(() => res.redirect('/Admin/home'))
    .catch(err => {
      console.error("Error deleting viva:", err);
      res.status(500).send("Failed to delete viva");
    });
});



module.exports = router;
