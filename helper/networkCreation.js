var db=require('../config/connection')
var collection=require('../config/ccollection');
const bcrypt=require("bcrypt");

const  ObjectId  = require('mongodb').ObjectId

module.exports={
 
    

   
    LoginNet: (userData) => {
        console.log(userData);
        
        let response = {};
        return new Promise(async (resolve, reject) => {
            try {
                let user = await db.get().collection('admin').findOne({ 
                    username: userData.username // Correct field name
                });
    
                if (user) {
                    const match = await bcrypt.compare(userData.password, user.password);
                    
                    if (match) {
                        console.log('Login successful');
                        response.user = { name: user.username, id: user._id };
                        response.status = true;
                        resolve(response);
                    } else {
                        console.log("Incorrect password");
                        resolve({ status: false });
                    }
                } else {
                    console.log("User not found");
                    resolve({ status: false });
                }
            } catch (error) {
                console.error("Login error:", error);
                reject(error);
            }
        })
    },
        
    
    dofile: (userData) => {
       
        
        return new Promise(async (resolve, reject) => {
          
            db.get().collection('files').insertOne(userData).then((data) => {
                resolve(data.insertedId );
            });

        })},
        vivaSubmit: async (userData) => {
            try {
                console.log("Raw userData:", userData);
        
                const { network_name, viva_name, viva_password } = userData;
        
                // Ensure questions are stored as an array
                const questions = Array.isArray(userData["questions[]"])
                    ? userData["questions[]"]
                    : [userData["questions[]"]];
        
                const options = {};
                Object.keys(userData).forEach((key) => {
                    if (key.startsWith("options[")) {
                        const index = key.match(/\d+/)[0]; // Extract question index
                        options[index] = Array.isArray(userData[key]) ? userData[key] : [userData[key]];
                    }
                });
        
                const correct_answer = {};
                Object.keys(userData).forEach((key) => {
                    if (key.startsWith("correct_answer[")) {
                        const index = key.match(/\d+/)[0];
                        correct_answer[index] = Number(userData[key]); // Ensure numeric value
                    }
                });
        
                // Format structured data
                const formattedQuestions = questions.map((q, index) => ({
                    question: q,
                    options: options[index] || [],
                    correct_answer: correct_answer[index]
                }));
        
                // Insert into MongoDB
                const response = await db.get().collection('qbank').insertOne({
                    network_name,
                    viva_name,
                    viva_password,
                    questions: formattedQuestions
                });
        
                console.log("DB Insert Response:", response);
                return response; // Return the result as a Promise
            } catch (error) {
                console.error("Error inserting quiz data:", error);
                throw error; // Ensure errors are caught in the calling function
            }
        }        
        ,
        compare: async (userAnswers) => {
            console.log(userAnswers);
        
            try {
                const quizzes = await db.get().collection('qbank').find().toArray(); // Fetch all quizzes
                let score = 0;
                let results = [];
        
                if (quizzes.length === 0) {
                    console.error("No quizzes found in the database.");
                    return { score: 0, results: [] };
                }
        
                const quiz = quizzes[0]; // Assuming you want to check the first quiz
                quiz.questions.forEach((question, index) => {
                    const correctAnswer = question.options[question.correct_answer]; // Get correct answer text
                    const userAnswer = userAnswers[`answers[${index}]`]; // Get user’s selected answer
        
                    const isCorrect = userAnswer === correctAnswer;
        
                    results.push({ question: question.question, userAnswer, isCorrect });
        
                    if (isCorrect) {
                        score++;
                    }
                });
        
                return { score, results };
            } catch (error) {
                console.error("Error comparing answers:", error);
                return { score: 0, results: [] };
            }
        }
        ,
        final:(data)=>{
return new Promise((resolve,reject)=>{
    db.get().collection("results").insertOne(data).then((response)=>{
        resolve({result1:true})
     })
})
        },
        returnResult:async()=>{
          const  info=await db.get().collection('results').find().toArray()
            return info
        },
        getVivadetails: async (networkName) => {
            try {
               
                // Find Viva where `network_name` matches session user name, return only required fields
                const viva = await db.get().collection('qbank').findOne(
                    { network_name: networkName },
                    { projection: { viva_name: 1, viva_password: 1, _id: 1 } } // Only retrieve viva_name and viva_password
                );
    
                return viva || null; // Return viva details or null if not found
            } catch (error) {
                console.error("Database error:", error);
                return null;
            }
        },
    }
//https://chatgpt.com/share/67bb5e4f-02c0-8004-8062-ccbf9c90dbbd