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

        db.get().collection('qbank')
            .find({ network_name: userData.network_name, viva_name: userData.viva_name })
            .toArray()
            .then((response) => {
                console.log("Fetched Questions:", response);
                resolve(response);
            })
            .catch((error) => {
                console.error("Error fetching questions:", error);
                reject(error);
            });
    });
}

}//git add .
//git commit -m "Updated feature XYZ"
//git push origin main
//