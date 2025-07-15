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
        compare: async (userAnswers,id) => {
            console.log(userAnswers);

        
            try {
                const quizzes = await db.get().collection('qbank').find({viva_uid:parseInt(id)}).toArray() // Fetch all quizzes
               console.log(quizzes+"gg");
               
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
      

        returnResult: async (viva_uid, admin) => {
            console.log(viva_uid,admin+"sknak");
            
            try {
                const results = await db.get().collection('results').find({
                    viva_uid: parseInt(viva_uid),
                    networkName: admin
                }).toArray();
        console.log("this is reuslt"+results);
        
                return results; // Returns an empty array if no matching documents are found
            } catch (error) {
                console.error("Error fetching results:", error);
                return [];
            }
        },
        
getVivaDetailsAndLogs: async (userData) => {
    try {
        console.log("useenMEEE", userData);

        // Step 1: Get user's viva details from qbank, dqbank, and qstatemcq collections
        const [qbankVivaList, dqbankVivaList, qstatemcqVivaList] = await Promise.all([
            db.get().collection('qbank').find(
                { network_name: userData },
                { projection: { viva_uid: 1, viva_name: 1, subject_name: 1, type: 1, _id: 0 } }
            ).toArray(),

            db.get().collection('dqbank').find(
                { network_name: userData },
                { projection: { viva_uid: 1, viva_name: 1, subject_name: 1, type: 1, _id: 0 } }
            ).toArray(),

            db.get().collection('qstatemcq').find(
                { network_name: userData },
                { projection: { viva_uid: 1, viva_name: 1, subject_name: 1, type: 1, _id: 0 } }
            ).toArray()
        ]);

        // Combine results from all three collections
        const vivaDetailsList = [...qbankVivaList, ...dqbankVivaList, ...qstatemcqVivaList];

        if (!vivaDetailsList.length) {
            console.log(`No viva records found for user: ${userData}`);
            return [];
        }

        // Step 2: Fetch logs for each viva_uid
        const results = await Promise.all(vivaDetailsList.map(async (viva) => {
            const { viva_uid, viva_name, subject_name, type } = viva;

            // Fetch logs from 'logIn' collection for this viva_uid
            const logEntries = await db.get().collection('logIn').find({ viva_uid }).toArray();

            if (!logEntries.length) {
                return {
                    viva_uid,
                    viva_name,
                    subject_name,
                    type,
                    logs: []
                };
            }

            // Format logs: extract className and roll number range
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
                type,
                logs: formattedLogs
            };
        }));

        return results;

    } catch (error) {
        console.error("Database error:", error);
        return [];
    }
}
,
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
     
        getPc: async() => {
            try {
              const lab = await db.get().collection('pc').find({}, { projection: { labName: 1, _id: 0 } }).toArray();
              
              if (lab.length === 0) {
                return null; // No data found, return null or any default value
              }
          
              return lab;  // Return the fetched lab data
            } catch (error) {
              console.error('Error fetching data:', error);
              return null;  // Return null in case of an error
            }
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
        DeletViva: async (networkName, vivaName) => {
            try {
                const dbInstance = db.get();
                const vivaUID = parseInt(vivaName);
        
                // Delete from `qbank`
                let resultQBank = await dbInstance.collection('qbank').deleteMany({ network_name: networkName, viva_uid: vivaUID });
        
                // Delete from `dqbank`
                let resultDQBank = await dbInstance.collection('dqbank').deleteMany({ network_name: networkName, viva_uid: vivaUID });
        
                // Delete from `logIn`
                let resultLogIn = await dbInstance.collection('logIn').deleteMany({ network_name: networkName, viva_uid: vivaUID });
        
                const totalDeleted = resultQBank.deletedCount + resultDQBank.deletedCount + resultLogIn.deletedCount;
        
                if (totalDeleted > 0) {
                    return `Viva deleted successfully from ${totalDeleted} records`;
                } else {
                    throw new Error("No matching viva found in qbank, dqbank, or logIn");
                }
            } catch (error) {
                throw new Error("Error deleting viva: " + error.message);
            }
        }
        
           
    }
    
//https://chatgpt.com/share/67bb5e4f-02c0-8004-8062-ccbf9c90dbbd