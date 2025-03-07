var express = require('express');
var router = express.Router();
const usersHelpers = require('../helper/guestHelper');
const guestHelper = require('../helper/guestHelper');
const db=require('../config/connection')
/* Middleware to check if student is logged in */
function isLoggedIn(req, res, next) {
    if (!req.session.loggedInStudents) {
        return res.redirect('/'); // Redirect to login page if not logged in
    }
    next(); // Proceed if logged in
}

/* GET login page */
router.get('/', function(req, res, next) {
    res.render('guest/login');
});

/* POST login */

router.post('/login', async (req, res) => {
    try {
        console.log("Received Login Request:", req.body);

        const { name, roll, register } = req.body;

        if (!name || !roll || !register) {
            return res.status(400).send("All fields are required.");
        }

        // Log stored data in the database
        const allEntries = await db.get().collection('logIn').find().toArray();
        console.log("All logIn entries:", JSON.stringify(allEntries, null, 2));

        // Query without type conversion
        const query = {
            students: {
                $elemMatch: {
                    roll: Number(roll),
                    register: Number(register)
                    
                }
            }
        };

        const logEntry = await db.get().collection('logIn').findOne(query);

        console.log("Fetched Student Data:", logEntry);

        if (logEntry) {
            const matchedStudent = logEntry.students.find(student => 
                student.roll == roll && student.register == register
            );

            if (!matchedStudent) {
                return res.send("No student found with these details.");
            }

            // Store student details + networkName in session
            req.session.loggedInStudents = true;
            req.session.studentDetails = { 
                
                name: matchedStudent.name,
                roll: matchedStudent.roll,
                register: matchedStudent.register,
                className: logEntry.className,
                networkName: logEntry.networkName ,
                vivaname:logEntry.vivaname
                // Add networkName
            };

            console.log("Session Data:", req.session.studentDetails);
            return res.redirect('/viva');
        } else {
            res.send("No student found, check with admin.");
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
    }
});

/* GET Viva Page - Requires login */
router.get('/viva', isLoggedIn, (req, res) => {
    res.render('guest/index', { user: req.session.studentDetails });
});

 /* GET Attend Viva - Requires login
 
 ngnog*/
router.get('/attendviva', isLoggedIn, (req, res) => {
  

    guestHelper.getQ(req.session.studentDetails.networkName).then((response) => {
        console.log(response);
        res.render('guest/viva', { response, student: req.session.studentDetails });
    }).catch((err) => {
        console.error("Error fetching questions:", err);
        res.status(500).send("Error fetching viva questions.");
    });
});

module.exports = router;
