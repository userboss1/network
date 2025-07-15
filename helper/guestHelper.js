var db=require('../config/connection')
var collection=require('../config/ccollection');
const bcrypt=require("bcrypt");
const { use } = require('../routes/superadmin');

module.exports={


    doResource: (userData) => {
        console.log("Received userData:", userData);
    
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure correct types for query fields
                let query = {
                  
                    roll: parseInt(userData.roll, 10),  // Convert to integer
                    register: parseInt(userData.registernumber, 10) // Convert to integer
                };
    
                // Check if conversion resulted in NaN (invalid number)
                if (isNaN(query.roll) || isNaN(query.register)) {
                    return resolve({
                        status: false,
                        message: "Invalid roll number or register number. Must be integers."
                    });
                }
                const originalLog = console.log;
                console.log = (...args) => {
                    const err = new Error();
                    const stackLine = err.stack.split("\n")[2]; // Get the caller info
                    originalLog("Logged from:", stackLine.trim(), "\nMessage:", ...args);
                };
                
                // Fetch user based on all criteria
                let user = await db.get().collection('logIn').findOne(query);
    
                console.log("Fetched User:", user); // Debugging output
    
                if (user) {
                    resolve({
                        status: true,
                        user: user, // Send the found user object
                    });
                } else {
                    resolve({
                        status: false,
                        message: "No user found with the provided details",
                    });
                }
            } catch (err) {
                console.error("Error fetching user:", err);
                reject(err);
            }
        });
    }
    
    
    
,    

getQ: (userData) => {
    return new Promise((resolve, reject) => {
        console.log("Received userData:", userData);

        // First: Try qbank
        db.get().collection('qbank')
            .find({ 
                network_name: userData.network_name, 
                viva_uid: userData.viva_uid 
            })
            .toArray()
            .then((qbankResults) => {
                if (qbankResults && qbankResults.length > 0) {
                    console.log("Fetched Questions from qbank:", qbankResults);
                    resolve({
                        source: 'qbank',
                        data: qbankResults
                    });
                } else {
                    // Second: Try dqbank
                    db.get().collection('dqbank')
                        .find({ 
                            network_name: userData.network_name, 
                            viva_uid: userData.viva_uid 
                        })
                        .toArray()
                        .then((dqbankResults) => {
                            if (dqbankResults && dqbankResults.length > 0) {
                                console.log("Fetched Questions from dqbank:", dqbankResults);
                                resolve({
                                    source: 'dqbank',
                                    data: dqbankResults
                                });
                            } else {
                                // Third: Try qstatemcq
                                db.get().collection('qstatemcq')
                                    .find({ 
                                        network_name: userData.network_name, 
                                        viva_uid: userData.viva_uid 
                                    })
                                    .toArray()
                                    .then((qstatemcqResults) => {
                                        if (qstatemcqResults && qstatemcqResults.length > 0) {
                                            console.log("Fetched Questions from qstatemcq:");
                                            resolve({
                                                source: 'qstatemcq',
                                                data: qstatemcqResults
                                            });
                                        } else {
                                            // Not found in any collection
                                            console.log("No questions found in qbank, dqbank, or qstatemcq.");
                                            resolve({
                                                source: 'none',
                                                data: []
                                            });
                                        }
                                    })
                                    .catch((error) => {
                                        console.error("Error fetching from qstatemcq:", error);
                                        reject(error);
                                    });
                            }
                        })
                        .catch((error) => {
                            console.error("Error fetching from dqbank:", error);
                            reject(error);
                        });
                }
            })
            .catch((error) => {
                console.error("Error fetching from qbank:", error);
                reject(error);
            });
    });
}


}//git add .
//git commit -m "Updated feature XYZ"
//git push origin main
//