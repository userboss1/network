var express = require('express');
var router = express.Router();
const usersHelpers = require('../helper/guestHelper');
const guestHelper = require('../helper/guestHelper');

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
router.post('/login', (req, res) => {
    console.log(req.body);

    usersHelpers.doResource(req.body).then((response) => {
        console.log(response);

        if (response.status) {
            req.session.loggedInStudents = true;
            req.session.studentDetails = response.user; // Ensure correct key
            console.log("Fetched student details:", req.session.studentDetails);
            res.redirect('/viva'); // Redirect to viva page
        } else {
            res.send("No user available, check with admin...");
        }
    }).catch((err) => {
        console.error("Error during login:", err);
        res.status(500).send("Server error");
    });
});

/* GET Viva Page - Requires login */
router.get('/viva', isLoggedIn, (req, res) => {
    res.render('guest/index', { user: req.session.studentDetails });
});

/* GET Attend Viva - Requires login */
router.get('/attendviva', isLoggedIn, (req, res) => {
    if (!req.session.vivaActive) { // Check if viva is active
        return res.send("Viva is not active. Please wait for the admin to start it.");
    }

    guestHelper.getQ().then((response) => {
        console.log(response);
        res.render('guest/viva', { response, student: req.session.studentDetails });
    }).catch((err) => {
        console.error("Error fetching questions:", err);
        res.status(500).send("Error fetching viva questions.");
    });
});

module.exports = router;
