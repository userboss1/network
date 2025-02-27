var db=require('../config/connection')
var collection=require('../config/ccollection');
const bcrypt=require("bcrypt");

module.exports={


    doResource: (userData) => {
        console.log("Received userData:", userData);
    
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure correct types for query fields
                let query = {
                    name: String(userData.name),
                    roll: parseInt(userData.roll, 10),  // Convert to integer
                    registernumber: parseInt(userData.registernumber, 10) // Convert to integer
                };
    
                // Check if conversion resulted in NaN (invalid number)
                if (isNaN(query.roll) || isNaN(query.registernumber)) {
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

getQ:()=>{

 return new Promise((resolve,reject)=>{
    db.get().collection('qbank').find().toArray().then((response)=>{
        resolve(response)
    })
 })
}
}//git add .
//git commit -m "Updated feature XYZ"
//git push origin main
//