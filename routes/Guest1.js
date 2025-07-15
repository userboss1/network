var express = require('express');
var router = express.Router();
const usersHelpers = require('../helper/guestHelper');
const guestHelper = require('../helper/guestHelper');
const db=require('../config/connection');
const { route } = require('./superadmin');
/* Middleware to check if student is logged in */
function isLoggedIn(req, res, next) {
    if (!req.session.loggedInStudents) {
        return res.redirect('/'); // Redirect to login page if not logged in
    }
    next(); // Proceed if logged in
}
// Authentication middleware to use on protected routes


// Example usage:
// router.get('/viva', authenticateStudent, (req, res) => {
//     // Protected route code here
// });
/* GET login page */
router.get('/',async function(req, res, next) { 
    try { 
        // Get client IP address 
        const clientIP = req.headers['x-forwarded-for'] ||  
            req.connection.remoteAddress ||  
            req.socket.remoteAddress; 
         
        // Clean the client IP 
        const cleanedClientIP = clientIP.split(',')[0].trim(); 
        console.log("Client IP:", cleanedClientIP); 
         
        // Check for loopback address or local network C-class 
        const isLocalIP = cleanedClientIP === '::1' || cleanedClientIP === '127.0.0.1' || cleanedClientIP.startsWith('192.168.'); 
        if (!isLocalIP) { 
            console.log(`IP ${cleanedClientIP} is not allowed for login.`); 
            return res.send("You must login from a machine in the local network."); 
        }

        // First check: If there's an existing session, verify the student still exists in DB
        if (req.session.loggedInStudents && req.session.studentDetails) {
            const studentIP = req.session.studentDetails.pcIP;
            const viva_uid = req.session.studentDetails.viva_uid;
            
            // Verify this student still exists in the database
            const logEntry = await db.get().collection('logIn').findOne({
                viva_uid: viva_uid,
                'students.pcIP': studentIP
            });
            
            if (!logEntry) {
                // Student no longer exists in DB, clear the session
                console.log("Student exists in session but not in DB. Clearing session.");
                req.session.loggedInStudents = false;
                req.session.studentDetails = null;
                // Redirect to login
                return res.render('guest/login');
            } else {
                // Student confirmed still in database, proceed to viva
                return res.redirect('/viva');
            }
        }
         
        // If no active session, try to find the student by IP
        const allLogEntries = await db.get().collection('logIn').find().toArray(); 
         
        // Loop through all log entries to find a student with this IP 
        let foundStudent = null; 
        let logEntry = null; 
         
        for (const entry of allLogEntries) { 
            if (entry.students && Array.isArray(entry.students)) { 
                const student = entry.students.find(s => s.pcIP === cleanedClientIP); 
                if (student) { 
                    foundStudent = student; 
                    logEntry = entry; 
                    break; 
                } 
            } 
        } 
         
        if (foundStudent && logEntry) { 
            // Store student details + networkName in session 
            req.session.loggedInStudents = true; 
            req.session.studentDetails = { 
                duration: logEntry.duration, 
                name: foundStudent.name, 
                roll: foundStudent.roll, 
                register: foundStudent.register, 
                className: logEntry.className, 
                networkName: logEntry.networkName, 
                vivaname: logEntry.vivaname, 
                viva_uid: logEntry.viva_uid, 
                pcIP: foundStudent.pcIP 
            }; 
             
            console.log("Session Data:", req.session.studentDetails); 
            return res.redirect('/viva'); 
        } else { 
            // If no match by IP, render the login form 
            res.render('guest/login'); 
        } 
    } catch (error) { 
        console.error("Error during auto-login:", error); 
        // On error, just render the login form 
        res.render('guest/login'); 
    } 
});
/* POST login - still keep this as fallback */
router.post('/login', async (req, res) => {
    try {
        console.log("Received Login Request:", req.body);
        
        const { uniqueId, roll, register } = req.body;
        
        if (!uniqueId || !roll || !register) {
            return res.status(400).send("All fields are required.");
        }
        
        // Rest of your existing POST login code...
        // This serves as a fallback if the IP-based login doesn't work
        
        // Query without type conversion
        const query = {
            uniqueId: Number(uniqueId),
            students: {
                $elemMatch: {
                    roll: Number(roll),
                    register: Number(register)
                }
            }
        };
        
        const logEntry = await db.get().collection('logIn').findOne(query);
        
        if (logEntry) {
            // Rest of your existing code...
            const matchedStudent = logEntry.students.find(student =>
                student.roll == roll && student.register == register
            );
            
            if (!matchedStudent) {
                return res.send("No student found with these details.");
            }
            
            // Store student details + networkName in session
            req.session.loggedInStudents = true;
            req.session.studentDetails = {
                duration: logEntry.duration,
                name: matchedStudent.name,
                roll: matchedStudent.roll,
                register: matchedStudent.register,
                className: logEntry.className,
                networkName: logEntry.networkName,
                vivaname: logEntry.vivaname,
                viva_uid: logEntry.viva_uid,
                pcIP: matchedStudent.pcIP
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
//  router.get('/attendviva', isLoggedIn, (req, res) => {
//     guestHelper.getQ({
//         network_name: req.session.studentDetails.networkName,
//         viva_uid: req.session.studentDetails.viva_uid // Use viva_uid instead of vivaname
//     })
//     .then((response) => {
//         console.log(response);
//         res.render('guest/viva', { response, student: req.session.studentDetails });
//     })
//     .catch((err) => {
//         console.error("Error fetching questions:", err);
//         res.status(500).send("Error fetching viva questions.");
//     });
// });

router.get('/attend/:viva_uid', async (req, res) => {
    const viva_uid = parseInt(req.params.viva_uid);
    const questions = await db.get().collection('qstatemcq').find({ vivaUID:viva_uid }).toArray();
  
  
    if (!questions.length) return res.send("❌ No questions found.");
  
    res.render('guest/statemcq', { viva_uid, questions });
  });
  
router.get('/attendviva', isLoggedIn, (req, res) => {

    guestHelper.getQ({
        network_name: req.session.studentDetails.networkName,
        viva_uid: req.session.studentDetails.viva_uid
    })
    .then((response) => {
        console.log(JSON.stringify(response));
        
        // Render different views based on which collection the data came from
        if (response.source === 'qbank') {
            console.log("here loged mcq");
            
            res.render('guest/viva', { response: response.data, student: req.session.studentDetails });
        } else if (response.source === 'dqbank') {
            console.log("here loged discro");
            
            res.render('guest/discript', { response: response.data, student: req.session.studentDetails });
        }
        else if (response.source === 'qstatemcq') {
            console.log("here loged state viva");
            
// Fix the rendering - access the first element of the data array
res.render('guest/statemcq', {
    questions: response.data[0].questions,  // Access first element then questions
    response: response.data[0],             // Pass the viva object
    student: req.session.studentDetails 
});        }
    })
    .catch((err) => {
        console.error("Error fetching questions:", err);
        res.status(500).send("Error fetching viva questions.");
    });
});



module.exports = router;
