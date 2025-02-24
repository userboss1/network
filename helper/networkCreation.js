var db=require('../config/connection')
var collection=require('../config/ccollection');
const bcrypt=require("bcrypt");
const { use, response } = require('../app');
const { resolve } = require('promise');
const  ObjectId  = require('mongodb').ObjectId

module.exports={
 
    LoginNet: (userData) => {
        console.log(userData);
        
        let response = {};
        return new Promise(async (resolve, reject) => {
            let user = await db.get().collection('admin').findOne({ 
                network: userData.network, 
                password: userData.password // Direct comparison (Not recommended for security reasons)
            });
    
            if (user) {
                console.log('Login successful');
                response.user = { name: user.name, id: user._id, content: user.content };
                response.status = true;
                resolve(response);
            } else {
                console.log("Login failed");
                resolve({ status: false });
            }
        });
    },
    
    doSignup: (userData) => {
        
        
        return new Promise(async (resolve, reject) => {
            userData.password = await bcrypt.hash(userData.password, 10);

            db.get().collection('files').insertOne(userData).then((data) => {
                resolve(data.insertedId );
            });

        })},
        vivaSumbit: async (userData) => {
            try {
                console.log("Raw userData:", userData);
                
                const { network_name, network_password } = userData;
        
                // Ensure questions are stored as an array
                const questions = Array.isArray(userData["questions[]"]) 
                    ? userData["questions[]"] 
                    : [userData["questions[]"]];
        
                const options = {};
                Object.keys(userData).forEach((key) => {
                    if (key.startsWith("options[")) {
                        const index = key.match(/\d+/)[0]; // Extract question index
                        options[index] = userData[key];
                    }
                });
        
                const correct_answer = {};
                Object.keys(userData).forEach((key) => {
                    if (key.startsWith("correct_answer[")) {
                        const index = key.match(/\d+/)[0];
                        correct_answer[index] = userData[key];
                    }
                });
        
                // Format structured data
                const formattedQuestions = questions.map((q, index) => ({
                    question: q,
                    options: options[index] || [],
                    correct_answer: Number(correct_answer[index])
                }));
        
                // Insert into MongoDB and return the result
                const response = await db.get().collection('qbank').insertOne({
                    network_name,
                    network_password,
                    questions: formattedQuestions
                });
        
                console.log("DB Insert Response:", response);
                return response; // Return the result as a Promise
            } catch (error) {
                console.error("Error inserting quiz data:", error);
                throw error; // Ensure  errors are caught in the calling function
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
        }
    }
//https://chatgpt.com/share/67bb5e4f-02c0-8004-8062-ccbf9c90dbbd