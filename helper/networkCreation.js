var db=require('../config/connection')
var collection=require('../config/ccollection');
const bcrypt=require("bcrypt");
const { promise } = require('bcrypt/promises');
const { resolve, reject } = require('promise');

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
                
                const { type,
                    network_name,
                    subject_name, 
                    viva_name, 
                    viva_uid,  questions } = userData;
                
                // The questions array is already formatted correctly, no need to reprocess
                
                // Insert into MongoDB
                const response = await db.get().collection('qbank').insertOne({
                    type,
            network_name,
            subject_name, 
            viva_name, 
            viva_uid:parseInt(viva_uid),
                    questions // Use the pre-formatted questions array directly
                });
                
                console.log("DB Insert Response:", response);
                return response;
            } catch (error) {
                console.error("Error inserting quiz data:", error);
                throw error;
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
      

        returnResult: async (viva, admin) => {
            try {
                const results = await db.get().collection('results').find({
                    vivaname: viva,
                    networkName: admin
                }).toArray();
        
                return results; // Returns an empty array if no matching documents are found
            } catch (error) {
                console.error("Error fetching results:", error);
                return [];
            }
        },
        
        getVivaDetailsAndLogs: async (userData) => { 
            try {
                // Step 1: Get user's viva details from both qbank and dqbank collections
                const [qbankVivaList, dqbankVivaList] = await Promise.all([
                    db.get().collection('qbank').find(
                        { user_id: userData.user_id }, // Filter by user_id
                        { projection: { viva_uid: 1, viva_name: 1, subject_name: 1, type: 1, _id: 0 } } // Include type
                    ).toArray(),
                    
                    db.get().collection('dqbank').find(
                        { user_id: userData.user_id }, // Filter by user_id
                        { projection: { viva_uid: 1, viva_name: 1, subject_name: 1, type: 1, _id: 0 } } // Include type
                    ).toArray()
                ]);
                
                // Combine results from both collections
                const vivaDetailsList = [...qbankVivaList, ...dqbankVivaList];
                
                if (!vivaDetailsList.length) { 
                    console.log(`No viva records found for user: ${userData.user_id}`); 
                    return []; 
                } 
        
                // Step 2: Fetch Logs for Each Viva UID
                const results = await Promise.all(vivaDetailsList.map(async (viva) => { 
                    const { viva_uid, viva_name, subject_name, type } = viva; // Include type
        
                    // Fetch logs from `logIn` matching this viva_uid 
                    const logEntries = await db.get().collection('logIn').find({ viva_uid }).toArray(); 
        
                    if (!logEntries.length) return { viva_uid, viva_name, subject_name, type, logs: [] }; 
        
                    // Process Each Log Entry to Extract Class Name & Roll Number Range 
                    const formattedLogs = logEntries.map(log => { 
                        const rollNumbers = log.students.map(student => student.roll); 
                        const minRoll = Math.min(...rollNumbers); 
                        const maxRoll = Math.max(...rollNumbers); 
                        return { 
                            uniqueId: log.uniqueId, 
                            className: log.className,
                            rollRange: `${minRoll}-${maxRoll}` 
                        }; 
                    }); 
        
                    return { 
                        viva_uid, 
                        viva_name,
                        subject_name,
                        type, // Include type in the final result
                        logs: formattedLogs 
                    }; 
                })); 
        
                return results; 
        
            } catch (error) { 
                console.error("Database error:", error); 
                return []; 
            } 
        },
        
        getClasses: () => {
            return new Promise(async (resolve, reject) => {
                try {
                    let classes = await db.get().collection('students').find({}, { projection: { className: 1, students: 1, _id: 0 } }).toArray();
        
                    let classData = classes.map(cls => ({
                        className: cls.className,
                        maxRollNumber: cls.students.length // Get total students as the max roll number
                    }));
        
                    console.log("Class Data:", classData); // Debugging log
                    resolve(classData);
                } catch (error) {
                    console.error("Error fetching class data:", error);
                    reject(error);
                }
            });
        },
       
      
        
                
        RemoveFromLogin: async ({ className, networkName, uniqueId }) => {
            try {
            let    query1={ className:className,
                    networkName:networkName,
                    uniqueId:Number(uniqueId)}
                const response = await db.get().collection('logIn').deleteOne(
                 query1
                );
        console.log(query1);
        
                return { status: true, deletedCount: response.deletedCount };
            } catch (error) {
                console.error("Error deleting document:", error);
                return { status: false, error: error.message };
            }
        },
         DeletViva: (networkName, vivaName) => {
            return new Promise((resolve, reject) => {
                db.get().collection('qbank').deleteOne({ network_name: networkName, viva_name: vivaName })
                    .then(result => {
                        if (result.deletedCount > 0) {
                            resolve("Viva deleted successfully");
                        } else {
                            reject("No matching viva found");
                        }
                    })
                    .catch(error => reject(error));
            });
        },
               
    }
    
//https://chatgpt.com/share/67bb5e4f-02c0-8004-8062-ccbf9c90dbbd