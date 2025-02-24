var db=require('../config/connection')
var collection=require('../config/ccollection');
const bcrypt=require("bcrypt");

module.exports={


    doLogin: (userData) => {
        console.log(userData);
        
        let loginStatus = false;
        let response = {};
    return new Promise(async (resolve, reject) => {
        let user = await db.get().collection('files').findOne({ name: userData.name });
        if (user) {
            bcrypt.compare(userData.password, user.password).then((status) => {
                if (status) {
                    console.log('login successful');
                    response.user = { name: user.name, id: user._id,content:user.content };

                    response.status = true;
                    resolve(response);
                } else {
                    console.log("login failed");
                    resolve({ status: false });
                }
                
            });
        } else {
            console.log('login failed netwokr');
            resolve({ status: false });
        }
        
    });
},
LoginNet: (userData) => {
    console.log(userData);
    
    let loginStatus = false;
    let response = {};
return new Promise(async (resolve, reject) => {
    let user = await db.get().collection(collection.ADMIN_COLLLECTION).findOne({ name: userData.name });
    if (user) {
        bcrypt.compare(userData.password, user.password).then((status) => {
            if (status) {
                console.log('login successful');
                response.user = { name: user.name, id: user._id,content:user.content };

                response.status = true;
                resolve(response);
            } else {
                console.log("login failed");
                resolve({ status: false });
            }
            
        });
    } else {
        console.log('login failed netwokr');
        resolve({ status: false });
    }
    
});
},
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